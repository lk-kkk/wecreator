/**
 * V3.7 Step 5.5 — 里程碑到期扫描
 * 每天 00:30：
 *   - plannedDate < NOW AND status='pending'  → status='overdue' + 红色通知
 *   - plannedDate - NOW in (0, 3d] AND status='pending' AND !reminderSent → T-3 提醒
 *
 * 注：Milestone 表无 reminderSent 字段，此处用 company_notification 查重（同一 milestone + type）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyNotificationService } from '../notification/company-notification.service';

@Injectable()
export class MilestoneRemindCron {
  private readonly logger = new Logger(MilestoneRemindCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  @Cron('30 0 * * *', { name: 'v3.7_milestone_remind' })
  async runScheduled() {
    await this.runOnce();
  }

  async runOnce() {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 86400_000);

    const pending = await this.prisma.milestone.findMany({
      where: { status: 'pending' as any },
      select: {
        id: true, name: true, plannedDate: true, projectId: true,
        project: { select: { name: true, managerId: true, companyId: true } },
      },
    });

    let overdueCount = 0;
    let remindedCount = 0;

    for (const m of pending) {
      if (!m.plannedDate || !m.project?.managerId || !m.project?.companyId) continue;
      const companyId = Number(m.project.companyId);
      const managerId = Number(m.project.managerId);

      if (m.plannedDate < now) {
        await this.prisma.milestone.update({
          where: { id: m.id },
          data: { status: 'overdue' as any },
        });
        await this.notify.create({
          companyId, userId: managerId, type: 'milestone_remind',
          title: `里程碑已逾期：${m.name}`,
          content: `项目「${m.project.name}」的里程碑「${m.name}」已超过计划日期`,
          refType: 'project', refId: Number(m.projectId),
        });
        overdueCount++;
      } else if (m.plannedDate <= in3Days) {
        // T-3 提醒：用 company_notification 查重（相同 milestone + type 24h 内只发一次）
        const recent = await this.prisma.companyNotification.findFirst({
          where: {
            userId: BigInt(managerId),
            type: 'milestone_remind',
            refType: 'milestone',
            refId: BigInt(m.id),
            createdAt: { gt: new Date(now.getTime() - 24 * 3600_000) },
          },
          select: { id: true },
        });
        if (recent) continue;

        await this.notify.create({
          companyId, userId: managerId, type: 'milestone_remind',
          title: `里程碑即将到期：${m.name}`,
          content: `项目「${m.project.name}」的里程碑「${m.name}」将在 ${Math.ceil((m.plannedDate.getTime() - now.getTime()) / 86400_000)} 天后到期`,
          refType: 'milestone', refId: Number(m.id),
        });
        remindedCount++;
      }
    }

    this.logger.log(`milestone-remind runOnce: overdue=${overdueCount} reminded=${remindedCount}`);
    return { overdue: overdueCount, reminded: remindedCount };
  }
}
