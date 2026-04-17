import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
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
} from './dto';

// ============================================================
// 企业端接口
// ============================================================
@ApiTags('enterprise-auth')
@Controller('enterprise')
export class EnterpriseAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '企业注册' })
  async register(@Body() dto: RegisterEnterpriseDto) {
    return this.authService.registerEnterprise(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '企业登录' })
  async login(@Body() dto: LoginEnterpriseDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return this.authService.loginEnterprise(dto, ip);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Token续期' })
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
  @ApiOperation({ summary: '更新企业信息' })
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
  @ApiOperation({ summary: '零工微信登录' })
  async login(@Body() dto: LoginWorkerDto) {
    return this.authService.loginWorker(dto);
  }

  @Post('bind-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '绑定手机号' })
  async bindPhone(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BindPhoneDto,
  ) {
    return this.authService.bindPhone(user.userId, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '实名认证' })
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyIdentityDto,
  ) {
    return this.authService.verifyIdentity(user.userId, dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '获取零工个人信息' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getWorkerProfile(user.userId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '更新零工个人信息' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateWorkerProfileDto,
  ) {
    return this.authService.updateWorkerProfile(user.userId, dto);
  }
}
