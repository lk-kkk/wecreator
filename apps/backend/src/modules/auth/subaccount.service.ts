/**
 * SubaccountService — 子账号管理（S2-019）
 *
 * R1 · wc-auth-dev
 *
 * RBAC 4 角色权限矩阵：
 *   super_admin  : 全部操作（含子账号管理）
 *   task_admin   : 任务发布/撮合/验收
 *   finance_admin: 充值/提现/财务报表
 *   operator     : 只读查看
 *
 * 规则：
 *   - 每家企业最多 20 个子账号
 *   - super_admin 不可被普通管理员删除
 *   - 密码修改需要旧密码校验（或 super_admin 强制重置）
 *
 * P0-3 修复：手机号 AES 加密存储（不再明文）
 */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  IsString,
  IsIn,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma';
import { CryptoUtil } from '../../common/utils/crypto.util';

// ── DTOs ─────────────────────────────────────────────────────────────
export class CreateSubaccountDto {
  @ApiProperty({ description: '姓名', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  name: string;

  @ApiProperty({ description: '手机号' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '密码（8-32位，含大小写+数字）' })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: '密码需含大小写字母和数字',
  })
  password: string;

  @ApiProperty({
    enum: ['super_admin', 'task_admin', 'finance_admin', 'operator'],
    description: '角色',
  })
  @IsIn(['super_admin', 'task_admin', 'finance_admin', 'operator'])
  role: string;
}

export class UpdateSubaccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  name?: string;

  @ApiPropertyOptional({
    enum: ['super_admin', 'task_admin', 'finance_admin', 'operator'],
  })
  @IsOptional()
  @IsIn(['super_admin', 'task_admin', 'finance_admin', 'operator'])
  role?: string;

  @ApiPropertyOptional({ description: '新密码' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: '密码需含大小写字母和数字',
  })
  newPassword?: string;
}

// 权限矩阵
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['task:*', 'finance:*', 'admin:*', 'worker:*'],
  task_admin: ['task:*', 'worker:read', 'worker:invite'],
  finance_admin: ['finance:*', 'task:read'],
  operator: ['task:read', 'finance:read', 'worker:read'],
};

