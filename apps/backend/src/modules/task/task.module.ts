import { Module } from '@nestjs/common';
import { TaskController, CommonController } from './task.controller';
import { TaskService } from './task.service';
import { RecommendationService }    from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { MarketplaceController, TaskApplicationController, WorkerApplicationController } from './marketplace.controller';
import { WorkerStatsController }    from './worker-stats.controller';
import { CheckpointService } from './checkpoint.service';
import { CommentService } from './comment.service';
import { IssueService } from './issue.service';
import { CheckpointController, CommentController, IssueController } from './task-enhancement.controller';

@Module({
  controllers: [
    TaskController, CommonController, RecommendationController,
    MarketplaceController, WorkerStatsController,
    TaskApplicationController, WorkerApplicationController,
    CheckpointController, CommentController, IssueController,
  ],
  providers:   [TaskService, RecommendationService, CheckpointService, CommentService, IssueService],
  exports:     [TaskService, RecommendationService, CheckpointService, CommentService, IssueService],
})
export class TaskModule {}
