/**
 * V3.4 服务广场 — 零工库权限模型 + 申请审核
 *
 * 零工端：
 *   GET  /marketplace/tasks              任务列表（仅零工库关联企业的任务）
 *   GET  /marketplace/tasks/:id          任务详情（校验零工库关系）
 *   POST /marketplace/tasks/:taskId/roles/:roleId/apply  提交申请
 *
 * 企业端：
 *   GET  /tasks/:id/applications         查看某任务的申请列表
 *   POST /tasks/:id/applications/:appId/review  审核申请（确认/婉拒）
 *
 * 零工端（个人）：
 *   GET  /worker/applications            我的申请列表
 */
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, ParseIntPipe, BadRequestException, ForbiddenException,
  ConflictException, NotFoundException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { RecommendationService } from './recommendation.service';

// ── DTOs ──────────────────────────────────────────────

class ApplyDto {
  @IsString()
  @MinLength(20, { message: '自我介绍至少20字' })
  @MaxLength(200, { message: '自我介绍最多200字' })
  intro: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expectPay?: number;

  @IsOptional()
  @IsString()
  availableAt?: string;
}

class ReviewDto {
  @IsIn(['approved', 'rejected'], { message: 'action 必须是 approved 或 rejected' })
  action: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rejectReason?: string;
}

// ── 零工端：服务广场 ─────────────────────────────────

