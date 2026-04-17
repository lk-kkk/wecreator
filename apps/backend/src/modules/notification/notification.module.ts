import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports:     [MessageModule],
  controllers: [NotificationController],
  providers:   [NotificationService],
  exports:     [NotificationService],
})
export class NotificationModule {}
