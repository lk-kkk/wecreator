/**
 * CompanyNotificationController — V3.7 §4.3 企业端站内通知中心
 *
 * 路由:
 *   GET  /api/v1/company-notifications               — 列表(分页+筛选)
 *   GET  /api/v1/company-notifications/unread-count  — 未读数(顶栏徽标)
 *   PUT  /api/v1/company-notifications/read          — 批量/全部已读
 */
import {
  Controller, Get, Put, Body, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  CompanyNotificationService,
  NotificationQueryDto,
  MarkReadDto,
} from './company-notification.service';

@ApiTags('Company Notifications')
@Controller('company-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'task_admin', 'finance_admin', 'operator')
@ApiBearerAuth('access-token')
export class CompanyNotificationController {
  constructor(private readonly svc: CompanyNotificationService) {}

  @Get()
  @ApiOperation({ summary: '企业端通知列表' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: NotificationQueryDto) {
    this.assertCompany(user);
    return this.svc.list(user.userId, user.companyId!, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未读数' })
  unread(@CurrentUser() user: CurrentUserPayload) {
    this.assertCompany(user);
    return this.svc.unreadCount(user.userId, user.companyId!);
  }

  @Put('read')
  @ApiOperation({ summary: '标记已读(批量/全部)' })
  read(@CurrentUser() user: CurrentUserPayload, @Body() dto: MarkReadDto) {
    this.assertCompany(user);
    return this.svc.markRead(user.userId, user.companyId!, dto);
  }

  private assertCompany(user: CurrentUserPayload) {
    if (user.userType !== 'company' || !user.companyId) {
      throw new ForbiddenException('仅企业端用户可访问');
    }
  }
}
