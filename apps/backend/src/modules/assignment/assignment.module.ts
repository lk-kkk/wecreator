import { Module } from '@nestjs/common';
import { AssignmentController, WorkerTaskController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { TaskModule } from '../task/task.module';

@Module({
  imports:     [TaskModule],
  controllers: [AssignmentController, WorkerTaskController],
  providers:   [AssignmentService],
  exports:     [AssignmentService],
})
export class AssignmentModule {}
