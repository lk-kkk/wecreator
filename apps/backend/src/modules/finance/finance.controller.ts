import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

// ── 公开路由：支付回调（无需JWT） ─────────────────────
@ApiTags('finance')
@Controller('finance')
export class FinancePublicController {
  constructor(private readonly financeService: FinanceService) {}

  /** 支付平台回调 — 无需 JWT */
  @Post('recharge/callback')
  @ApiOperation({ summary: '支付回调（模拟）' })
  async callback(@Body('transactionNo') transactionNo: string) {
    return this.financeService.handlePayCallback(transactionNo);
  }

  /** 充值状态查询 — 无需 JWT */
  @Get('recharge/:transactionNo/status')
  @ApiOperation({ summary: '查询充值状态' })
  async rechargeStatus(@Param('transactionNo') transactionNo: string) {
    return this.financeService.getRechargeStatus(transactionNo);
  }
}

// ── 鉴权路由（需 JWT）─────────────────────────────────
@ApiTags('finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('recharge')
  @ApiOperation({ summary: '企业充值' })
  async recharge(
    @CurrentUser() user: CurrentUserPayload,
    @Body('amount') amount: number,
  ) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.financeService.createRecharge(user.companyId!, amount);
  }

  @Post('lock')
  @ApiOperation({ summary: '资金锁定（发布任务时）' })
  async lock(
    @CurrentUser() user: CurrentUserPayload,
    @Body('taskId') taskId: number,
    @Body('budget') budget: number,
  ) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.financeService.lockFund(user.companyId!, taskId, budget);
  }

  @Get('balance')
  @ApiOperation({ summary: '查询企业余额' })
  async balance(@CurrentUser() user: CurrentUserPayload) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.financeService.getBalance(user.companyId!);
  }

  @Get('transactions')
  @ApiOperation({ summary: '交易流水' })
  async transactions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.financeService.getTransactions(user.companyId!, { type, page, pageSize });
  }

  // V3.9: 任务付款
  @Post('tasks/:taskId/pay')
  @ApiOperation({ summary: 'V3.9 任务付款（待付款→已完成）' })
  async payForTask(
    @Param('taskId') taskId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.financeService.payForTask(user.companyId!, Number(taskId));
  }
}
