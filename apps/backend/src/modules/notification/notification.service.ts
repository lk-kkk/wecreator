/**
 * NotificationService — 通知中心
 *
 * Schema V2 字段变更:
 *  - userId    → recipientId
 *  - userType  → recipientType
 *  - relatedId → relatedTaskId
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { NotificationType, UserType } from '@prisma/client';
import { MessageGateway } from '../message/message.gateway';

export interface CreateNotificationDto {
  recipientId:   bigint;
  recipientType: UserType;
  type:          NotificationType;
  title:         string;
  content:       string;
  relatedTaskId?: bigint;
  templateCode?: string;
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
        recipientId:   dto.recipientId,
        recipientType: dto.recipientType,
        type:          dto.type,
        title:         dto.title,
        content:       dto.content,
        relatedTaskId: dto.relatedTaskId ?? null,
        templateCode:  dto.templateCode ?? null,
      },
    });

    // 通过 WebSocket 实时推送未读数变化
    const unreadCount = await this.getUnreadCount(
      Number(dto.recipientId),
      dto.recipientType,
    );
    this.messageGateway.sendToUser(
      Number(dto.recipientId),
      'notification_count',
      { unreadCount },
    );

    return notification;
  }

  // ──────────────────────────────────────────
  // 通知列表（分页，未读优先）
  // GET /notifications
  // ──────────────────────────────────────────
  async list(
    userId: number,
    userType: UserType,
    page = 1,
    pageSize = 20,
  ) {
    const skip = (page - 1) * pageSize;
    const where = { recipientId: BigInt(userId), recipientType: userType };

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
      list: list.map((n) => ({
        ...n,
        id: Number(n.id),
        recipientId: Number(n.recipientId),
        relatedTaskId: n.relatedTaskId ? Number(n.relatedTaskId) : null,
      })),
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
      where: { id: BigInt(id), recipientId: BigInt(userId), recipientType: userType },
      data: { isRead: true },
    });
    return { success: true };
  }

  // ──────────────────────────────────────────
  // 全部已读
  // PUT /notifications/read-all
  // ──────────────────────────────────────────
  async markAllRead(userId: number, userType: UserType) {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        recipientId: BigInt(userId),
        recipientType: userType,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { updated: count };
  }

  // ──────────────────────────────────────────
  // 未读计数
  // GET /notifications/unread-count
  // ──────────────────────────────────────────
  async getUnreadCount(userId: number, userType: UserType): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientId: BigInt(userId),
        recipientType: userType,
        isRead: false,
      },
    });
  }
}
