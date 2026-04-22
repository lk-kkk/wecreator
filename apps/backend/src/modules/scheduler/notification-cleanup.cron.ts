/**
 * V3.7 Step 5.6 — 通知清理
 * 每天 02:00：
 *   - 删除 created_at < NOW()-90d 的通知
 *   - 对 is_read=false 超过 MAX_UNREAD=999 的用户，保留最新 999 条（其余删除）
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';

const MAX_UNREAD = 999;

@Injectable()
export class NotificationCleanupCron {
  private readonly logger = new Logger(NotificationCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  @Cron('0 2 * * *', { name: 'v3.7_notification_cleanup' })
  async runScheduled() {
    await this.runOnce();
  }

  async runOnce() {
    // 1) 90 天外统一删除
    const { expiredDeleted } = await this.notify.cleanup();

    // 2) 单用户未读 > 999 → 保留最新 999 条
    const hotUsers = await this.prisma.companyNotification.groupBy({
      by: ['userId'],
      where: { isRead: false },
      _count: { _all: true },
      having: { userId: { _count: { gt: MAX_UNREAD } } },
    });

    let trimmed = 0;
    for (const u of hotUsers) {
      // 找到第 MAX_UNREAD+1 条的 createdAt，删除这以及更早的
      const boundary = await this.prisma.companyNotification.findMany({
        where: { userId: u.userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        skip: MAX_UNREAD,
        take: 1,
        select: { createdAt: true },
      });
      if (boundary.length === 0) continue;

      const res = await this.prisma.companyNotification.deleteMany({
        where: {
          userId: u.userId,
          isRead: false,
          createdAt: { lte: boundary[0].createdAt },
        },
      });
      trimmed += res.count;
    }

    this.logger.log(
      `notification-cleanup runOnce: expired=${expiredDeleted} trimmed=${trimmed} hotUsers=${hotUsers.length}`,
    );
    return { expiredDeleted, trimmed, hotUsers: hotUsers.length };
  }
}
