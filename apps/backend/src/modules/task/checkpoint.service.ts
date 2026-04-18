/**
 * CheckpointService — R2 检查点管理（Sprint 4 · V3.7）
 * Schema: task_checkpoints (12字段, 5状态: pending→submitted→passed/rejected→overdue)
 */
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, IsDateString, IsArray, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

export class CreateCheckpointDto {
  @ApiProperty() @IsString() @MaxLength(50) name: string;
  @ApiProperty() @IsIn(['progress_check', 'quality_gate']) type: string;
  @ApiProperty() @IsDateString() plannedDate: string;
  @ApiProperty() @IsNumber() reviewerId: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
}

export class SubmitCheckpointDto {
  @ApiProperty() @IsString() submitContent: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() submitAttachments?: string[];
}

export class ReviewCheckpointDto {
  @ApiProperty() @IsIn(['passed', 'rejected']) result: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reviewComment?: string;
}

@Injectable()
export class CheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  async list(taskId: number) {
    const items = await this.prisma.taskCheckpoint.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map(c => this.serialize(c));
  }

  async create(taskId: number, dto: CreateCheckpointDto) {
    const maxSort = await this.prisma.taskCheckpoint.aggregate({
      where: { taskId: BigInt(taskId) },
      _max: { sortOrder: true },
    });
    const cp = await this.prisma.taskCheckpoint.create({
      data: {
        taskId: BigInt(taskId),
        name: dto.name,
        type: dto.type as any,
        plannedDate: new Date(dto.plannedDate),
        reviewerId: BigInt(dto.reviewerId),
        description: dto.description,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    return { checkpointId: Number(cp.id) };
  }

  async submit(checkpointId: number, dto: SubmitCheckpointDto) {
    const cp = await this.prisma.taskCheckpoint.findUnique({ where: { id: BigInt(checkpointId) } });
    if (!cp) throw new NotFoundException('检查点不存在');
    if (!['pending', 'rejected'].includes(cp.status)) throw new BadRequestException('当前状态不允许提交');

    await this.prisma.taskCheckpoint.update({
      where: { id: BigInt(checkpointId) },
      data: {
        status: 'submitted',
        submitContent: dto.submitContent,
        submitAttachments: dto.submitAttachments || [],
        submittedAt: new Date(),
        revisionCount: cp.status === 'rejected' ? { increment: 1 } : undefined,
      },
    });
    return { checkpointId, status: 'submitted' };
  }

  async review(checkpointId: number, dto: ReviewCheckpointDto) {
    const cp = await this.prisma.taskCheckpoint.findUnique({ where: { id: BigInt(checkpointId) } });
    if (!cp) throw new NotFoundException('检查点不存在');
    if (cp.status !== 'submitted') throw new BadRequestException('当前状态不允许审核');

    await this.prisma.taskCheckpoint.update({
      where: { id: BigInt(checkpointId) },
      data: {
        status: dto.result as any,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      },
    });
    return { checkpointId, status: dto.result };
  }

  async delete(checkpointId: number) {
    await this.prisma.taskCheckpoint.delete({ where: { id: BigInt(checkpointId) } });
    return { deleted: true };
  }

  private serialize(c: any) {
    return {
      id: Number(c.id), taskId: Number(c.taskId), name: c.name, type: c.type,
      plannedDate: c.plannedDate, reviewerId: Number(c.reviewerId),
      description: c.description, status: c.status,
      submitContent: c.submitContent, submitAttachments: c.submitAttachments,
      submittedAt: c.submittedAt, reviewComment: c.reviewComment, reviewedAt: c.reviewedAt,
      revisionCount: c.revisionCount, sortOrder: c.sortOrder,
    };
  }
}
