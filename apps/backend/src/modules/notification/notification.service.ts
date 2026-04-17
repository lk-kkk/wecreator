import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { NotificationType, UserType } from '@prisma/client';
import { MessageGateway } from '../message/message.gateway';

export interface CreateNotificationDto {
  userId:    bigint;
  userType:  UserType;
  type:      NotificationType;
  title:     string;
  content:   string;
  relatedId?: bigint;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  // ──────────────────────────────────────────
  // 创建通知（内部调用，由业务事件触发）
  // ──────────────────────────────────────────
  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId:    dto.userId,
        userType:  dto.userType,
        type:      dto.type,
        title:     dto.title,
        content:   dto.content,
        relatedId: dto.relatedId ?? null,
      },
    });

    // 通过 WebSocket 实时推送未读数变化
    const unreadCount = await this.getUnreadCount(Number(dto.userId), dto.userType);
    this.messageGateway.sendToUser(Number(dto.userId), 'notification_count', {
      unreadCount,
    });

    return notification;
  }

  // ──────────────────────────────────────────
  // 通知列表（分页，未读优先）
  // GET /notifications
  // ──────────────────────────────────────────
  async list(
    userId:   number,
    userType: UserType,
    page     = 1,
    pageSize = 20,
  ) {
    const skip = (page - 1) * pageSize;
    const where = { userId: BigInt(userId), userType };

    const [total, list] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      list: list.map((n) => ({ ...n, id: Number(n.id), userId: Number(n.userId), relatedId: n.relatedId ? Number(n.relatedId) : null })),
      total,
      page,
      pageSize,
    };
  }

  // ──────────────────────────────────────────
  // 标记单条已读
  // PUT /notifications/:id/read
  // ──────────────────────────────────────────
  async markOneRead(id: number, userId: number, userType: UserType) {
    await this.prisma.notification.updateMany({
      where: { id: BigInt(id), userId: BigInt(userId), userType },
      data:  { isRead: true },
    });
    return { success: true };
  }

  // ──────────────────────────────────────────
  // 全部已读
  // PUT /notifications/read-all
  // ──────────────────────────────────────────
  async markAllRead(userId: number, userType: UserType) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: BigInt(userId), userType, isRead: false },
      data:  { isRead: true },
    });
    return { updated: count };
  }

  // ──────────────────────────────────────────
  // 未读计数
  // GET /notifications/unread-count
  // ──────────────────────────────────────────
  async getUnreadCount(userId: number, userType: UserType): Promise<number> {
    return this.prisma.notification.count({
      where: { userId: BigInt(userId), userType, isRead: false },
    });
  }
}
