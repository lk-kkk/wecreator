/**
 * CommonModule — 全局共享服务
 * 由 @Global 装饰，所有模块可直接注入其 providers，无需 imports
 */
import { Global, Module } from '@nestjs/common';
import { NoGeneratorService } from './no-generator.service';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  providers: [NoGeneratorService, RedisLockService],
  exports: [NoGeneratorService, RedisLockService],
})
export class CommonModule {}
