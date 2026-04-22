import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // 6. 创建分配记录
    const assignment = await this.prisma.roleAssignment.create({
      data: {
        taskRoleId: BigInt(taskRoleId),
        workerId: BigInt(workerId),
        slotIndex,
        status: 'invited',
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h超时
      },
    });

    this.logger.log(`邀约: task=${taskId}, role=${taskRoleId}, worker=${workerId}, slot=${slotIndex}`);

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
