import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { NoGeneratorService } from '../../common';
import { assertTransition } from './task-status.machine';
import { ProjectService } from '../project/project.service';
import { CompanyNotificationService } from '../notification/company-notification.service';
import {
  CreateTaskDto,
  UpdateDraftDto,
  SetTaskRolesDto,
  TaskQueryDto,
} from './dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly noGen: NoGeneratorService,
    private readonly projectService: ProjectService,
    private readonly companyNotificationService: CompanyNotificationService,
  ) {}

  // ================================================================
  // 创建任务（草稿）
  // ================================================================
  async createTask(companyId: number, userId: number, dto: CreateTaskDto) {
    const taskNo = await this.noGen.nextTaskNo();
    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          companyId: BigInt(companyId),
          createdBy: BigInt(userId),
          taskNo, // V3.7
          title: dto.title,
          description: dto.description,
          taskMode: dto.taskMode as any,
          totalBudget: dto.totalBudget,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          address: dto.address,
          projectId: dto.projectId ? BigInt(dto.projectId) : undefined,
          milestoneId: dto.milestoneId ? BigInt(dto.milestoneId) : undefined,
          status: 'draft',
          // V3.7
          priority: (dto.priority as any) || 'p2',
          acceptanceCriteria: dto.acceptanceCriteria,
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
      taskNo: result.taskNo, // V3.7
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
    // V3.7
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.acceptanceCriteria !== undefined) data.acceptanceCriteria = dto.acceptanceCriteria;
    // V3.8: 里程碑关联
    if (dto.milestoneId !== undefined) data.milestoneId = dto.milestoneId ? BigInt(dto.milestoneId) : null;

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
      priority, riskLevel, // V3.7
      sortBy = 'createdAt', sortOrder = 'desc',
      createdFrom, createdTo,
      hasPendingApplications,
      page = 1, pageSize = 20,
    } = query;

    const where: any = { companyId: BigInt(companyId) };
    if (status) where.status = status;
    if (taskMode) where.taskMode = taskMode;
    if (priority) where.priority = priority; // V3.7
    if (riskLevel) where.riskLevel = riskLevel; // V3.7
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
          milestone: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          taskRoles: {
            include: {
              _count: {
                select: {
                  assignments: { where: { status: { in: ['accepted', 'completed'] } } },
                },
              },
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
        milestone: { select: { id: true, name: true, status: true, plannedDate: true } },
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
        attachments: { orderBy: { createdAt: 'asc' } },
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
        filledCount: r.assignments.filter((a: any) => ['accepted', 'completed'].includes(a.status)).length,
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
      attachments: ((task as any).attachments || []).map((a: any) => ({
        attachmentId: Number(a.id),
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: Number(a.fileSize),
        fileType: a.fileType,
        createdAt: a.createdAt,
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

  /**
   * 删除任务（仅允许删除草稿/已取消/已关闭状态的任务）
   */
  async deleteTask(taskId: number, companyId: number) {
    const task = await this.getTaskOrThrow(taskId, companyId);
    const deletableStatuses = ['draft', 'cancelled', 'closed'];
    if (!deletableStatuses.includes(task.status)) {
      throw new ForbiddenException(
        '只能删除草稿、已取消或已关闭状态的任务',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 删除关联数据
      await tx.taskAttachment.deleteMany({ where: { taskId: BigInt(taskId) } });
      await tx.taskCheckpoint.deleteMany({ where: { taskId: BigInt(taskId) } });
      await tx.taskComment.deleteMany({ where: { taskId: BigInt(taskId) } });
      await tx.taskIssue.deleteMany({ where: { taskId: BigInt(taskId) } });
      await tx.taskRole.deleteMany({ where: { taskId: BigInt(taskId) } });
      await tx.task.delete({ where: { id: BigInt(taskId) } });
    });

    return { message: '任务已删除' };
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
      taskNo: task.taskNo ?? null, // V3.7 任务编号
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
      // V3.8: 里程碑关联
      projectId: task.projectId ? Number(task.projectId) : null,
      projectName: task.project?.name ?? null,
      milestoneId: task.milestoneId ? Number(task.milestoneId) : null,
      milestoneName: task.milestone?.name ?? null,
    };
  }

  // ================================================================
  // W4 — 更新进度（只增不减）+ V3.7 日报写入
  // POST /worker/tasks/:assignmentId/progress
  // ================================================================
  async updateProgress(
    assignmentId: number,
    workerId: number,
    progress: number,
    note?: string,
    extra?: { dailySummary?: string; tomorrowPlan?: string; issues?: string },
  ) {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: {
        id: BigInt(assignmentId),
        workerId: BigInt(workerId),
        status: 'accepted',
      },
      include: { taskRole: true },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在或无权操作');
    if (progress <= assignment.progress) {
      throw new BadRequestException(`进度只能增加，当前已是 ${assignment.progress}%`);
    }

    // 事务：同时更新分配进度 + 写入 progress_updates 日报记录
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.roleAssignment.update({
        where: { id: BigInt(assignmentId) },
        data: { progress, updatedAt: new Date() },
      });
      const pu = await tx.progressUpdate.create({
        data: {
          taskId: assignment.taskRole.taskId,
          taskRoleId: assignment.taskRoleId,
          assignmentId: BigInt(assignmentId),
          workerId: BigInt(workerId),
          progressPct: progress,
          content: note ?? null,
          issues: extra?.issues ?? null,
          dailySummary: extra?.dailySummary ?? null,
          tomorrowPlan: extra?.tomorrowPlan ?? null,
        },
      });
      return pu;
    });

    return {
      assignmentId,
      progress,
      progressUpdateId: Number(result.id),
      dailySummary: result.dailySummary,
      tomorrowPlan: result.tomorrowPlan,
    };
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

    // 验收通过 → 分配状态改为 completed
    if (result === 'approved') {
      await this.prisma.roleAssignment.update({
        where: { id: assignment.id },
        data: { status: 'completed', progress: 100 },
      });
      this.logger.log(`分配 #${assignment.id} 验收通过 → completed`);

      // V3.7 Step 5.7 + V3.9: 检查任务所有 assignment 是否均已 completed
      // V3.9: 不再自动切换任务状态为 completed，而是等待零工发起验收申请
      const pendingCount = await this.prisma.roleAssignment.count({
        where: {
          taskRole: { taskId: BigInt(taskId) },
          status: { in: ['accepted', 'invited'] as any },
        },
      });
      if (pendingCount === 0) {
        this.logger.log(`任务所有分配均已完成: task=${taskId}，等待零工发起验收申请`);
      }
    }

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
        milestone: { select: { id: true, name: true, status: true, plannedDate: true } },
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
      taskNo:      task.taskNo ?? null, // V3.7 任务编号
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
      // V3.8: 里程碑关联
      projectId:     task.projectId ? Number(task.projectId) : null,
      milestoneId:   task.milestoneId ? Number(task.milestoneId) : null,
      milestoneName: task.milestone?.name ?? null,
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

  // ================================================================
  // 附件管理
  // ================================================================
  async addAttachment(
    taskId: number,
    companyId: number,
    userId: number,
    dto: import('./dto').AddAttachmentDto,
  ) {
    await this.getTaskOrThrow(taskId, companyId);
    const existing = await this.prisma.taskAttachment.count({ where: { taskId: BigInt(taskId) } });
    if (existing >= 10) throw new BadRequestException('附件最多10个');

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId: BigInt(taskId),
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: BigInt(dto.fileSize),
        fileType: dto.fileType,
        uploadedBy: BigInt(userId),
      },
    });
    return {
      attachmentId: Number(attachment.id),
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: Number(attachment.fileSize),
      fileType: attachment.fileType,
      createdAt: attachment.createdAt,
    };
  }

  async deleteAttachment(taskId: number, attachmentId: number, companyId: number) {
    await this.getTaskOrThrow(taskId, companyId);
    const att = await this.prisma.taskAttachment.findFirst({
      where: { id: BigInt(attachmentId), taskId: BigInt(taskId) },
    });
    if (!att) throw new NotFoundException('附件不存在');
    await this.prisma.taskAttachment.delete({ where: { id: BigInt(attachmentId) } });
    return { attachmentId };
  }

  async getAttachments(taskId: number, companyId: number) {
    await this.getTaskOrThrow(taskId, companyId);
    const list = await this.prisma.taskAttachment.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { createdAt: 'asc' },
    });
    return list.map((a) => ({
      attachmentId: Number(a.id),
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: Number(a.fileSize),
      fileType: a.fileType,
      createdAt: a.createdAt,
    }));
  }

  // ================================================================
  // V3.9: 任务审批（招募完成 → 进行中）
  // ================================================================
  async approveTask(taskId: number, companyId: number) {
    const task = await this.getTaskOrThrow(taskId, companyId);
    assertTransition(task.status, 'in_progress');

    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data: { status: 'in_progress' },
    });

    this.logger.log(`任务审批通过: task=${taskId} published → in_progress`);
    return { message: '任务审批通过，已进入执行阶段', status: 'in_progress' };
  }

  // ================================================================
  // V3.9: 零工发起验收申请（进行中 → 验收中）
  // ================================================================
  async requestAcceptance(assignmentId: number, workerId: number) {
    // 查找分配记录
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { id: BigInt(assignmentId), workerId: BigInt(workerId), status: 'accepted' },
      include: {
        taskRole: {
          include: {
            task: { select: { id: true, title: true, companyId: true, createdBy: true, status: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('未找到执行中的任务分配');

    const task = (assignment as any).taskRole.task;
    if (task.status !== 'in_progress') {
      throw new BadRequestException('任务当前状态不支持发起验收申请');
    }

    // 任务状态转为 reviewing
    assertTransition(task.status, 'reviewing');
    await this.prisma.task.update({
      where: { id: task.id },
      data: { status: 'reviewing' },
    });

    // 发送企业端通知
    try {
      await this.companyNotificationService.create({
        companyId: Number(task.companyId),
        userId: Number(task.createdBy),
        type: 'acceptance_request',
        title: '零工发起验收申请',
        content: `任务「${task.title}」的零工已完成工作，发起了验收申请，请及时处理。`,
        refType: 'task',
        refId: Number(task.id),
      });
    } catch (e: any) {
      this.logger.warn(`发送验收申请通知失败: ${e?.message}`);
    }

    this.logger.log(`验收申请: task=${Number(task.id)} assignment=${assignmentId}`);
    return { message: '验收申请已发送，请等待企业确认', status: 'reviewing' };
  }

  // ================================================================
  // V3.9: 企业验收确认（验收中 → 待付款）
  // ================================================================
  async acceptTask(taskId: number, companyId: number) {
    const task = await this.getTaskOrThrow(taskId, companyId);
    assertTransition(task.status, 'pending_payment');

    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data: { status: 'pending_payment' as any },
    });

    this.logger.log(`验收确认: task=${taskId} reviewing → pending_payment`);
    return { message: '验收已确认，任务进入待付款阶段', status: 'pending_payment' };
  }

  // ================================================================
  // V3.9: 企业验收驳回（验收中 → 进行中）
  // ================================================================
  async rejectAcceptance(taskId: number, companyId: number, reason: string) {
    const task = await this.getTaskOrThrow(taskId, companyId);
    assertTransition(task.status, 'in_progress');

    await this.prisma.task.update({
      where: { id: BigInt(taskId) },
      data: { status: 'in_progress' },
    });

    this.logger.log(`验收驳回: task=${taskId} reviewing → in_progress, reason=${reason}`);
    return { message: '验收已驳回，任务回到进行中', status: 'in_progress', reason };
  }

  // ================================================================
  // V3.9: 任务执行过程节点查询
  // ================================================================
  async getExecutionNodes(taskId: number, companyId: number) {
    await this.getTaskOrThrow(taskId, companyId);

    // 1. 查询检查点（模板节点）
    const checkpoints = await this.prisma.taskCheckpoint.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { sortOrder: 'asc' },
    });

    // 2. 查询日报（工作日志）
    const progressUpdates = await this.prisma.progressUpdate.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { createdAt: 'asc' },
    });

    // 3. 查询附件（过程交付物）
    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { createdAt: 'asc' },
    });

    // 4. 查询角色信息用于关联日报的零工名
    const roles = await this.prisma.taskRole.findMany({
      where: { taskId: BigInt(taskId) },
      include: {
        assignments: {
          include: {
            worker: { select: { id: true, realName: true } },
          },
        },
      },
    });
    const workerMap = new Map<string, string>();
    for (const r of roles) {
      for (const a of r.assignments) {
        workerMap.set(String(a.workerId), (a.worker as any)?.realName || `零工#${a.workerId}`);
      }
    }

    // 5. 按节点组装数据
    const nodes = checkpoints.map((cp) => {
      // 找该节点时间范围内的日报（按 sortOrder 前后节点的日期范围筛选）
      const cpDate = new Date(cp.plannedDate);
      const logs = progressUpdates
        .filter((pu) => {
          const puDate = new Date(pu.createdAt);
          // 简化逻辑：将日报关联到最近的检查点
          return puDate <= cpDate;
        })
        .map((pu) => ({
          id: Number(pu.id),
          workerId: Number(pu.workerId),
          workerName: workerMap.get(String(pu.workerId)) || `零工#${pu.workerId}`,
          progressPct: pu.progressPct,
          content: pu.content,
          dailySummary: pu.dailySummary,
          tomorrowPlan: pu.tomorrowPlan,
          issues: pu.issues,
          screenshots: pu.screenshots,
          createdAt: pu.createdAt,
        }));

      // 该节点时间范围内的附件
      const nodeAttachments = attachments
        .filter((att) => new Date(att.createdAt) <= cpDate)
        .map((att) => ({
          attachmentId: Number(att.id),
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileSize: Number(att.fileSize),
          fileType: att.fileType,
          createdAt: att.createdAt,
        }));

      return {
        nodeId: Number(cp.id),
        name: cp.name,
        type: cp.type,
        status: cp.status,
        plannedDate: cp.plannedDate,
        description: cp.description,
        submitContent: cp.submitContent,
        submittedAt: cp.submittedAt,
        reviewComment: cp.reviewComment,
        reviewedAt: cp.reviewedAt,
        revisionCount: cp.revisionCount,
        // 进度比：取该节点关联日报中的最大进度
        progressPct: logs.length > 0 ? Math.max(...logs.map((l) => l.progressPct)) : 0,
        // 工作日志（日报汇总）
        logs,
        // 过程交付物
        attachments: nodeAttachments,
      };
    });

    // 如果没有检查点，返回一个默认节点包含所有数据
    if (nodes.length === 0) {
      return {
        nodes: [{
          nodeId: 0,
          name: '整体执行',
          type: 'progress_check',
          status: 'pending',
          plannedDate: null,
          description: null,
          progressPct: progressUpdates.length > 0
            ? Math.max(...progressUpdates.map((pu) => pu.progressPct))
            : 0,
          logs: progressUpdates.map((pu) => ({
            id: Number(pu.id),
            workerId: Number(pu.workerId),
            workerName: workerMap.get(String(pu.workerId)) || `零工#${pu.workerId}`,
            progressPct: pu.progressPct,
            content: pu.content,
            dailySummary: pu.dailySummary,
            tomorrowPlan: pu.tomorrowPlan,
            issues: pu.issues,
            screenshots: pu.screenshots,
            createdAt: pu.createdAt,
          })),
          attachments: attachments.map((att) => ({
            attachmentId: Number(att.id),
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: Number(att.fileSize),
            fileType: att.fileType,
            createdAt: att.createdAt,
          })),
        }],
      };
    }

    // 移除被前节点包含的重复日报/附件（确保每条日报只出现在最近的节点中）
    const usedLogIds = new Set<number>();
    const usedAttIds = new Set<number>();
    const deduped = nodes.map((node) => {
      const uniqueLogs = node.logs.filter((l) => !usedLogIds.has(l.id));
      uniqueLogs.forEach((l) => usedLogIds.add(l.id));
      const uniqueAtts = node.attachments.filter((a) => !usedAttIds.has(a.attachmentId));
      uniqueAtts.forEach((a) => usedAttIds.add(a.attachmentId));
      return { ...node, logs: uniqueLogs, attachments: uniqueAtts };
    });

    return { nodes: deduped };
  }

}