// ── Service ──────────────────────────────────────────────────────────
@Injectable()
export class SubaccountService {
  private readonly logger = new Logger(SubaccountService.name);
  private readonly MAX_ACCOUNTS = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoUtil,
  ) {}

  // ================================================================
  // 列出所有子账号
  // ================================================================
  async list(companyId: number) {
    const accounts = await this.prisma.companyUser.findMany({
      where: { companyId: BigInt(companyId), status: { not: 'deleted' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return accounts.map((a) => this._format(a));
  }

  // ================================================================
  // 创建子账号 (P0-3: 手机号加密存储)
  // ================================================================
  async create(
    companyId: number,
    operatorId: number,
    dto: CreateSubaccountDto,
  ) {
    await this._assertSuperAdmin(operatorId);

    // 上限检查
    const count = await this.prisma.companyUser.count({
      where: { companyId: BigInt(companyId), status: { not: 'deleted' } },
    });
    if (count >= this.MAX_ACCOUNTS) {
      throw new BadRequestException(
        `子账号数量已达上限（${this.MAX_ACCOUNTS}个）`,
      );
    }

    // 手机号唯一性检查（解密比对）
    const users = await this.prisma.companyUser.findMany({
      where: { companyId: BigInt(companyId), status: { not: 'deleted' } },
      select: { id: true, phone: true },
    });
    const duplicate = users.find((u) => {
      try {
        return this.crypto.decrypt(u.phone) === dto.phone;
      } catch {
        return false;
      }
    });
    if (duplicate) {
      throw new ConflictException('该手机号已被注册');
    }

    // P0-3: AES 加密手机号
    const encryptedPhone = this.crypto.encrypt(dto.phone);
    const hash = await bcrypt.hash(dto.password, 10);

    const account = await this.prisma.companyUser.create({
      data: {
        companyId: BigInt(companyId),
        name: dto.name,
        phone: encryptedPhone, // 加密存储
        passwordHash: hash,
        role: dto.role as any,
        status: 'active',
      },
    });

    this.logger.log(
      `子账号创建: company=${companyId}, id=${account.id}, role=${dto.role}`,
    );
    return this._format(account);
  }

  // ================================================================
  // 更新子账号（角色 / 密码）
  // ================================================================
  async update(
    companyId: number,
    operatorId: number,
    targetId: number,
    dto: UpdateSubaccountDto,
  ) {
    await this._assertSuperAdmin(operatorId);
    const target = await this._getAccount(companyId, targetId);

    // 不允许修改另一个 super_admin（除非自己就是被修改者）
    if (target.role === 'super_admin' && Number(target.id) !== operatorId) {
      throw new ForbiddenException('不能修改其他超级管理员');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.role) data.role = dto.role;
    if (dto.newPassword)
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.prisma.companyUser.update({
      where: { id: BigInt(targetId) },
      data,
    });
    return this._format(updated);
  }

  // ================================================================
  // 启用 / 禁用
  // ================================================================
  async setStatus(
    companyId: number,
    operatorId: number,
    targetId: number,
    active: boolean,
  ) {
    await this._assertSuperAdmin(operatorId);
    const target = await this._getAccount(companyId, targetId);

    if (target.role === 'super_admin')
      throw new ForbiddenException('不能禁用超级管理员');
    if (Number(target.id) === operatorId)
      throw new BadRequestException('不能禁用自己');

    await this.prisma.companyUser.update({
      where: { id: BigInt(targetId) },
      data: { status: active ? 'active' : 'disabled' },
    });
    return { success: true };
  }

  // ================================================================
  // 删除（软删除）
  // ================================================================
  async remove(companyId: number, operatorId: number, targetId: number) {
    await this._assertSuperAdmin(operatorId);
    const target = await this._getAccount(companyId, targetId);

    if (target.role === 'super_admin')
      throw new ForbiddenException('不能删除超级管理员');
    if (Number(target.id) === operatorId)
      throw new BadRequestException('不能删除自己');

    await this.prisma.companyUser.update({
      where: { id: BigInt(targetId) },
      data: { status: 'deleted' },
    });
    this.logger.log(`子账号删除: company=${companyId}, id=${targetId}`);
    return { success: true };
  }

  // ================================================================
  // 角色权限查询
  // ================================================================
  getRolePermissions(role: string) {
    return {
      role,
      permissions: ROLE_PERMISSIONS[role] ?? [],
      description:
        ({
          super_admin: '超级管理员：可管理子账号，拥有全部操作权限',
          task_admin: '任务管理员：可发布任务、撮合分配、验收结算',
          finance_admin: '财务管理员：可充值、查看财务报表',
          operator: '普通操作员：只读查看',
        } as Record<string, string>)[role] ?? '未知角色',
    };
  }

  // ── Private ──────────────────────────────────────────────────────

  private async _assertSuperAdmin(userId: number) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('只有超级管理员可以管理子账号');
    }
  }

  private async _getAccount(companyId: number, userId: number) {
    const user = await this.prisma.companyUser.findFirst({
      where: {
        id: BigInt(userId),
        companyId: BigInt(companyId),
        status: { not: 'deleted' },
      },
    });
    if (!user) throw new NotFoundException('子账号不存在');
    return user;
  }

  /** 格式化输出（手机号脱敏） */
  private _format(a: any) {
    let maskedPhone = '—';
    try {
      const plain = this.crypto.decrypt(a.phone);
      maskedPhone = plain.slice(0, 3) + '****' + plain.slice(-4);
    } catch {
      // 旧数据可能是明文
      if (a.phone && a.phone.length === 11) {
        maskedPhone = a.phone.slice(0, 3) + '****' + a.phone.slice(-4);
      }
    }

    return {
      id: Number(a.id),
      name: a.name,
      phone: maskedPhone,
      role: a.role,
      status: a.status,
      permissions: ROLE_PERMISSIONS[a.role] ?? [],
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
    };
  }
}
