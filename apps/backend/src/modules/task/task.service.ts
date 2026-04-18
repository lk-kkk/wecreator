import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { assertTransition } from './task-status.machine';
import {
  CreateTaskDto,
  UpdateDraftDto,
  SetTaskRolesDto,
  TaskQueryDto,
} from './dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 创建任务（草稿）
  // ================================================================
  async createTask(companyId: number, userId: number, dto: CreateTaskDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          companyId: BigInt(companyId),
          createdBy: BigInt(userId),
          title: dto.title,
          description: dto.description,
          taskMode: dto.taskMode as any,
          totalBudget: dto.totalBudget,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          address: dto.address,
          status: 'draft',
        },
      });

      // 如果同时传了角色列表
      if (dto.roles && dto.roles.length > 0) {
        await tx.taskRole.createMany({
          data: dto.roles.map((r) => ({
            taskId: task.id,
            roleName: r.roleName,
            headcount: r.headcount,
            budget: r.budget,
            skillTags: r.skillTags,
            description: r.description,
          })),
        });
      }

      return task;
    });

    this.logger.log(`任务创建: ${dto.title} (ID: ${result.id})`);

    return {
      taskId: Number(result.id),
      status: 'draft',
      message: '任务创建成功（草稿）',
    };
  }

  // ================================================================
  // 草稿自动保存（merge更新）
  // ================================================================
  async updateDraft(taskId: number, companyId: number, dto: UpdateDraftDto) {
    const task = await this.getTaskOrThrow(taskId, companyId);

    if (task.status !== 'draft') {
      throw new BadRequestException('只有草稿状态可以编辑');
    }

    // 过滤掉undefined字段，实现merge
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.totalBudget !== undefined) data.totalBudget = dto.totalBudget;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.address !== undefined) data.address = dto.address;

    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data,
    });

    return { message: '草稿已保存' };
  }

  // ================================================================
  // 配置角色岗位（覆盖）
  // ================================================================
  async setTaskRoles(taskId: number, companyId: number, dto: SetTaskRolesDto) {
    const task = await this.getTaskOrThrow(taskId, companyId);

    if (task.status !== 'draft') {
      throw new BadRequestException('只有草稿状态可以配置角色');
    }

    await this.prisma.$transaction(async (tx) => {
      // 删除旧角色
      await tx.taskRole.deleteMany({ where: { taskId: BigInt(taskId) } });

      // 创建新角色
      await tx.taskRole.createMany({
        data: dto.roles.map((r) => ({
          taskId: BigInt(taskId),
          roleName: r.roleName,
          headcount: r.headcount,
          budget: r.budget,
          skillTags: r.skillTags,
          description: r.description,
        })),
      });
    });

    return { message: `已配置 ${dto.roles.length} 个角色岗位` };
  }

  // ================================================================
  // 提交发布
  // ================================================================
  async publishTask(taskId: number, companyId: number) {
    const task = await this.getTaskOrThrow(taskId, companyId);

    assertTransition(task.status, 'pending_review');

    // 数据完整性校验
    if (!task.title) throw new BadRequestException('任务标题不能为空');
    if (!task.taskMode) throw new BadRequestException('任务模式未选择');
    if (Number(task.totalBudget) <= 0) throw new BadRequestException('总预算必须大于0');

    // 日期校验
    if (task.startDate && task.endDate) {
      if (new Date(task.endDate) <= new Date(task.startDate)) {
        throw new BadRequestException('结束日期必须晚于开始日期');
      }
    }
    if (task.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(task.endDate) < today) {
        throw new BadRequestException('结束日期不能早于今天');
      }
    }

    const roles = await this.prisma.taskRole.findMany({
      where: { taskId: BigInt(taskId) },
    });
    if (roles.length === 0) throw new BadRequestException('至少配置一个角色岗位');

    // 角色预算合计校验
    const rolesBudgetSum = roles.reduce((s, r) => s + Number(r.budget), 0);
    if (rolesBudgetSum > Number(task.totalBudget)) {
      throw new BadRequestException('角色预算合计超过总预算');
    }

    // MVP阶段：自动通过审核 → published
    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    this.logger.log(`任务发布: ID=${taskId}`);

    return { message: '任务发布成功', status: 'published' };
  }

  // ================================================================
  // 任务列表（多维筛选+分页+排序）
  // ================================================================
  async getTaskList(companyId: number, query: TaskQueryDto) {
    const {
      status, keyword, taskMode,
      sortBy = 'createdAt', sortOrder = 'desc',
      createdFrom, createdTo,
      hasPendingApplications,
      page = 1, pageSize = 20,
    } = query;

    const where: any = { companyId: BigInt(companyId) };
    if (status) where.status = status;
    if (taskMode) where.taskMode = taskMode;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    // 日期范围筛选
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo)   where.createdAt.lte = new Date(createdTo);
    }

    // 排序
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [list, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          taskRoles: {
            include: {
              _count: { select: { assignments: true } },
              applications: {
                where: { status: 'pending' },
                select: { id: true },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    // 组装结果
    let result = list.map((t: any) => {
      const pendingCount = t.taskRoles.reduce(
        (sum: number, r: any) => sum + (r.applications?.length ?? 0), 0,
      );
      const totalHeadcount = t.taskRoles.reduce(
        (sum: number, r: any) => sum + r.headcount, 0,
      );
      const filledCount = t.taskRoles.reduce(
        (sum: number, r: any) => sum + (r._count?.assignments ?? 0), 0,
      );

      return {
        ...this.formatTask(t),
        pendingApplications: pendingCount,
        totalHeadcount,
        filledCount,
        roles: t.taskRoles.map((r: any) => ({
          id: Number(r.id),
          roleName: r.roleName,
          headcount: r.headcount,
          budget: Number(r.budget),
          filledCount: r._count?.assignments ?? 0,
          pendingApplications: r.applications?.length ?? 0,
        })),
      };
    });

    // 待审批过滤（内存级 — 后续大数据量可迁移到 SQL 子查询）
    if (hasPendingApplications) {
      result = result.filter((t) => t.pendingApplications > 0);
    }

    return {
      list: result,
      total: hasPendingApplications ? result.length : total,
      page,
      pageSize,
    };
  }

  // ================================================================
  // 任务详情
  // ================================================================
  async getTaskDetail(taskId: number, companyId?: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(taskId) },
      include: {
        taskRoles: {
          include: {
            assignments: {
              include: { worker: true },
            },
            applications: {
              select: { id: true, status: true },
            },
          },
        },
        deliverables: { orderBy: { submittedAt: 'desc' } },
      },
    });

    if (!task) throw new NotFoundException('任务不存在');
    if (companyId && Number(task.companyId) !== companyId) {
      throw new ForbiddenException('无权查看此任务');
    }

    // 计算聚合进度
    let totalProgress = 0;
    let assignmentCount = 0;
    const roles = task.taskRoles.map((r: any) => {
      const accepted = r.assignments.filter((a: any) => ['accepted', 'completed'].includes(a.status));
      accepted.forEach((a: any) => {
        totalProgress += a.progress;
        assignmentCount++;
      });

      return {
        id: Number(r.id),
        roleName: r.roleName,
        headcount: r.headcount,
        budget: Number(r.budget),
        skillTags: r.skillTags,
        description: r.description,
        filledCount: r.assignments.length,
        pendingApplications: r.applications?.filter((a: any) => a.status === 'pending').length ?? 0,
        assignments: r.assignments.map((a: any) => ({
          id: Number(a.id),
          slotIndex: a.slotIndex,
          status: a.status,
          progress: a.progress,
          worker: a.worker ? {
            id: Number(a.worker.id),
            realName: a.worker.realName,
            avatarUrl: a.worker.avatarUrl,
            avgRating: Number(a.worker.avgRating),
          } : null,
        })),
      };
    });

    const totalHeadcount = roles.reduce((s, r) => s + r.headcount, 0);
    const filledCount = roles.reduce((s, r) => s + r.filledCount, 0);
    const avgProgress = assignmentCount > 0 ? Math.round(totalProgress / assignmentCount) : 0;

    return {
      ...this.formatTask(task),
      description: task.description,
      address: task.address,
      totalHeadcount,
      filledCount,
      avgProgress,
      roles,
      deliverables: task.deliverables.map((d) => ({
        id: Number(d.id),
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        version: d.version,
        status: d.status,
        submittedAt: d.submittedAt,
      })),
    };
  }

  // ================================================================
  // 平台角色库
  // ================================================================
  async getPlatformRoles() {
    const roles = await this.prisma.platformRole.findMany({
      orderBy: { category: 'asc' },
    });
    return roles.map((r) => ({
      id: Number(r.id),
      roleName: r.roleName,
      category: r.category,
      description: r.description,
      suggestedDaily: r.suggestedDaily ? Number(r.suggestedDaily) : null,
      skillTags: r.skillTags,
    }));
  }

  // ================================================================
  // 技能标签字典
  // ================================================================
  async getSkillTags(category?: string) {
    const where: any = {};
    if (category) where.category = category;

    const tags = await this.prisma.skillTag.findMany({
      where,
      orderBy: [{ hot: 'desc' }, { name: 'asc' }],
    });
    return tags.map((t) => ({
      id: Number(t.id),
      name: t.name,
      category: t.category,
      hot: t.hot,
    }));
  }

  // ================================================================
  // 取消任务
  // ================================================================
  async cancelTask(taskId: number, companyId: number) {
    const task = await this.getTaskOrThrow(taskId, companyId);
    assertTransition(task.status, 'cancelled');

    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data: { status: 'cancelled' },
    });

    return { message: '任务已取消' };
  }

  // ================================================================
  // 私有方法
  // ================================================================

  private async getTaskOrThrow(taskId: number, companyId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(taskId) },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (Number(task.companyId) !== companyId) {
      throw new ForbiddenException('无权操作此任务');
    }
    return task;
  }

  private formatTask(task: any) {
    return {
      taskId: Number(task.id),
      title: task.title,
      taskMode: task.taskMode,
      status: task.status,
      totalBudget: Number(task.totalBudget),
      lockedAmount: Number(task.lockedAmount),
      startDate: task.startDate,
      endDate: task.endDate,
      publishedAt: task.publishedAt,
      createdAt: task.createdAt,
      roleCount: task.taskRoles?.length || 0,
    };
  }

  // ================================================================
  // W4 — 更新进度（只增不减）
  // POST /worker/tasks/:assignmentId/progress
  // ================================================================
  async updateProgress(assignmentId: number, workerId: number, progress: number, note?: string) {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: {
        id: BigInt(assignmentId),
        workerId: BigInt(workerId),
        status: 'accepted',
      },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在或无权操作');
    if (progress <= assignment.progress) {
      throw new BadRequestException(`进度只能增加，当前已是 ${assignment.progress}%`);
    }
    await this.prisma.roleAssignment.update({
      where: { id: BigInt(assignmentId) },
      data: { progress, updatedAt: new Date() },
    });
    return { assignmentId, progress };
  }

  // ================================================================
  // W4 — 提交交付物（版本管理）
  // POST /worker/tasks/:assignmentId/deliverables
  // ================================================================
  async submitDeliverable(
    assignmentId: number,
    workerId: number,
    dto: { fileUrl: string; fileName: string; fileSize?: number; fileType?: string },
  ) {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { id: BigInt(assignmentId), workerId: BigInt(workerId) },
      include: { taskRole: true },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    const lastVersion = await this.prisma.deliverable.findFirst({
      where: { assignmentId: BigInt(assignmentId) },
      orderBy: { version: 'desc' },
    });
    const version = (lastVersion?.version ?? 0) + 1;
    const deliverable = await this.prisma.deliverable.create({
      data: {
        taskId:       assignment.taskRole.taskId,
        assignmentId: BigInt(assignmentId),
        fileUrl:      dto.fileUrl,
        fileName:     dto.fileName,
        fileSize:     dto.fileSize ? BigInt(dto.fileSize) : null,
        fileType:     dto.fileType ?? null,
        version,
        status:       'submitted',
      },
    });
    this.logger.log(`交付物提交: assignment=${assignmentId} v${version}`);
    return {
      deliverableId: Number(deliverable.id),
      version,
      fileUrl:       deliverable.fileUrl,
      fileName:      deliverable.fileName,
      submittedAt:   deliverable.submittedAt,
    };
  }

  // ================================================================
  // W4 — 企业验收（通过/退回）
  // POST /tasks/:taskId/roles/:roleId/review
  // ================================================================
  async reviewDeliverable(
    taskId: number,
    taskRoleId: number,
    companyId: number,
    result: 'approved' | 'rejected',
    reviewNote?: string,
  ) {
    if (result === 'rejected' && !reviewNote) {
      throw new BadRequestException('退回时必须填写原因');
    }
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { taskRoleId: BigInt(taskRoleId), status: 'accepted' },
    });
    if (!assignment) throw new NotFoundException('未找到已接单的分配记录');
    const deliverable = await this.prisma.deliverable.findFirst({
      where: { assignmentId: assignment.id, status: 'submitted' },
      orderBy: { version: 'desc' },
    });
    if (!deliverable) throw new NotFoundException('没有待验收的交付物');
    await this.prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        status:     result === 'approved' ? 'approved' : 'rejected',
        reviewNote: reviewNote ?? null,
        reviewedAt: new Date(),
      },
    });
    this.logger.log(`验收结果: task=${taskId} role=${taskRoleId} result=${result}`);
    return { taskRoleId, deliverableId: Number(deliverable.id), result, reviewNote };
  }

  // ================================================================
  // W4 — 任务详情（含角色、交付物）
  // ================================================================
  async getTaskDetailFull(taskId: number, companyId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(taskId) },
      include: {
        taskRoles: {
          include: {
            assignments: {
              where: { status: { in: ['accepted', 'completed'] } },
              include: { worker: { select: { id: true, realName: true, avatarUrl: true } } },
            },
          },
        },
      },
    }) as any;
    if (!task) throw new NotFoundException('任务不存在');
    if (Number(task.companyId) !== companyId) throw new ForbiddenException();
    const deliverables = await this.prisma.deliverable.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: [{ assignmentId: 'asc' }, { version: 'desc' }],
    });
    return {
      taskId:      Number(task.id),
      title:       task.title,
      description: task.description,
      taskMode:    task.taskMode,
      status:      task.status,
      totalBudget: Number(task.totalBudget),
      lockedAmount: Number(task.lockedAmount),
      startDate:   task.startDate,
      endDate:     task.endDate,
      address:     task.address,
      publishedAt: task.publishedAt,
      roles: task.taskRoles.map((role) => ({
        taskRoleId:   Number(role.id),
        roleName:     role.roleName,
        headcount:    role.headcount,
        budget:       Number(role.budget),
        skillTags:    role.skillTags,
        description:  role.description,
        assignments:  role.assignments.map((a) => ({
          assignmentId: Number(a.id),
          workerId:     Number(a.workerId),
          workerName:   (a as any).worker?.realName ?? '',
          workerAvatar: (a as any).worker?.avatarUrl ?? '',
          status:       a.status,
          progress:     a.progress,
          acceptedAt:   a.acceptedAt,
        })),
      })),
      deliverables: deliverables.map((d) => ({
        deliverableId: Number(d.id),
        assignmentId:  Number(d.assignmentId),
        fileUrl:       d.fileUrl,
        fileName:      d.fileName,
        fileSize:      d.fileSize ? Number(d.fileSize) : null,
        fileType:      d.fileType,
        version:       d.version,
        status:        d.status,
        reviewNote:    d.reviewNote,
        submittedAt:   d.submittedAt,
        reviewedAt:    d.reviewedAt,
      })),
    };
  }

}
