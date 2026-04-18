/**
 * Auth Controllers — 企业端 + 零工端
 *
 * R1 · wc-auth-dev · Sprint 1 W1
 *
 * 企业端路由 /api/v1/enterprise/
 *   POST   /register        企业注册
 *   POST   /login           企业登录
 *   POST   /refresh-token   Token 续期
 *   GET    /profile         获取企业信息
 *   PUT    /profile         更新企业信息
 *
 * 零工端路由 /api/v1/worker/
 *   POST   /login           微信登录
 *   POST   /bind-phone      绑定手机号
 *   POST   /verify          实名认证
 *   GET    /profile         获取个人信息
 *   PUT    /profile         更新个人信息
 *   POST   /roles           添加角色档案
 *   DELETE /roles/:id       删除角色档案
 *   POST   /portfolios      上传作品集
 *   DELETE /portfolios/:id  删除作品
 */
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import {
  RegisterEnterpriseDto,
  LoginEnterpriseDto,
  LoginWorkerDto,
  BindPhoneDto,
  VerifyIdentityDto,
  RefreshTokenDto,
  UpdateEnterpriseDto,
  UpdateWorkerProfileDto,
  AddWorkerRoleDto,
  AddPortfolioDto,
} from './dto';

/**
 * 从 Request 中提取客户端 IP（兼容代理）
 */
function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ============================================================
// 企业端接口
// ============================================================
@ApiTags('enterprise-auth')
@Controller('enterprise')
export class EnterpriseAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '企业注册（信用代码 + 管理员信息）' })
  async register(@Body() dto: RegisterEnterpriseDto) {
    return this.authService.registerEnterprise(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // 登录接口独立限流
  @ApiOperation({ summary: '企业登录（手机号 + 密码 → 双 Token）' })
  async login(@Body() dto: LoginEnterpriseDto, @Req() req: Request) {
    return this.authService.loginEnterprise(dto, extractIp(req));
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Token 续期（refreshToken → 新双 Token）' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '获取企业信息' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getEnterpriseProfile(user.companyId!);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '更新企业信息（名称/Logo/简介/邮箱/行业）' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateEnterpriseDto,
  ) {
    return this.authService.updateEnterpriseProfile(user.companyId!, dto);
  }
}

// ============================================================
// 零工端接口
// ============================================================
@ApiTags('worker-auth')
@Controller('worker')
export class WorkerAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '零工微信登录（wx.login code → JWT 双 Token）' })
  async login(@Body() dto: LoginWorkerDto) {
    return this.authService.loginWorker(dto);
  }

  @Post('bind-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '绑定手机号（需已登录）' })
  async bindPhone(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BindPhoneDto,
  ) {
    return this.authService.bindPhone(user.userId, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '实名认证（姓名 + 身份证 → 三要素校验 + AES 加密存储）' })
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyIdentityDto,
  ) {
    return this.authService.verifyIdentity(user.userId, dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '获取零工个人信息（含角色/作品集/钱包摘要）' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getWorkerProfile(user.userId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '更新零工个人信息（昵称/头像/城市/简介/技能标签）' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateWorkerProfileDto,
  ) {
    return this.authService.updateWorkerProfile(user.userId, dto);
  }

  // ── 角色档案 ──────────────────────────────────────────

  @Post('roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '添加角色档案（最多 5 个）' })
  async addRole(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddWorkerRoleDto,
  ) {
    return this.authService.addWorkerRole(user.userId, dto);
  }

  @Delete('roles/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除角色档案' })
  async deleteRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.deleteWorkerRole(user.userId, id);
  }

  // ── 作品集 ────────────────────────────────────────────

  @Post('portfolios')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '上传作品集（最多 20 件）' })
  async addPortfolio(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddPortfolioDto,
  ) {
    return this.authService.addPortfolio(user.userId, dto);
  }

  @Delete('portfolios/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除作品' })
  async deletePortfolio(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.deletePortfolio(user.userId, id);
  }
}
