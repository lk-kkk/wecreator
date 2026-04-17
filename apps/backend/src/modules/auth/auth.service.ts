import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { JwtPayload } from './jwt.strategy';
import {
  RegisterEnterpriseDto,
  LoginEnterpriseDto,
  LoginWorkerDto,
  BindPhoneDto,
  VerifyIdentityDto,
  UpdateEnterpriseDto,
  UpdateWorkerProfileDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoUtil,
  ) {}

  // ================================================================
  // 企业注册
  // ================================================================
  async registerEnterprise(dto: RegisterEnterpriseDto) {
    // 1. 检查信用代码是否已注册
    const existing = await this.prisma.company.findUnique({
      where: { creditCode: dto.creditCode },
    });
    if (existing) {
      throw new ConflictException('该企业已注册');
    }

    // 2. 加密手机号 + hash密码
    const encryptedPhone = this.crypto.encrypt(dto.adminPhone);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. 事务创建企业+管理员
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          creditCode: dto.creditCode,
          contactEmail: dto.contactEmail,
          industryTag: dto.industryTag,
        },
      });

      const admin = await tx.companyUser.create({
        data: {
          companyId: company.id,
          name: dto.adminName,
          phone: encryptedPhone,
          passwordHash,
          role: 'super_admin',
        },
      });

      return { company, admin };
    });

    this.logger.log(`企业注册成功: ${dto.name} (ID: ${result.company.id})`);

    return {
      companyId: Number(result.company.id),
      status: result.company.status,
      message: '注册成功，等待审核',
    };
  }

  // ================================================================
  // 企业登录
  // ================================================================
  async loginEnterprise(dto: LoginEnterpriseDto, ip?: string) {
    // 1. 查找所有企业用户，解密手机号比对
    const users = await this.prisma.companyUser.findMany({
      include: { company: true },
    });

    const user = users.find((u) => {
      try {
        return this.crypto.decrypt(u.phone) === dto.phone;
      } catch {
        return false;
      }
    });

    if (!user) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    // 2. 验证密码
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    // 3. 检查状态
    if (user.status !== 'active') {
      throw new UnauthorizedException('账号已被停用');
    }

    // 4. 生成双Token
    const tokens = this.generateTokens({
      sub: Number(user.id),
      companyId: Number(user.companyId),
      role: user.role,
      userType: 'company',
    });

    // 5. 更新登录信息
    await this.prisma.companyUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // 6. 记录登录日志
    await this.prisma.loginLog.create({
      data: {
        userId: user.id,
        userType: 'company',
        ip: ip || 'unknown',
      },
    });

    return {
      ...tokens,
      user: {
        userId: Number(user.id),
        name: user.name,
        role: user.role,
        companyId: Number(user.companyId),
        companyName: user.company.name,
        companyStatus: user.company.status,
      },
    };
  }

  // ================================================================
  // 零工微信登录
  // ================================================================
  async loginWorker(dto: LoginWorkerDto) {
    // 1. 用code换openid（开发环境mock）
    const openid = await this.getOpenidFromCode(dto.code);

    // 2. 查找或创建零工
    let worker = await this.prisma.worker.findUnique({
      where: { openid },
    });

    let isNew = false;
    if (!worker) {
      worker = await this.prisma.worker.create({
        data: { openid },
      });
      isNew = true;
      this.logger.log(`新零工注册: openid=${openid} (ID: ${worker.id})`);
    }

    // 3. 生成Token
    const tokens = this.generateTokens({
      sub: Number(worker.id),
      userType: 'worker',
    });

    return {
      ...tokens,
      isNew,
      user: {
        userId: Number(worker.id),
        realName: worker.realName,
        avatarUrl: worker.avatarUrl,
        isVerified: worker.isVerified,
        level: worker.level,
      },
    };
  }

  // ================================================================
  // 零工绑定手机号
  // ================================================================
  async bindPhone(workerId: number, dto: BindPhoneDto) {
    const encryptedPhone = this.crypto.encrypt(dto.phone);

    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: { phone: encryptedPhone },
    });

    return { message: '手机号绑定成功' };
  }

  // ================================================================
  // 零工实名认证
  // ================================================================
  async verifyIdentity(workerId: number, dto: VerifyIdentityDto) {
    // 1. 校验身份证号格式（18位 + 校验位）
    if (!this.validateIdCard(dto.idCard)) {
      throw new BadRequestException('身份证号校验位不正确');
    }

    // 2. 调用三要素验证（开发环境mock通过）
    const verifyResult = await this.callThreeElementVerify(
      dto.realName,
      dto.idCard,
    );

    if (!verifyResult.passed) {
      throw new BadRequestException('实名认证未通过');
    }

    // 3. AES加密后存储
    const encryptedIdCard = this.crypto.encrypt(dto.idCard);

    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: {
        realName: dto.realName,
        idCardEncrypted: encryptedIdCard,
        isVerified: true,
        level: 'verified',
      },
    });

    this.logger.log(`零工实名认证成功: ID=${workerId}`);

    return { message: '实名认证成功', isVerified: true };
  }

  // ================================================================
  // Token续期
  // ================================================================
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      }) as JwtPayload;

      const tokens = this.generateTokens({
        sub: payload.sub,
        companyId: payload.companyId,
        role: payload.role,
        userType: payload.userType,
      });

      return tokens;
    } catch {
      throw new UnauthorizedException('refreshToken已过期，请重新登录');
    }
  }

  // ================================================================
  // 获取企业信息
  // ================================================================
  async getEnterpriseProfile(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: BigInt(companyId) },
    });
    if (!company) throw new BadRequestException('企业不存在');

    return {
      companyId: Number(company.id),
      name: company.name,
      creditCode: company.creditCode,
      status: company.status,
      logoUrl: company.logoUrl,
      description: company.description,
      contactEmail: company.contactEmail,
      industryTag: company.industryTag,
      balance: Number(company.balance),
      lockedBalance: Number(company.lockedBalance),
      createdAt: company.createdAt,
    };
  }

  // ================================================================
  // 更新企业信息
  // ================================================================
  async updateEnterpriseProfile(companyId: number, dto: UpdateEnterpriseDto) {
    await this.prisma.company.update({
      where: { id: BigInt(companyId) },
      data: dto,
    });
    return { message: '更新成功' };
  }

  // ================================================================
  // 获取零工信息
  // ================================================================
  async getWorkerProfile(workerId: number) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: BigInt(workerId) },
      include: {
        workerRoles: true,
        portfolios: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!worker) throw new BadRequestException('零工不存在');

    return {
      userId: Number(worker.id),
      realName: worker.realName,
      phone: worker.phone ? this.crypto.decrypt(worker.phone) : null,
      avatarUrl: worker.avatarUrl,
      city: worker.city,
      bio: worker.bio,
      isVerified: worker.isVerified,
      avgRating: Number(worker.avgRating),
      completionRate: Number(worker.completionRate),
      completedCount: worker.completedCount,
      level: worker.level,
      roles: worker.workerRoles.map((r) => ({
        id: Number(r.id),
        roleName: r.roleName,
        yearsExp: r.yearsExp,
        skillTags: r.skillTags,
      })),
      portfolios: worker.portfolios.map((p) => ({
        id: Number(p.id),
        title: p.title,
        description: p.description,
        fileUrl: p.fileUrl,
        fileType: p.fileType,
      })),
    };
  }

  // ================================================================
  // 更新零工信息
  // ================================================================
  async updateWorkerProfile(workerId: number, dto: UpdateWorkerProfileDto) {
    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: dto,
    });
    return { message: '更新成功' };
  }

  // ================================================================
  // 私有方法
  // ================================================================

  private generateTokens(payload: JwtPayload) {
    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '2h') as any,
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES', '7d') as any,
    });

    return { accessToken, refreshToken };
  }

  /**
   * 微信code换openid（开发环境mock）
   */
  private async getOpenidFromCode(code: string): Promise<string> {
    if (this.config.get<string>('NODE_ENV') === 'development') {
      // 开发环境：code直接当openid用
      return `dev_openid_${code}`;
    }

    // TODO: 生产环境调用微信API
    // const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    throw new BadRequestException('微信登录暂未配置');
  }

  /**
   * 三要素实名认证（开发环境mock）
   */
  private async callThreeElementVerify(
    _realName: string,
    _idCard: string,
  ): Promise<{ passed: boolean }> {
    if (this.config.get<string>('NODE_ENV') === 'development') {
      return { passed: true };
    }

    // TODO: 生产环境调用阿里云实人认证API
    throw new BadRequestException('实名认证服务暂未配置');
  }

  /**
   * 身份证号校验位验证（ISO 7064:1983 MOD 11-2）
   */
  private validateIdCard(idCard: string): boolean {
    if (!/^\d{17}[\dXx]$/.test(idCard)) return false;

    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(idCard[i]) * weights[i];
    }

    const checkCode = checkCodes[sum % 11];
    return idCard[17].toUpperCase() === checkCode;
  }
}
