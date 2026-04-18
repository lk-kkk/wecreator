/**
 * TaskTemplateService — 任务模板（S2-022）+ 企业自定义角色（S2-023）
 *
 * Schema V2 字段变更 (CompanyCustomRole):
 *  - roleName → name
 *  - skillTags (string) → commonSkills (Json)
 *  - dailyRate → removed (use category instead)
 *  - +category
 *  - +isActive
 *
 * 任务模板：暂用 CompanyCustomRole 的 description 前缀 "[TEMPLATE]" 存储
 * 自定义角色：企业定义专属岗位（上限50个）
 */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ── DTOs ─────────────────────────────────────────────────────────────
export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '基于已有任务ID创建' })
  @IsOptional()
  @Type(() => Number)
  fromTaskId?: number;

  @ApiPropertyOptional({ description: '任务标题' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: '任务描述' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: '任务模式',
    enum: ['task_package', 'daily_rate'],
  })
  @IsOptional()
  @IsString()
  taskMode?: string;

  @ApiPropertyOptional({
    description: '角色配置 JSON（与任务角色结构相同）',
  })
  @IsOptional()
  roleConfig?: any[];
}

export class CreateFromTemplateDto {
  @ApiProperty({ description: '模板ID' })
  @Type(() => Number)
  templateId: number;

