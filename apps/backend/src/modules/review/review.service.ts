/**
 * ReviewService — 评价管理
 *
 * Schema V2 字段变更:
 *  - targetId → revieweeId
 *  - +taskRoleId (新增必填)
 *  - +dimensionScores (JSON)
 *  - +overallScore (加权综合)
 *  - +positiveTags (JSON)
 *  - +isVisible (双盲)
 *  - rating 变为 nullable（兼容旧数据）
 */
import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  IsInt, Min, Max, IsString, IsOptional, IsNumber, IsArray,
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
  @ApiPropertyOptional({ description: '正向标签', type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) positiveTags?: string[];
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
      rating: dto.rating,
      comment: dto.comment,
      dimensions: null,
      positiveTags: null,
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
    const weightedScore =
      dto.qualityScore * weights.quality +
      dto.communicationScore * weights.communication +
      dto.attitudeScore * weights.attitude +
      dto.deliveryScore * weights.delivery +
      dto.overallScore * weights.overall;
    const rating = Math.round(weightedScore);

    const dimensionScores = {
      quality: dto.qualityScore,
      communication: dto.communicationScore,
      attitude: dto.attitudeScore,
      delivery: dto.deliveryScore,
      overall: dto.overallScore,
    };

    return this._submitReview(assignmentId, reviewerType, reviewerId, targetId, {
      rating,
      comment: dto.comment,
      dimensions: dimensionScores,
      overallScore: weightedScore,
      positiveTags: dto.positiveTags ?? null,
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
    data: {
      rating: number;
      comment?: string;
      dimensions: Record<string, number> | null;
      overallScore?: number;
      positiveTags?: string[] | null;
    },
  ) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
      include: { taskRole: true },
    });
    if (!assignment) throw new BadRequestException('分配记录不存在');
    if (assignment.status !== 'completed')
      throw new BadRequestException('只有已完成的任务才能评价');

    // 自动解析 targetId：企业评零工→workerId，零工评企业→taskRole.task.companyId
    if (targetId === 0) {
      if (reviewerType === 'company') {
        targetId = Number(assignment.workerId);
      } else {
        const task = await this.prisma.task.findUnique({ where: { id: assignment.taskRole.taskId } });
        targetId = task ? Number(task.companyId) : 0;
      }
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        assignmentId_reviewerType: {
          assignmentId: BigInt(assignmentId),
          reviewerType,
        },
      },
    });
    if (existing) throw new BadRequestException('已评价，不可重复提交');

    // 检查对方是否已评 → 如果双方都评，则设置 isVisible=true
    const otherSide = reviewerType === 'company' ? 'worker' : 'company';
    const otherReview = await this.prisma.review.findUnique({
      where: {
        assignmentId_reviewerType: {
          assignmentId: BigInt(assignmentId),
          reviewerType: otherSide,
        },
      },
    });

    const review = await this.prisma.review.create({
      data: {
        taskId: assignment.taskRole.taskId,
        taskRoleId: assignment.taskRoleId,
        assignmentId: BigInt(assignmentId),
        reviewerType,
        reviewerId: BigInt(reviewerId),
        revieweeId: BigInt(targetId),
        rating: data.rating,
        comment: data.comment ?? null,
        dimensionScores: data.dimensions ?? undefined,
        overallScore: data.overallScore ?? data.rating,
        positiveTags: data.positiveTags ?? undefined,
        isVisible: !!otherReview, // 对方已评则双方可见
      },
    });

    // 如果对方已评，将对方的也设为可见
    if (otherReview && !otherReview.isVisible) {
      await this.prisma.review.update({
        where: { id: otherReview.id },
        data: { isVisible: true },
      });
    }

    // 更新零工平均评分（企业评价时）
    if (reviewerType === 'company') {
      await this.updateWorkerAvgRating(targetId);
    }

    this.logger.log(
      `评价提交: assignment=${assignmentId}, by=${reviewerType}, rating=${data.rating}`,
    );

    return {
      reviewId: Number(review.id),
      rating: review.rating,
      overallScore: review.overallScore ? Number(review.overallScore) : null,
      comment: review.comment,
      reviewerType: review.reviewerType,
      dimensions: data.dimensions,
      positiveTags: data.positiveTags,
      isVisible: review.isVisible,
      createdAt: review.createdAt,
    };
  }

  // 重新计算零工平均评分
  private async updateWorkerAvgRating(workerId: number) {
    const result = await this.prisma.review.aggregate({
      _avg: { rating: true },
      where: { revieweeId: BigInt(workerId), reviewerType: 'company' },
    });
    const avg = result._avg?.rating ?? 0;
    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: { avgRating: avg },
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
      reviewId: Number(r.id),
      reviewerType: r.reviewerType,
      rating: r.rating,
      overallScore: r.overallScore ? Number(r.overallScore) : null,
      dimensionScores: r.dimensionScores,
      comment: r.comment,
      isVisible: r.isVisible,
      createdAt: r.createdAt,
    }));
  }

  // ================================================================
  // 获取零工的历史评价（公开主页用）
  // ================================================================
  async getWorkerReviews(workerId: number, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { revieweeId: BigInt(workerId), reviewerType: 'company', isVisible: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.review.count({
        where: { revieweeId: BigInt(workerId), reviewerType: 'company', isVisible: true },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      list: list.map((r) => ({
        reviewId: Number(r.id),
        taskId: Number(r.taskId),
        rating: r.rating,
        overallScore: r.overallScore ? Number(r.overallScore) : null,
        dimensionScores: r.dimensionScores,
        positiveTags: r.positiveTags,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    };
  }
}
