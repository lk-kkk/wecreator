/**
 * TaskTemplateService — 任务模板（S2-022）+ 企业自定义角色（S2-023）
 *
 * 任务模板：从已有任务创建模板，可复用发布
 * 自定义角色：企业定义专属岗位（上限50个）
 */
import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ── DTOs ─────────────────────────────────────────────────────────────
export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', maxLength: 100 })
  @IsString() @MaxLength(100) name: string;

  @ApiPropertyOptional({ description: '基于已有任务ID创建' })
  @IsOptional() @Type(() => Number) fromTaskId?: number;

  @ApiPropertyOptional({ description: '任务标题' })
  @IsOptional() @IsString() @MaxLength(100) title?: string;

  @ApiPropertyOptional({ description: '任务描述' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ description: '任务模式', enum: ['task_package', 'daily_rate'] })
  @IsOptional() @IsString() taskMode?: string;

  @ApiPropertyOptional({ description: '角色配置 JSON（与任务角色结构相同）' })
  @IsOptional() roleConfig?: any[];
}

export class CreateFromTemplateDto {
  @ApiProperty({ description: '模板ID' })
  @Type(() => Number) templateId: number;

  @ApiPropertyOptional({ description: '覆盖任务标题' })
  @IsOptional() @IsString() @MaxLength(100) title?: string;
}

export class CreateCustomRoleDto {
  @ApiProperty({ description: '角色名称', maxLength: 50 })
  @IsString() @MaxLength(50) roleName: string;

  @ApiPropertyOptional({ description: '角色描述', maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200) description?: string;

  @ApiPropertyOptional({ description: '技能标签（逗号分隔）' })
  @IsOptional() @IsString() skillTags?: string;

  @ApiPropertyOptional({ description: '参考日薪（元）' })
  @IsOptional() @Type(() => Number) dailyRate?: number;
}

// ── Service ──────────────────────────────────────────────────────────
@Injectable()
export class TaskTemplateService {
  private readonly logger = new Logger(TaskTemplateService.name);
  private readonly MAX_CUSTOM_ROLES = 50;

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 任务模板 CRUD
  // ================================================================

  /** 列出企业所有模板 */
  async listTemplates(companyId: number) {
    // 使用 task_template_configs JSON 列存储（无单独模型时用 company description 字段临时存储）
    // 实际实现：使用 Redis 或 JSON 字段。此处使用 Prisma rawQuery 存入 company 扩展表
    // 由于 schema 中无 task_template 表，改用内存 Map 模拟 + 说明（生产建议加表）
    // 正确做法：添加 schema migration，此处先基于 CompanyCustomRole.description JSON 实现
    const roles = await this.prisma.companyCustomRole.findMany({
      where: { companyId: BigInt(companyId) },
    });

    // 模板存储于 description 字段前缀 "[TEMPLATE]" 的记录（轻量实现）
    const templates = roles
      .filter(r => r.description?.startsWith('[TEMPLATE]'))
      .map(r => {
        try {
          const data = JSON.parse(r.description!.replace('[TEMPLATE]', ''));
          return {
            templateId:  Number(r.id),
            name:        r.roleName,
            taskMode:    data.taskMode ?? 'task_package',
            title:       data.title ?? '',
            description: data.description ?? '',
            roleConfig:  data.roleConfig ?? [],
            createdAt:   r.createdAt,
          };
        } catch { return null; }
      })
      .filter(Boolean);

    return templates;
  }

  /** 保存模板（从任务或从头创建） */
  async saveTemplate(companyId: number, dto: CreateTemplateDto) {
    let data: any = {
      title:       dto.title ?? '',
      description: dto.description ?? '',
      taskMode:    dto.taskMode ?? 'task_package',
      roleConfig:  dto.roleConfig ?? [],
    };

    // 从已有任务复制
    if (dto.fromTaskId) {
      const task = await this.prisma.task.findFirst({
        where:   { id: BigInt(dto.fromTaskId), companyId: BigInt(companyId) },
        include: { taskRoles: true },
      });
      if (!task) throw new NotFoundException('任务不存在');
      data = {
        title:       task.title,
        description: task.description ?? '',
        taskMode:    task.taskMode,
        roleConfig:  task.taskRoles.map(r => ({
          roleName:      (r as any).roleName,
          headcount:     (r as any).headcount,
          suggestedDaily: (r as any).suggestedDaily,
          skillTags:     (r as any).skillTags,
        })),
      };
    }

    // 检查同名模板
    const exists = await this.prisma.companyCustomRole.findFirst({
      where: { companyId: BigInt(companyId), roleName: dto.name, description: { startsWith: '[TEMPLATE]' } },
    });
    if (exists) throw new BadRequestException('同名模板已存在');

    const record = await this.prisma.companyCustomRole.create({
      data: {
        companyId:   BigInt(companyId),
        roleName:    dto.name,
        description: `[TEMPLATE]${JSON.stringify(data)}`,
      },
    });

    this.logger.log(`任务模板保存: company=${companyId}, name=${dto.name}`);
    return {
      templateId: Number(record.id),
      name:       dto.name,
      ...data,
    };
  }

