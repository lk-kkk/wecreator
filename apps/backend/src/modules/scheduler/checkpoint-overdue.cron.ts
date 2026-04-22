/**
 * V3.7 Step 5.3 — 检查点逾期扫描
 * 每天 00:30：将 plannedDate < TODAY 且 status='pending' 的检查点置为 overdue
 * 通知：检查点 reviewer（企业用户）
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';

@Injectable()
export class CheckpointOverdueCron {
  private readonly logger = new Logger(CheckpointOverdueCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  @Cron('30 0 * * *', { name: 'v3.7_checkpoint_overdue' })
  async runScheduled() {
    await this.runOnce();
  }

  async runOnce() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueList = await this.prisma.taskCheckpoint.findMany({
      where: {
        status: 'pending',
        plannedDate: { lt: today },
      },
      select: {
        id: true, taskId: true, name: true, reviewerId: true,
        task: { select: { title: true, companyId: true, createdBy: true } },
      },
    });

    for (const cp of overdueList) {
      await this.prisma.taskCheckpoint.update({
        where: { id: cp.id },
        data: { status: 'overdue' as any },
      });

      // 通知 reviewer（或退回给 createdBy）
      const notifyUserId = cp.reviewerId ?? cp.task?.createdBy;
      if (cp.task?.companyId && notifyUserId) {
        await this.notify.create({
          companyId: Number(cp.task.companyId),
          userId: Number(notifyUserId),
          type: 'checkpoint',
          title: `检查点已逾期：${cp.name}`,
          content: `任务「${cp.task.title}」的检查点「${cp.name}」已超过计划日期`,
          refType: 'task',
          refId: Number(cp.taskId),
        });
      }
    }

    this.logger.log(`checkpoint-overdue runOnce: overdue=${overdueList.length}`);
    return { overdue: overdueList.length };
  }
}
