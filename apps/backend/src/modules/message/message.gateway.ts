import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { MessageService } from './message.service';

interface AuthSocket extends Socket {
  userId: number;
  userType: 'company' | 'worker';
}

// ──────────────────────────────────────────────
// WebSocket 事件常量
// ──────────────────────────────────────────────
export const WS_EVENTS = {
  SEND_MESSAGE:    'send_message',
  NEW_MESSAGE:     'new_message',
  MESSAGE_READ:    'message_read',
  READ_RECEIPT:    'read_receipt',
  ERROR:           'ws_error',
  ONLINE_USERS:    'online_users',
} as const;

// Redis 频道
const REDIS_CHANNEL = 'wc:chat:broadcast';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(MessageGateway.name);

  // socketId → { userId, userType }
  private readonly onlineMap = new Map<string, { userId: number; userType: string }>();

  // userId → Set<socketId>（一人多端）
  private readonly userSocketMap = new Map<number, Set<string>>();

  // Redis subscriber 专用客户端
  private redisSub: Redis;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
    private readonly messageService: MessageService,
  ) {
    // 创建独立订阅客户端（subscriber 不能执行普通命令）
    this.redisSub = redis.duplicate();
    this.redisSub.subscribe(REDIS_CHANNEL);
    this.redisSub.on('message', (_channel, payload) => {
      this.handleRedisMessage(payload);
    });
  }

  // ── 连接：验证 JWT ────────────────────────────────────────
  async handleConnection(client: AuthSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new WsException('Missing token');

      const payload = this.jwtService.verify(token);
      client.userId   = payload.sub;
      client.userType = payload.type;   // 'company' | 'worker'

      // 加入个人房间（用于私信推送）
      const userRoom = `user:${client.userId}`;
      client.join(userRoom);

      // 记录在线状态
      this.onlineMap.set(client.id, { userId: client.userId, userType: client.userType });
      if (!this.userSocketMap.has(client.userId)) {
        this.userSocketMap.set(client.userId, new Set());
      }
      this.userSocketMap.get(client.userId)!.add(client.id);

      this.logger.log(`✅ Connected: user=${client.userId}(${client.userType}) socket=${client.id}`);
    } catch (err) {
      this.logger.warn(`❌ Auth failed for socket ${client.id}: ${err.message}`);
      client.emit(WS_EVENTS.ERROR, { code: 401, message: 'Unauthorized' });
      client.disconnect();
    }
  }

  // ── 断开：清理状态 ────────────────────────────────────────
  handleDisconnect(client: AuthSocket) {
    const info = this.onlineMap.get(client.id);
    if (info) {
      this.onlineMap.delete(client.id);
      const sockets = this.userSocketMap.get(info.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSocketMap.delete(info.userId);
      }
    }
    this.logger.log(`🔌 Disconnected: socket=${client.id}`);
  }

  // ── 发送消息 ─────────────────────────────────────────────
  @SubscribeMessage(WS_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: {
      conversationId: number;
      type?: 'text' | 'image' | 'file';
      content: string;
      fileName?: string;
      fileSize?: number;
    },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const { conversationId, type = 'text', content, fileName, fileSize } = dto;

    // 1. 鉴权：确认用户属于该会话
    const conversation = await this.messageService.getConversationById(conversationId);
    if (!conversation) throw new WsException('Conversation not found');

    const allowed =
      (client.userType === 'company' && Number(conversation.companyUserId) === client.userId) ||
      (client.userType === 'worker'  && Number(conversation.workerId)       === client.userId);
    if (!allowed) throw new WsException('Forbidden');

    // 2. 持久化到 MongoDB
    const saved = await this.messageService.saveMessage({
      conversationId,
      senderId: client.userId,
      senderType: client.userType,
      type,
      content,
      fileName: fileName ?? null,
      fileSize: fileSize ?? null,
    });

    // 3. 更新会话最后消息时间
    await this.messageService.updateLastMsgAt(conversationId);

    // 4. 通过 Redis Pub/Sub 广播（支持多实例）
    const payload = JSON.stringify({
      event:          WS_EVENTS.NEW_MESSAGE,
      conversationId,
      message: {
        id:           saved._id,
        conversationId,
        senderId:     client.userId,
        senderType:   client.userType,
        type,
        content,
        fileName:     fileName ?? null,
        fileSize:     fileSize ?? null,
        createdAt:    saved.createdAt,
      },
      targetUserIds: [
        Number(conversation.companyUserId),
        Number(conversation.workerId),
      ],
    });
    await this.redis.publish(REDIS_CHANNEL, payload);

    return { success: true, messageId: String(saved._id) };
  }

  // ── 已读回执 ─────────────────────────────────────────────
  @SubscribeMessage(WS_EVENTS.MESSAGE_READ)
  async handleMessageRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: { conversationId: number; messageIds: string[] },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const { conversationId, messageIds } = dto;
    await this.messageService.markAsRead(messageIds, client.userId);

    // 通知对方已读
    const conversation = await this.messageService.getConversationById(conversationId);
    if (conversation) {
      const otherId =
        client.userType === 'company'
          ? Number(conversation.workerId)
          : Number(conversation.companyUserId);

      this.sendToUser(otherId, WS_EVENTS.READ_RECEIPT, { conversationId, messageIds, readBy: client.userId });
    }

    return { success: true };
  }

  // ── Redis Pub/Sub 消费 ────────────────────────────────────
  private handleRedisMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      const { event, message, targetUserIds } = data;

      // 推送给所有目标用户（含多端）
      (targetUserIds as number[]).forEach((uid) => {
        this.sendToUser(uid, event, message);
      });
    } catch (e) {
      this.logger.error('Redis message parse error', e);
    }
  }

  // ── 工具：向指定用户所有 socket 推送 ────────────────────
  sendToUser(userId: number, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // ── 工具：向 Room 广播（供外部 Service 调用） ────────────
  broadcastToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  // ── 在线用户数（运维/调试用） ────────────────────────────
  getOnlineCount(): number {
    return this.userSocketMap.size;
  }
}
