import {
  Controller, Post, Patch, Get, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  DisputeService, CreateDisputeDto, ResolveDisputeDto, AddEvidenceDto,
} from './dispute.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DisputeController {
  constructor(private readonly svc: DisputeService) {}

  /** S2-011 发起争议 */
  @Post()
  @ApiOperation({ summary: '发起争议仲裁' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.svc.createDispute(
      user.userType as 'company' | 'worker',
      user.userId,
      dto,
    );
  }

  /** 补充证据 */
  @Post(':id/evidence')
  @ApiOperation({ summary: '补充争议证据' })
  addEvidence(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.svc.addEvidence(id, user.userId, user.userType as 'company' | 'worker', dto);
  }

  /** 撤销争议（发起方） */
  @Patch(':id/cancel')
  @ApiOperation({ summary: '撤销争议（仅发起方，pending 状态）' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.svc.cancelDispute(id, user.userId, user.userType as 'company' | 'worker');
  }

  /** 受理争议（管理员） — 后续接入 admin guard */
  @Patch(':id/accept')
  @ApiOperation({ summary: '受理争议（管理员）' })
  accept(@Param('id', ParseIntPipe) id: number) {
    return this.svc.acceptDispute(id);
  }

  /** 裁决（管理员） */
  @Patch(':id/resolve')
  @ApiOperation({ summary: '仲裁裁决（管理员）' })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.svc.resolveDispute(id, dto);
  }

  /** 查看单个争议详情 */
  @Get(':id')
  @ApiOperation({ summary: '查看争议详情' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }

  /** 查看某任务的争议列表 */
  @Get('tasks/:taskId')
  @ApiOperation({ summary: '查看任务的争议列表' })
  listByTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.svc.listByTask(taskId);
  }

  /** 查看当前用户相关的争议 */
  @Get()
  @ApiOperation({ summary: '查看我的争议列表' })
  listMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page')     page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    return this.svc.listByUser(
      user.userId,
      user.userType as 'company' | 'worker',
      Number(page),
      Number(pageSize),
    );
  }
}
