import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma';

/**
 * 人天模式 · 按周结算（4种场景）
 *
 * 场景 A: 正常周结 — 周日 23:59 自动触发，结算本周已确认工时
 * 场景 B: 任务提前结束 — 任务状态变为 completed 时立即触发
 * 场景 C: 争议仲裁后结算 — DisputeService 调用
 * 场景 D: 超期未确认自动结算 — T+1 auto_confirmed 视为正常出勤
 */
@Injectable()
export class WeeklySettlementService {
  private readonly logger = new Logger(WeeklySettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // S2-003: 每周日 23:00 自动结算
  // ================================================================
  @Cron('0 23 * * 0', { name: 'weekly_settlement' })
  async weeklySettle() {
    this.logger.log('每周结算 Cron 触发');

    // 获取所有 in_progress 且 daily_rate 模式的 RoleAssignment
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        status: 'accepted',
        taskRole: { task: { taskMode: 'daily_rate' } },
      },
      include: { taskRole: { include: { task: true } } },
    });

    for (const asgn of assignments) {
      try {
        await this.settleWeek(Number(asgn.id), 'cron');
      } catch (e: any) {
        this.logger.warn(`周结算失败 assignment=${asgn.id}: ${e.message}`);
      }
    }
  }

  // ================================================================
  // 核心结算逻辑（供多场景调用）
  // ================================================================
  async settleWeek(
    assignmentId: number,
    trigger: 'cron' | 'task_completed' | 'dispute' | 'manual',
    weekOverride?: { weekStart: Date; weekEnd: Date },
  ) {
    // 计算本周区间（周一到周日）
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日
    const weekStart = weekOverride?.weekStart ?? (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const weekEnd = weekOverride?.weekEnd ?? (() => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 6);
      d.setHours(23, 59, 59, 999);
      return d;
    })();

    // 幂等：已结算则跳过
    const existing = await this.prisma.weeklySettlement.findFirst({
      where: {
        assignmentId: BigInt(assignmentId),
        weekStart,
      },
    });
    if (existing) {
      this.logger.log(`周结算幂等跳过: assignment=${assignmentId}, weekStart=${weekStart}`);
      return null;
    }

    // 查询本周已确认工时（含 auto_confirmed）
    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        assignmentId: BigInt(assignmentId),
        checkinDate: { gte: weekStart, lte: weekEnd },
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
    });

    const totalDays = checkins.length; // 每条打卡记录 = 1人天

    if (totalDays === 0) {
      this.logger.log(`无有效工时，跳过结算: assignment=${assignmentId}`);
      return null;
    }

    // 获取人天费率
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
      include: {
        taskRole: { include: { task: true } },
        worker: true,
      },
    });
    if (!assignment) throw new BadRequestException('分配记录不存在');

    const dailyRate = Number((assignment as any).taskRole.suggestedDaily ?? 0);
    if (dailyRate <= 0) throw new BadRequestException('人天费率未设置');

    const grossAmount = totalDays * dailyRate;
    const platformFee = grossAmount * 0.08;           // 8% 平台服务费
    const netAmount   = grossAmount - platformFee;

    // 事务：创建周结算 + 零工钱包入账 + 企业扣款
    await this.prisma.$transaction(async (tx) => {
      // 1. 创建周结算记录
      await tx.weeklySettlement.create({
        data: {
          assignmentId: BigInt(assignmentId),
          weekStart,
          weekEnd,
          totalDays:   totalDays,
          dailyRate:   dailyRate,
          grossAmount: grossAmount,
          netAmount:   netAmount,
          status:      'completed',
          settledAt:   new Date(),
        },
      });

      // 2. 零工钱包入账
      await tx.wallet.upsert({
        where:  { workerId: assignment.workerId },
        create: {
          workerId:         assignment.workerId,
          availableBalance: netAmount,
          totalEarned:      netAmount,
        },
        update: {
          availableBalance: { increment: netAmount },
          totalEarned:      { increment: netAmount },
        },
      });

      // 3. 零工收入流水
      await tx.transaction.create({
        data: {
          transactionNo: `WS${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          type:          'settlement',
          direction:     'in',
          amount:        netAmount,
          workerId:      assignment.workerId,
          taskId:        (assignment as any).taskRole.taskId,
          status:        'completed',
          completedAt:   new Date(),
          remark:        `人天结算 ${weekStart.toISOString().slice(0, 10)} ~ ${weekEnd.toISOString().slice(0, 10)} (${totalDays}人天 × ¥${dailyRate})`,
        },
      });
    });

    this.logger.log(
      `周结算完成: assignment=${assignmentId}, ${totalDays}天, gross=¥${grossAmount}, net=¥${netAmount}, trigger=${trigger}`,
    );
    return { assignmentId, totalDays, grossAmount, netAmount };
  }

  // ================================================================
  // 场景 B: 任务完成时立即触发当周剩余结算
  // ================================================================
  async settleOnTaskComplete(assignmentId: number) {
    return this.settleWeek(assignmentId, 'task_completed');
  }

  // ================================================================
  // 查询周结算历史
  // ================================================================
  async listWeeklySettlements(assignmentId: number) {
    const records = await this.prisma.weeklySettlement.findMany({
      where:   { assignmentId: BigInt(assignmentId) },
      orderBy: { weekStart: 'desc' },
    });
    return records.map((r) => ({
      id:          Number(r.id),
      weekStart:   r.weekStart,
      weekEnd:     r.weekEnd,
      totalDays:   Number(r.totalDays),
      dailyRate:   Number(r.dailyRate),
      grossAmount: Number(r.grossAmount),
      netAmount:   Number(r.netAmount),
      status:      r.status,
      settledAt:   r.settledAt,
    }));
  }
}
