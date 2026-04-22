/**
 * V3.7 Scheduler 模块
 * 聚合 6 个 cron：
 *   5.1 风险等级（每小时）
 *   5.2 SLA 监控（每 15 分钟）
 *   5.3 检查点逾期（每天 00:30）
 *   5.4 日报缺失（每天 09:00）
 *   5.5 里程碑到期（每天 00:30）
 *   5.6 通知清理（每天 02:00）
 *
 * 依赖 ScheduleModule.forRoot() 在 app.module 已注册。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { NotificationModule } from '../notification/notification.module';
import { RiskLevelCron } from './risk-level.cron';
import { SlaMonitorCron } from './sla-monitor.cron';
import { CheckpointOverdueCron } from './checkpoint-overdue.cron';
import { DailyMissingCron } from './daily-missing.cron';
import { MilestoneRemindCron } from './milestone-remind.cron';
import { NotificationCleanupCron } from './notification-cleanup.cron';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [
    RiskLevelCron,
    SlaMonitorCron,
    CheckpointOverdueCron,
    DailyMissingCron,
    MilestoneRemindCron,
    NotificationCleanupCron,
  ],
  exports: [
    RiskLevelCron,
    SlaMonitorCron,
    CheckpointOverdueCron,
    DailyMissingCron,
    MilestoneRemindCron,
    NotificationCleanupCron,
  ],
})
export class SchedulerModule {}
