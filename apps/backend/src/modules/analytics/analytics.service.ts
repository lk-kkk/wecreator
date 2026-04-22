/**
 * V3.7 Phase 6 — AnalyticsService
 *
 * 职责：
 *  1. track(...) — 业务入口注入埋点（内部调用，fire-and-forget）
 *  2. record(...) — 前端主动上报接口（POST /analytics/events）
 *  3. getTaskAnalytics / getProjectAnalytics / getQualityAnalytics — Dashboard 聚合
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

export type AnalyticsActorType = 'company_user' | 'worker' | 'system';

export interface TrackInput {
  event:     string;
  actorType: AnalyticsActorType;
  actorId?:  number | null;
  companyId?: number | null;
  refType?:  string | null;
  refId?:    number | null;
  props?:    Record<string, any>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 埋点写入（fire-and-forget，失败不影响主流程）
  // ================================================================
  async track(input: TrackInput): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event:     input.event,
          actorType: input.actorType,
          actorId:   input.actorId != null ? BigInt(input.actorId) : null,
          companyId: input.companyId != null ? BigInt(input.companyId) : null,
          refType:   input.refType ?? null,
          refId:     input.refId != null ? BigInt(input.refId) : null,
          props:     input.props ?? undefined,
        },
      });
    } catch (e: any) {
      this.logger.warn(`track(${input.event}) 失败: ${e?.message}`);
    }
  }

  // ================================================================
  // Dashboard A — 任务维度分析
  // ================================================================
  async getTaskAnalytics(companyId: number) {
    const cid = BigInt(companyId);

    // ── 平均完成周期（天） = AVG(updatedAt - createdAt) for status=completed
    const completed = await this.prisma.task.findMany({
      where: { companyId: cid, status: 'completed' as any },
      select: { createdAt: true, updatedAt: true, endDate: true },
    });
    const avgCycleDays = completed.length === 0 ? 0 :
      Math.round(
        (completed.reduce((sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()), 0)
          / completed.length) / 86400_000 * 10,
      ) / 10;

    // ── 按时交付率 = completed 任务中 updatedAt <= endDate 的占比
    const withDeadline = completed.filter(t => !!t.endDate);
    const onTime = withDeadline.filter(t => t.updatedAt <= (t.endDate as Date)).length;
    const onTimeRate = withDeadline.length === 0 ? 0 :
      Math.round(onTime / withDeadline.length * 1000) / 10;

    // ── 接单响应时间（小时） = AVG(acceptedAt - invitedAt) 对于 accepted+completed 分配
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        taskRole: { task: { companyId: cid } },
        status: { in: ['accepted', 'completed'] as any },
        acceptedAt: { not: null },
      },
      select: { invitedAt: true, acceptedAt: true },
    });
    const avgResponseHours = assignments.length === 0 ? 0 :
      Math.round(
        (assignments.reduce((sum, a) =>
          sum + ((a.acceptedAt as Date).getTime() - (a.invitedAt as Date).getTime()), 0)
          / assignments.length) / 3600_000 * 10,
      ) / 10;

    // ── 本月活跃零工数 = 最近 30d 有 accepted assignment 的 workerId distinct
    const monthAgo = new Date(Date.now() - 30 * 86400_000);
    const activeWorkers = await this.prisma.roleAssignment.findMany({
      where: {
        taskRole: { task: { companyId: cid } },
        status: { in: ['accepted', 'completed'] as any },
        acceptedAt: { gte: monthAgo },
      },
      select: { workerId: true },
      distinct: ['workerId'],
    });

    // ── 任务类型饼图（taskMode）
    const byMode = await this.prisma.task.groupBy({
      by: ['taskMode'],
      where: { companyId: cid },
      _count: { id: true },
    });

    // ── 优先级分布（priority）
    const byPriority = await this.prisma.task.groupBy({
      by: ['priority'],
      where: { companyId: cid },
      _count: { id: true },
    });

    // ── 完成趋势（最近 30 天，按天聚合 completed 数）
    const dailyCompleted = await this.prisma.$queryRawUnsafe<Array<{ d: string; count: bigint }>>(
      `SELECT DATE(updated_at) AS d, COUNT(*) AS count
         FROM tasks
         WHERE company_id = ? AND status='completed'
           AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY DATE(updated_at)
         ORDER BY d ASC`,
      companyId,
    );

    return {
      cards: {
        avgCycleDays,
        onTimeRate,          // %
        avgResponseHours,
        activeWorkers:       activeWorkers.length,
      },
      charts: {
        byMode:      byMode.map(m => ({ name: m.taskMode, value: m._count.id })),
        byPriority:  byPriority.map(p => ({ name: p.priority ?? 'unset', value: p._count.id })),
        completionTrend: dailyCompleted.map(r => ({
          date:  r.d,
          count: Number(r.count),
        })),
      },
      generatedAt: new Date(),
    };
  }

  // ================================================================
  // Dashboard B — 项目维度分析
  // ================================================================
  async getProjectAnalytics(companyId: number) {
    const cid = BigInt(companyId);

    // 状态分布（环形）
    const byStatus = await this.prisma.project.groupBy({
      by: ['status'],
      where: { companyId: cid },
      _count: { id: true },
    });

    // 风险分布（三色）
    const byRisk = await this.prisma.project.groupBy({
      by: ['riskLevel'],
      where: { companyId: cid },
      _count: { id: true },
    });

    // 阶段分布
    const byPhase = await this.prisma.project.groupBy({
      by: ['phase'],
      where: { companyId: cid },
      _count: { id: true },
    });

    // 预算对比（每个项目的预算 vs 已结算）— 取 Top 10
    // 注：Project 本身无 budget 字段，以关联任务 taskRoles.budget 汇总
    const projects = await this.prisma.project.findMany({
      where: { companyId: cid },
      select: {
        id: true, name: true,
        tasks: {
          select: { id: true, taskRoles: { select: { budget: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const budgetCompare: Array<{ name: string; budget: number; settled: number }> = [];
    for (const p of projects) {
      const budget = p.tasks.reduce(
        (s, t) => s + t.taskRoles.reduce((ss, r) => ss + Number(r.budget ?? 0), 0),
        0,
      );
      const taskIds = p.tasks.map(t => t.id);
      const settled = taskIds.length === 0 ? { _sum: { amount: 0 } } :
        await this.prisma.transaction.aggregate({
          where: {
            type: 'settlement', direction: 'out', status: 'completed',
            taskId: { in: taskIds },
          },
          _sum: { amount: true },
        });
      budgetCompare.push({
        name:    p.name,
        budget,
        settled: Number(settled?._sum?.amount ?? 0),
      });
    }

    return {
      byStatus:  byStatus.map(s => ({ name: s.status, value: s._count.id })),
      byRisk:    byRisk.map(r => ({ name: r.riskLevel ?? 'unset', value: r._count.id })),
      byPhase:   byPhase.map(p => ({ name: p.phase ?? 'unset', value: p._count.id })),
      budgetCompare,
      generatedAt: new Date(),
    };
  }

  // ================================================================
  // Dashboard C — 质量分析
  // ================================================================
  async getQualityAnalytics(companyId: number) {
    const cid = BigInt(companyId);

    // 交付物：approved vs rejected vs submitted
    const deliverables = await this.prisma.deliverable.findMany({
      where: { task: { companyId: cid } },
      select: { status: true, version: true, assignmentId: true },
    });
    const approved = deliverables.filter(d => d.status === 'approved').length;
    const rejected = deliverables.filter(d => d.status === 'rejected').length;
    const totalReviewed = approved + rejected;
    const approvalRate = totalReviewed === 0 ? 0 :
      Math.round(approved / totalReviewed * 1000) / 10;

    // 返工率 = 有 version > 1 的 assignment / 所有 assignment 已提交 deliverable 的
    const byAssign = new Map<string, number>();
    for (const d of deliverables) {
      const k = String(d.assignmentId);
      byAssign.set(k, Math.max(byAssign.get(k) ?? 0, d.version));
    }
    const totalAssign   = byAssign.size;
    const rewornAssign  = [...byAssign.values()].filter(v => v > 1).length;
    const avgRevisions  = totalAssign === 0 ? 0 :
      Math.round([...byAssign.values()].reduce((a, b) => a + b, 0) / totalAssign * 10) / 10;
    const reworkRate    = totalAssign === 0 ? 0 :
      Math.round(rewornAssign / totalAssign * 1000) / 10;

    // 检查点通过率
    const checkpoints = await this.prisma.taskCheckpoint.groupBy({
      by: ['status'],
      where: { task: { companyId: cid } },
      _count: { id: true },
    });
    const cpMap: Record<string, number> = {};
    checkpoints.forEach(c => { cpMap[c.status] = c._count.id; });
    const cpReviewed = (cpMap['passed'] ?? 0) + (cpMap['rejected'] ?? 0);
    const cpPassRate = cpReviewed === 0 ? 0 :
      Math.round((cpMap['passed'] ?? 0) / cpReviewed * 1000) / 10;

    return {
      cards: {
        approvalRate,     // %
        reworkRate,       // %
        avgRevisions,     // 次
        cpPassRate,       // %
      },
      deliverableStatus: {
        approved,
        rejected,
        pending: deliverables.length - approved - rejected,
      },
      checkpointStatus: cpMap,
      generatedAt: new Date(),
    };
  }
}
