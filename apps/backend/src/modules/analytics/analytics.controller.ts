/**
 * V3.7 Phase 6 — AnalyticsController
 *
 * 路由:
 *  POST /analytics/events            — 前端主动上报（project_board_view / notification_click）
 *  GET  /analytics/tasks             — 任务分析
 *  GET  /analytics/projects          — 项目分析
 *  GET  /analytics/quality           — 质量分析
 */
import {
  Body, Controller, Get, Post, UseGuards, HttpCode, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService, AnalyticsActorType } from './analytics.service';

class TrackEventDto {
  event!: string;
  refType?: string;
  refId?: number;
  props?: Record<string, any>;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  // 任何登录用户可上报
  @Post('events')
  @HttpCode(204)
  @Roles('super_admin', 'task_admin', 'finance_admin', 'operator', 'worker')
  async record(@Req() req: any, @Body() dto: TrackEventDto) {
    const user = req.user;
    const actorType: AnalyticsActorType =
      user?.userType === 'worker' ? 'worker' : 'company_user';
    await this.svc.track({
      event:     dto.event,
      actorType,
      actorId:   user?.userId ?? null,
      companyId: user?.companyId ?? null,
      refType:   dto.refType,
      refId:     dto.refId,
      props:     dto.props,
    });
  }

  @Get('tasks')
  @Roles('super_admin', 'task_admin', 'operator')
  async tasks(@Req() req: any) {
    return this.svc.getTaskAnalytics(req.user.companyId);
  }

  @Get('projects')
  @Roles('super_admin', 'task_admin', 'operator')
  async projects(@Req() req: any) {
    return this.svc.getProjectAnalytics(req.user.companyId);
  }

  @Get('quality')
  @Roles('super_admin', 'task_admin', 'operator')
  async quality(@Req() req: any) {
    return this.svc.getQualityAnalytics(req.user.companyId);
  }
}
