import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  IsInt, Min, Max, IsString, IsOptional, IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ── DTOs ─────────────────────────────────────────
export class CreateReviewDto {
  @ApiProperty({ description: '整体评分 1-5', example: 5 })
  @IsInt() @Min(1) @Max(5) @Type(() => Number)
  rating: number;

  @ApiPropertyOptional({ description: '文字评价', maxLength: 500 })
  @IsOptional() @IsString()
  comment?: string;
}

/** W7 多维度评价 */
export class CreateReviewV2Dto {
  @ApiProperty({ description: '专业能力 1-5' }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) qualityScore: number;
  @ApiProperty({ description: '沟通配合 1-5' }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) communicationScore: number;
  @ApiProperty({ description: '工作态度 1-5' }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) attitudeScore: number;
  @ApiProperty({ description: '按时交付 1-5' }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) deliveryScore: number;
  @ApiProperty({ description: '整体满意度 1-5' }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) overallScore: number;
  @ApiPropertyOptional({ description: '文字评价', maxLength: 500 }) @IsOptional() @IsString() comment?: string;
}

// ── Service ──────────────────────────────────────
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // V1: 简版评价（兼容 Sprint1）
  // ================================================================
  async createReview(
    assignmentId: number,
    reviewerType: 'company' | 'worker',
    reviewerId: number,
    targetId: number,
    dto: CreateReviewDto,
  ) {
    return this._submitReview(assignmentId, reviewerType, reviewerId, targetId, {
      rating:  dto.rating,
      comment: dto.comment,
      dimensions: null,
    });
  }

  // ================================================================
  // V2: 多维度评价（W7 S2-004）
  // ================================================================
  async createReviewV2(
    assignmentId: number,
    reviewerType: 'company' | 'worker',
    reviewerId: number,
    targetId: number,
    dto: CreateReviewV2Dto,
  ) {
    // 综合评分 = 加权均值
    const weights = { quality: 0.25, communication: 0.2, attitude: 0.2, delivery: 0.2, overall: 0.15 };
    const rating = Math.round(
      dto.qualityScore * weights.quality +
      dto.communicationScore * weights.communication +
      dto.attitudeScore * weights.attitude +
      dto.deliveryScore * weights.delivery +
      dto.overallScore * weights.overall,
    );

    const dimensionsJson = JSON.stringify({
      quality:       dto.qualityScore,
      communication: dto.communicationScore,
      attitude:      dto.attitudeScore,
      delivery:      dto.deliveryScore,
      overall:       dto.overallScore,
    });

    return this._submitReview(assignmentId, reviewerType, reviewerId, targetId, {
      rating,
      comment: dto.comment,
      dimensions: dimensionsJson,
    });
  }

  // ================================================================
  // 内部：通用提交逻辑
  // ================================================================
  private async _submitReview(
    assignmentId: number,
    reviewerType: 'company' | 'worker',
    reviewerId: number,
    targetId: number,
    data: { rating: number; comment?: string; dimensions: string | null },
  ) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
      include: { taskRole: true },
    });
    if (!assignment) throw new BadRequestException('分配记录不存在');
    if (assignment.status !== 'completed')
      throw new BadRequestException('只有已完成的任务才能评价');

    const existing = await this.prisma.review.findUnique({
      where: {
        assignmentId_reviewerType: {
          assignmentId: BigInt(assignmentId),
          reviewerType,
        },
      },
    });
    if (existing) throw new BadRequestException('已评价，不可重复提交');

    const review = await this.prisma.review.create({
      data: {
        taskId:       (assignment as any).taskRole.taskId,
        assignmentId: BigInt(assignmentId),
        reviewerType,
        reviewerId:   BigInt(reviewerId),
        targetId:     BigInt(targetId),
        rating:       data.rating,
        comment:      data.comment ?? null,
      },
    });

    // 更新零工平均评分（企业评价时）
    if (reviewerType === 'company') {
      await this.updateWorkerAvgRating(targetId);
    }

    this.logger.log(
      `评价提交: assignment=${assignmentId}, by=${reviewerType}, rating=${data.rating}`,
    );

    return {
      reviewId:     Number(review.id),
      rating:       review.rating,
      comment:      review.comment,
      reviewerType: review.reviewerType,
      dimensions:   data.dimensions ? JSON.parse(data.dimensions) : null,
      createdAt:    review.createdAt,
    };
  }

  // 重新计算零工平均评分
  private async updateWorkerAvgRating(workerId: number) {
    const result = await this.prisma.review.aggregate({
      _avg: { rating: true },
      where: { targetId: BigInt(workerId), reviewerType: 'company' },
    });
    const avg = result._avg.rating ?? 0;
    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data:  { avgRating: avg },
    });
  }

  // ================================================================
  // 获取某个 Assignment 的评价
  // ================================================================
  async getReviews(assignmentId: number) {
    const reviews = await this.prisma.review.findMany({
      where: { assignmentId: BigInt(assignmentId) },
    });
    return reviews.map((r) => ({
      reviewId:     Number(r.id),
      reviewerType: r.reviewerType,
      rating:       r.rating,
      comment:      r.comment,
      createdAt:    r.createdAt,
    }));
  }

  // ================================================================
  // 获取零工的历史评价（公开主页用）
  // ================================================================
  async getWorkerReviews(workerId: number, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.review.findMany({
        where:   { targetId: BigInt(workerId), reviewerType: 'company' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.review.count({
        where: { targetId: BigInt(workerId), reviewerType: 'company' },
      }),
    ]);
    return {
      total, page, pageSize,
      list: list.map((r) => ({
        reviewId:  Number(r.id),
        taskId:    Number(r.taskId),
        rating:    r.rating,
        comment:   r.comment,
        createdAt: r.createdAt,
      })),
    };
  }
}
