/**
 * V3.7 Step 5.1 — 风险等级计算 Cron
 * 每小时触发：对进行中的任务/项目重新计算 riskLevel（red/yellow/green）
 *  - days_to_deadline <= 2 && progress < 80%  → red
 *  - days_to_deadline <= 5 && progress < 70%  → yellow
 *  - else                                     → green
 *
 * 等级变化时写入 company_notification('risk_alert')，供前端轮询展示。
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';
import { AnalyticsService } from '../analytics/analytics.service';

type Level = 'green' | 'yellow' | 'red';

@Injectable()
export class RiskLevelCron {
  private readonly logger = new Logger(RiskLevelCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
    private readonly analytics: AnalyticsService,
  ) {}

  private computeLevel(daysLeft: number, progress: number): Level {
    if (daysLeft <= 2 && progress < 80) return 'red';
    if (daysLeft <= 5 && progress < 70) return 'yellow';
    return 'green';
  }

  private daysBetween(future: Date, now: Date = new Date()) {
    const diff = future.getTime() - now.getTime();
    return Math.floor(diff / 86400_000);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'v3.7_risk_level' })
  async runScheduled() {
    await this.runOnce();
  }

  /** 供测试直接调用 */
  async runOnce() {
    const stats = { taskChecked: 0, taskChanged: 0, projectChecked: 0, projectChanged: 0 };

    // ========= 任务层面 =========
    const tasks = await this.prisma.task.findMany({
      where: { status: 'in_progress', endDate: { not: null } },
      select: {
        id: true, title: true, endDate: true, riskLevel: true,
        createdBy: true, companyId: true,
        taskRoles: {
          select: {
            assignments: { select: { progress: true, status: true } },
          },
        },
      },
    });

    for (const t of tasks) {
      stats.taskChecked++;
      if (!t.endDate) continue;
      const daysLeft = this.daysBetween(t.endDate);

      // 平均进度（仅 accepted / completed）
      const progs = t.taskRoles.flatMap((r) =>
        r.assignments.filter((a) => ['accepted', 'completed'].includes(a.status)).map((a) => a.progress),
      );
      const avgProgress = progs.length > 0 ? Math.round(progs.reduce((a, b) => a + b, 0) / progs.length) : 0;

      const nextLevel = this.computeLevel(daysLeft, avgProgress);
      if (nextLevel === t.riskLevel) continue;

      stats.taskChanged++;
      await this.prisma.task.update({
        where: { id: t.id },
        data: { riskLevel: nextLevel as any },
      });
      await this.analytics.track({
        event: 'risk_level_change', actorType: 'system',
        companyId: Number(t.companyId),
        refType: 'task', refId: Number(t.id),
        props: { from: t.riskLevel, to: nextLevel, daysLeft, avgProgress },
      });

      if ((nextLevel === 'red' || nextLevel === 'yellow') && t.companyId && t.createdBy) {
        await this.notify.create({
          companyId: Number(t.companyId),
          userId: Number(t.createdBy),
          type: 'risk_alert',
          title: `任务风险升级：${t.title}`,
          content: `任务「${t.title}」风险等级已变更为 ${nextLevel.toUpperCase()}（剩余 ${daysLeft} 天 / 进度 ${avgProgress}%）`,
          refType: 'task',
          refId: Number(t.id),
        });
      }
    }

    // ========= 项目层面 =========
    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: ['planning', 'active'] as any },
        expectedDeliveryDate: { not: null },
      },
      select: {
        id: true, name: true, expectedDeliveryDate: true, riskLevel: true,
        managerId: true, companyId: true,
      },
    });

    for (const p of projects) {
      stats.projectChecked++;
      if (!p.expectedDeliveryDate) continue;
      const daysLeft = this.daysBetween(p.expectedDeliveryDate);

      // 项目进度 = 关联任务 roleAssignment 平均
      const agg = await this.prisma.task.findMany({
        where: { projectId: p.id },
        select: {
          taskRoles: { select: { assignments: { select: { progress: true, status: true } } } },
        },
      });
      const progs = agg.flatMap((t) =>
        t.taskRoles.flatMap((r) =>
          r.assignments.filter((a) => ['accepted', 'completed'].includes(a.status)).map((a) => a.progress),
        ),
      );
      const avgProgress = progs.length > 0 ? Math.round(progs.reduce((a, b) => a + b, 0) / progs.length) : 0;

      const nextLevel = this.computeLevel(daysLeft, avgProgress);
      if (nextLevel === p.riskLevel) continue;

      stats.projectChanged++;
      await this.prisma.project.update({
        where: { id: p.id },
        data: { riskLevel: nextLevel as any },
      });
      await this.analytics.track({
        event: 'risk_level_change', actorType: 'system',
        companyId: Number(p.companyId),
        refType: 'project', refId: Number(p.id),
        props: { from: p.riskLevel, to: nextLevel, daysLeft, avgProgress },
      });

      if ((nextLevel === 'red' || nextLevel === 'yellow') && p.managerId) {
        await this.notify.create({
          companyId: Number(p.companyId),
          userId: Number(p.managerId),
          type: 'risk_alert',
          title: `项目风险升级：${p.name}`,
          content: `项目「${p.name}」风险等级已变更为 ${nextLevel.toUpperCase()}（剩余 ${daysLeft} 天 / 进度 ${avgProgress}%）`,
          refType: 'project',
          refId: Number(p.id),
        });
      }
    }

    this.logger.log(`risk-level runOnce: ${JSON.stringify(stats)}`);
    return stats;
  }
}
