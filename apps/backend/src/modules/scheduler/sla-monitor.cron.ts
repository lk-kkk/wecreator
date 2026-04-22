/**
 * V3.7 Step 5.2 — 问题 SLA 监控
 * 每 15 分钟扫描 TaskIssue：
 *   - status='open' AND firstResponseAt IS NULL AND createdAt < NOW()-24h AND slaBreached=false
 *   → 置 slaBreached=true，通知 task.createdBy
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';

@Injectable()
export class SlaMonitorCron {
  private readonly logger = new Logger(SlaMonitorCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  @Cron('*/15 * * * *', { name: 'v3.7_sla_monitor' })
  async runScheduled() {
    await this.runOnce();
  }

  async runOnce() {
    const threshold24h = new Date(Date.now() - 24 * 3600_000);

    const breached = await this.prisma.taskIssue.findMany({
      where: {
        status: 'open',
        firstResponseAt: null,
        createdAt: { lt: threshold24h },
        slaBreached: false,
      },
      select: {
        id: true, taskId: true, title: true,
        task: { select: { title: true, createdBy: true, companyId: true } },
      },
    });

    for (const i of breached) {
      await this.prisma.taskIssue.update({
        where: { id: i.id },
        data: { slaBreached: true },
      });

      if (i.task?.companyId && i.task?.createdBy) {
        await this.notify.create({
          companyId: Number(i.task.companyId),
          userId: Number(i.task.createdBy),
          type: 'risk_alert',
          title: `问题 SLA 超时：${i.title}`,
          content: `任务「${i.task.title}」的问题「${i.title}」已超过 24 小时未响应`,
          refType: 'task',
          refId: Number(i.taskId),
        });
      }
    }

    this.logger.log(`sla-monitor runOnce: breached=${breached.length}`);
    return { breached: breached.length };
  }
}
