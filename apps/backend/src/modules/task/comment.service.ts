/**
 * CommentService — R2 任务评论（Sprint 4 · V3.7）
 * Schema: task_comments (10字段, 支持回复/嵌套/@提及/标记重要)
 */
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma';
import { CompanyNotificationService } from '../notification/company-notification.service';
import { AnalyticsService } from '../analytics/analytics.service';

export class CreateCommentDto {
  @ApiProperty() @IsString() @MaxLength(1000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() parentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isImportant?: boolean;
}

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
    private readonly analytics: AnalyticsService,
  ) {}

  async list(taskId: number, page = 1, pageSize = 50) {
    const where = { taskId: BigInt(taskId), isDeleted: false };
    const [list, total] = await Promise.all([
      this.prisma.taskComment.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.taskComment.count({ where }),
    ]);
    return { list: list.map(c => this.serialize(c)), total, page, pageSize };
  }

  async create(taskId: number, authorType: string, authorId: number, dto: CreateCommentDto) {
    // V3.7 — 校验任务存在
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');

    // V3.7 — 校验参与者权限
    await this.assertParticipant(taskId, authorType, authorId, task);

    // V3.7 — 嵌套最多 2 层：如果 parentId 存在，父评论的 parentId 必须为 null
    if (dto.parentId) {
      const parent = await this.prisma.taskComment.findUnique({ where: { id: BigInt(dto.parentId) } });
      if (!parent) throw new NotFoundException('父评论不存在');
      if (Number(parent.taskId) !== taskId) throw new BadRequestException('父评论不属于当前任务');
      if (parent.parentId !== null) throw new BadRequestException('评论嵌套最多 2 层');
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: BigInt(taskId),
        authorType: authorType as any,
        authorId: BigInt(authorId),
        content: dto.content.replace(/<[^>]*>/g, ''), // XSS防护：去除HTML标签
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
        attachments: dto.attachments || [],
        isImportant: dto.isImportant || false,
      },
    });

    // 解析 @提及 — 格式: @[用户名](userId)
    const mentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
    const mentionedUserIds: number[] = [];
    let match;
    while ((match = mentionRegex.exec(dto.content)) !== null) {
      mentionedUserIds.push(Number(match[2]));
    }

    // V3.7 — 触发企业端站内通知（仅对企业用户提及）
    if (mentionedUserIds.length > 0 && task.companyId) {
      const mentionedCompanyUsers = await this.prisma.companyUser.findMany({
        where: {
          id: { in: mentionedUserIds.map((id) => BigInt(id)) },
          companyId: task.companyId,
        },
        select: { id: true },
      });
      if (mentionedCompanyUsers.length > 0) {
        await this.notify.createMany(
          mentionedCompanyUsers.map((u) => Number(u.id)),
          {
            companyId: Number(task.companyId),
            type: 'comment_mention',
            title: `你被提及了：任务《${task.title}》`,
            content: dto.content.slice(0, 200),
            refType: 'comment',
            refId: Number(comment.id),
          },
        );
      }
    }

    await this.analytics.track({
      event: 'task_comment_post',
      actorType: authorType as any,
      actorId: authorId,
      companyId: Number(task.companyId),
      refType: 'comment', refId: Number(comment.id),
      props: { taskId, mentionCount: mentionedUserIds.length, hasParent: !!dto.parentId },
    });

    return { commentId: Number(comment.id), mentionedUserIds };
  }

  async softDelete(commentId: number, userId: number) {
    const c = await this.prisma.taskComment.findUnique({ where: { id: BigInt(commentId) } });
    if (!c) throw new NotFoundException('评论不存在');
    if (Number(c.authorId) !== userId) throw new ForbiddenException('仅评论作者可删除');

    await this.prisma.taskComment.update({
      where: { id: BigInt(commentId) },
      data: { isDeleted: true },
    });
    return { deleted: true };
  }

  /**
   * V3.7 — 参与者权限校验
   * 评论区允许的人员：
   *   - 企业端：任务创建人 / 项目负责人 / 同企业管理员（由路由层 RBAC 保证 super_admin/task_admin/operator）
   *   - 零工端：已分配该任务的零工（status IN invited/accepted/completed）
   */
  private async assertParticipant(
    taskId: number,
    authorType: string,
    authorId: number,
    task: any,
  ) {
    if (authorType === 'company_user') {
      if (Number(task.createdBy) === authorId) return;
      if (task.projectId) {
        const proj = await this.prisma.project.findUnique({
          where: { id: task.projectId },
          select: { managerId: true },
        });
        if (proj && Number(proj.managerId) === authorId) return;
      }
      // 其他同企业用户：由 JWT + 路由层 RBAC 验证；此处放行
      return;
    }
    if (authorType === 'worker') {
      const assigned = await this.prisma.roleAssignment.findFirst({
        where: {
          workerId: BigInt(authorId),
          status: { in: ['invited', 'accepted', 'completed'] },
          taskRole: { taskId: BigInt(taskId) },
        },
        select: { id: true },
      });
      if (!assigned) throw new ForbiddenException('非任务参与人，不能发表评论');
    }
  }

  private serialize(c: any) {
    return {
      id: Number(c.id), taskId: Number(c.taskId),
      parentId: c.parentId ? Number(c.parentId) : null,
      authorType: c.authorType, authorId: Number(c.authorId),
      content: c.content, attachments: c.attachments,
      isImportant: c.isImportant, createdAt: c.createdAt,
    };
  }
}
