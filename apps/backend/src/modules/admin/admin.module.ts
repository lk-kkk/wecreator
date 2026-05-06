import { Module } from '@nestjs/common';
import {
  SubaccountController,
  DashboardController,
  InvoiceController,
  TaskTemplateController,
  CustomRoleController,
  CheckpointTemplateController,
  CustomSkillController,
} from './admin.controller';
import { AuthModule }          from '../auth/auth.module';
import { SubaccountService }   from '../auth/subaccount.service';
import { DashboardService }    from '../task/dashboard.service';
import { InvoiceService }      from '../finance/invoice.service';
import { TaskTemplateService } from '../task/task-template.service';

@Module({
  imports: [AuthModule], // 提供 CryptoUtil 依赖
  controllers: [
    SubaccountController,
    DashboardController,
    InvoiceController,
    TaskTemplateController,
    CustomRoleController,
    CheckpointTemplateController,
    CustomSkillController,
  ],
  providers: [
    SubaccountService,
    DashboardService,
    InvoiceService,
    TaskTemplateService,
  ],
  exports: [DashboardService, TaskTemplateService],
})
export class AdminModule {}
