/**
 * AuthModule
 *
 * R1 · wc-auth-dev
 *
 * 提供：
 *  - JwtAuthGuard (全局 JWT 验证)
 *  - RolesGuard (RBAC 角色守卫)
 *  - @CurrentUser() 装饰器
 *  - @Roles() 装饰器
 *  - CryptoUtil (AES-256-CBC)
 *  - SubaccountService (子账号 CRUD，由 AdminModule 引用)
 */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { EnterpriseAuthController, WorkerAuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { SubaccountService } from './subaccount.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [EnterpriseAuthController, WorkerAuthController],
  providers: [AuthService, JwtStrategy, CryptoUtil, SubaccountService],
  exports: [AuthService, JwtStrategy, CryptoUtil, SubaccountService],
})
export class AuthModule {}
