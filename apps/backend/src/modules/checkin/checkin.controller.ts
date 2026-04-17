import {
  Controller, Post, Get, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckinService } from './checkin.service';
import { CheckinDto, CheckoutDto, ConfirmCheckinDto } from './checkin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

// ── 零工：打卡相关 ────────────────────────────────
@ApiTags('checkin')
@Controller('worker/tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WorkerCheckinController {
  constructor(private readonly svc: CheckinService) {}

  /** S2-001 上班打卡 */
  @Post(':assignmentId/checkin')
  @ApiOperation({ summary: '零工每日上班打卡（GPS+截图）' })
  async checkin(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CheckinDto,
  ) {
    return this.svc.checkin(assignmentId, user.userId, dto);
  }

  /** 下班签退 */
  @Post(':assignmentId/checkout')
  @ApiOperation({ summary: '零工每日下班签退' })
  async checkout(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CheckoutDto,
  ) {
    return this.svc.checkout(assignmentId, user.userId, dto);
  }

  /** 查看本人打卡记录 */
  @Get(':assignmentId/checkins')
  @ApiOperation({ summary: '零工查看打卡记录' })
  async listCheckins(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.listCheckins(assignmentId, page, pageSize);
  }
}

// ── 企业：确认工时 ────────────────────────────────
@ApiTags('checkin')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CompanyCheckinController {
  constructor(private readonly svc: CheckinService) {}

  /** S2-002 企业确认工时 */
  @Post('checkins/:checkinId/confirm')
  @ApiOperation({ summary: '企业确认工时打卡' })
  async confirm(
    @Param('checkinId', ParseIntPipe) checkinId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmCheckinDto,
  ) {
    return this.svc.confirmCheckin(checkinId, user.companyId!, 'confirm', dto);
  }

  /** 企业驳回工时 */
  @Post('checkins/:checkinId/reject')
  @ApiOperation({ summary: '企业驳回工时打卡' })
  async reject(
    @Param('checkinId', ParseIntPipe) checkinId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmCheckinDto,
  ) {
    return this.svc.confirmCheckin(checkinId, user.companyId!, 'reject', dto);
  }

  /** 企业查看某 Assignment 的打卡列表 */
  @Get('assignments/:assignmentId/checkins')
  @ApiOperation({ summary: '企业查看零工打卡记录' })
  async listCheckins(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.listCheckins(assignmentId, page, pageSize);
  }
}
