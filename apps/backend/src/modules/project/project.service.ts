/**
 * ProjectService — R2-a 项目管理
 * Schema: projects(14字段) + milestones(11字段) + milestone_attachments
 */
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsEnum, IsDateString, MaxLength, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ─── DTO ───
export class CreateProjectDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) clientLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDeliveryDate?: string;
  @ApiPropertyOptional({ description: '项目负责人（company_users.id），默认为创建者' })
  @IsOptional() @IsNumber() managerId?: number;
}

export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) clientLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDeliveryDate?: string;
}

export class UpdateProjectStatusDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['planning', 'active', 'suspended', 'completed', 'archived'])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['requirement', 'execution', 'acceptance'])
  phase?: string;
}

export class CreateMilestoneDto {
  @ApiProperty() @IsString() @MaxLength(50) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
  @ApiProperty() @IsDateString() plannedDate: string;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedDate?: string;
}

export class ProjectQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() pageSize?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() phase?: string;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() riskLevel?: string;
}

// ─── Service ───
@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  /** C06a-01: 项目列表 */
  async getProjects(companyId: number, query: ProjectQueryDto) {
    const { page = 1, pageSize = 20, status, phase, keyword, riskLevel } = query;
    const where: any = { companyId: BigInt(companyId) };
    if (status) where.status = status;
    if (phase) where.phase = phase;
    if (riskLevel) where.riskLevel = riskLevel;
    if (keyword) where.name = { contains: keyword };

    const [list, total] = await Promise.all([
      this.prisma.project.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          milestones: { select: { id: true, status: true } },
          tasks: { select: { id: true, status: true, totalBudget: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    // 批量查询负责人名称
    const managerIds = [...new Set(list.map(p => Number(p.managerId)))];
    const managers = await this.prisma.companyUser.findMany({
      where: { id: { in: managerIds.map(id => BigInt(id)) } },
      select: { id: true, name: true },
    });
    const managerMap = new Map(managers.map(m => [Number(m.id), m.name]));

    return {
      list: list.map(p => ({ ...this.serializeProject(p), managerName: managerMap.get(Number(p.managerId)) ?? null })),
      total, page, pageSize,
    };
  }

  /** C06a-02: 创建项目 */
  async createProject(companyId: number, userId: number, dto: CreateProjectDto) {
    // 项目上限500
    const existingCount = await this.prisma.project.count({ where: { companyId: BigInt(companyId) } });
    if (existingCount >= 500) throw new BadRequestException('每企业最多创建500个项目');

    // 生成项目编号 PRJ-YYYYMMDD-NNN
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.project.count({
      where: { projectNo: { startsWith: `PRJ-${today}` } },
    });
    const projectNo = `PRJ-${today}-${String(count + 1).padStart(3, '0')}`;

    const project = await this.prisma.project.create({
      data: {
        companyId: BigInt(companyId),
        projectNo,
        name: dto.name,
        clientLocation: dto.clientLocation,
        managerId: BigInt(dto.managerId ?? userId),
        description: dto.description,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
      },
    });
    return { projectId: Number(project.id), projectNo: project.projectNo };
  }

  /** C06a-03: 项目详情 */
  async getProjectById(companyId: number, projectId: number) {
    const p = await this.prisma.project.findFirst({
      where: { id: BigInt(projectId), companyId: BigInt(companyId) },
      include: {
        milestones: { orderBy: { sortOrder: 'asc' }, include: { attachments: true } },
        tasks: {
          select: { id: true, title: true, status: true, taskMode: true, totalBudget: true,
            taskRoles: { select: { id: true, roleName: true, headcount: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!p) throw new NotFoundException('项目不存在');
    // 查询负责人名称
    const manager = await this.prisma.companyUser.findUnique({
      where: { id: p.managerId },
      select: { name: true },
    });
    return { ...this.serializeProject(p), managerName: manager?.name ?? null };
  }

  /** C06a-04: 更新项目 */
  async updateProject(companyId: number, projectId: number, dto: UpdateProjectDto) {
    const p = await this.prisma.project.findFirst({
      where: { id: BigInt(projectId), companyId: BigInt(companyId) },
    });
    if (!p) throw new NotFoundException('项目不存在');
    if (p.status === 'archived') throw new ForbiddenException('已归档项目不可编辑');

    const updated = await this.prisma.project.update({
      where: { id: BigInt(projectId) },
      data: {
        ...dto.name && { name: dto.name },
        ...dto.clientLocation !== undefined && { clientLocation: dto.clientLocation },
        ...dto.description !== undefined && { description: dto.description },
        ...dto.expectedDeliveryDate && { expectedDeliveryDate: new Date(dto.expectedDeliveryDate) },
      },
    });
    return { projectId: Number(updated.id) };
  }

  /** C06a-05: 更新项目状态/阶段 */
  async updateProjectStatus(companyId: number, projectId: number, dto: UpdateProjectStatusDto) {
    const p = await this.prisma.project.findFirst({
      where: { id: BigInt(projectId), companyId: BigInt(companyId) },
    });
    if (!p) throw new NotFoundException('项目不存在');

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.phase) data.phase = dto.phase;

    await this.prisma.project.update({ where: { id: BigInt(projectId) }, data });
    return { projectId: Number(p.id), status: dto.status ?? p.status, phase: dto.phase ?? p.phase };
  }

  /** C06a-06: 看板视图 */
  async getBoard(companyId: number) {
    const projects = await this.prisma.project.findMany({
      where: { companyId: BigInt(companyId), status: { notIn: ['archived'] } },
      include: {
        milestones: { select: { id: true, status: true, plannedDate: true } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map(p => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t: any) => t.status === 'completed').length;
      const progress = totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0;
      const totalMs = p.milestones.length;
      const completedMs = p.milestones.filter((m: any) => m.status === 'completed').length;
      const overdueMs = p.milestones.filter((m: any) => m.status === 'pending' && new Date((m as any).plannedDate) < new Date()).length;
      // 三色预警: 有逾期里程碑=red, 有即将到期(7天内)=yellow, 否则green
      const upcomingMs = p.milestones.filter((m: any) => {
        if (m.status !== 'pending') return false;
        const diff = (new Date((m as any).plannedDate).getTime() - Date.now()) / 86400000;
        return diff >= 0 && diff <= 7;
      }).length;
      const riskLevel = overdueMs > 0 ? 'red' : upcomingMs > 0 ? 'yellow' : 'green';

      return {
        id: Number(p.id),
        projectNo: p.projectNo,
        name: p.name,
        status: p.status,
        phase: p.phase,
        riskLevel,
        progress,
        taskCount: totalTasks,
        completedTaskCount: completedTasks,
        milestoneCount: totalMs,
        completedMilestoneCount: completedMs,
        overdueMilestoneCount: overdueMs,
        expectedDeliveryDate: p.expectedDeliveryDate,
        updatedAt: p.updatedAt,
      };
    });
  }

  /** C06a-07: 里程碑列表 */
  async getMilestones(companyId: number, projectId: number) {
    await this.checkOwnership(companyId, projectId);
    const list = await this.prisma.milestone.findMany({
      where: { projectId: BigInt(projectId) },
      orderBy: { sortOrder: 'asc' },
      include: { attachments: true },
    });
    return list.map(m => this.serializeMilestone(m));
  }

  /** C06a-08: 创建里程碑 */
  async createMilestone(companyId: number, projectId: number, userId: number, dto: CreateMilestoneDto) {
    await this.checkOwnership(companyId, projectId);
    const maxSort = await this.prisma.milestone.aggregate({
      where: { projectId: BigInt(projectId) },
      _max: { sortOrder: true },
    });
    const m = await this.prisma.milestone.create({
      data: {
        projectId: BigInt(projectId),
        name: dto.name,
        description: dto.description,
        plannedDate: new Date(dto.plannedDate),
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        createdBy: BigInt(userId),
      },
    });
    return { milestoneId: Number(m.id) };
  }

  /** C06a-09: 更新里程碑 */
  async updateMilestone(companyId: number, projectId: number, milestoneId: number, dto: UpdateMilestoneDto) {
    await this.checkOwnership(companyId, projectId);
    const m = await this.prisma.milestone.findFirst({
      where: { id: BigInt(milestoneId), projectId: BigInt(projectId) },
    });
    if (!m) throw new NotFoundException('里程碑不存在');

    const updated = await this.prisma.milestone.update({
      where: { id: BigInt(milestoneId) },
      data: {
        ...dto.name && { name: dto.name },
        ...dto.description !== undefined && { description: dto.description },
        ...dto.plannedDate && { plannedDate: new Date(dto.plannedDate) },
      },
    });
    return { milestoneId: Number(updated.id) };
  }

  /** C06a-10: 删除里程碑 */
  async deleteMilestone(companyId: number, projectId: number, milestoneId: number) {
    await this.checkOwnership(companyId, projectId);
    await this.prisma.milestoneAttachment.deleteMany({ where: { milestoneId: BigInt(milestoneId) } });
    await this.prisma.milestone.delete({ where: { id: BigInt(milestoneId) } });
    return { deleted: true };
  }

  /** C06a-11: 完成里程碑 */
  async completeMilestone(companyId: number, projectId: number, milestoneId: number) {
    await this.checkOwnership(companyId, projectId);
    const m = await this.prisma.milestone.findFirst({
      where: { id: BigInt(milestoneId), projectId: BigInt(projectId) },
    });
    if (!m) throw new NotFoundException('里程碑不存在');
    if (m.status === 'completed') throw new BadRequestException('里程碑已完成');

    await this.prisma.milestone.update({
      where: { id: BigInt(milestoneId) },
      data: { status: 'completed', completedAt: new Date() },
    });
    return { milestoneId: Number(m.id), status: 'completed' };
  }

  /** C06a-12: 项目统计 */
  async getStats(companyId: number) {
    const projects = await this.prisma.project.findMany({
      where: { companyId: BigInt(companyId) },
      include: {
        tasks: { select: { status: true } },
        milestones: { select: { status: true, plannedDate: true } },
      },
    });

    const total = projects.length;
    const byStatus: Record<string, number> = {};
    const byRisk: Record<string, number> = { green: 0, yellow: 0, red: 0 };
    let totalProgress = 0;

    for (const p of projects) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      const completedT = p.tasks.filter((t: any) => t.status === 'completed').length;
      totalProgress += p.tasks.length > 0 ? completedT / p.tasks.length : 0;
      const overdueMs = p.milestones.filter((m: any) => m.status === 'pending' && new Date(m.plannedDate) < new Date()).length;
      const risk = overdueMs > 0 ? 'red' : 'green';
      byRisk[risk]++;
    }

    return {
      total,
      byStatus,
      byRisk,
      avgProgress: total > 0 ? Math.round(totalProgress / total * 100) : 0,
    };
  }

  // ─── Helpers ───
  private async checkOwnership(companyId: number, projectId: number) {
    const p = await this.prisma.project.findFirst({
      where: { id: BigInt(projectId), companyId: BigInt(companyId) },
    });
    if (!p) throw new NotFoundException('项目不存在');
    return p;
  }

  private serializeProject(p: any) {
    return {
      id: Number(p.id),
      projectNo: p.projectNo,
      name: p.name,
      clientLocation: p.clientLocation,
      managerId: Number(p.managerId),
      description: p.description,
      status: p.status,
      phase: p.phase,
      expectedDeliveryDate: p.expectedDeliveryDate,
      riskLevel: p.riskLevel,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      milestones: p.milestones?.map((m: any) => this.serializeMilestone(m)),
      tasks: p.tasks?.map((t: any) => ({
        id: Number(t.id), title: t.title, status: t.status, taskMode: t.taskMode,
        totalBudget: t.totalBudget ? Number(t.totalBudget) : 0,
        roles: t.taskRoles?.map((r: any) => ({ id: Number(r.id), roleName: r.roleName, headcount: r.headcount })),
      })),
    };
  }

  private serializeMilestone(m: any) {
    return {
      id: Number(m.id),
      name: m.name,
      description: m.description,
      plannedDate: m.plannedDate,
      completedAt: m.completedAt,
      status: m.status,
      sortOrder: m.sortOrder,
      createdBy: Number(m.createdBy),
      attachments: m.attachments?.map((a: any) => ({
        id: Number(a.id), fileName: a.fileName, fileUrl: a.fileUrl, fileSize: Number(a.fileSize),
      })),
    };
  }
}
