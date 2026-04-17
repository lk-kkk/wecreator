import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import {
  PlatformAuthController,
  PlatformDashboardController,
  PlatformCompanyController,
  PlatformWorkerController,
  PlatformTaskController,
  PlatformDisputeController,
  PlatformFinanceController,
  PlatformConfigController,
} from './platform.controller';

@Module({
  controllers: [
    PlatformAuthController,
    PlatformDashboardController,
    PlatformCompanyController,
    PlatformWorkerController,
    PlatformTaskController,
    PlatformDisputeController,
    PlatformFinanceController,
    PlatformConfigController,
  ],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
