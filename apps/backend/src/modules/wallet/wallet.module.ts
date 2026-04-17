import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { RedisLockService } from '../../common/redis-lock.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, RedisLockService],
  exports: [WalletService],
})
export class WalletModule {}
