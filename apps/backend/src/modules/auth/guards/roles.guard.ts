import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard
 *
 * 支持两类标识同时存在于 @Roles() 列表中:
 *   1) 企业端角色:  super_admin / task_admin / finance_admin / operator
 *   2) 用户类型伪角色:  worker / platform  (匹配 user.userType)
 *
 * 若 required 为空则直接放行（只做 JwtAuthGuard 认证）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('未认证用户');

    // 企业端按 role 匹配
    if (user.role && required.includes(user.role)) return true;
    // 零工/平台按 userType 伪角色匹配
    if (user.userType && required.includes(user.userType)) return true;

    throw new ForbiddenException(
      `无权访问：需要角色 [${required.join(', ')}]，当前 role=${user.role ?? '-'} userType=${user.userType ?? '-'}`,
    );
  }
}
