import { Module } from '@nestjs/common';
import {
  SubaccountController,
  DashboardController,
  InvoiceController,
  TaskTemplateController,
  CustomRoleController,
} from './admin.controller';
import { SubaccountService }   from '../auth/subaccount.service';
import { DashboardService }    from '../task/dashboard.service';
import { InvoiceService }      from '../finance/invoice.service';
import { TaskTemplateService } from '../task/task-template.service';

@Module({
  controllers: [
    SubaccountController,
    DashboardController,
    InvoiceController,
    TaskTemplateController,
    CustomRoleController,
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
