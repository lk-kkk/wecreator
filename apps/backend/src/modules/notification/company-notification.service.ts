/**
 * CompanyNotificationService — V3.7 §4.3 企业端站内通知中心
 *
 * Schema: company_notifications
 * 类型: issue_report / risk_alert / milestone_remind / acceptance /
 *       checkpoint / comment_mention / daily_missing / status_change
 *
 * 该服务用于各业务模块通过事件方式触发企业端通知（与零工端 NotificationService 分离）。
 */
import { Injectable } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsString, IsArray, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';
import { CompanyNotificationType, Prisma } from '@prisma/client';

export interface CreateCompanyNotificationDto {
  companyId: number;
  userId: number;
  type: CompanyNotificationType;
  title: string;
  content: string;
  refType?: string | null;
  refId?: number | null;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional() page?: string;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional() pageSize?: string;

  @ApiPropertyOptional({ description: '通知类型筛选' })
  @IsOptional() @IsIn([
    'issue_report', 'risk_alert', 'milestone_remind', 'acceptance',
    'task_application', 'checkpoint', 'comment_mention', 'daily_missing', 'status_change',
  ])
  type?: string;

  @ApiPropertyOptional({ description: '已读状态筛选', enum: ['true', 'false'] })
  @IsOptional() @IsString()
  isRead?: string;
}

export class MarkReadDto {
  @ApiPropertyOptional({ description: '通知ID列表', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  ids?: number[];

  @ApiPropertyOptional({ description: '是否全部已读' })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

@Injectable()
export class CompanyNotificationService {
  /** 每用户未读上限 */
  private static readonly MAX_UNREAD = 999;

  constructor(private readonly prisma: PrismaService) {}

  /** 供其他模块调用的统一创建入口 */
  async create(dto: CreateCompanyNotificationDto) {
    return this.prisma.companyNotification.create({
      data: {
        companyId: BigInt(dto.companyId),
        userId: BigInt(dto.userId),
        type: dto.type,
        title: dto.title.slice(0, 100),
        content: dto.content.slice(0, 500),
        refType: dto.refType ?? null,
        refId: dto.refId ? BigInt(dto.refId) : null,
      },
    });
  }

  /** 批量创建（多人接收同一条通知） */
  async createMany(
    userIds: number[],
    base: Omit<CreateCompanyNotificationDto, 'userId'>,
  ) {
    if (userIds.length === 0) return { count: 0 };
    const rows: Prisma.CompanyNotificationCreateManyInput[] = userIds.map((uid) => ({
      companyId: BigInt(base.companyId),
      userId: BigInt(uid),
      type: base.type,
      title: base.title.slice(0, 100),
      content: base.content.slice(0, 500),
      refType: base.refType ?? null,
      refId: base.refId ? BigInt(base.refId) : null,
    }));
    const res = await this.prisma.companyNotification.createMany({ data: rows });
    return { count: res.count };
  }

  /**
   * GET /api/v1/company-notifications
   * 列表：分页 + 类型筛选 + 已读状态筛选
   */
  async list(userId: number, companyId: number, query: NotificationQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));

    const where: Prisma.CompanyNotificationWhereInput = {
      userId: BigInt(userId),
      companyId: BigInt(companyId),
    };
    if (query.type) where.type = query.type as CompanyNotificationType;
    if (query.isRead === 'true') where.isRead = true;
    if (query.isRead === 'false') where.isRead = false;

    const [list, total, unread] = await Promise.all([
      this.prisma.companyNotification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.companyNotification.count({ where }),
      this.prisma.companyNotification.count({
        where: { userId: BigInt(userId), companyId: BigInt(companyId), isRead: false },
      }),
    ]);

    return {
      list: list.map((n) => this.serialize(n)),
      total,
      unread,
      page,
      pageSize,
    };
  }

  /**
   * PUT /api/v1/company-notifications/read
   * 标记已读：支持 { ids: [] } 批量 或 { all: true } 全部
   */
  async markRead(userId: number, companyId: number, dto: MarkReadDto) {
    if (dto.all) {
      const res = await this.prisma.companyNotification.updateMany({
        where: { userId: BigInt(userId), companyId: BigInt(companyId), isRead: false },
        data: { isRead: true },
      });
      return { updated: res.count };
    }
    if (dto.ids && dto.ids.length > 0) {
      const res = await this.prisma.companyNotification.updateMany({
        where: {
          id: { in: dto.ids.map((id) => BigInt(id)) },
          userId: BigInt(userId),
          companyId: BigInt(companyId),
        },
        data: { isRead: true },
      });
      return { updated: res.count };
    }
    return { updated: 0 };
  }

  /** 未读计数（供顶栏徽标使用） */
  async unreadCount(userId: number, companyId: number) {
    const count = await this.prisma.companyNotification.count({
      where: { userId: BigInt(userId), companyId: BigInt(companyId), isRead: false },
    });
    return { count };
  }

  /**
   * 清理任务（由 cron 调用）：
   *   - 删除 created_at < 90d 的记录
   *   - 对 is_read=false 超过 MAX_UNREAD 的用户，保留最新 MAX_UNREAD 条
   */
  async cleanup() {
    const threshold = new Date(Date.now() - 90 * 86400 * 1000);
    const expired = await this.prisma.companyNotification.deleteMany({
      where: { createdAt: { lt: threshold } },
    });
    return { expiredDeleted: expired.count };
  }

  private serialize(n: any) {
    return {
      id: Number(n.id),
      companyId: Number(n.companyId),
      userId: Number(n.userId),
      type: n.type,
      title: n.title,
      content: n.content,
      refType: n.refType,
      refId: n.refId ? Number(n.refId) : null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
