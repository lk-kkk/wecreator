/**
 * V3.7 Phase 6 — AnalyticsModule
 * 导出 AnalyticsService 供业务模块注入以埋点。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports:     [PrismaModule],
  providers:   [AnalyticsService],
  controllers: [AnalyticsController],
  exports:     [AnalyticsService],
})
export class AnalyticsModule {}
