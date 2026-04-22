/**
 * V3.7 Step 5.4 — 日报缺失扫描
 * 每天 09:00：检查进行中任务，若零工连续 3 个自然日未提交 progress_updates
 * → 通知零工（写 company_notification type='daily_missing'）
 * → 通知任务发起人（企业 PM）
 *
 * 简化版：连续 3 天 ≈ 3*24h；不排除周末（实际业务按自然日即可）
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';

@Injectable()
export class DailyMissingCron {
  private readonly logger = new Logger(DailyMissingCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  @Cron('0 9 * * *', { name: 'v3.7_daily_missing' })
  async runScheduled() {
    await this.runOnce();
  }

  async runOnce() {
    const threshold = new Date(Date.now() - 3 * 86400_000);

    // 进行中任务下 accepted 且进度未到 100% 的 assignment
    const activeAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        status: 'accepted',
        progress: { lt: 100 },
        taskRole: { task: { status: 'in_progress' } },
      },
      select: {
        id: true, workerId: true,
        taskRole: {
          select: {
            task: { select: { id: true, title: true, companyId: true, createdBy: true } },
          },
        },
      },
    });

    // 获取这些 assignment 的最近一次 progressUpdate
    const ids = activeAssignments.map((a) => a.id);
    if (ids.length === 0) {
      this.logger.log('daily-missing runOnce: no active assignments');
      return { missing: 0 };
    }

    const recentUpdates = await this.prisma.progressUpdate.groupBy({
      by: ['assignmentId'],
      where: { assignmentId: { in: ids } },
      _max: { createdAt: true },
    });
    const latestMap = new Map<string, Date | null>();
    for (const r of recentUpdates) {
      latestMap.set(String(r.assignmentId), (r._max as any).createdAt);
    }

    const missingByTask = new Map<string, { task: any; workerIds: Set<number> }>();

    for (const a of activeAssignments) {
      const last = latestMap.get(String(a.id));
      if (last && last > threshold) continue; // 最近 3 天有更新

      const task = a.taskRole?.task;
      if (!task) continue;
      const key = String(task.id);
      if (!missingByTask.has(key)) missingByTask.set(key, { task, workerIds: new Set() });
      missingByTask.get(key)!.workerIds.add(Number(a.workerId));
    }

    let notified = 0;
    for (const { task, workerIds } of missingByTask.values()) {
      // 通知 PM
      if (task.companyId && task.createdBy) {
        await this.notify.create({
          companyId: Number(task.companyId),
          userId: Number(task.createdBy),
          type: 'daily_missing',
          title: `日报缺失提醒：${task.title}`,
          content: `任务「${task.title}」有 ${workerIds.size} 名零工连续 3 天未提交日报`,
          refType: 'task',
          refId: Number(task.id),
        });
        notified++;
      }
      // TODO: 通知零工侧需走微信订阅消息（本 Phase 不实现）
    }

    this.logger.log(`daily-missing runOnce: tasksNotified=${notified}`);
    return { missing: notified };
  }
}