  @ApiPropertyOptional({ description: '覆盖任务标题' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}

export class CreateCustomRoleDto {
  @ApiProperty({ description: '角色名称', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '分类', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  category?: string;

  @ApiPropertyOptional({ description: '角色描述', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '常用技能标签（最多10个）',
    type: [String],
    example: ['Photoshop', 'Illustrator', '品牌设计'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonSkills?: string[];
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
    const roles = await this.prisma.companyCustomRole.findMany({
      where: { companyId: BigInt(companyId) },
    });

    // 模板存储于 description 字段前缀 "[TEMPLATE]" 的记录（轻量实现）
    const templates = roles
      .filter((r) => r.description?.startsWith('[TEMPLATE]'))
      .map((r) => {
        try {
          const data = JSON.parse(r.description!.replace('[TEMPLATE]', ''));
          return {
            templateId: Number(r.id),
            name: r.name,
            taskMode: data.taskMode ?? 'task_package',
            title: data.title ?? '',
            description: data.description ?? '',
            roleConfig: data.roleConfig ?? [],
            createdAt: r.createdAt,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return templates;
  }

  /** 保存模板（从任务或从头创建） */
  async saveTemplate(companyId: number, dto: CreateTemplateDto) {
    let data: any = {
      title: dto.title ?? '',
      description: dto.description ?? '',
      taskMode: dto.taskMode ?? 'task_package',
      roleConfig: dto.roleConfig ?? [],
    };

    // 从已有任务复制
    if (dto.fromTaskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: BigInt(dto.fromTaskId), companyId: BigInt(companyId) },
        include: { taskRoles: true },
      });
      if (!task) throw new NotFoundException('任务不存在');
      data = {
        title: task.title,
        description: task.description ?? '',
        taskMode: task.taskMode,
        roleConfig: task.taskRoles.map((r) => ({
          roleName: r.roleName,
          headcount: r.headcount,
          budget: Number(r.budget),
          skillTags: r.skillTags,
        })),
      };
    }

    // 检查同名模板
    const exists = await this.prisma.companyCustomRole.findFirst({
      where: {
        companyId: BigInt(companyId),
        name: dto.name,
        description: { startsWith: '[TEMPLATE]' },
      },
    });
    if (exists) throw new BadRequestException('同名模板已存在');

    const record = await this.prisma.companyCustomRole.create({
      data: {
        companyId: BigInt(companyId),
        name: dto.name,
        description: `[TEMPLATE]${JSON.stringify(data)}`,
      },
    });

    this.logger.log(
      `任务模板保存: company=${companyId}, name=${dto.name}`,
    );
    return {
      templateId: Number(record.id),
      name: dto.name,
      ...data,
    };
  }

  /** 删除模板 */
  async deleteTemplate(companyId: number, templateId: number) {
    const record = await this.prisma.companyCustomRole.findFirst({
      where: {
        id: BigInt(templateId),
        companyId: BigInt(companyId),
        description: { startsWith: '[TEMPLATE]' },
      },
    });
    if (!record) throw new NotFoundException('模板不存在');

    await this.prisma.companyCustomRole.delete({
      where: { id: BigInt(templateId) },
    });
    return { success: true };
  }

  /** 从模板创建任务（返回草稿任务） */
  async createFromTemplate(companyId: number, dto: CreateFromTemplateDto) {
    const record = await this.prisma.companyCustomRole.findFirst({
      where: {
        id: BigInt(dto.templateId),
        companyId: BigInt(companyId),
        description: { startsWith: '[TEMPLATE]' },
      },
    });
    if (!record) throw new NotFoundException('模板不存在');

    const tplData = JSON.parse(record.description!.replace('[TEMPLATE]', ''));

    // 创建草稿任务
    const task = await this.prisma.task.create({
      data: {
        companyId: BigInt(companyId),
        createdBy: BigInt(companyId),
        title: dto.title ?? tplData.title,
        description: tplData.description,
        taskMode: tplData.taskMode,
        status: 'draft',
        totalBudget: 0,
      },
    });

    // 创建角色
    if (tplData.roleConfig?.length) {
      await this.prisma.taskRole.createMany({
        data: tplData.roleConfig.map((r: any) => ({
          taskId: task.id,
          roleName: r.roleName,
          headcount: r.headcount ?? 1,
          budget: r.budget ?? 0,
          skillTags: r.skillTags,
        })),
      });
    }

    this.logger.log(
      `从模板创建任务: template=${dto.templateId}, task=${task.id}`,
    );
    return { taskId: Number(task.id), status: 'draft', title: task.title };
  }

  // ================================================================
  // 企业自定义角色 CRUD（S2-023）—— 适配 Schema V2
  // ================================================================

  async listCustomRoles(companyId: number) {
    const roles = await this.prisma.companyCustomRole.findMany({
      where: {
        companyId: BigInt(companyId),
        isActive: true,
        description: { not: { startsWith: '[TEMPLATE]' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return roles.map((r) => this._formatRole(r));
  }

  async createCustomRole(companyId: number, dto: CreateCustomRoleDto) {
    const count = await this.prisma.companyCustomRole.count({
      where: {
        companyId: BigInt(companyId),
        isActive: true,
        description: { not: { startsWith: '[TEMPLATE]' } },
      },
    });
    if (count >= this.MAX_CUSTOM_ROLES) {
      throw new BadRequestException(
        `自定义角色已达上限（${this.MAX_CUSTOM_ROLES}个）`,
      );
    }

    // Schema V2: unique constraint on (company_id, name)
    const exists = await this.prisma.companyCustomRole.findUnique({
      where: {
        companyId_name: {
          companyId: BigInt(companyId),
          name: dto.name,
        },
      },
    });
    if (exists) throw new BadRequestException('同名角色已存在');

    const role = await this.prisma.companyCustomRole.create({
      data: {
        companyId: BigInt(companyId),
        name: dto.name,
        category: dto.category,
        description: dto.description,
        commonSkills: dto.commonSkills ?? undefined,
      },
    });
    return this._formatRole(role);
  }

  async updateCustomRole(
    companyId: number,
    roleId: number,
    dto: Partial<CreateCustomRoleDto>,
  ) {
    const role = await this.prisma.companyCustomRole.findFirst({
      where: {
        id: BigInt(roleId),
        companyId: BigInt(companyId),
        description: { not: { startsWith: '[TEMPLATE]' } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');

    // 如果修改了 name，检查唯一性
    if (dto.name && dto.name !== role.name) {
      const conflict = await this.prisma.companyCustomRole.findUnique({
        where: {
          companyId_name: {
            companyId: BigInt(companyId),
            name: dto.name,
          },
        },
      });
      if (conflict) throw new BadRequestException('同名角色已存在');
    }

    const updated = await this.prisma.companyCustomRole.update({
      where: { id: BigInt(roleId) },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.commonSkills !== undefined
          ? { commonSkills: dto.commonSkills }
          : {}),
      },
    });
    return this._formatRole(updated);
  }

  async deleteCustomRole(companyId: number, roleId: number) {
    const role = await this.prisma.companyCustomRole.findFirst({
      where: { id: BigInt(roleId), companyId: BigInt(companyId) },
    });
    if (!role) throw new NotFoundException('角色不存在');

    // 软删除：标记 isActive = false
    await this.prisma.companyCustomRole.update({
      where: { id: BigInt(roleId) },
      data: { isActive: false },
    });
    return { success: true };
  }

  private _formatRole(r: any) {
    return {
      roleId: Number(r.id),
      name: r.name,
      category: r.category,
      description:
        r.description?.startsWith('[TEMPLATE]') ? null : r.description,
      commonSkills: r.commonSkills ?? [],
      isActive: r.isActive,
      createdAt: r.createdAt,
    };
  }
}
