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
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        '[FATAL] JWT_SECRET 未配置！请在 .env 中设置 JWT_SECRET（至少32字符随机字符串）',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.userType) {
      throw new UnauthorizedException('无效的Token');
    }

    // P0-03: 校验 userType 白名单，防止不同端 Token 混用
    const validUserTypes = ['company', 'worker', 'platform'];
    if (!validUserTypes.includes(payload.userType)) {
      throw new UnauthorizedException('无效的Token类型');
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
