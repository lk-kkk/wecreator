/**
 * TaskEnhancementController — R2 Sprint 4 新增路由
 * - /tasks/:id/checkpoints  (4 routes)
 * - /tasks/:id/comments     (3 routes)
 * - /tasks/:id/issues       (3 routes)
 */
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CheckpointService, CreateCheckpointDto, SubmitCheckpointDto, ReviewCheckpointDto } from './checkpoint.service';
import { CommentService, CreateCommentDto } from './comment.service';
import { IssueService, CreateIssueDto, UpdateIssueDto } from './issue.service';


@ApiTags('Task Checkpoints')
@Controller('tasks/:taskId/checkpoints')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class CheckpointController {
  constructor(private readonly svc: CheckpointService) {}

  @Get()
  @ApiOperation({ summary: '检查点列表' })
  list(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.svc.list(taskId);
  }

  @Post()
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '创建检查点' })
  create(@Param('taskId', ParseIntPipe) taskId: number, @Body() dto: CreateCheckpointDto) {
    return this.svc.create(taskId, dto);
  }

  @Post(':cpId/submit')
  @Roles('worker')
  @ApiOperation({ summary: '零工提交检查点' })
  submit(@Param('cpId', ParseIntPipe) cpId: number, @Body() dto: SubmitCheckpointDto) {
    return this.svc.submit(cpId, dto);
  }

  @Post(':cpId/review')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '企业审核检查点' })
  review(
    @Param('cpId', ParseIntPipe) cpId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReviewCheckpointDto,
  ) {
    return this.svc.review(cpId, user.userId, dto);
  }

  @Delete(':cpId')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '删除检查点' })
  delete(@Param('cpId', ParseIntPipe) cpId: number) {
    return this.svc.delete(cpId);
  }
}

@ApiTags('Task Comments')
@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class CommentController {
  constructor(private readonly svc: CommentService) {}

  @Get()
  @ApiOperation({ summary: '评论列表' })
  list(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.svc.list(taskId);
  }

  @Post()
  @Roles('super_admin', 'task_admin', 'operator', 'worker')
  @ApiOperation({ summary: '发表评论' })
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCommentDto,
  ) {
    const authorType = user.userType === 'company' ? 'company_user' : 'worker';
    return this.svc.create(taskId, authorType, user.userId, dto);
  }

  @Delete(':commentId')
  @Roles('super_admin', 'task_admin', 'operator', 'worker')
  @ApiOperation({ summary: '删除评论(软删除)' })
  delete(@Param('commentId', ParseIntPipe) commentId: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.softDelete(commentId, user.userId);
  }
}

@ApiTags('Task Issues')
@Controller('tasks/:taskId/issues')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class IssueController {
  constructor(private readonly svc: IssueService) {}

  @Get()
  @ApiOperation({ summary: '问题列表' })
  list(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.svc.list(taskId);
  }

  @Post()
  @Roles('super_admin', 'task_admin', 'operator', 'worker')
  @ApiOperation({ summary: '上报问题' })
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateIssueDto,
  ) {
    const reporterType = user.userType === 'company' ? 'company_user' : 'worker';
    return this.svc.create(taskId, reporterType, user.userId, dto);
  }

  @Put(':issueId')
  @Roles('super_admin', 'task_admin', 'operator')
  @ApiOperation({ summary: '更新问题状态' })
  update(@Param('issueId', ParseIntPipe) issueId: number, @Body() dto: UpdateIssueDto) {
    return this.svc.update(issueId, dto);
  }
}
