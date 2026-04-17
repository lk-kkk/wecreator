import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { EnterpriseAuthController, WorkerAuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [EnterpriseAuthController, WorkerAuthController],
  providers: [AuthService, JwtStrategy, CryptoUtil],
  exports: [AuthService, JwtStrategy, CryptoUtil],
})
export class AuthModule {}
