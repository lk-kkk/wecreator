/**
 * RecommendationService — 双向推荐（S2-010）
 *
 * 零工推荐评分公式（企业侧：为任务推荐零工）：
 *   score = avgRating×0.40 + completionRate×0.30 + completedCount_norm×0.20 + skillMatch×0.10
 *
 * 任务推荐评分公式（零工侧：为零工推荐任务）：
 *   score = skillMatch×0.50 + cityMatch×0.20 + budgetFit×0.20 + freshness×0.10
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

// ── 推荐结果类型 ─────────────────────────────────────
export interface WorkerScore {
  workerId:       number;
  realName:       string | null;
  avatarUrl:      string | null;
  avgRating:      number;
  completionRate: number;
  completedCount: number;
  level:          string;
  roles:          string[];
  skillTags:      string[];
  score:          number;             // 0-100
  dimensions: {
    ratingScore:       number;
    completionScore:   number;
    experienceScore:   number;
    skillMatchScore:   number;
  };
}

export interface TaskScore {
  taskId:      number;
  title:       string;
  companyName: string;
  taskMode:    string;
  budget:      number;
  startDate:   Date | null;
  endDate:     Date | null;
  address:     string | null;
  roles:       string[];
  score:       number;
  dimensions: {
    skillMatch:  number;
    cityMatch:   number;
    budgetFit:   number;
    freshness:   number;
  };
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // S2-010 企业侧：为任务角色推荐零工
  // ================================================================
  async recommendWorkersForRole(
    taskRoleId: number,
    limit = 20,
  ): Promise<WorkerScore[]> {
    // 获取岗位需求
    const role = await this.prisma.taskRole.findUnique({
      where:   { id: BigInt(taskRoleId) },
      include: { task: true },
    });
    if (!role) return [];

    const requiredSkills  = this._parseTags((role as any).skillTags ?? '');
    const requiredRoleName = (role as any).roleName ?? '';

    // 已被分配的零工（排除）
    const assignedWorkerIds = await this.prisma.roleAssignment.findMany({
      where:  { taskRoleId: BigInt(taskRoleId), status: { in: ['invited', 'accepted'] } },
      select: { workerId: true },
    });
    const excludeSet = new Set(assignedWorkerIds.map(a => a.workerId));

    // 拉取候选零工（已实名 + 活跃）
    const workers = await this.prisma.worker.findMany({
      where: {
        isVerified: true,
        status:     'active',
        id:         excludeSet.size > 0 ? { notIn: [...excludeSet] } : undefined,
      },
      include: { workerRoles: true },
      take:    200,
    });

    // 计算评分
    const scored: WorkerScore[] = workers.map(w => {
      const avgRating      = Number(w.avgRating ?? 0);            // 0-5
      const completionRate = Number(w.completionRate ?? 0);        // 0-1
      const completedCount = w.completedCount;                     // 0+

      // 技能匹配度
      const workerSkills = w.workerRoles.flatMap(r =>
        this._parseTags((r as any).skillTags ?? ''),
      );
      const workerRoleNames = w.workerRoles.map(r => (r as any).roleName as string);
      const skillMatch = this._calcSkillMatch(requiredSkills, workerSkills, requiredRoleName, workerRoleNames);

      // 各维度得分（归一化到 0-100）
      const ratingScore       = (avgRating / 5) * 100;
      const completionScore   = completionRate * 100;
      const experienceScore   = Math.min((completedCount / 20) * 100, 100); // 20单视为满分
      const skillMatchScore   = skillMatch * 100;

      // 加权综合分
      const score = Math.round(
        ratingScore * 0.40 +
        completionScore * 0.30 +
        experienceScore * 0.20 +
        skillMatchScore * 0.10,
      );

      return {
        workerId:       Number(w.id),
        realName:       w.realName,
        avatarUrl:      w.avatarUrl,
        avgRating,
        completionRate,
        completedCount,
        level:          w.level,
        roles:          workerRoleNames,
        skillTags:      workerSkills.slice(0, 10),
        score,
        dimensions: {
          ratingScore:     Math.round(ratingScore),
          completionScore: Math.round(completionScore),
          experienceScore: Math.round(experienceScore),
          skillMatchScore: Math.round(skillMatchScore),
        },
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // ================================================================
  // S2-016 零工侧：为零工推荐任务
  // ================================================================
  async recommendTasksForWorker(
    workerId: number,
    limit = 20,
    page = 1,
  ): Promise<{ total: number; list: TaskScore[] }> {
    const worker = await this.prisma.worker.findUnique({
      where:   { id: BigInt(workerId) },
      include: { workerRoles: true },
    });
    if (!worker) return { total: 0, list: [] };

    const workerSkills    = worker.workerRoles.flatMap(r => this._parseTags((r as any).skillTags ?? ''));
    const workerRoleNames = worker.workerRoles.map(r => (r as any).roleName as string);
    const workerCity      = worker.city ?? '';

    // 已参与或拒绝的任务（排除）
    const participated = await this.prisma.roleAssignment.findMany({
      where:   { workerId: BigInt(workerId) },
      select:  { taskRole: { select: { taskId: true } } },
    });
    const excludeTaskIds = new Set(participated.map(a => (a as any).taskRole.taskId));

    // 获取已发布的任务
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'published',
        id:     excludeTaskIds.size > 0 ? { notIn: [...excludeTaskIds] } : undefined,
        // 过滤有空缺的任务（简化：直接取 published 任务）
      },
      include: {
        company:   { select: { name: true } },
        taskRoles: true,
      },
      orderBy: { publishedAt: 'desc' },
      take:    200,
    });

    const now = Date.now();

    const scored: TaskScore[] = tasks.map(t => {
      const taskSkills    = t.taskRoles.flatMap(r => this._parseTags((r as any).skillTags ?? ''));
      const taskRoleNames = t.taskRoles.map(r => (r as any).roleName as string);

      // 技能匹配
      const skillMatch = this._calcSkillMatch(workerSkills, taskSkills, '', taskRoleNames);
      const cityMatch  = workerCity && t.address && t.address.includes(workerCity) ? 1 : 0;
      const budget     = Number(t.totalBudget);

      // 预算适配（简化：以 5000 元为基准，越接近越高）
      const budgetFit = Math.max(0, 1 - Math.abs(budget - 5000) / 50000);

      // 新鲜度（发布时间越近越高，7天内满分）
      const publishedAt = t.publishedAt ? t.publishedAt.getTime() : now;
      const ageDays     = (now - publishedAt) / (1000 * 86400);
      const freshness   = Math.max(0, 1 - ageDays / 30);  // 30天后归零

      const score = Math.round(
        skillMatch * 50 +
        cityMatch  * 20 +
        budgetFit  * 20 +
        freshness  * 10,
      );

      return {
        taskId:      Number(t.id),
        title:       t.title,
        companyName: (t.company as any)?.name ?? '',
        taskMode:    t.taskMode,
        budget,
        startDate:   t.startDate,
        endDate:     t.endDate,
        address:     t.address,
        roles:       taskRoleNames,
        score,
        dimensions: {
          skillMatch:  Math.round(skillMatch * 100),
          cityMatch:   Math.round(cityMatch  * 100),
          budgetFit:   Math.round(budgetFit  * 100),
          freshness:   Math.round(freshness  * 100),
        },
      };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const start  = (page - 1) * limit;
    return {
      total: sorted.length,
      list:  sorted.slice(start, start + limit),
    };
  }

  // ================================================================
  // 搜索零工（关键词 + 技能 + 城市）
  // ================================================================
  async searchWorkers(params: {
    keyword?: string;
    city?: string;
    skillTag?: string;
    minRating?: number;
    page?: number;
    pageSize?: number;
  }) {
    const { keyword, city, skillTag, minRating = 0, page = 1, pageSize = 20 } = params;

    const where: any = { isVerified: true, status: 'active' };
    if (city)    where.city    = { contains: city };
    if (keyword) where.realName = { contains: keyword };
    if (minRating > 0) where.avgRating = { gte: minRating };

    const [list, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: { workerRoles: true },
        orderBy: [{ avgRating: 'desc' }, { completedCount: 'desc' }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      this.prisma.worker.count({ where }),
    ]);

    return {
      total, page, pageSize,
      list: list
        .filter(w => !skillTag || w.workerRoles.some(r =>
          (r as any).skillTags?.includes(skillTag),
        ))
        .map(w => ({
          workerId:       Number(w.id),
          realName:       w.realName,
          avatarUrl:      w.avatarUrl,
          city:           w.city,
          avgRating:      Number(w.avgRating),
          completionRate: Number(w.completionRate),
          completedCount: w.completedCount,
          level:          w.level,
          roles:          w.workerRoles.map(r => (r as any).roleName),
          skillTags:      w.workerRoles.flatMap(r => this._parseTags((r as any).skillTags ?? '')).slice(0, 8),
        })),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /** 解析逗号分隔的技能标签 */
  private _parseTags(raw: string): string[] {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  /** 计算技能匹配度（Jaccard 相似度 + 角色名匹配加成） */
  private _calcSkillMatch(
    skills1: string[],
    skills2: string[],
    roleName1: string,
    roleNames2: string[],
  ): number {
    if (skills1.length === 0 && skills2.length === 0) return 0.5; // 无标签时中性分

    const set1 = new Set(skills1.map(s => s.toLowerCase()));
    const set2 = new Set(skills2.map(s => s.toLowerCase()));

    const intersection = [...set1].filter(s => set2.has(s)).length;
    const union        = new Set([...set1, ...set2]).size;
    const jaccard      = union > 0 ? intersection / union : 0;

    // 角色名匹配加成 (+0.2)
    const roleBonus = roleName1 && roleNames2.some(r =>
      r.toLowerCase().includes(roleName1.toLowerCase()) ||
      roleName1.toLowerCase().includes(r.toLowerCase()),
    ) ? 0.2 : 0;

    return Math.min(1, jaccard + roleBonus);
  }
}
