import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma';
import { Message, MessageDocument } from './schemas/message.schema';

const CHAT_BROADCAST_CHANNEL = 'wc:chat:broadcast';

// ─────────────────────────────────────────────
// DTOs（内部使用）
// ─────────────────────────────────────────────
export interface SaveMessageDto {
  conversationId: number;
  senderId: number;
  senderType: 'company' | 'worker';
  type: 'text' | 'image' | 'file';
  content: string;
  fileName: string | null;
  fileSize: number | null;
}

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ──────────────────────────────────────────
  // 会话管理
  // ──────────────────────────────────────────

  /**
   * 获取或创建会话（taskId + companyUserId + workerId 唯一）
   */
  async getOrCreateConversation(taskId: bigint, companyUserId: bigint, workerId: bigint) {
    return this.prisma.conversation.upsert({
      where: {
        taskId_companyUserId_workerId: { taskId, companyUserId, workerId },
      },
      create: { taskId, companyUserId, workerId },
      update: {},
    });
  }

  /** 按 ID 查询会话 */
  async getConversationById(id: number) {
    return this.prisma.conversation.findUnique({
      where: { id: BigInt(id) },
    });
  }

  /**
   * 用户会话列表（含最后一条消息 + 未读数）
   * GET /conversations
   */
  async listConversations(
    userId: number,
    userType: 'company' | 'worker',
    page = 1,
    pageSize = 20,
  ) {
    const skip = (page - 1) * pageSize;

    // 查询与用户相关的所有会话
    const where =
      userType === 'company'
        ? { companyUserId: BigInt(userId) }
        : { workerId: BigInt(userId) };

    const [total, conversations] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMsgAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    // 批量从 MongoDB 拉取每个会话的最后一条消息 + 未读数
    const convIds = conversations.map((c) => Number(c.id));
    const [lastMsgs, unreadCounts] = await Promise.all([
      this.getLastMessages(convIds),
      this.getUnreadCounts(convIds, userId),
    ]);

    const list = conversations.map((conv) => ({
      id:             Number(conv.id),
      taskId:         Number(conv.taskId),
      companyUserId:  Number(conv.companyUserId),
      workerId:       Number(conv.workerId),
      lastMsgAt:      conv.lastMsgAt,
      lastMessage:    lastMsgs.get(Number(conv.id)) ?? null,
      unreadCount:    unreadCounts.get(Number(conv.id)) ?? 0,
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 历史消息（分页，倒序）
   * GET /conversations/:id/messages
   */
  async listMessages(
    conversationId: number,
    userId: number,
    userType: 'company' | 'worker',
    page = 1,
    pageSize = 30,
  ) {
    // 验证权限
    const conv = await this.getConversationById(conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');

    const allowed =
      (userType === 'company' && Number(conv.companyUserId) === userId) ||
      (userType === 'worker'  && Number(conv.workerId)       === userId);
    if (!allowed) throw new ForbiddenException();

    const skip = (page - 1) * pageSize;
    const [total, messages] = await Promise.all([
      this.messageModel.countDocuments({ conversationId }),
      this.messageModel
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    // 自动标记为已读
    const unreadIds = messages
      .filter((m) => !m.readBy.includes(userId))
      .map((m) => String(m._id));
    if (unreadIds.length) {
      await this.markAsRead(unreadIds, userId);
    }

    return {
      list: messages.map(this.formatMessage),
      total,
      page,
      pageSize,
    };
  }

  // ──────────────────────────────────────────
  // 消息存储
  // ──────────────────────────────────────────

  async saveMessage(dto: SaveMessageDto): Promise<MessageDocument> {
    const msg = new this.messageModel({
      ...dto,
      readBy: [dto.senderId],
      createdAt: new Date(),
    });
    return msg.save();
  }

  /**
   * 统一发消息入口（HTTP / WS 共用）
   * 1. 权限校验
   * 2. 持久化到 MongoDB
   * 3. 更新 conversation.lastMsgAt
   * 4. （可选）Redis publish，如果对方 WS 连着就能实时收到
   */
  async sendMessage(
    conversationId: number,
    senderId: number,
    senderType: 'company' | 'worker',
    dto: { content: string; type: 'text' | 'image' | 'file'; fileName: string | null; fileSize: number | null },
  ) {
    const conv = await this.getConversationById(conversationId);
    if (!conv) throw new NotFoundException('会话不存在');

    const allowed =
      (senderType === 'company' && Number(conv.companyUserId) === senderId) ||
      (senderType === 'worker'  && Number(conv.workerId)       === senderId);
    if (!allowed) throw new ForbiddenException('无权操作该会话');

    const saved = await this.saveMessage({
      conversationId,
      senderId,
      senderType,
      type: dto.type,
      content: dto.content,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
    });
    await this.updateLastMsgAt(conversationId);

    const msgOut = {
      id:             String(saved._id),
      conversationId,
      senderId,
      senderType,
      type:           dto.type,
      content:        dto.content,
      fileName:       dto.fileName,
      fileSize:       dto.fileSize,
      createdAt:      saved.createdAt,
    };

    // 除非 Redis 不可用，否则推流给在线订阅者（可选增强，不阻塞主流程）
    try {
      await this.redis.publish(CHAT_BROADCAST_CHANNEL, JSON.stringify({
        event: 'new_message',
        conversationId,
        message: msgOut,
        targetUserIds: [Number(conv.companyUserId), Number(conv.workerId)],
      }));
    } catch {
      // 无 Redis 也不影响 HTTP 发送成功
    }

    return msgOut;
  }

  async updateLastMsgAt(conversationId: number) {
    await this.prisma.conversation.update({
      where: { id: BigInt(conversationId) },
      data:  { lastMsgAt: new Date() },
    });
  }

  async markAsRead(messageIds: string[], userId: number) {
    await this.messageModel.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: userId } },
    );
  }

  // ──────────────────────────────────────────
  // 辅助方法
  // ──────────────────────────────────────────

  private async getLastMessages(convIds: number[]): Promise<Map<number, unknown>> {
    // 每个会话取最后一条
    const docs = await this.messageModel
      .aggregate([
        { $match: { conversationId: { $in: convIds } } },
        { $sort:  { conversationId: 1, createdAt: -1 } },
        { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } },
      ])
      .exec();

    return new Map(docs.map((d) => [d._id as number, this.formatMessage(d.doc)]));
  }

  private async getUnreadCounts(convIds: number[], userId: number): Promise<Map<number, number>> {
    const docs = await this.messageModel
      .aggregate([
        {
          $match: {
            conversationId: { $in: convIds },
            readBy: { $not: { $elemMatch: { $eq: userId } } },
          },
        },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(docs.map((d) => [d._id as number, d.count as number]));
  }

  private formatMessage(m: any) {
    return {
      id:             String(m._id),
      conversationId: m.conversationId,
      senderId:       m.senderId,
      senderType:     m.senderType,
      type:           m.type,
      content:        m.content,
      fileName:       m.fileName,
      fileSize:       m.fileSize,
      readBy:         m.readBy,
      createdAt:      m.createdAt,
    };
  }
}
