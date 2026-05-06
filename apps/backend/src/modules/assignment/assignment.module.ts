import { Module } from '@nestjs/common';
import { AssignmentController, WorkerTaskController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { TaskModule } from '../task/task.module';
import { ProjectModule } from '../project/project.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports:     [TaskModule, ProjectModule, NotificationModule],
  controllers: [AssignmentController, WorkerTaskController],
  providers:   [AssignmentService],
  exports:     [AssignmentService],
})
export class AssignmentModule {}
