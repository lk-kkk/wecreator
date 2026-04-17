import {
  Controller, Post, Get, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService, CreateReviewDto, CreateReviewV2Dto } from './review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ReviewController {
  constructor(private readonly svc: ReviewService) {}

  /** S1-057 / S2-004 简版评价（兼容接口）*/
  @Post(':assignmentId')
  @ApiOperation({ summary: '提交评价（V1 整体评分）' })
  async createReview(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewDto,
  ) {
    const isCompany = user.userType === 'company';
    const reviewerType = isCompany ? 'company' : 'worker';
    const targetId = isCompany
      ? 0   // 企业评价零工，targetId 由服务端从 assignment 取
      : 0;  // 待实现：零工评企业

    // 获取 assignment 以确定 targetId
    return this.svc.createReview(
      assignmentId, reviewerType,
      user.userId,
      targetId,
      dto,
    );
  }

  /** S2-004 多维度评价（V2）*/
  @Post(':assignmentId/v2')
  @ApiOperation({ summary: '提交多维度评价（V2）' })
  async createReviewV2(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewV2Dto,
  ) {
    const reviewerType = user.userType === 'company' ? 'company' : 'worker';
    return this.svc.createReviewV2(
      assignmentId, reviewerType,
      user.userId,
      0,  // targetId resolved from assignment in service
      dto,
    );
  }

  /** 获取 Assignment 的评价列表 */
  @Get(':assignmentId')
  @ApiOperation({ summary: '获取评价列表' })
  async getReviews(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ) {
    return this.svc.getReviews(assignmentId);
  }

  /** 获取零工的所有历史评价（用于公开主页）*/
  @Get('workers/:workerId')
  @ApiOperation({ summary: '零工历史评价（公开主页）' })
  async getWorkerReviews(
    @Param('workerId', ParseIntPipe) workerId: number,
    @Query('page')     page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.getWorkerReviews(workerId, page, pageSize);
  }
}