@ApiTags('marketplace')
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MarketplaceController {
  private readonly logger = new Logger(MarketplaceController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendSvc: RecommendationService,
  ) {}

  /**
   * V3.4 核心：获取当前零工所在零工库的企业 ID 列表
   */
  private async getPoolCompanyIds(workerId: bigint): Promise<bigint[]> {
    const pools = await this.prisma.companyWorkerPool.findMany({
      where: {
        workerId,
        inviteStatus: { in: ['registered', 'verified'] },
      },
      select: { companyId: true },
    });
    return pools.map(p => p.companyId);
  }

  // ================================================================
  // GET /marketplace/tasks — 服务广场任务列表（V3.4: 仅零工库企业）
  // ================================================================
  @Get('tasks')
  @ApiOperation({ summary: '服务广场任务列表（仅零工库关联企业）' })
  @ApiQuery({ name: 'roleName', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'taskMode', required: false })
  @ApiQuery({ name: 'sort', required: false, description: 'latest | match | budget' })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'groupBy', required: false, description: 'company' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Query('roleName') roleName?: string,
    @Query('city') city?: string,
    @Query('taskMode') taskMode?: string,
    @Query('sort') sort?: string,
    @Query('keyword') keyword?: string,
    @Query('groupBy') groupBy?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    const p = Number(page);
    const ps = Number(pageSize);

    // V3.4: 获取零工库关联的企业 IDs
    const companyIds = await this.getPoolCompanyIds(BigInt(user.userId));

    // 如果零工不在任何企业的零工库中，返回空 + 提示
    if (companyIds.length === 0) {
      return groupBy === 'company'
        ? { groups: [], companyCount: 0, hint: '您尚未被企业纳入零工库，完善个人资料等待企业邀请' }
        : { total: 0, page: p, pageSize: ps, list: [], companyCount: 0, hint: '您尚未被企业纳入零工库，完善个人资料等待企业邀请' };
    }

    // V3.4: 基础 where — 只查零工库内企业的 published 任务
    const where: any = {
      status: 'published',
      companyId: { in: companyIds },
    };
    if (city) where.address = { contains: city };
    if (taskMode) where.taskMode = taskMode;
    if (keyword) where.title = { contains: keyword };
    if (roleName) where.taskRoles = { some: { roleName: { contains: roleName } } };

    // 按企业分组模式
    if (groupBy === 'company') {
      const tasks = await this.prisma.task.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
          taskRoles: { select: { id: true, roleName: true, headcount: true, budget: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      });

      const groupMap = new Map<string, any>();
      for (const t of tasks) {
        const cid = String(t.companyId);
        if (!groupMap.has(cid)) {
          groupMap.set(cid, { company: { id: Number(t.company.id), name: t.company.name, logoUrl: t.company.logoUrl }, tasks: [] });
        }
        groupMap.get(cid).tasks.push({
          taskId: Number(t.id),
          title: t.title,
          totalBudget: Number(t.totalBudget),
          taskMode: t.taskMode,
          address: t.address,
          publishedAt: t.publishedAt,
          roles: t.taskRoles.map(r => ({ roleName: r.roleName, headcount: r.headcount, budget: Number(r.budget) })),
        });
      }

      return {
        groups: [...groupMap.values()].sort((a, b) => b.tasks.length - a.tasks.length),
        companyCount: companyIds.length,
      };
    }

    // 标准分页模式
    const orderBy: any = sort === 'budget'
      ? { totalBudget: 'desc' }
      : { publishedAt: 'desc' };

    const [list, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
          taskRoles: { select: { id: true, roleName: true, headcount: true, budget: true, skillTags: true } },
        },
        orderBy,
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.task.count({ where }),
    ]);

    // match score
    let scoreMap: Map<number, any> = new Map();
    if (sort === 'match') {
      const rec = await this.recommendSvc.recommendTasksForWorker(user.userId, 200, 1);
      for (const r of rec.list) scoreMap.set(r.taskId, { score: r.score, dimensions: r.dimensions });
    }

    const items = list.map(t => {
      const tid = Number(t.id);
      const recData = scoreMap.get(tid);
      return {
        taskId: tid,
        title: t.title,
        totalBudget: Number(t.totalBudget),
        taskMode: t.taskMode,
        address: t.address,
        publishedAt: t.publishedAt,
        company: { id: Number(t.company.id), name: t.company.name, logoUrl: t.company.logoUrl },
        roles: t.taskRoles.map(r => ({
          roleId: Number(r.id),
          roleName: r.roleName,
          headcount: r.headcount,
          budget: Number(r.budget),
        })),
        matchScore: recData?.score ?? null,
        dimensions: recData?.dimensions ?? null,
      };
    });

    if (sort === 'match') {
      items.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }

    return { total, page: p, pageSize: ps, list: items, companyCount: companyIds.length };
  }

  // ================================================================
  // GET /marketplace/tasks/:id — 任务详情（V3.4: 校验零工库关系）
  // ================================================================
  @Get('tasks/:id')
  @ApiOperation({ summary: '服务广场任务详情（校验零工库关系）' })
  async taskDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: BigInt(id), status: 'published' },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        taskRoles: {
          select: {
            id: true, roleName: true, headcount: true, budget: true,
            skillTags: true, description: true,
            assignments: { select: { id: true }, where: { status: { in: ['invited', 'accepted'] } } },
          },
        },
      },
    });

    if (!task) throw new BadRequestException('任务不存在或未发布');

    // V3.4: 校验零工库关系
    const companyIds = await this.getPoolCompanyIds(BigInt(user.userId));
    if (!companyIds.some(cid => cid === task.companyId)) {
      throw new ForbiddenException('您不在该企业的零工库中，无法查看此任务');
    }

    // 检查当前零工是否已申请过
    const myApplications = await this.prisma.taskApplication.findMany({
      where: { workerId: BigInt(user.userId), taskRole: { taskId: BigInt(id) } },
      select: { id: true, taskRoleId: true, status: true },
    });
    const appliedMap = new Map(myApplications.map(a => [String(a.taskRoleId), a.status]));

    // 获取匹配度
    const rec = await this.recommendSvc.recommendTasksForWorker(user.userId, 200, 1);
    const matchData = rec.list.find(r => r.taskId === id);

    return {
      taskId: Number(task.id),
      title: task.title,
      description: task.description,
      totalBudget: Number(task.totalBudget),
      taskMode: task.taskMode,
      address: task.address,
      startDate: task.startDate,
      endDate: task.endDate,
      publishedAt: task.publishedAt,
      company: { id: Number(task.company.id), name: task.company.name, logoUrl: task.company.logoUrl },
      roles: task.taskRoles.map(r => ({
        roleId: Number(r.id),
        roleName: r.roleName,
        headcount: r.headcount,
        budget: Number(r.budget),
        skillTags: r.skillTags,
        description: r.description,
        filledCount: r.assignments.length,
        myApplicationStatus: appliedMap.get(String(r.id)) ?? null,
      })),
      matchScore: matchData?.score ?? null,
      dimensions: matchData?.dimensions ?? null,
    };
  }

  // ================================================================
  // POST /marketplace/tasks/:taskId/roles/:roleId/apply — 提交申请
  // ================================================================
  @Post('tasks/:taskId/roles/:roleId/apply')
  @ApiOperation({ summary: '零工申请任务角色' })
  async apply(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ApplyDto,
  ) {
    if (user.userType !== 'worker') {
      throw new ForbiddenException('仅零工账号可申请');
    }

    const worker = await this.prisma.worker.findUnique({ where: { id: BigInt(user.userId) } });
    if (!worker?.isVerified) {
      throw new BadRequestException('请先完成实名认证');
    }

    const role = await this.prisma.taskRole.findUnique({
      where: { id: BigInt(roleId) },
      include: { task: true },
    });
    if (!role || Number(role.taskId) !== taskId) {
      throw new BadRequestException('角色不存在');
    }
    if (role.task.status !== 'published') {
      throw new BadRequestException('任务未在招募中');
    }

    // V3.4: 校验零工库关系
    const companyIds = await this.getPoolCompanyIds(BigInt(user.userId));
    if (!companyIds.some(cid => cid === role.task.companyId)) {
      throw new ForbiddenException('您不在该企业的零工库中，无法申请');
    }

    // 检查重复
    const existing = await this.prisma.taskApplication.findUnique({
      where: { taskRoleId_workerId: { taskRoleId: BigInt(roleId), workerId: BigInt(user.userId) } },
    });
    if (existing) {
      if (existing.status === 'pending') throw new ConflictException('您已申请该角色，请等待审核');
      if (existing.status === 'approved') throw new ConflictException('您的申请已通过');
      // rejected → 允许重新申请
      await this.prisma.taskApplication.update({
        where: { id: existing.id },
        data: {
          intro: dto.intro,
          expectPay: dto.expectPay,
          availableAt: dto.availableAt ? new Date(dto.availableAt) : null,
          status: 'pending',
          rejectReason: null,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
      return { message: '重新申请成功，请等待企业审核' };
    }

    await this.prisma.taskApplication.create({
      data: {
        taskRoleId: BigInt(roleId),
        workerId: BigInt(user.userId),
        intro: dto.intro,
        expectPay: dto.expectPay,
        availableAt: dto.availableAt ? new Date(dto.availableAt) : null,
      },
    });

    return { message: '申请成功，请等待企业审核' };
  }
}

// ── 企业端：申请审核 ─────────────────────────────────

@ApiTags('task-applications')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TaskApplicationController {
  private readonly logger = new Logger(TaskApplicationController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // GET /tasks/:id/applications — 企业查看某任务的申请列表
  // ================================================================
  @Get(':id/applications')
  @ApiOperation({ summary: '企业查看任务的申请列表' })
  @ApiQuery({ name: 'status', required: false })
  async listApplications(
    @Param('id', ParseIntPipe) taskId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
  ) {
    if (user.userType !== 'company') {
      throw new ForbiddenException('仅企业账号可查看');
    }

    // 验证任务归属
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');
    if (Number(task.companyId) !== user.companyId) throw new ForbiddenException('无权操作');

    const where: any = { taskRole: { taskId: BigInt(taskId) } };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const applications = await this.prisma.taskApplication.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true, realName: true, avatarUrl: true, city: true,
            avgRating: true, completedCount: true, level: true, bio: true,
          },
        },
        taskRole: {
          select: { id: true, roleName: true, headcount: true, budget: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: applications.length,
      list: applications.map(a => ({
        applicationId: Number(a.id),
        status: a.status,
        intro: a.intro,
        expectPay: a.expectPay ? Number(a.expectPay) : null,
        availableAt: a.availableAt,
        rejectReason: a.rejectReason,
        reviewedAt: a.reviewedAt,
        createdAt: a.createdAt,
        worker: {
          workerId: Number(a.worker.id),
          realName: a.worker.realName,
          avatarUrl: a.worker.avatarUrl,
          city: a.worker.city,
          avgRating: Number(a.worker.avgRating),
          completedCount: a.worker.completedCount,
          level: a.worker.level,
          bio: a.worker.bio,
        },
        role: {
          roleId: Number(a.taskRole.id),
          roleName: a.taskRole.roleName,
          headcount: a.taskRole.headcount,
          budget: Number(a.taskRole.budget),
        },
      })),
    };
  }

  // ================================================================
  // POST /tasks/:id/applications/:appId/review — 企业审核申请
  // V3.4: 确认 → 直接创建 accepted 分配；婉拒 → 仅记录
  // ================================================================
  @Post(':id/applications/:appId/review')
  @ApiOperation({ summary: '企业审核申请（确认→直接执行/婉拒→仅记录）' })
  async reviewApplication(
    @Param('id', ParseIntPipe) taskId: number,
    @Param('appId', ParseIntPipe) appId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReviewDto,
  ) {
    if (user.userType !== 'company') {
      throw new ForbiddenException('仅企业账号可审核');
    }

    // 验证任务归属
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');
    if (Number(task.companyId) !== user.companyId) throw new ForbiddenException('无权操作');

    // 获取申请记录
    const application = await this.prisma.taskApplication.findUnique({
      where: { id: BigInt(appId) },
      include: { taskRole: true },
    });
    if (!application) throw new NotFoundException('申请记录不存在');
    if (Number(application.taskRole.taskId) !== taskId) throw new BadRequestException('申请不属于该任务');
    if (application.status !== 'pending') throw new BadRequestException('该申请已处理');

    if (dto.action === 'approved') {
      // ── 确认：检查槽位 + 创建 accepted 分配 ──
      const activeAssignments = await this.prisma.roleAssignment.count({
        where: {
          taskRoleId: application.taskRoleId,
          status: { in: ['invited', 'accepted'] },
        },
      });
      if (activeAssignments >= application.taskRole.headcount) {
        throw new BadRequestException('该角色已招满，无法确认');
      }

      // V3.4 事务：更新申请 + 创建 accepted 分配 + 自动流转任务状态
      await this.prisma.$transaction(async (tx) => {
        // 更新申请状态
        await tx.taskApplication.update({
          where: { id: BigInt(appId) },
          data: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedBy: BigInt(user.userId),
          },
        });

        // V3.4: 直接创建 accepted 分配（跳过 invited）
        await tx.roleAssignment.create({
          data: {
            taskRoleId: application.taskRoleId,
            workerId: application.workerId,
            slotIndex: activeAssignments + 1,
            status: 'accepted',
            acceptedAt: new Date(),
          },
        });

        // 任务状态自动流转：published → in_progress
        if (task.status === 'published') {
          await tx.task.update({
            where: { id: BigInt(taskId) },
            data: { status: 'in_progress' },
          });
          this.logger.log(`任务自动流转: ${taskId} → in_progress (V3.4 申请确认触发)`);
        }
      });

      this.logger.log(`V3.4 申请确认: app=${appId}, task=${taskId}, worker=${application.workerId}`);
      return { message: '已确认，零工已进入执行状态' };

    } else {
      // ── 婉拒：仅更新申请状态，不影响任务 ──
      if (!dto.rejectReason) {
        throw new BadRequestException('婉拒时必须填写原因');
      }

      await this.prisma.taskApplication.update({
        where: { id: BigInt(appId) },
        data: {
          status: 'rejected',
          rejectReason: dto.rejectReason,
          reviewedAt: new Date(),
          reviewedBy: BigInt(user.userId),
        },
      });

      this.logger.log(`V3.4 申请婉拒: app=${appId}, task=${taskId}, reason=${dto.rejectReason}`);
      return { message: '已婉拒，已通知零工' };
    }
  }
}

// ── 零工端：我的申请记录 ──────────────────────────────

@ApiTags('worker-applications')
@Controller('worker')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WorkerApplicationController {
  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // GET /worker/applications — 零工查看自己的申请历史
  // ================================================================
  @Get('applications')
  @ApiOperation({ summary: '零工申请记录列表' })
  @ApiQuery({ name: 'status', required: false })
  async myApplications(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
  ) {
    if (user.userType !== 'worker') {
      throw new ForbiddenException('仅零工账号可查看');
    }

    const where: any = { workerId: BigInt(user.userId) };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const applications = await this.prisma.taskApplication.findMany({
      where,
      include: {
        taskRole: {
          include: {
            task: {
              select: {
                id: true, title: true, status: true, taskMode: true,
                company: { select: { id: true, name: true, logoUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: applications.length,
      list: applications.map(a => ({
        applicationId: Number(a.id),
        status: a.status,
        intro: a.intro,
        expectPay: a.expectPay ? Number(a.expectPay) : null,
        rejectReason: a.rejectReason,
        reviewedAt: a.reviewedAt,
        createdAt: a.createdAt,
        role: {
          roleId: Number(a.taskRole.id),
          roleName: a.taskRole.roleName,
          budget: Number(a.taskRole.budget),
        },
        task: {
          taskId: Number(a.taskRole.task.id),
          title: a.taskRole.task.title,
          status: a.taskRole.task.status,
          taskMode: a.taskRole.task.taskMode,
          company: { id: Number(a.taskRole.task.company.id), name: a.taskRole.task.company.name, logoUrl: a.taskRole.task.company.logoUrl },
        },
      })),
    };
  }
}
