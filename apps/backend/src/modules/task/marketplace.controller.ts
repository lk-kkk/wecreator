/**
 * V3.3 服务广场 — 零工端公开任务浏览 + 报名投递
 *
 * GET  /marketplace/tasks              任务列表（筛选/搜索/分页/企业分组）
 * GET  /marketplace/tasks/:id          任务详情（仅 published）
 * POST /marketplace/tasks/:taskId/roles/:roleId/apply  报名投递
 */
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, ParseIntPipe, BadRequestException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { RecommendationService } from './recommendation.service';

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

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendSvc: RecommendationService,
  ) {}

  // ================================================================
  // GET /marketplace/tasks — 服务广场任务列表
  // ================================================================
  @Get('tasks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '服务广场任务列表' })
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

    // 基础 where：只查 published 任务
    const where: any = { status: 'published' };
    if (city) where.address = { contains: city };
    if (taskMode) where.taskMode = taskMode;
    if (keyword) where.title = { contains: keyword };

    // 角色筛选：需要 join taskRoles
    if (roleName) {
      where.taskRoles = { some: { roleName: { contains: roleName } } };
    }

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

      // 按企业 ID 分组
      const groupMap = new Map<string, any>();
      for (const t of tasks) {
        const cid = String(t.companyId);
        if (!groupMap.has(cid)) {
          groupMap.set(cid, {
            company: t.company,
            tasks: [],
          });
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

    // 如果排序方式是 match，获取推荐分数
    let scoreMap: Map<number, any> = new Map();
    if (sort === 'match') {
      const rec = await this.recommendSvc.recommendTasksForWorker(user.userId, 200, 1);
      for (const r of rec.list) {
        scoreMap.set(r.taskId, { score: r.score, dimensions: r.dimensions });
      }
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
        company: t.company,
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

    // 如果 sort === match，按分数排序
    if (sort === 'match') {
      items.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }

    return { total, page: p, pageSize: ps, list: items };
  }

  // ================================================================
  // GET /marketplace/tasks/:id — 任务详情
  // ================================================================
  @Get('tasks/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '服务广场任务详情' })
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

    // 检查当前零工是否已报名过
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
      company: task.company,
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
  // POST /marketplace/tasks/:taskId/roles/:roleId/apply — 报名投递
  // ================================================================
  @Post('tasks/:taskId/roles/:roleId/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '零工报名投递' })
  async apply(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ApplyDto,
  ) {
    if (user.userType !== 'worker') {
      throw new ForbiddenException('仅零工账号可报名');
    }

    // 验证零工已实名
    const worker = await this.prisma.worker.findUnique({ where: { id: BigInt(user.userId) } });
    if (!worker?.isVerified) {
      throw new BadRequestException('请先完成实名认证');
    }

    // 验证任务和角色存在且已发布
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

    // 检查重复报名
    const existing = await this.prisma.taskApplication.findUnique({
      where: { taskRoleId_workerId: { taskRoleId: BigInt(roleId), workerId: BigInt(user.userId) } },
    });
    if (existing) {
      if (existing.status === 'pending') throw new ConflictException('您已报名该角色，请等待审核');
      if (existing.status === 'approved') throw new ConflictException('您的报名已通过');
      // rejected → 允许重新报名，更新记录
      await this.prisma.taskApplication.update({
        where: { id: existing.id },
        data: {
          intro: dto.intro,
          expectPay: dto.expectPay,
          availableAt: dto.availableAt ? new Date(dto.availableAt) : null,
          status: 'pending',
          rejectReason: null,
        },
      });
      return { message: '重新报名成功，请等待企业审核' };
    }

    // 创建报名
    await this.prisma.taskApplication.create({
      data: {
        taskRoleId: BigInt(roleId),
        workerId: BigInt(user.userId),
        intro: dto.intro,
        expectPay: dto.expectPay,
        availableAt: dto.availableAt ? new Date(dto.availableAt) : null,
      },
    });

    return { message: '报名成功，请等待企业审核' };
  }
}
