/**
 * CommentService — R2 任务评论（Sprint 4 · V3.7）
 * Schema: task_comments (10字段, 支持回复/嵌套/@提及/标记重要)
 */
import {
  Injectable, NotFoundException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

export class CreateCommentDto {
  @ApiProperty() @IsString() @MaxLength(1000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() parentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isImportant?: boolean;
}

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 解析@提及 — 格式: @[用户名](userId)
    const mentions = dto.content.match(/@\[([^\]]+)\]\((\d+)\)/g);
    // TODO: C19 事件 → R4 通知

    return { commentId: Number(comment.id) };
  }

  async softDelete(commentId: number, userId: number) {
    const c = await this.prisma.taskComment.findUnique({ where: { id: BigInt(commentId) } });
    if (!c) throw new NotFoundException('评论不存在');
    if (Number(c.authorId) !== userId) throw new NotFoundException('无权删除');

    await this.prisma.taskComment.update({
      where: { id: BigInt(commentId) },
      data: { isDeleted: true },
    });
    return { deleted: true };
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
