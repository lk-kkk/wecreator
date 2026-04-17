/**
 * PlatformService — 平台运营管理后台核心服务 (V3.2 §18)
 */
import {
  Injectable, UnauthorizedException, BadRequestException,
  NotFoundException, ForbiddenException, Logger, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma';
import type {
  PlatformLoginDto, RejectCompanyDto, FreezeCompanyDto,
  BanWorkerDto, AdjustCreditDto, ForceCloseTaskDto, FreezeTaskFundDto,
  PlatformResolveDisputeDto, WithdrawalReviewDto, RefundDto,
  UpdateConfigDto, CreateAdminDto, UpdateAdminDto,
} from './dto';

let runtimeConfig = {
  serviceFeeRate: 0.08, withdrawalSingleLimit: 5000, withdrawalDailyLimit: 20000,
  rechargeSingleLimit: 50000, acceptanceTimeoutDays: 3, disputeSlaHours: 72, invitationExpiryHours: 24,
};

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  // ── AUTH ────────────────────────────────────────────────
  async login(dto: PlatformLoginDto, ip: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { username: dto.username } });
    if (!admin) throw new UnauthorizedException('用户名或密码错误');
    if (admin.status === 'disabled') throw new ForbiddenException('账号已禁用');
    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('用户名或密码错误');
    await this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } });
    const payload = { sub: Number(admin.id), userType: 'platform' as const, platformRole: admin.role };
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: '30m' }),
      refreshToken: this.jwt.sign(payload, { expiresIn: '2h' }),
      admin: { id: Number(admin.id), username: admin.username, displayName: admin.displayName, role: admin.role },
    };
  }

  async refreshToken(token: string) {
    try {
      const p = this.jwt.verify(token);
      if (p.userType !== 'platform') throw new Error();
      return { accessToken: this.jwt.sign({ sub: p.sub, userType: 'platform', platformRole: p.platformRole }, { expiresIn: '30m' }) };
    } catch { throw new UnauthorizedException('Refresh token 无效'); }
  }

  async getProfile(adminId: number) {
    const a = await this.prisma.platformAdmin.findUnique({ where: { id: BigInt(adminId) } });
    if (!a) throw new NotFoundException('管理员不存在');
    return { id: Number(a.id), username: a.username, displayName: a.displayName, role: a.role, lastLoginAt: a.lastLoginAt, lastLoginIp: a.lastLoginIp };
  }

  // ── DASHBOARD ──────────────────────────────────────────
  async getDashboard() {
    const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [cT, wT, nC, nW, aT, gmv, stl, pA, pD, pW] = await Promise.all([
      this.prisma.company.count(), this.prisma.worker.count(),
      this.prisma.company.count({ where: { createdAt: { gte: ms } } }),
      this.prisma.worker.count({ where: { createdAt: { gte: ms } } }),
      this.prisma.task.count({ where: { status: { in: ['published', 'in_progress', 'reviewing'] } } }),
      this.prisma.transaction.aggregate({ where: { type: 'recharge', status: 'completed', createdAt: { gte: ms } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'settlement', status: 'completed', createdAt: { gte: ms } }, _sum: { amount: true } }),
      this.prisma.company.count({ where: { status: 'pending' } }),
      this.prisma.dispute.count({ where: { status: { in: ['pending', 'investigating'] } } }),
      this.prisma.transaction.count({ where: { type: 'withdraw', status: 'pending' } }),
    ]);
    const g = Number(gmv._sum.amount ?? 0), s = Number(stl._sum.amount ?? 0);
    return { companyTotal: cT, workerTotal: wT, newUsersThisMonth: nC + nW, activeTasks: aT, gmvThisMonth: g, settleThisMonth: s, platformFeeIncome: Math.round(s * 0.08 / 1.08 * 100) / 100, pendingTodos: pA + pD + pW, pendingAudit: pA, pendingDisputes: pD, pendingWithdrawals: pW };
  }

  async getTrends() {
    const build = (rows: Array<{ day: string; cnt: bigint }>) => {
      const m = new Map<string, number>(); rows.forEach(r => m.set(String(r.day).slice(0, 10), Number(r.cnt)));
      const res: Array<{ date: string; value: number }> = [];
      for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10); res.push({ date: d, value: m.get(d) ?? 0 }); }
      return res;
    };
    const [t1, t2, t3] = await Promise.all([
      this.prisma.$queryRaw<any[]>`SELECT DATE(created_at) as day, COUNT(*) as cnt FROM tasks WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY day`,
      this.prisma.$queryRaw<any[]>`SELECT DATE(completed_at) as day, COALESCE(SUM(amount),0) as cnt FROM transactions WHERE type='settlement' AND status='completed' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(completed_at) ORDER BY day`,
      this.prisma.$queryRaw<any[]>`SELECT DATE(created_at) as day, COUNT(*) as cnt FROM (SELECT created_at FROM companies UNION ALL SELECT created_at FROM workers) t WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY day`,
    ]);
    return { taskTrend: build(t1), settleTrend: build(t2), userTrend: build(t3) };
  }

  async getAlerts() {
    const alerts: Array<{ level: string; message: string; count: number }> = [];
    const a1 = await this.prisma.company.count({ where: { status: 'pending', createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
    if (a1 > 0) alerts.push({ level: 'error', message: `${a1} 个企业审核超过24h未处理`, count: a1 });
    const a2 = await this.prisma.dispute.count({ where: { status: { in: ['pending', 'investigating'] }, createdAt: { lt: new Date(Date.now() - 48 * 3600_000) } } });
    if (a2 > 0) alerts.push({ level: 'warning', message: `${a2} 个争议工单超过48h未处理`, count: a2 });
    const a3 = await this.prisma.transaction.count({ where: { amount: { gte: 10000 }, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
    if (a3 > 0) alerts.push({ level: 'error', message: `${a3} 笔大额交易（≥¥10,000）`, count: a3 });
    return alerts;
  }

  // ── COMPANY ────────────────────────────────────────────
  async listCompanies(q: { page?: number; pageSize?: number; status?: string; search?: string; sortBy?: string; sortOrder?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {}; if (q.status) w.status = q.status;
    if (q.search) w.OR = [{ name: { contains: q.search } }, { creditCode: { contains: q.search } }];
    const ob: any = q.sortBy === 'balance' ? { balance: q.sortOrder || 'desc' } : { createdAt: 'desc' };
    const [total, items] = await Promise.all([
      this.prisma.company.count({ where: w }),
      this.prisma.company.findMany({ where: w, orderBy: ob, skip: (p - 1) * ps, take: ps, include: { _count: { select: { tasks: true } } } }),
    ]);
    return { total, page: p, pageSize: ps, items: items.map((c: any) => ({ id: Number(c.id), name: c.name, creditCode: c.creditCode, status: c.status, balance: Number(c.balance), lockedBalance: Number(c.lockedBalance), taskCount: c._count.tasks, createdAt: c.createdAt })) };
  }

  async getCompanyDetail(id: number) {
    const c: any = await this.prisma.company.findUnique({
      where: { id: BigInt(id) },
      include: {
        tasks: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, title: true, status: true, totalBudget: true, createdAt: true } },
        users: { select: { id: true, name: true, role: true, status: true } },
        _count: { select: { tasks: true } },
      },
    });
    if (!c) throw new NotFoundException('企业不存在');
    const [rt, st] = await Promise.all([
      this.prisma.transaction.aggregate({ where: { companyId: c.id, type: 'recharge', status: 'completed' }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { companyId: c.id, type: 'settlement', status: 'completed' }, _sum: { amount: true } }),
    ]);
    return { id: Number(c.id), name: c.name, creditCode: c.creditCode, status: c.status, contactEmail: c.contactEmail, industryTag: c.industryTag, logoUrl: c.logoUrl, balance: Number(c.balance), lockedBalance: Number(c.lockedBalance), totalRecharge: Number(rt._sum.amount ?? 0), totalSettlement: Number(st._sum.amount ?? 0), taskCount: c._count.tasks, tasks: c.tasks.map((t: any) => ({ id: Number(t.id), title: t.title, status: t.status, budget: Number(t.totalBudget), createdAt: t.createdAt })), users: c.users.map((u: any) => ({ id: Number(u.id), name: u.name, role: u.role, status: u.status })), createdAt: c.createdAt, version: c.version };
  }

  async approveCompany(id: number, adminId: number) {
    const c = await this.prisma.company.findUnique({ where: { id: BigInt(id) } });
    if (!c) throw new NotFoundException('企业不存在');
    if (c.status !== 'pending') throw new BadRequestException('当前状态无法审核');
    await this.prisma.company.update({ where: { id: BigInt(id) }, data: { status: 'active', approvedAt: new Date() } });
    await this._auditLog(adminId, 'company_approve', 'company', id, `审核通过: ${c.name}`);
    return { message: '审核通过' };
  }

  async rejectCompany(id: number, adminId: number, dto: RejectCompanyDto) {
    const c = await this.prisma.company.findUnique({ where: { id: BigInt(id) } });
    if (!c) throw new NotFoundException('企业不存在');
    if (c.status !== 'pending') throw new BadRequestException('当前状态无法驳回');
    await this._auditLog(adminId, 'company_reject', 'company', id, `驳回: ${dto.reason}`);
    return { message: '已驳回' };
  }

  async freezeCompany(id: number, adminId: number, dto: FreezeCompanyDto) {
    const c = await this.prisma.company.findUnique({ where: { id: BigInt(id) } });
    if (!c) throw new NotFoundException('企业不存在');
    if (dto.action === 'freeze') {
      if (c.status === 'suspended') throw new BadRequestException('已冻结');
      await this.prisma.company.update({ where: { id: BigInt(id) }, data: { status: 'suspended' } });
    } else {
      if (c.status !== 'suspended') throw new BadRequestException('未冻结');
      await this.prisma.company.update({ where: { id: BigInt(id) }, data: { status: 'active' } });
    }
    await this._auditLog(adminId, `company_${dto.action}`, 'company', id, dto.reason);
    return { message: dto.action === 'freeze' ? '已冻结' : '已解冻' };
  }

  // ── WORKER ─────────────────────────────────────────────
  async listWorkers(q: { page?: number; pageSize?: number; status?: string; verified?: string; level?: string; city?: string; search?: string; sortBy?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {};
    if (q.status) w.status = q.status;
    if (q.verified === 'true') w.isVerified = true;
    if (q.verified === 'false') w.isVerified = false;
    if (q.level) w.level = q.level;
    if (q.city) w.city = q.city;
    if (q.search) w.OR = [{ realName: { contains: q.search } }];
    const ob: any = q.sortBy === 'rating' ? { avgRating: 'desc' } : q.sortBy === 'completed' ? { completedCount: 'desc' } : { createdAt: 'desc' };
    const [total, items] = await Promise.all([
      this.prisma.worker.count({ where: w }),
      this.prisma.worker.findMany({ where: w, orderBy: ob, skip: (p - 1) * ps, take: ps, include: { wallet: { select: { availableBalance: true } } } }),
    ]);
    return { total, page: p, pageSize: ps, items: items.map((w2: any) => ({ id: Number(w2.id), realName: w2.realName, avatarUrl: w2.avatarUrl, city: w2.city, isVerified: w2.isVerified, level: w2.level, avgRating: Number(w2.avgRating), completedCount: w2.completedCount, status: w2.status, walletBalance: w2.wallet ? Number(w2.wallet.availableBalance) : 0, createdAt: w2.createdAt })) };
  }

  async getWorkerDetail(id: number) {
    const w: any = await this.prisma.worker.findUnique({
      where: { id: BigInt(id) },
      include: {
        wallet: true,
        workerRoles: true,
        assignments: { orderBy: { invitedAt: 'desc' }, take: 20, include: { taskRole: { include: { task: { select: { id: true, title: true, status: true } } } } } },
      },
    });
    if (!w) throw new NotFoundException('零工不存在');
    return { id: Number(w.id), realName: w.realName, avatarUrl: w.avatarUrl, city: w.city, bio: w.bio, isVerified: w.isVerified, level: w.level, avgRating: Number(w.avgRating), completedCount: w.completedCount, completionRate: Number(w.completionRate), status: w.status, wallet: w.wallet ? { available: Number(w.wallet.availableBalance), frozen: Number(w.wallet.frozenBalance), totalEarned: Number(w.wallet.totalEarned) } : null, roles: w.workerRoles.map((r: any) => ({ roleName: r.roleName })), tasks: w.assignments.map((a: any) => ({ id: Number(a.taskRole?.task?.id), title: a.taskRole?.task?.title, status: a.status, invitedAt: a.invitedAt })), createdAt: w.createdAt };
  }

  async banWorker(id: number, adminId: number, dto: BanWorkerDto) {
    const w = await this.prisma.worker.findUnique({ where: { id: BigInt(id) } });
    if (!w) throw new NotFoundException('零工不存在');
    if (dto.action === 'ban' && w.status === 'suspended') throw new BadRequestException('已封禁');
    if (dto.action === 'unban' && w.status !== 'suspended') throw new BadRequestException('未封禁');
    await this.prisma.worker.update({ where: { id: BigInt(id) }, data: { status: dto.action === 'ban' ? 'suspended' : 'active' } });
    await this._auditLog(adminId, `worker_${dto.action}`, 'worker', id, dto.reason);
    return { message: dto.action === 'ban' ? '已封禁' : '已解封' };
  }

  async adjustCredit(id: number, adminId: number, dto: AdjustCreditDto) {
    const w = await this.prisma.worker.findUnique({ where: { id: BigInt(id) } });
    if (!w) throw new NotFoundException('零工不存在');
    const nr = Math.max(0, Math.min(5, Number(w.avgRating) + dto.adjustment / 20));
    await this.prisma.worker.update({ where: { id: BigInt(id) }, data: { avgRating: nr } });
    await this._auditLog(adminId, 'worker_credit', 'worker', id, `adj=${dto.adjustment} reason=${dto.reason}`);
    return { message: '信用分已调整', newRating: nr };
  }

  // ── TASK ───────────────────────────────────────────────
  async listTasks(q: { page?: number; pageSize?: number; status?: string; mode?: string; search?: string; sortBy?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {};
    if (q.status) w.status = q.status;
    if (q.mode) w.taskMode = q.mode;
    if (q.search) w.OR = [{ title: { contains: q.search } }];
    const ob: any = q.sortBy === 'budget' ? { totalBudget: 'desc' } : { createdAt: 'desc' };
    const [total, items] = await Promise.all([
      this.prisma.task.count({ where: w }),
      this.prisma.task.findMany({ where: w, orderBy: ob, skip: (p - 1) * ps, take: ps, include: { company: { select: { name: true } }, _count: { select: { taskRoles: true } } } }),
    ]);
    // Check for disputes separately
    const taskIds = items.map((t: any) => t.id);
    const disputeCounts = taskIds.length > 0 ? await this.prisma.dispute.groupBy({ by: ['taskId'], where: { taskId: { in: taskIds } }, _count: { id: true } }) : [];
    const dMap = new Map(disputeCounts.map((d: any) => [String(d.taskId), d._count.id]));

    return { total, page: p, pageSize: ps, items: items.map((t: any) => ({ id: Number(t.id), title: t.title, companyName: t.company.name, mode: t.taskMode, status: t.status, totalBudget: Number(t.totalBudget), roleCount: t._count.taskRoles, hasDispute: (dMap.get(String(t.id)) || 0) > 0, createdAt: t.createdAt, endDate: t.endDate })) };
  }

  async getTaskDetail(id: number) {
    const t: any = await this.prisma.task.findUnique({
      where: { id: BigInt(id) },
      include: { company: { select: { id: true, name: true } }, taskRoles: { include: { assignments: { include: { worker: { select: { id: true, realName: true } } } } } } },
    });
    if (!t) throw new NotFoundException('任务不存在');
    const [disputes, txns] = await Promise.all([
      this.prisma.dispute.findMany({ where: { taskId: t.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.transaction.findMany({ where: { taskId: t.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { id: Number(t.id), title: t.title, description: t.description, company: { id: Number(t.company.id), name: t.company.name }, mode: t.taskMode, status: t.status, totalBudget: Number(t.totalBudget), lockedAmount: Number(t.lockedAmount), endDate: t.endDate, roles: t.taskRoles.map((r: any) => ({ id: Number(r.id), roleName: r.roleName, headcount: r.headcount, budget: Number(r.budget), assignments: r.assignments.map((a: any) => ({ id: Number(a.id), workerId: Number(a.workerId), workerName: a.worker?.realName, status: a.status, progress: a.progress })) })), disputes: disputes.map((d: any) => ({ id: Number(d.id), status: d.status, reason: d.reason, createdAt: d.createdAt })), transactions: txns.map((tx: any) => ({ id: Number(tx.id), type: tx.type, direction: tx.direction, amount: Number(tx.amount), status: tx.status, createdAt: tx.createdAt })), createdAt: t.createdAt };
  }

  async forceCloseTask(id: number, adminId: number, dto: ForceCloseTaskDto) {
    const t = await this.prisma.task.findUnique({ where: { id: BigInt(id) } });
    if (!t) throw new NotFoundException('任务不存在');
    if (['completed', 'closed', 'cancelled'].includes(t.status)) throw new BadRequestException('任务已结束');
    await this.prisma.task.update({ where: { id: BigInt(id) }, data: { status: 'closed' } });
    await this._auditLog(adminId, 'task_force_close', 'task', id, dto.reason);
    return { message: '已强制关闭' };
  }

  async freezeTaskFund(id: number, adminId: number, dto: FreezeTaskFundDto) {
    await this._auditLog(adminId, `task_fund_${dto.action}`, 'task', id, dto.reason);
    return { message: `资金已${dto.action === 'freeze' ? '冻结' : '解冻'}` };
  }

  // ── DISPUTE ────────────────────────────────────────────
  async listDisputes(q: { page?: number; pageSize?: number; status?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {}; if (q.status) w.status = q.status;
    const [total, items] = await Promise.all([
      this.prisma.dispute.count({ where: w }),
      this.prisma.dispute.findMany({ where: w, orderBy: { createdAt: 'desc' }, skip: (p - 1) * ps, take: ps }),
    ]);
    // Enrich with task titles
    const taskIds = [...new Set(items.map(d => d.taskId))];
    const tasks = taskIds.length > 0 ? await this.prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true, company: { select: { name: true } } } }) : [];
    const tMap = new Map(tasks.map((t: any) => [String(t.id), t]));

    const now = Date.now();
    return { total, page: p, pageSize: ps, items: items.map(d => {
      const h = (now - d.createdAt.getTime()) / 3600_000;
      const task: any = tMap.get(String(d.taskId));
      return { id: Number(d.id), taskTitle: task?.title, companyName: task?.company?.name, initiatorType: d.initiatorType, status: d.status, sla: ['pending', 'investigating'].includes(d.status) ? (h > 72 ? 'overdue' : h > 48 ? 'warning' : 'normal') : 'resolved', createdAt: d.createdAt };
    }) };
  }

  async getDisputeDetail(id: number) {
    const d = await this.prisma.dispute.findUnique({ where: { id: BigInt(id) } });
    if (!d) throw new NotFoundException('争议不存在');
    const task: any = await this.prisma.task.findUnique({ where: { id: d.taskId }, include: { company: { select: { name: true } } } });
    const assignment: any = await this.prisma.roleAssignment.findUnique({ where: { id: d.assignmentId }, include: { worker: { select: { realName: true } }, taskRole: { select: { roleName: true, budget: true } } } });
    return { id: Number(d.id), taskId: Number(d.taskId), taskTitle: task?.title, companyName: task?.company?.name, workerName: assignment?.worker?.realName, roleName: assignment?.taskRole?.roleName, amount: Number(assignment?.taskRole?.budget ?? 0), initiatorType: d.initiatorType, reason: d.reason, evidenceUrls: d.evidenceUrls ? JSON.parse(d.evidenceUrls) : [], status: d.status, resolution: d.resolution, resolvedAt: d.resolvedAt, createdAt: d.createdAt };
  }

  async acceptDispute(id: number, adminId: number) {
    const d = await this.prisma.dispute.findUnique({ where: { id: BigInt(id) } });
    if (!d) throw new NotFoundException('争议不存在');
    if (d.status !== 'pending') throw new BadRequestException('只能受理 pending 状态');
    await this.prisma.dispute.update({ where: { id: BigInt(id) }, data: { status: 'investigating' } });
    await this._auditLog(adminId, 'dispute_accept', 'dispute', id, '受理争议');
    return { message: '已受理' };
  }

  async resolveDispute(id: number, adminId: number, dto: PlatformResolveDisputeDto) {
    const d = await this.prisma.dispute.findUnique({ where: { id: BigInt(id) } });
    if (!d) throw new NotFoundException('争议不存在');
    if (!['pending', 'investigating'].includes(d.status)) throw new BadRequestException('当前状态无法裁决');
    const sMap: Record<string, string> = { full_settlement: 'resolved_worker', full_refund: 'resolved_company', partial_settlement: 'resolved_split', negotiate: 'cancelled' };
    await this.prisma.dispute.update({ where: { id: BigInt(id) }, data: { status: sMap[dto.type] as any, resolution: `[${dto.type}${dto.ratio != null ? `:${dto.ratio}%` : ''}] ${dto.explanation}`, resolvedAt: new Date() } });
    await this._auditLog(adminId, 'dispute_resolve', 'dispute', id, `type=${dto.type} ratio=${dto.ratio ?? '-'}`);
    return { message: '裁决已生效' };
  }

  // ── FINANCE ────────────────────────────────────────────

  async getFinanceOverview() {
    const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [cBal, wBal, gmv, settle] = await Promise.all([
      this.prisma.company.aggregate({ _sum: { balance: true, lockedBalance: true } }),
      this.prisma.wallet.aggregate({ _sum: { availableBalance: true, frozenBalance: true, totalEarned: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'recharge', status: 'completed', createdAt: { gte: ms } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'settlement', status: 'completed', createdAt: { gte: ms } }, _sum: { amount: true } }),
    ]);
    const s = Number(settle._sum?.amount ?? 0);
    return { companyBalance: Number(cBal._sum?.balance ?? 0), companyLocked: Number(cBal._sum?.lockedBalance ?? 0), workerAvailable: Number(wBal._sum?.availableBalance ?? 0), workerFrozen: Number(wBal._sum?.frozenBalance ?? 0), gmvThisMonth: Number(gmv._sum?.amount ?? 0), settleThisMonth: s, platformFee: Math.round(s * 0.08 / 1.08 * 100) / 100 };
  }

  async listTransactions(q: { page?: number; pageSize?: number; type?: string; status?: string; search?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {}; if (q.type) w.type = q.type; if (q.status) w.status = q.status;
    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where: w }),
      this.prisma.transaction.findMany({ where: w, orderBy: { createdAt: 'desc' }, skip: (p - 1) * ps, take: ps }),
    ]);
    return { total, page: p, pageSize: ps, items: items.map((t: any) => ({ id: Number(t.id), transactionNo: t.transactionNo, type: t.type, direction: t.direction, amount: Number(t.amount), status: t.status, createdAt: t.createdAt, isAbnormal: Number(t.amount) >= 10000 })) };
  }

  async listWithdrawals(q: { page?: number; pageSize?: number }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where: { type: 'withdraw', status: 'pending' } }),
      this.prisma.transaction.findMany({ where: { type: 'withdraw', status: 'pending' }, orderBy: { createdAt: 'desc' }, skip: (p - 1) * ps, take: ps }),
    ]);
    return { total, page: p, pageSize: ps, items: items.map((t: any) => ({ id: Number(t.id), amount: Number(t.amount), status: t.status, createdAt: t.createdAt })) };
  }

  async reviewWithdrawal(id: number, adminId: number, dto: WithdrawalReviewDto) {
    const t = await this.prisma.transaction.findUnique({ where: { id: BigInt(id) } });
    if (!t) throw new NotFoundException('交易不存在');
    if (t.type !== 'withdraw' || t.status !== 'pending') throw new BadRequestException('只能审核pending提现');
    await this.prisma.transaction.update({ where: { id: BigInt(id) }, data: { status: dto.action === 'approve' ? 'completed' : 'failed', completedAt: new Date() } });
    await this._auditLog(adminId, 'withdrawal_' + dto.action, 'transaction', id, dto.reason || dto.action);
    return { message: dto.action === 'approve' ? '已通过' : '已拒绝' };
  }

  async refund(adminId: number, dto: RefundDto) {
    await this._auditLog(adminId, 'refund', 'company', dto.companyId, 'amount=' + dto.amount + ' reason=' + dto.reason);
    return { message: '退款已发起' };
  }

  // -- CONFIG --
  getConfig() { return { ...runtimeConfig }; }

  updateConfig(adminId: number, dto: UpdateConfigDto) {
    runtimeConfig = { ...runtimeConfig, ...dto };
    this._auditLog(adminId, 'config_update', 'system', 0, JSON.stringify(dto));
    return { message: '配置已更新', config: runtimeConfig };
  }

  async listAdmins() {
    const admins = await this.prisma.platformAdmin.findMany({ orderBy: { createdAt: 'desc' } });
    return admins.map((a: any) => ({ id: Number(a.id), username: a.username, displayName: a.displayName, role: a.role, status: a.status, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt }));
  }

  async createAdmin(adminId: number, dto: CreateAdminDto) {
    const existing = await this.prisma.platformAdmin.findUnique({ where: { username: dto.username } });
    if (existing) throw new ConflictException('用户名已存在');
    const hash = await bcrypt.hash(dto.password, 10);
    const a = await this.prisma.platformAdmin.create({ data: { username: dto.username, passwordHash: hash, displayName: dto.displayName, role: dto.role as any } });
    await this._auditLog(adminId, 'admin_create', 'platform_admin', Number(a.id), 'created: ' + dto.username);
    return { id: Number(a.id), username: a.username, displayName: a.displayName, role: a.role };
  }

  async updateAdmin(targetId: number, adminId: number, dto: UpdateAdminDto) {
    const a = await this.prisma.platformAdmin.findUnique({ where: { id: BigInt(targetId) } });
    if (!a) throw new NotFoundException('管理员不存在');
    const data: any = {};
    if (dto.displayName) data.displayName = dto.displayName;
    if (dto.role) data.role = dto.role;
    if (dto.status) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.platformAdmin.update({ where: { id: BigInt(targetId) }, data });
    await this._auditLog(adminId, 'admin_update', 'platform_admin', targetId, JSON.stringify(dto));
    return { message: '已更新' };
  }

  async listAuditLogs(q: { page?: number; pageSize?: number; action?: string; adminId?: number; targetType?: string }) {
    const p = q.page || 1, ps = q.pageSize || 20;
    const w: any = {};
    if (q.action) w.action = q.action;
    if (q.adminId) w.adminId = BigInt(q.adminId);
    if (q.targetType) w.targetType = q.targetType;
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where: w }),
      this.prisma.auditLog.findMany({ where: w, orderBy: { createdAt: 'desc' }, skip: (p - 1) * ps, take: ps, include: { admin: { select: { username: true, displayName: true } } } }),
    ]);
    return { total, page: p, pageSize: ps, items: items.map((l: any) => ({ id: Number(l.id), adminName: l.admin.displayName, action: l.action, targetType: l.targetType, targetId: l.targetId ? Number(l.targetId) : null, detail: l.detail, ip: l.ip, createdAt: l.createdAt })) };
  }

  // -- INTERNAL --
  private async _auditLog(adminId: number, action: string, targetType: string, targetId: number, detail?: string) {
    await this.prisma.auditLog.create({ data: { adminId: BigInt(adminId), action, targetType, targetId: BigInt(targetId), detail } });
  }
}
