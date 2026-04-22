import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { CompanyNotificationController } from './company-notification.controller';
import { CompanyNotificationService } from './company-notification.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
  controllers: [NotificationController, CompanyNotificationController],
  providers: [NotificationService, CompanyNotificationService],
  exports: [NotificationService, CompanyNotificationService],
})
export class NotificationModule {}
