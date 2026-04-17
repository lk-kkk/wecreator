import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkerCheckinController, CompanyCheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { WeeklySettlementService } from './weekly-settlement.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [WorkerCheckinController, CompanyCheckinController],
  providers:   [CheckinService, WeeklySettlementService],
  exports:     [CheckinService, WeeklySettlementService],
})
export class CheckinModule {}
