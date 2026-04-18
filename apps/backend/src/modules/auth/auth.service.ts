/**
 * AuthService — 认证核心业务逻辑
 *
 * R1 · wc-auth-dev · Sprint 1 W1
 *
 * 修复清单:
 *  P0-1  Redis 登录限流 (10 fails / 5 min / IP)
 *  P0-2  verifyIdentity 补全 idCardHash (SHA-256)
 *  P0-3  零工注册时自动创建 Wallet
 *  P0-4  企业登录增加企业状态检查
 *  P1-1  Worker roles API (addWorkerRole)
 *  P1-2  Worker portfolios API (addPortfolio)
 *  P1-3  微信 userInfo nickname/avatar 支持
 */
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
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
  AddWorkerRoleDto,
  AddPortfolioDto,
  RefreshTokenDto,
} from './dto';

// Redis key 前缀
const LOGIN_FAIL_PREFIX = 'auth:login_fail:';
const LOGIN_FAIL_TTL = 300;       // 5 分钟
const LOGIN_FAIL_MAX = 10;        // 最多 10 次

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoUtil,
    @InjectRedis() private readonly redis: Redis,
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

    // 2. 加密手机号 + hash 密码 + 手机 hash索引
    const encryptedPhone = this.crypto.encrypt(dto.adminPhone);
    const phoneHash = createHash('sha256').update(dto.adminPhone).digest('hex');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. 事务创建企业 + 管理员
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
          phoneHash,
          passwordHash,
          role: 'super_admin',
        },
      });

      return { company, admin };
    });

    this.logger.log(
      `企业注册成功: ${dto.name} (ID: ${result.company.id})`,
    );

    return {
      companyId: Number(result.company.id),
      status: result.company.status,
      message: '注册成功，等待审核',
    };
  }

  // ================================================================
  // 企业登录 (P0-1: 增加 Redis 限流 · P0-4: 企业状态检查)
  // ================================================================
  async loginEnterprise(dto: LoginEnterpriseDto, ip: string) {
    // ── 1. IP 限流检查 ──────────────────────────────
    await this.checkLoginRateLimit(ip);

    // ── 2. 查找用户（phoneHash 索引 + 旧数据回退）──
    const phoneHash = createHash('sha256').update(dto.phone).digest('hex');
    let user = await this.prisma.companyUser.findFirst({
      where: { phoneHash },
      include: { company: true },
    });

    // 旧数据回退：phoneHash 列为 null 的记录逐个解密匹配
    if (!user) {
      const legacyUsers = await this.prisma.companyUser.findMany({
        where: { phoneHash: null },
        include: { company: true },
      });
      user = legacyUsers.find((u) => {
        try {
          return this.crypto.decrypt(u.phone) === dto.phone;
        } catch {
          return false;
        }
      }) ?? null;

      // 找到后补填 phoneHash（渐进迁移）
      if (user) {
        await this.prisma.companyUser.update({
          where: { id: user.id },
          data: { phoneHash },
        });
      }
    }

    if (!user) {
      await this.recordLoginFailure(ip);
      throw new UnauthorizedException('手机号或密码错误');
    }

    // ── 3. 验证密码 ─────────────────────────────────
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.recordLoginFailure(ip);
      throw new UnauthorizedException('手机号或密码错误');
    }

    // ── 4. 检查用户状态 ─────────────────────────────
    if (user.status === 'disabled') {
      throw new UnauthorizedException('账号已被停用');
    }
    if (user.status === 'deleted') {
      throw new UnauthorizedException('账号已被删除');
    }

    // ── 5. 检查企业状态 (P0-4) ──────────────────────
    if (user.company.status === 'suspended') {
      throw new ForbiddenException('企业已被停用，请联系平台管理员');
    }
    // pending 状态仍允许登录，但返回提示
    const companyWarning =
      user.company.status === 'pending' ? '企业资质审核中，部分功能受限' : undefined;

    // ── 6. 生成双 Token ─────────────────────────────
    const tokens = this.generateTokens({
      sub: Number(user.id),
      companyId: Number(user.companyId),
      role: user.role,
      userType: 'company',
    });

    // ── 7. 更新登录信息 + 清除失败计数 ──────────────
    await Promise.all([
      this.prisma.companyUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ip },
      }),
      this.prisma.loginLog.create({
        data: {
          userId: user.id,
          userType: 'company',
          loginMethod: 'password',
          ip,
          result: 'success',
        },
      }),
      this.clearLoginFailure(ip),
    ]);

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
      ...(companyWarning ? { warning: companyWarning } : {}),
    };
  }

  // ================================================================
  // 零工微信登录 (P0-3: 自动创建 Wallet · P1-3: nickname 支持)
  // ================================================================
  async loginWorker(dto: LoginWorkerDto) {
    // 1. 用 code 换 openid（开发环境 mock）
    const { openid, nickname: wxNickname, avatarUrl: wxAvatar } =
      await this.getWechatSession(dto.code);

    // 2. 查找或创建零工（含 Wallet）
    let worker = await this.prisma.worker.findUnique({
      where: { openid },
    });

    let isNew = false;
    if (!worker) {
      // 事务：创建零工 + 钱包
      const result = await this.prisma.$transaction(async (tx) => {
        const w = await tx.worker.create({
          data: {
            openid,
            nickname: wxNickname || null,
            avatarUrl: wxAvatar || null,
          },
        });
        // P0-3: 自动创建钱包
        await tx.wallet.create({
          data: { workerId: w.id },
        });
        return w;
      });
      worker = result;
      isNew = true;
      this.logger.log(`新零工注册: openid=${openid} (ID: ${worker.id})`);
    } else if (wxNickname && !worker.nickname) {
      // 若微信返回了昵称且用户还没设置，自动填充
      worker = await this.prisma.worker.update({
        where: { id: worker.id },
        data: {
          nickname: wxNickname,
          ...(wxAvatar && !worker.avatarUrl ? { avatarUrl: wxAvatar } : {}),
        },
      });
    }

    // 3. 生成 Token
    const tokens = this.generateTokens({
      sub: Number(worker.id),
      userType: 'worker',
    });

    return {
      ...tokens,
      isNew,
      user: {
        userId: Number(worker.id),
        nickname: worker.nickname,
        realName: worker.realName,
        avatarUrl: worker.avatarUrl,
        phone: worker.phone ? '已绑定' : null,
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

    // 检查手机号是否已被其他零工绑定（遍历匹配）
    const workers = await this.prisma.worker.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true },
    });
    const conflict = workers.find((w) => {
      try {
        return (
          this.crypto.decrypt(w.phone!) === dto.phone &&
          Number(w.id) !== workerId
        );
      } catch {
        return false;
      }
    });
    if (conflict) {
      throw new ConflictException('该手机号已被其他账号绑定');
    }

    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: { phone: encryptedPhone },
    });

    return { message: '手机号绑定成功' };
  }

  // ================================================================
  // 零工实名认证 (P0-2: 补全 idCardHash)
  // ================================================================
  async verifyIdentity(workerId: number, dto: VerifyIdentityDto) {
    // 1. 校验身份证号格式（18 位 + 校验位）
    if (!this.validateIdCard(dto.idCard)) {
      throw new BadRequestException('身份证号校验位不正确');
    }

    // 2. 检查是否已实名
    const worker = await this.prisma.worker.findUnique({
      where: { id: BigInt(workerId) },
      select: { isVerified: true },
    });
    if (worker?.isVerified) {
      throw new BadRequestException('已完成实名认证，不可重复认证');
    }

    // 3. 调用三要素验证（开发环境 mock 通过）
    const verifyResult = await this.callThreeElementVerify(
      dto.realName,
      dto.idCard,
    );
    if (!verifyResult.passed) {
      throw new BadRequestException('实名认证未通过');
    }

    // 4. AES 加密身份证 + SHA-256 哈希（用于快速查找去重）
    const encryptedIdCard = this.crypto.encrypt(dto.idCard);
    const idCardHash = createHash('sha256').update(dto.idCard).digest('hex');

    // 5. 检查身份证是否已被其他人认证
    const existingVerified = await this.prisma.worker.findFirst({
      where: { idCardHash, id: { not: BigInt(workerId) } },
    });
    if (existingVerified) {
      throw new ConflictException('该身份证号已被其他账号认证');
    }

    // 6. 更新
    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: {
        realName: dto.realName,
        idCardEncrypted: encryptedIdCard,
        idCardHash, // P0-2: 补全 SHA-256 哈希
        isVerified: true,
        level: 'verified',
      },
    });

    this.logger.log(`零工实名认证成功: ID=${workerId}`);
    return { message: '实名认证成功', isVerified: true };
  }

  // ================================================================
  // Token 续期
  // ================================================================
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      }) as JwtPayload;

      // 验证用户是否仍然有效
      if (payload.userType === 'company') {
        const user = await this.prisma.companyUser.findUnique({
          where: { id: BigInt(payload.sub) },
          select: { status: true },
        });
        if (!user || user.status !== 'active') {
          throw new UnauthorizedException('账号状态异常，请重新登录');
        }
      } else if (payload.userType === 'worker') {
        const worker = await this.prisma.worker.findUnique({
          where: { id: BigInt(payload.sub) },
          select: { status: true },
        });
        if (!worker || worker.status !== 'active') {
          throw new UnauthorizedException('账号状态异常，请重新登录');
        }
      }

      const tokens = this.generateTokens({
        sub: payload.sub,
        companyId: payload.companyId,
        role: payload.role,
        userType: payload.userType,
      });

      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('refreshToken 已过期，请重新登录');
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
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.industryTag !== undefined ? { industryTag: dto.industryTag } : {}),
      },
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
        workerRoles: {
          include: { platformRole: true },
          orderBy: { createdAt: 'desc' },
        },
        portfolios: { orderBy: { sortOrder: 'asc' } },
        wallet: { select: { availableBalance: true, frozenBalance: true, totalEarned: true } },
      },
    });
    if (!worker) throw new BadRequestException('零工不存在');

    return {
      userId: Number(worker.id),
      nickname: worker.nickname,
      realName: worker.realName,
      phone: worker.phone ? this.crypto.decrypt(worker.phone) : null,
      avatarUrl: worker.avatarUrl,
      coverImage: worker.coverImage,
      city: worker.city,
      bio: worker.bio,
      skillTags: worker.skillTags,
      isVerified: worker.isVerified,
      avgRating: Number(worker.avgRating),
      completionRate: Number(worker.completionRate),
      completedCount: worker.completedCount,
      level: worker.level,
      avgResponseHours: worker.avgResponseHours ? Number(worker.avgResponseHours) : null,
      roles: worker.workerRoles.map((r) => ({
        id: Number(r.id),
        roleName: r.roleName,
        platformRoleId: r.platformRoleId ? Number(r.platformRoleId) : null,
        level: r.level,
        yearsExp: r.yearsExp,
        minDailyRate: r.minDailyRate ? Number(r.minDailyRate) : null,
        maxDailyRate: r.maxDailyRate ? Number(r.maxDailyRate) : null,
        skillTags: r.skillTags,
        experienceDesc: r.experienceDesc,
        isAccepting: r.isAccepting,
        completedCount: r.completedCount,
        avgRating: Number(r.avgRating),
      })),
      portfolios: worker.portfolios.map((p) => ({
        id: Number(p.id),
        title: p.title,
        description: p.description,
        fileUrl: p.fileUrl,
        fileType: p.fileType,
        isFeatured: p.isFeatured,
        visibility: p.visibility,
      })),
      wallet: worker.wallet
        ? {
            availableBalance: Number(worker.wallet.availableBalance),
            frozenBalance: Number(worker.wallet.frozenBalance),
            totalEarned: Number(worker.wallet.totalEarned),
          }
        : null,
    };
  }

  // ================================================================
  // 更新零工信息
  // ================================================================
  async updateWorkerProfile(workerId: number, dto: UpdateWorkerProfileDto) {
    await this.prisma.worker.update({
      where: { id: BigInt(workerId) },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.coverImage !== undefined ? { coverImage: dto.coverImage } : {}),
        ...(dto.coverTemplate !== undefined ? { coverTemplate: dto.coverTemplate } : {}),
        ...(dto.skillTags !== undefined ? { skillTags: dto.skillTags } : {}),
      },
    });
    return { message: '更新成功' };
  }

  // ================================================================
  // P1-1: 添加零工角色档案
  // ================================================================
  async addWorkerRole(workerId: number, dto: AddWorkerRoleDto) {
    // 限制最多 5 个角色
    const count = await this.prisma.workerRole.count({
      where: { workerId: BigInt(workerId) },
    });
    if (count >= 5) {
      throw new BadRequestException('最多添加 5 个角色档案');
    }

    // 检查角色名是否重复
    const existing = await this.prisma.workerRole.findFirst({
      where: {
        workerId: BigInt(workerId),
        roleName: dto.roleName,
      },
    });
    if (existing) {
      throw new ConflictException('已存在同名角色');
    }

    const role = await this.prisma.workerRole.create({
      data: {
        workerId: BigInt(workerId),
        platformRoleId: dto.platformRoleId ? BigInt(dto.platformRoleId) : null,
        roleName: dto.roleName,
        level: dto.level as any || null,
        yearsExp: dto.yearsExp,
        minDailyRate: dto.minDailyRate,
        maxDailyRate: dto.maxDailyRate,
        skillTags: dto.skillTags ?? undefined,
        experienceDesc: dto.experienceDesc,
      },
    });

    return {
      id: Number(role.id),
      roleName: role.roleName,
      level: role.level,
      message: '角色添加成功',
    };
  }

  // ================================================================
  // P1-2: 添加零工作品集
  // ================================================================
  async addPortfolio(workerId: number, dto: AddPortfolioDto) {
    // 限制最多 20 个作品
    const count = await this.prisma.portfolio.count({
      where: { workerId: BigInt(workerId) },
    });
    if (count >= 20) {
      throw new BadRequestException('作品集最多 20 件');
    }

    const portfolio = await this.prisma.portfolio.create({
      data: {
        workerId: BigInt(workerId),
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType as any,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: count, // 追加到末尾
      },
    });

    return {
      id: Number(portfolio.id),
      title: portfolio.title,
      message: '作品上传成功',
    };
  }

  // ================================================================
  // 删除零工角色
  // ================================================================
  async deleteWorkerRole(workerId: number, roleId: number) {
    const role = await this.prisma.workerRole.findFirst({
      where: { id: BigInt(roleId), workerId: BigInt(workerId) },
    });
    if (!role) throw new BadRequestException('角色不存在');

    await this.prisma.workerRole.delete({
      where: { id: BigInt(roleId) },
    });

    return { message: '角色删除成功' };
  }

  // ================================================================
  // 删除零工作品
  // ================================================================
  async deletePortfolio(workerId: number, portfolioId: number) {
    const p = await this.prisma.portfolio.findFirst({
      where: { id: BigInt(portfolioId), workerId: BigInt(workerId) },
    });
    if (!p) throw new BadRequestException('作品不存在');

    await this.prisma.portfolio.delete({
      where: { id: BigInt(portfolioId) },
    });

    return { message: '作品删除成功' };
  }

  // ================================================================
  // 私有方法
  // ================================================================

  /** 生成 access + refresh 双 Token */
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

  // ── Redis 登录限流 (P0-1) ─────────────────────────

  /** 检查 IP 是否超过失败限制 */
  private async checkLoginRateLimit(ip: string): Promise<void> {
    const key = `${LOGIN_FAIL_PREFIX}${ip}`;
    const count = await this.redis.get(key);
    if (count && parseInt(count, 10) >= LOGIN_FAIL_MAX) {
      throw new UnauthorizedException(
        `登录失败次数过多，请 ${Math.ceil(LOGIN_FAIL_TTL / 60)} 分钟后再试`,
      );
    }
  }

  /** 记录登录失败 */
  private async recordLoginFailure(ip: string): Promise<void> {
    const key = `${LOGIN_FAIL_PREFIX}${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, LOGIN_FAIL_TTL);
    }
  }

  /** 登录成功后清除失败计数 */
  private async clearLoginFailure(ip: string): Promise<void> {
    await this.redis.del(`${LOGIN_FAIL_PREFIX}${ip}`);
  }

  // ── 微信登录 ──────────────────────────────────────

  /**
   * 微信 code 换 session（开发环境 mock）
   */
  private async getWechatSession(
    code: string,
  ): Promise<{ openid: string; nickname?: string; avatarUrl?: string }> {
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      // 开发环境：code 直接当 openid 用
      return { openid: `dev_openid_${code}` };
    }

    // 生产环境调用微信 API
    const appid = this.config.get<string>('WECHAT_APPID');
    const secret = this.config.get<string>('WECHAT_SECRET');
    // TODO: 使用 axios 调用:
    // GET https://api.weixin.qq.com/sns/jscode2session
    //   ?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code
    throw new BadRequestException('微信登录暂未配置');
  }

  /**
   * 三要素实名认证（开发环境 mock）
   */
  private async callThreeElementVerify(
    _realName: string,
    _idCard: string,
  ): Promise<{ passed: boolean }> {
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      return { passed: true };
    }
    // TODO: 生产环境调用阿里云实人认证 API
    throw new BadRequestException('实名认证服务暂未配置');
  }

  /**
   * 身份证号校验位验证（ISO 7064:1983 MOD 11-2）
   */
  private validateIdCard(idCard: string): boolean {
    if (!/^\d{17}[\dXx]$/.test(idCard)) return false;

    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = [
      '1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2',
    ];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(idCard[i]) * weights[i];
    }

    const checkCode = checkCodes[sum % 11];
    return idCard[17].toUpperCase() === checkCode;
  }
}
