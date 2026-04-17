import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number;        // userId (companyUserId 或 workerId 或 platformAdminId)
  companyId?: number; // 企业用户才有
  role?: string;      // 企业用户角色
  userType: 'company' | 'worker' | 'platform';
  platformRole?: string; // 平台管理员角色
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback_secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.userType) {
      throw new UnauthorizedException('无效的Token');
    }
    return {
      userId: payload.sub,
      companyId: payload.companyId,
      role: payload.role,
      userType: payload.userType,
      platformRole: payload.platformRole,
    };
  }
}