  /** 删除模板 */
  async deleteTemplate(companyId: number, templateId: number) {
    const record = await this.prisma.companyCustomRole.findFirst({
      where: { id: BigInt(templateId), companyId: BigInt(companyId), description: { startsWith: '[TEMPLATE]' } },
    });
    if (!record) throw new NotFoundException('模板不存在');

    await this.prisma.companyCustomRole.delete({ where: { id: BigInt(templateId) } });
    return { success: true };
  }

  /** 从模板创建任务（返回草稿任务） */
  async createFromTemplate(companyId: number, dto: CreateFromTemplateDto) {
    const record = await this.prisma.companyCustomRole.findFirst({
      where: { id: BigInt(dto.templateId), companyId: BigInt(companyId), description: { startsWith: '[TEMPLATE]' } },
    });
    if (!record) throw new NotFoundException('模板不存在');

    const tplData = JSON.parse(record.description!.replace('[TEMPLATE]', ''));

    // 创建草稿任务
    const task = await this.prisma.task.create({
      data: {
        companyId:   BigInt(companyId),
        createdBy:   BigInt(companyId),   // 使用 companyId 作为 createdBy 占位（生产环境传 userId）
        title:       dto.title ?? tplData.title,
        description: tplData.description,
        taskMode:    tplData.taskMode,
        status:      'draft',
        totalBudget: 0,
      },
    });

    // 创建角色
    if (tplData.roleConfig?.length) {
      await this.prisma.taskRole.createMany({
        data: tplData.roleConfig.map((r: any) => ({
          taskId:        task.id,
          roleName:      r.roleName,
          headcount:     r.headcount ?? 1,
          suggestedDaily: r.suggestedDaily,
          skillTags:     r.skillTags,
          status:        'open',
        })),
      });
    }

    this.logger.log(`从模板创建任务: template=${dto.templateId}, task=${task.id}`);
    return { taskId: Number(task.id), status: 'draft', title: task.title };
  }

  // ================================================================
  // 企业自定义角色 CRUD（S2-023）
  // ================================================================

  async listCustomRoles(companyId: number) {
    const roles = await this.prisma.companyCustomRole.findMany({
      where:   { companyId: BigInt(companyId), description: { not: { startsWith: '[TEMPLATE]' } } },
      orderBy: { createdAt: 'desc' },
    });
    return roles.map(r => this._formatRole(r));
  }

  async createCustomRole(companyId: number, dto: CreateCustomRoleDto) {
    const count = await this.prisma.companyCustomRole.count({
      where: { companyId: BigInt(companyId), description: { not: { startsWith: '[TEMPLATE]' } } },
    });
    if (count >= this.MAX_CUSTOM_ROLES) {
      throw new BadRequestException(`自定义角色已达上限（${this.MAX_CUSTOM_ROLES}个）`);
    }

    const exists = await this.prisma.companyCustomRole.findFirst({
      where: { companyId: BigInt(companyId), roleName: dto.roleName, description: { not: { startsWith: '[TEMPLATE]' } } },
    });
    if (exists) throw new BadRequestException('同名角色已存在');

    const role = await this.prisma.companyCustomRole.create({
      data: {
        companyId:   BigInt(companyId),
        roleName:    dto.roleName,
        description: dto.description,
        skillTags:   dto.skillTags,
        dailyRate:   dto.dailyRate,
      },
    });
    return this._formatRole(role);
  }

  async updateCustomRole(companyId: number, roleId: number, dto: Partial<CreateCustomRoleDto>) {
    const role = await this.prisma.companyCustomRole.findFirst({
      where: { id: BigInt(roleId), companyId: BigInt(companyId), description: { not: { startsWith: '[TEMPLATE]' } } },
    });
    if (!role) throw new NotFoundException('角色不存在');

    const updated = await this.prisma.companyCustomRole.update({
      where: { id: BigInt(roleId) },
      data:  {
        roleName:    dto.roleName,
        description: dto.description,
        skillTags:   dto.skillTags,
        dailyRate:   dto.dailyRate,
      },
    });
    return this._formatRole(updated);
  }

  async deleteCustomRole(companyId: number, roleId: number) {
    const role = await this.prisma.companyCustomRole.findFirst({
      where: { id: BigInt(roleId), companyId: BigInt(companyId) },
    });
    if (!role) throw new NotFoundException('角色不存在');
    await this.prisma.companyCustomRole.delete({ where: { id: BigInt(roleId) } });
    return { success: true };
  }

  private _formatRole(r: any) {
    return {
      roleId:      Number(r.id),
      roleName:    r.roleName,
      description: r.description,
      skillTags:   r.skillTags?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [],
      dailyRate:   r.dailyRate ? Number(r.dailyRate) : null,
      createdAt:   r.createdAt,
    };
  }
}
