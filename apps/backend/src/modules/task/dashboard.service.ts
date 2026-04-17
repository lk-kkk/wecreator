/**
 * DashboardService — 数据看板（S2-020）
 *
 * 6 核心指标：
 *   1. 任务概览（总数/各状态分布）
 *   2. 资金概览（余额/本月充值/本月结算/锁定）
 *   3. 零工概览（在库总数/活跃/完成率均值）
 *   4. 评价均分（近30天）
 *   5. 30日任务发布趋势（折线图数据）
 *   6. 30日结算金额趋势（折线图数据）
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 主看板数据（企业端）
  // ================================================================
  async getCompanyDashboard(companyId: number) {
    const [
      taskStats,
      financeStats,
      workerStats,
      reviewStats,
      taskTrend,
      settleTrend,
    ] = await Promise.all([
      this._taskStats(companyId),
      this._financeStats(companyId),
      this._workerStats(companyId),
      this._reviewStats(companyId),
      this._taskTrend(companyId),
      this._settleTrend(companyId),
    ]);

    return {
      taskStats,
      financeStats,
      workerStats,
      reviewStats,
      taskTrend,
      settleTrend,
      generatedAt: new Date(),
    };
  }

  // ================================================================
  // 平台管理员看板（全局统计）
  // ================================================================
  async getPlatformDashboard() {
    const [
      globalTaskStats,
      globalFinance,
      globalWorkers,
      globalReviews,
      globalTaskTrend,
      globalSettleTrend,
    ] = await Promise.all([
      this._globalTaskStats(),
      this._globalFinanceStats(),
      this._globalWorkerStats(),
      this._globalReviewStats(),
      this._globalTaskTrend(),
      this._globalSettleTrend(),
    ]);

    return {
      globalTaskStats,
      globalFinance,
      globalWorkers,
      globalReviews,
      globalTaskTrend,
      globalSettleTrend,
      generatedAt: new Date(),
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // 企业侧
  // ──────────────────────────────────────────────────────────────────

  private async _taskStats(companyId: number) {
    const tasks = await this.prisma.task.groupBy({
      by:    ['status'],
      where: { companyId: BigInt(companyId) },
      _count: { id: true },
    });

    const map: Record<string, number> = {};
    tasks.forEach(t => { map[t.status] = t._count.id; });

    return {
      total:          Object.values(map).reduce((a, b) => a + b, 0),
      draft:          map['draft']          ?? 0,
      published:      map['published']      ?? 0,
      in_progress:    map['in_progress']    ?? 0,
      reviewing:      map['reviewing']      ?? 0,
      completed:      map['completed']      ?? 0,
      cancelled:      map['cancelled']      ?? 0,
    };
  }

  private async _financeStats(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: BigInt(companyId) },
      select: { balance: true, lockedBalance: true },
    });

    const now   = new Date();
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    const [rechargeThisMonth, settleThisMonth] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          companyId: BigInt(companyId), type: 'recharge',
          status: 'completed', createdAt: { gte: month },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          companyId: BigInt(companyId), type: 'settlement',
          direction: 'out', status: 'completed', createdAt: { gte: month },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      balance:            Number(company?.balance ?? 0),
      lockedBalance:      Number(company?.lockedBalance ?? 0),
      rechargeThisMonth:  Number(rechargeThisMonth._sum.amount ?? 0),
      settleThisMonth:    Number(settleThisMonth._sum.amount ?? 0),
    };
  }

  private async _workerStats(companyId: number) {
    // 该企业下所有参与过任务的零工 ID
    const assignedWorkers = await this.prisma.roleAssignment.findMany({
      where: {
        taskRole: { task: { companyId: BigInt(companyId) } },
        status: { not: 'rejected' },
      },
      select:  { workerId: true },
      distinct: ['workerId'],
    });
    const workerIds = [...new Set(assignedWorkers.map(a => a.workerId))];

    const [activeCount, avgRate] = await Promise.all([
      this.prisma.roleAssignment.count({
        where: {
          taskRole: { task: { companyId: BigInt(companyId) } },
          status: 'accepted',
        },
      }),
      this.prisma.worker.aggregate({
        where:  { id: { in: workerIds } },
        _avg:   { avgRating: true, completionRate: true },
        _count: { id: true },
      }),
    ]);

    return {
      poolTotal:          workerIds.length,
      activeAssignments:  activeCount,
      avgRating:          Math.round((Number(avgRate._avg.avgRating ?? 0)) * 10) / 10,
      avgCompletionRate:  Math.round((Number(avgRate._avg.completionRate ?? 0)) * 1000) / 10,
    };
  }

  private async _reviewStats(companyId: number) {
    const days30 = new Date(Date.now() - 30 * 86400_000);

    // 获取该企业任务的所有 taskId
    const taskIds = await this.prisma.task.findMany({
      where:  { companyId: BigInt(companyId) },
      select: { id: true },
    });
    const ids = taskIds.map(t => t.id);

    if (ids.length === 0) return { avgScore30d: 0, reviewCount: 0 };

    const reviews = await this.prisma.review.findMany({
      where: { taskId: { in: ids }, createdAt: { gte: days30 } },
      select: { rating: true },
    });

    const avg = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

    return {
      avgScore30d:  Math.round(avg * 10) / 10,
      reviewCount:  reviews.length,
    };
  }

  private async _taskTrend(companyId: number) {
    return this._buildTrend(
      await this.prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>`
        SELECT DATE(created_at) as day, COUNT(*) as cnt
        FROM tasks
        WHERE company_id = ${BigInt(companyId)}
          AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `,
    );
  }

  private async _settleTrend(companyId: number) {
    return this._buildTrend(
      await this.prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>`
        SELECT DATE(completed_at) as day, SUM(amount) as cnt
        FROM transactions
        WHERE company_id = ${BigInt(companyId)}
          AND type = 'settlement' AND direction = 'out' AND status = 'completed'
          AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(completed_at)
        ORDER BY day ASC
      `,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // 平台侧（全局）
  // ──────────────────────────────────────────────────────────────────

  private async _globalTaskStats() {
    const tasks = await this.prisma.task.groupBy({ by: ['status'], _count: { id: true } });
    const map: Record<string, number> = {};
    tasks.forEach(t => { map[t.status] = t._count.id; });
    return { total: Object.values(map).reduce((a, b) => a + b, 0), ...map };
  }

  private async _globalFinanceStats() {
    const now   = new Date();
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const [gmv, settle] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { type: 'recharge', status: 'completed', createdAt: { gte: month } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'settlement', status: 'completed', createdAt: { gte: month } },
        _sum: { amount: true },
      }),
    ]);
    return {
      gmvThisMonth:     Number(gmv._sum.amount ?? 0),
      settleThisMonth:  Number(settle._sum.amount ?? 0),
    };
  }

  private async _globalWorkerStats() {
    const [total, verified, active] = await Promise.all([
      this.prisma.worker.count(),
      this.prisma.worker.count({ where: { isVerified: true } }),
      this.prisma.worker.count({ where: { status: 'active' } }),
    ]);
    return { total, verified, active };
  }

  private async _globalReviewStats() {
    const reviews = await this.prisma.review.findMany({
      select: { rating: true },
    });
    const avg = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
    return {
      avgScore:    Math.round(avg * 10) / 10,
      totalReviews: reviews.length,
    };
  }

  private async _globalTaskTrend() {
    return this._buildTrend(
      await this.prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>`
        SELECT DATE(created_at) as day, COUNT(*) as cnt
        FROM tasks
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(created_at) ORDER BY day ASC
      `,
    );
  }

  private async _globalSettleTrend() {
    return this._buildTrend(
      await this.prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>`
        SELECT DATE(completed_at) as day, SUM(amount) as cnt
        FROM transactions
        WHERE type = 'settlement' AND status = 'completed'
          AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(completed_at) ORDER BY day ASC
      `,
    );
  }

  // ── 工具：补全30天日期序列 ────────────────────────────────────────
  private _buildTrend(rows: Array<{ day: string; cnt: bigint }>) {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(String(r.day).slice(0, 10), Number(r.cnt)));

    const result: Array<{ date: string; value: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
    }
    return result;
  }
}
