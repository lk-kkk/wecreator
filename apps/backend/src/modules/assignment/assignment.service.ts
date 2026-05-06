import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { ProjectService } from '../project/project.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly notificationService: NotificationService,
  ) {}

  // ================================================================
  // 零工库列表（企业端）
  // ================================================================
  async getWorkerPool(query: { keyword?: string; city?: string; roleName?: string; page?: number; pageSize?: number }) {
    const { keyword, city, roleName, page = 1, pageSize = 20 } = query;

    const where: any = { isVerified: true, status: 'active' };
    if (city) where.city = city;
    if (keyword) {
      where.OR = [
        { realName: { contains: keyword } },
        { bio: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: {
          workerRoles: roleName ? { where: { roleName: { contains: roleName } } } : true,
        },
        orderBy: { avgRating: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.worker.count({ where }),
    ]);

    return {
      list: list.map((w) => ({
        workerId: Number(w.id),
        realName: w.realName,
        avatarUrl: w.avatarUrl,
        city: w.city,
        bio: w.bio,
        avgRating: Number(w.avgRating),
        completionRate: Number(w.completionRate),
        completedCount: w.completedCount,
        level: w.level,
        roles: w.workerRoles.map((r) => ({
          roleName: r.roleName,
          yearsExp: r.yearsExp,
          skillTags: r.skillTags,
        })),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ================================================================
  // 定向邀约
  // ================================================================
  async inviteWorker(
    taskId: number,
    taskRoleId: number,
    workerId: number,
    companyId: number,
  ) {
    // 1. 校验任务归属+状态
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');
    if (Number(task.companyId) !== companyId) throw new ForbiddenException('无权操作');
    if (task.status !== 'published' && task.status !== 'in_progress') {
      throw new BadRequestException('当前状态不可邀约');
    }

    // 2. 校验角色岗位
    const taskRole = await this.prisma.taskRole.findUnique({
      where: { id: BigInt(taskRoleId) },
      include: { assignments: true },
    });
    if (!taskRole || Number(taskRole.taskId) !== taskId) {
      throw new NotFoundException('角色岗位不存在');
    }

    // 3. 检查槽位
    const activeAssignments = taskRole.assignments.filter(
      (a) => a.status === 'invited' || a.status === 'accepted',
    );
    if (activeAssignments.length >= taskRole.headcount) {
      throw new BadRequestException('该角色已招满');
    }

    // 4. 检查零工是否已被邀约
    const existing = taskRole.assignments.find(
      (a) => Number(a.workerId) === workerId && (a.status === 'invited' || a.status === 'accepted'),
    );
    if (existing) {
      throw new BadRequestException('该零工已被邀约');
    }

    // 5. 分配slot_index
    const slotIndex = activeAssignments.length + 1;

    // 6. 事务：创建分配记录 + 确保零工在企业零工库中
    //    （V3.4 零工库模型：服务广场只展示 pool 中企业的任务，
    //     邀约即代表企业信任零工，自动纳入零工库 inviteStatus=registered）
    const workerInfo = await this.prisma.worker.findUnique({
      where: { id: BigInt(workerId) },
      select: { realName: true, nickname: true, isVerified: true },
    });

    const assignment = await this.prisma.$transaction(async (tx) => {
      // 6a. 创建分配记录
      const a = await tx.roleAssignment.create({
        data: {
          taskRoleId: BigInt(taskRoleId),
          workerId: BigInt(workerId),
          slotIndex,
          status: 'invited',
          expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h超时
        },
      });

      // 6b. 确保零工在企业零工库中
      const existingPool = await tx.companyWorkerPool.findFirst({
        where: { companyId: BigInt(companyId), workerId: BigInt(workerId) },
        select: { id: true, inviteStatus: true },
      });

      if (!existingPool) {
        // Pool 唯一键是 (companyId, prePhone)；对邀约已注册零工，
        // 用占位 prePhone 避免与真实预录入手机号冲突
        const preName = workerInfo?.realName || workerInfo?.nickname || `零工${workerId}`;
        const prePhone = `invite:${workerId}`;
        const inviteStatus = workerInfo?.isVerified ? 'verified' : 'registered';

        await tx.companyWorkerPool.create({
          data: {
            companyId: BigInt(companyId),
            workerId: BigInt(workerId),
            preName,
            prePhone,
            inviteStatus,
          },
        });
        this.logger.log(`自动纳入零工库: company=${companyId}, worker=${workerId}, status=${inviteStatus}`);
      } else if (existingPool.inviteStatus === 'pending') {
        // 已预录入但还未进入 registered：升级状态
        await tx.companyWorkerPool.update({
          where: { id: existingPool.id },
          data: {
            inviteStatus: workerInfo?.isVerified ? 'verified' : 'registered',
            workerId: BigInt(workerId),
          },
        });
      }

      return a;
    });

    this.logger.log(`邀约: task=${taskId}, role=${taskRoleId}, worker=${workerId}, slot=${slotIndex}`);

    // 发送通知给零工
    try {
      await this.notificationService.create({
        recipientId: BigInt(workerId),
        recipientType: 'worker' as any,
        type: 'task_invite' as any,
        title: '您有一条新的任务邀约',
        content: `您被邀请参与任务「${task.title}」，请在24小时内确认。`,
        relatedTaskId: BigInt(taskId),
      });
    } catch (e: any) {
      this.logger.warn(`邀约通知发送失败: ${e?.message}`);
    }

    return {
      assignmentId: Number(assignment.id),
      slotIndex,
      expiresAt: assignment.expiredAt,
      message: '邀约已发送',
    };
  }

  // ================================================================
  // 零工接单
  // ================================================================
  async acceptInvite(assignmentId: number, workerId: number) {
    const assignment = await this.getAssignmentOrThrow(assignmentId, workerId);

    if (assignment.status !== 'invited') {
      throw new BadRequestException('当前状态不可接单');
    }

    // 检查是否过期
    if (assignment.expiredAt && new Date() > assignment.expiredAt) {
      await this.prisma.roleAssignment.update({
        where: { id: BigInt(assignmentId) },
        data: { status: 'expired' },
      });
      throw new BadRequestException('邀约已过期');
    }

    await this.prisma.roleAssignment.update({
      where: { id: BigInt(assignmentId) },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // 检查是否为首个接单 → 任务自动流转到 in_progress
    const taskRole = await this.prisma.taskRole.findUnique({
      where: { id: assignment.taskRoleId },
    });
    if (taskRole) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskRole.taskId },
      });
      if (task && task.status === 'published') {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: 'in_progress' },
        });
        this.logger.log(`任务自动流转: ${task.id} → in_progress`);

        // V3.7 Step 5.7: 同步项目阶段（若有关联项目）
        if (task.projectId) {
          try {
            await this.projectService.syncPhaseFromTasks(Number(task.projectId));
          } catch (e: any) {
            this.logger.warn(`syncPhaseFromTasks 失败: project=${task.projectId} err=${e?.message}`);
          }
        }
      }
    }

    this.logger.log(`零工接单: assignment=${assignmentId}, worker=${workerId}`);
    return { message: '接单成功' };
  }

  // ================================================================
  // 零工婉拒
  // ================================================================
  async rejectInvite(assignmentId: number, workerId: number) {
    const assignment = await this.getAssignmentOrThrow(assignmentId, workerId);

    if (assignment.status !== 'invited') {
      throw new BadRequestException('当前状态不可婉拒');
    }

    await this.prisma.roleAssignment.update({
      where: { id: BigInt(assignmentId) },
      data: { status: 'rejected', rejectedAt: new Date() },
    });

    return { message: '已婉拒' };
  }

  // ================================================================
  // 零工任务列表
  // ================================================================
  async getWorkerTasks(workerId: number, status?: string) {
    const where: any = { workerId: BigInt(workerId) };
    if (status) where.status = status;

    const assignments = await this.prisma.roleAssignment.findMany({
      where,
      include: {
        taskRole: {
          include: { task: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // V3.7: 按 taskId 聚合未解决问题数（open / in_progress）
    const taskIds = Array.from(new Set(assignments.map((a) => a.taskRole.task.id)));
    const issueCountMap = new Map<string, number>();
    if (taskIds.length > 0) {
      const grouped = await this.prisma.taskIssue.groupBy({
        by: ['taskId'],
        where: {
          taskId: { in: taskIds },
          status: { in: ['open', 'in_progress'] as any },
        },
        _count: { _all: true },
      });
      for (const g of grouped) {
        issueCountMap.set(String(g.taskId), (g as any)._count?._all ?? 0);
      }
    }

    return assignments.map((a) => ({
      assignmentId: Number(a.id),
      status: a.status,
      progress: a.progress,
      slotIndex: a.slotIndex,
      invitedAt: a.invitedAt,
      acceptedAt: a.acceptedAt,
      task: {
        taskId: Number(a.taskRole.task.id),
        title: a.taskRole.task.title,
        taskMode: a.taskRole.task.taskMode,
        status: a.taskRole.task.status,
      },
      role: {
        roleName: a.taskRole.roleName,
        budget: Number(a.taskRole.budget),
      },
      // V3.7: 未解决问题数（用于列表右上角 ⚠️ 图标）
      unresolvedIssueCount: issueCountMap.get(String(a.taskRole.task.id)) ?? 0,
    }));
  }

  /**
   * 获取任务工作日志
   */
  async getWorkLogs(assignmentId: number, _userId: number) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');

    const logs = await this.prisma.progressUpdate.findMany({
      where: { assignmentId: BigInt(assignmentId) },
      orderBy: { createdAt: 'desc' },
    });

    return {
      list: logs.map((l: any) => ({
        id: Number(l.id),
        assignmentId: Number(l.assignmentId),
        workerId: Number(l.workerId),
        content: l.content,
        progress: l.progress,
        createdAt: l.createdAt,
      })),
    };
  }

  // ================================================================
  private async getAssignmentOrThrow(assignmentId: number, workerId: number) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (Number(assignment.workerId) !== workerId) throw new ForbiddenException('无权操作');
    return assignment;
  }
}
