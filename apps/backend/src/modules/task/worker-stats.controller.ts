/**
 * V3.3 零工统计 + 信用分 + 封面图
 *
 * GET  /worker/stats         个人统计（服务企业数+任务统计+信用分）
 * GET  /worker/credit-score  信用分明细
 * PUT  /worker/cover-image   更新封面背景图
 */
import {
  Controller, Get, Put, Body, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

class UpdateCoverDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string; // OSS URL

  @IsOptional()
  @IsString()
  @MaxLength(20)
  coverTemplate?: string; // e.g. 'simple','creative','business','warm','tech','photo'
}

// 信用分等级映射
function creditLevel(score: number) {
  if (score >= 90) return { level: '极佳', color: '#52c41a' };
  if (score >= 75) return { level: '良好', color: '#1677ff' };
  if (score >= 60) return { level: '一般', color: '#faad14' };
  if (score >= 40) return { level: '较低', color: '#ff7a45' };
  return { level: '待改善', color: '#ff4d4f' };
}

@ApiTags('worker-stats')
@Controller('worker')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WorkerStatsController {
  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // GET /worker/stats — 个人数据面板
  // ================================================================
  @Get('stats')
  @ApiOperation({ summary: '零工个人统计（数据面板+信用分）' })
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    const workerId = BigInt(user.userId);

    // 并行查询所有统计数据
    const [worker, servedCompanies, taskCounts] = await Promise.all([
      this.prisma.worker.findUnique({
        where: { id: workerId },
        select: {
          avgRating: true,
          completionRate: true,
          completedCount: true,
          coverImage: true,
          coverTemplate: true,
        },
      }),
      // 服务企业数（历史去重）
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT t.company_id) as count
        FROM role_assignments ra
        JOIN task_roles tr ON ra.task_role_id = tr.id
        JOIN tasks t ON tr.task_id = t.id
        WHERE ra.worker_id = ${workerId}
      `,
      // 任务分状态统计
      this.prisma.roleAssignment.groupBy({
        by: ['status'],
        where: { workerId },
        _count: true,
      }),
    ]);

    if (!worker) throw new BadRequestException('用户不存在');

    // 解析任务统计
    const statusMap: Record<string, number> = {};
    for (const item of taskCounts) {
      statusMap[item.status] = item._count;
    }

    const acceptedCount = (statusMap['accepted'] ?? 0) + (statusMap['completed'] ?? 0);
    const inProgressCount = statusMap['accepted'] ?? 0;
    const completedCount = worker.completedCount;

    // 计算信用分
    const credit = await this._calcCreditScore(workerId, worker);

    return {
      servedCompanies: Number(servedCompanies[0]?.count ?? 0),
      acceptedTasks: acceptedCount,
      inProgressTasks: inProgressCount,
      completedTasks: completedCount,
      creditScore: credit.total,
      creditLevel: creditLevel(credit.total),
      coverImage: worker.coverImage,
      coverTemplate: worker.coverTemplate ?? 'simple',
    };
  }

  // ================================================================
  // GET /worker/credit-score — 信用分明细
  // ================================================================
  @Get('credit-score')
  @ApiOperation({ summary: '零工信用分明细（各维度拆解）' })
  async getCreditScore(@CurrentUser() user: CurrentUserPayload) {
    const workerId = BigInt(user.userId);
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { avgRating: true, completionRate: true, completedCount: true },
    });
    if (!worker) throw new BadRequestException('用户不存在');

    const credit = await this._calcCreditScore(workerId, worker);
    return credit;
  }

  // ================================================================
  // PUT /worker/cover-image — 更新封面
  // ================================================================
  @Put('cover-image')
  @ApiOperation({ summary: '更新封面背景图' })
  async updateCover(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCoverDto,
  ) {
    if (!dto.coverImage && !dto.coverTemplate) {
      throw new BadRequestException('请提供封面图URL或模板ID');
    }

    await this.prisma.worker.update({
      where: { id: BigInt(user.userId) },
      data: {
        coverImage: dto.coverImage ?? null,
        coverTemplate: dto.coverTemplate ?? null,
      },
    });

    return { message: '封面已更新' };
  }

  // ================================================================
  // 信用分计算：评分×40% + 完成率×30% + 按时交付×20% + (1-争议率)×10%
  // ================================================================
  private async _calcCreditScore(
    workerId: bigint,
    worker: { avgRating: any; completionRate: any; completedCount: number },
  ) {
    const avgRating = Number(worker.avgRating ?? 0);
    const completionRate = Number(worker.completionRate ?? 0);
    const completedCount = worker.completedCount;

    // 按时交付率：在截止日期前提交验收的任务数 / 已完成任务总数
    let onTimeRate = 1; // 默认 100%
    if (completedCount > 0) {
      const onTimeCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM role_assignments ra
        JOIN task_roles tr ON ra.task_role_id = tr.id
        JOIN tasks t ON tr.task_id = t.id
        WHERE ra.worker_id = ${workerId}
          AND ra.status = 'completed'
          AND (t.end_date IS NULL OR ra.accepted_at <= t.end_date)
      `;
      onTimeRate = Number(onTimeCount[0]?.count ?? 0) / completedCount;
    }

    // 争议率
    let disputeRate = 0;
    if (completedCount > 0) {
      const disputeResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM disputes d
        JOIN role_assignments ra ON d.assignment_id = ra.id
        WHERE ra.worker_id = ${workerId}
      `;
      const disputeCount = Number(disputeResult[0]?.count ?? 0);
      disputeRate = disputeCount / completedCount;
    }

    // 各维度得分（0-100）
    const ratingDim = (avgRating / 5) * 100;
    const completionDim = completionRate * 100;
    const onTimeDim = onTimeRate * 100;
    const noDisputeDim = (1 - disputeRate) * 100;

    // 加权总分
    const total = Math.round(
      ratingDim * 0.4 +
      completionDim * 0.3 +
      onTimeDim * 0.2 +
      noDisputeDim * 0.1,
    );

    // 新用户默认80分
    const finalScore = completedCount === 0 && avgRating === 0 ? 80 : Math.max(0, Math.min(100, total));

    return {
      total: finalScore,
      ...creditLevel(finalScore),
      dimensions: {
        rating: { score: Math.round(ratingDim), weight: '40%', raw: avgRating },
        completion: { score: Math.round(completionDim), weight: '30%', raw: completionRate },
        onTime: { score: Math.round(onTimeDim), weight: '20%', raw: onTimeRate },
        noDispute: { score: Math.round(noDisputeDim), weight: '10%', raw: 1 - disputeRate },
      },
    };
  }
}
