import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { CommonModule } from './common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ── 业务模块 ──────────────────────────────────────────
import { AuthModule }         from './modules/auth/auth.module';
import { TaskModule }         from './modules/task/task.module';
import { AssignmentModule }   from './modules/assignment/assignment.module';
import { FinanceModule }      from './modules/finance/finance.module';
import { WalletModule }       from './modules/wallet/wallet.module';
import { ReviewModule }       from './modules/review/review.module';
import { MessageModule }      from './modules/message/message.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FileModule }         from './modules/file/file.module';
import { ContractModule }     from './modules/contract/contract.module';
import { CheckinModule }      from './modules/checkin/checkin.module';
import { DisputeModule }      from './modules/dispute/dispute.module';
import { AdminModule }        from './modules/admin/admin.module';
import { PlatformModule }     from './modules/platform/platform.module';
import { ProjectModule }      from './modules/project/project.module';
import { AiModule }           from './modules/ai/ai.module';
import { SchedulerModule }    from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    // ── 基础设施 ──────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    RedisModule,
    CommonModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ uri: c.get<string>('MONGODB_URL') }),
    }),

    // ── JWT ───────────────────────────────────────
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (c.get<string>('JWT_ACCESS_EXPIRES') || '2h') as any },
      }),
    }),

    // ── R9 安全：全局限流 100 req/min/IP ─────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ── V3.7 定时任务基础设施 ────────────────
    ScheduleModule.forRoot(),

    // ── 业务模块（W1→W7）────────────────────────
    AuthModule,         // W1 ✅
    TaskModule,         // W2 ✅
    AssignmentModule,   // W3 ✅
    FinanceModule,      // W3+W5 ✅
    WalletModule,       // W5 ✅
    ReviewModule,       // W5 ✅
    MessageModule,      // W4 ✅
    NotificationModule, // W4 ✅
    FileModule,         // W4 ✅
    ContractModule,     // W4 ✅
    CheckinModule,      // W7 ✅
    DisputeModule,      // W8 ✅
    AdminModule,        // W9 ✅
    PlatformModule,     // V3.2 平台运营后台 ✅
    ProjectModule,      // W13 R2-a ✅
    AiModule,           // W14 R2-b ✅
    SchedulerModule,    // V3.7 Cron ✅
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 全局限流守卫
  ],
})
export class AppModule {}
