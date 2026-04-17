import { Module } from '@nestjs/common';
import { TaskController, CommonController } from './task.controller';
import { TaskService } from './task.service';
import { RecommendationService }    from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { MarketplaceController }    from './marketplace.controller';
import { WorkerStatsController }    from './worker-stats.controller';

@Module({
  controllers: [
    TaskController, CommonController, RecommendationController,
    MarketplaceController, WorkerStatsController,
  ],
  providers:   [TaskService, RecommendationService],
  exports:     [TaskService, RecommendationService],
})
export class TaskModule {}
