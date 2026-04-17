/**
 * PlatformController — 平台运营管理后台 API (V3.2 §18.5)
 * 34 个接口：认证4 + 看板3 + 企业5 + 零工4 + 任务4 + 仲裁4 + 资金5 + 配置6 + 发票3(复用)
 */
import {
  Controller, Get, Post, Patch, Put, Body, Param, Query,
  UseGuards, Req, ParseIntPipe, HttpCode, HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import {
  PlatformLoginDto, RejectCompanyDto, FreezeCompanyDto,
  BanWorkerDto, AdjustCreditDto, ForceCloseTaskDto, FreezeTaskFundDto,
  PlatformResolveDisputeDto, WithdrawalReviewDto, RefundDto,
  UpdateConfigDto, CreateAdminDto, UpdateAdminDto,
} from './dto';

// ── 平台管理员鉴权 helper ──────────────────────────────────
function assertPlatform(user: any, ...roles: string[]) {
  if (user.userType !== 'platform') throw new ForbiddenException('仅平台管理员可访问');
  if (roles.length > 0 && !roles.includes(user.platformRole) && user.platformRole !== 'platform_super_admin') {
    throw new ForbiddenException('权限不足');
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.1 认证 (4 API) — 无需 JWT
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/auth')
@Controller('platform')
export class PlatformAuthController {
  constructor(private readonly svc: PlatformService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员登录' })
  login(@Body() dto: PlatformLoginDto, @Req() req: Request) {
    return this.svc.login(dto, req.ip || 'unknown');
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Token' })
  refresh(@Body('refreshToken') token: string) {
    return this.svc.refreshToken(token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '当前管理员信息' })
  profile(@CurrentUser() user: any) {
    assertPlatform(user);
    return this.svc.getProfile(user.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '退出登录' })
  logout() {
    return { message: '已退出' };
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.2 数据看板 (3 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/dashboard')
@Controller('platform/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformDashboardController {
  constructor(private readonly svc: PlatformService) {}

  @Get()
  @ApiOperation({ summary: '全局指标卡（8项）' })
  dashboard(@CurrentUser() user: any) {
    assertPlatform(user);
    return this.svc.getDashboard();
  }

  @Get('trends')
  @ApiOperation({ summary: '30日趋势图' })
  trends(@CurrentUser() user: any) {
    assertPlatform(user);
    return this.svc.getTrends();
  }

  @Get('alerts')
  @ApiOperation({ summary: '实时告警' })
  alerts(@CurrentUser() user: any) {
    assertPlatform(user);
    return this.svc.getAlerts();
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.3 企业管理 (5 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/companies')
@Controller('platform/companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformCompanyController {
  constructor(private readonly svc: PlatformService) {}

  @Get()
  @ApiOperation({ summary: '企业列表' })
  list(
    @CurrentUser() user: any,
    @Query('page') page?: number, @Query('pageSize') pageSize?: number,
    @Query('status') status?: string, @Query('search') search?: string,
    @Query('sortBy') sortBy?: string, @Query('sortOrder') sortOrder?: string,
  ) {
    assertPlatform(user, 'platform_ops');
    return this.svc.listCompanies({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, status, search, sortBy, sortOrder });
  }

  @Get(':id')
  @ApiOperation({ summary: '企业详情' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.getCompanyDetail(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: '审核通过' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.approveCompany(id, user.userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: '审核驳回' })
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectCompanyDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.rejectCompany(id, user.userId, dto);
  }

  @Patch(':id/freeze')
  @ApiOperation({ summary: '冻结/解冻企业' })
  freeze(@Param('id', ParseIntPipe) id: number, @Body() dto: FreezeCompanyDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.freezeCompany(id, user.userId, dto);
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.4 零工管理 (4 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/workers')
@Controller('platform/workers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformWorkerController {
  constructor(private readonly svc: PlatformService) {}

  @Get()
  @ApiOperation({ summary: '零工列表' })
  list(
    @CurrentUser() user: any,
    @Query('page') page?: number, @Query('pageSize') pageSize?: number,
    @Query('status') status?: string, @Query('verified') verified?: string,
    @Query('level') level?: string, @Query('city') city?: string,
    @Query('search') search?: string, @Query('sortBy') sortBy?: string,
  ) {
    assertPlatform(user, 'platform_ops');
    return this.svc.listWorkers({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, status, verified, level, city, search, sortBy });
  }

  @Get(':id')
  @ApiOperation({ summary: '零工详情' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.getWorkerDetail(id);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: '封禁/解封零工' })
  ban(@Param('id', ParseIntPipe) id: number, @Body() dto: BanWorkerDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.banWorker(id, user.userId, dto);
  }

  @Patch(':id/credit')
  @ApiOperation({ summary: '人工调整信用分' })
  credit(@Param('id', ParseIntPipe) id: number, @Body() dto: AdjustCreditDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.adjustCredit(id, user.userId, dto);
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.5 任务监控 (4 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/tasks')
@Controller('platform/tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformTaskController {
  constructor(private readonly svc: PlatformService) {}

  @Get()
  @ApiOperation({ summary: '全平台任务列表' })
  list(
    @CurrentUser() user: any,
    @Query('page') page?: number, @Query('pageSize') pageSize?: number,
    @Query('status') status?: string, @Query('mode') mode?: string,
    @Query('search') search?: string, @Query('sortBy') sortBy?: string,
  ) {
    assertPlatform(user, 'platform_ops');
    return this.svc.listTasks({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, status, mode, search, sortBy });
  }

  @Get(':id')
  @ApiOperation({ summary: '任务详情（管理员视角）' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.getTaskDetail(id);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: '强制关闭任务' })
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: ForceCloseTaskDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.forceCloseTask(id, user.userId, dto);
  }

  @Patch(':id/freeze-fund')
  @ApiOperation({ summary: '冻结/解冻任务资金' })
  freezeFund(@Param('id', ParseIntPipe) id: number, @Body() dto: FreezeTaskFundDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_ops');
    return this.svc.freezeTaskFund(id, user.userId, dto);
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.6 争议仲裁 (4 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/disputes')
@Controller('platform/disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformDisputeController {
  constructor(private readonly svc: PlatformService) {}

  @Get()
  @ApiOperation({ summary: '争议列表' })
  list(@CurrentUser() user: any, @Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query('status') status?: string) {
    assertPlatform(user, 'platform_arbitrator');
    return this.svc.listDisputes({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, status });
  }

  @Get(':id')
  @ApiOperation({ summary: '争议详情' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_arbitrator');
    return this.svc.getDisputeDetail(id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: '受理争议' })
  accept(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_arbitrator');
    return this.svc.acceptDispute(id, user.userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: '出具裁决' })
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: PlatformResolveDisputeDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_arbitrator');
    return this.svc.resolveDispute(id, user.userId, dto);
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.7 资金监控 (5 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/finance')
@Controller('platform/finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformFinanceController {
  constructor(private readonly svc: PlatformService) {}

  @Get('overview')
  @ApiOperation({ summary: '资金总览' })
  overview(@CurrentUser() user: any) {
    assertPlatform(user, 'platform_finance');
    return this.svc.getFinanceOverview();
  }

  @Get('transactions')
  @ApiOperation({ summary: '全平台交易流水' })
  transactions(
    @CurrentUser() user: any,
    @Query('page') page?: number, @Query('pageSize') pageSize?: number,
    @Query('type') type?: string, @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    assertPlatform(user, 'platform_finance');
    return this.svc.listTransactions({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, type, status, search });
  }

  @Get('withdrawals')
  @ApiOperation({ summary: '待审核提现列表' })
  withdrawals(@CurrentUser() user: any, @Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    assertPlatform(user, 'platform_finance');
    return this.svc.listWithdrawals({ page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  }

  @Patch('withdrawals/:id')
  @ApiOperation({ summary: '提现审核' })
  reviewWithdrawal(@Param('id', ParseIntPipe) id: number, @Body() dto: WithdrawalReviewDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_finance');
    return this.svc.reviewWithdrawal(id, user.userId, dto);
  }

  @Post('refund')
  @ApiOperation({ summary: '发起退款' })
  refund(@Body() dto: RefundDto, @CurrentUser() user: any) {
    assertPlatform(user, 'platform_finance');
    return this.svc.refund(user.userId, dto);
  }
}

// ═══════════════════════════════════════════════════════════
// §18.5.9 系统配置 (6 API)
// ═══════════════════════════════════════════════════════════
@ApiTags('platform/config')
@Controller('platform')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlatformConfigController {
  constructor(private readonly svc: PlatformService) {}

  @Get('config')
  @ApiOperation({ summary: '获取平台参数' })
  getConfig(@CurrentUser() user: any) {
    assertPlatform(user);
    return this.svc.getConfig();
  }

  @Put('config')
  @ApiOperation({ summary: '更新平台参数' })
  updateConfig(@Body() dto: UpdateConfigDto, @CurrentUser() user: any) {
    assertPlatform(user);
    if (user.platformRole !== 'platform_super_admin') throw new ForbiddenException('仅超级管理员可修改');
    return this.svc.updateConfig(user.userId, dto);
  }

  @Get('admins')
  @ApiOperation({ summary: '管理员列表' })
  listAdmins(@CurrentUser() user: any) {
    assertPlatform(user);
    if (user.platformRole !== 'platform_super_admin') throw new ForbiddenException('仅超级管理员可查看');
    return this.svc.listAdmins();
  }

  @Post('admins')
  @ApiOperation({ summary: '创建管理员' })
  createAdmin(@Body() dto: CreateAdminDto, @CurrentUser() user: any) {
    assertPlatform(user);
    if (user.platformRole !== 'platform_super_admin') throw new ForbiddenException('仅超级管理员可创建');
    return this.svc.createAdmin(user.userId, dto);
  }

  @Patch('admins/:id')
  @ApiOperation({ summary: '修改管理员' })
  updateAdmin(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdminDto, @CurrentUser() user: any) {
    assertPlatform(user);
    if (user.platformRole !== 'platform_super_admin') throw new ForbiddenException('仅超级管理员可修改');
    return this.svc.updateAdmin(id, user.userId, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '审计日志查询' })
  auditLogs(
    @CurrentUser() user: any,
    @Query('page') page?: number, @Query('pageSize') pageSize?: number,
    @Query('action') action?: string, @Query('adminId') adminId?: number,
    @Query('targetType') targetType?: string,
  ) {
    assertPlatform(user);
    return this.svc.listAuditLogs({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, action, adminId: adminId ? Number(adminId) : undefined, targetType });
  }
}
