import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WithdrawDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;
}

@ApiTags('wallet')
@Controller('worker/wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: '查询零工钱包余额' })
  async getWallet(@CurrentUser() user: CurrentUserPayload) {
    return this.walletService.getWallet(user.userId);
  }

  @Post('withdraw')
  @ApiOperation({ summary: '申请提现' })
  async withdraw(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.withdraw(user.userId, dto.amount);
  }

  @Get('transactions')
  @ApiOperation({ summary: '零工流水明细' })
  async transactions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: string,
  ) {
    return this.walletService.getWorkerTransactions(user.userId, { page, pageSize, type });
  }
}
