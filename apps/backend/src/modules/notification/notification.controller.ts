import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface JwtPayload {
  userId: number;
  companyId?: number;
  userType: 'company' | 'worker';
}

@ApiTags('notification')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/v1/notifications
   * 通知列表（未读优先分页）
   */
  @Get()
  @ApiOperation({ summary: '通知列表（未读优先）' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('page',     new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const userType = user.userType === 'company' ? UserType.company : UserType.worker;
    return this.notificationService.list(user.userId, userType, page, pageSize);
  }

  /**
   * GET /api/v1/notifications/unread-count
   * 未读计数（需在 :id 路由之前声明）
   */
  @Get('unread-count')
  @ApiOperation({ summary: '未读通知数' })
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const userType = user.userType === 'company' ? UserType.company : UserType.worker;
    const count = await this.notificationService.getUnreadCount(user.userId, userType);
    return { count };
  }

  /**
   * PUT /api/v1/notifications/read-all
   * 全部已读
   */
  @Put('read-all')
  @ApiOperation({ summary: '全部已读' })
  async readAll(@CurrentUser() user: JwtPayload) {
    const userType = user.userType === 'company' ? UserType.company : UserType.worker;
    return this.notificationService.markAllRead(user.userId, userType);
  }

  /**
   * PUT /api/v1/notifications/:id/read
   * 单条已读
   */
  @Put(':id/read')
  @ApiOperation({ summary: '标记单条已读' })
  async readOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userType = user.userType === 'company' ? UserType.company : UserType.worker;
    return this.notificationService.markOneRead(id, user.userId, userType);
  }
}
