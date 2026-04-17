import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FinanceController, FinancePublicController } from './finance.controller';
import { FinanceService } from './finance.service';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ScheduleModule.forRoot(), WalletModule],
  controllers: [FinanceController, FinancePublicController, SettlementController],
  providers: [FinanceService, SettlementService],
  exports: [FinanceService, SettlementService],
})
export class FinanceModule {}
