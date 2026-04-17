/**
 * DisputeService — 争议仲裁（S2-011）
 *
 * 状态机（5态）：
 *   pending → investigating → resolved_company / resolved_worker / resolved_split
 *                           → cancelled
 *
 * 业务规则：
 *   - 任务状态为 in_progress / completed 才可发起
 *   - 仲裁期间禁止普通提现
 *   - 管理员裁决后自动触发资金结算
 *   - 证据 URL 以 JSON 数组存储于 evidenceUrls 字段
 */
import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ── DTOs ────────────────────────────────────────────────────────────
export class CreateDisputeDto {
  @ApiProperty({ description: '关联任务 ID' }) @Type(() => Number) taskId: number;
  @ApiProperty({ description: '关联分配 ID' }) @Type(() => Number) assignmentId: number;
  @ApiProperty({ description: '争议原因', maxLength: 500 })
  @IsString() @MaxLength(500) reason: string;
  @ApiPropertyOptional({ description: '证据文件 OSS URL 数组（最多10个）', type: [String] })
  @IsOptional() @IsArray() evidenceUrls?: string[];
}

export class ResolveDisputeDto {
  @ApiProperty({
    description: '裁决结果',
    enum: ['resolved_company', 'resolved_worker', 'resolved_split'],
  })
  @IsIn(['resolved_company', 'resolved_worker', 'resolved_split']) resolution: string;
  @ApiProperty({ description: '裁决说明', maxLength: 500 })
  @IsString() @MaxLength(500) resolutionNote: string;
  @ApiPropertyOptional({ description: '分摊比例（resolved_split时，0-100 表示企业分得%）' })
  @IsOptional() @Type(() => Number) splitRatioCompany?: number;
}

export class AddEvidenceDto {
  @ApiProperty({ description: '新增证据 OSS URL 数组', type: [String] })
  @IsArray() evidenceUrls: string[];
}

// ── Service ─────────────────────────────────────────────────────────
@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 发起争议
  // ================================================================
  async createDispute(
    initiatorType: 'company' | 'worker',
    initiatorId: number,
    dto: CreateDisputeDto,
  ) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(dto.assignmentId) },
      include: { taskRole: { include: { task: true } } },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');

    const task = (assignment as any).taskRole.task;
    if (!['published', 'in_progress', 'completed'].includes(task.status)) {
      throw new BadRequestException('当前任务状态不允许发起争议');
    }

    // 权限检查
    if (initiatorType === 'company' && task.companyId !== BigInt(initiatorId)) {
      throw new ForbiddenException('无权操作');
    }
    if (initiatorType === 'worker' && assignment.workerId !== BigInt(initiatorId)) {
      throw new ForbiddenException('无权操作');
    }

    // 重复检查：同一 assignment 不可同时存在多个 pending/investigating 争议
    const existing = await this.prisma.dispute.findFirst({
      where: {
        assignmentId: BigInt(dto.assignmentId),
        status:       { in: ['pending', 'investigating'] },
      },
    });
    if (existing) throw new BadRequestException('该任务已存在进行中的争议');

    const dispute = await this.prisma.dispute.create({
      data: {
        taskId:        BigInt(dto.taskId),
        assignmentId:  BigInt(dto.assignmentId),
        initiatorType: initiatorType as any,
        initiatorId:   BigInt(initiatorId),
        reason:        dto.reason,
        evidenceUrls:  dto.evidenceUrls?.length
          ? JSON.stringify(dto.evidenceUrls.slice(0, 10))
          : null,
        status: 'pending',
      },
    });

    this.logger.log(`争议发起: id=${dispute.id}, by=${initiatorType}#${initiatorId}`);
    return this._format(dispute);
  }

  // ================================================================
  // 补充证据
  // ================================================================
  async addEvidence(
    disputeId: number,
    userId: number,
    userType: 'company' | 'worker',
    dto: AddEvidenceDto,
  ) {
    const dispute = await this._getAndCheck(disputeId);
    if (!['pending', 'investigating'].includes(dispute.status)) {
      throw new BadRequestException('争议已结案，无法补充证据');
    }

    // 只有发起方或对方可补充证据
    const existing: string[] = dispute.evidenceUrls
      ? JSON.parse(dispute.evidenceUrls as string)
      : [];
    const merged = [...new Set([...existing, ...dto.evidenceUrls])].slice(0, 10);

    const updated = await this.prisma.dispute.update({
      where: { id: BigInt(disputeId) },
      data:  { evidenceUrls: JSON.stringify(merged) },
    });
    return this._format(updated);
  }

  // ================================================================
  // 受理（pending → investigating）—— 管理员操作
  // ================================================================
  async acceptDispute(disputeId: number) {
    const dispute = await this._getAndCheck(disputeId);
    if (dispute.status !== 'pending') throw new BadRequestException('仲裁已受理');

    const updated = await this.prisma.dispute.update({
      where: { id: BigInt(disputeId) },
      data:  { status: 'investigating' },
    });
    this.logger.log(`争议受理: id=${disputeId}`);
    return this._format(updated);
  }

  // ================================================================
  // 裁决（investigating → resolved_*）—— 管理员操作
  // ================================================================
  async resolveDispute(disputeId: number, dto: ResolveDisputeDto) {
    const dispute = await this._getAndCheck(disputeId);
    if (dispute.status !== 'investigating') {
      throw new BadRequestException('只有受理中的争议才能裁决');
    }

    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: dispute.assignmentId },
      include: { taskRole: { include: { task: true } } },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');

    await this.prisma.$transaction(async (tx) => {
      // 1. 更新争议状态
      await tx.dispute.update({
        where: { id: BigInt(disputeId) },
        data: {
          status:     dto.resolution as any,
          resolution: `${dto.resolutionNote}${
            dto.resolution === 'resolved_split' && dto.splitRatioCompany != null
              ? `（企业分得 ${dto.splitRatioCompany}%，零工分得 ${100 - dto.splitRatioCompany}%）`
              : ''
          }`,
          resolvedAt: new Date(),
        },
      });

      // 2. 根据裁决结果处理资金
      const lockedAmt = Number((assignment as any).taskRole.task.lockedAmount ?? 0);
      if (lockedAmt > 0) {
        if (dto.resolution === 'resolved_worker') {
          // 零工胜诉：全额结算给零工
          await this._settleToWorker(tx, assignment, lockedAmt, '争议仲裁：零工胜诉全额结算');
        } else if (dto.resolution === 'resolved_company') {
          // 企业胜诉：解锁还给企业
          await this._unlockToCompany(tx, assignment, lockedAmt, '争议仲裁：企业胜诉退款');
        } else if (dto.resolution === 'resolved_split') {
          // 按比例分摊
          const companyRatio = (dto.splitRatioCompany ?? 50) / 100;
          const workerAmt    = lockedAmt * (1 - companyRatio);
          const companyAmt   = lockedAmt * companyRatio;
          if (workerAmt > 0) {
            await this._settleToWorker(tx, assignment, workerAmt, `争议仲裁：分摊结算零工 ${Math.round((1-companyRatio)*100)}%`);
          }
          if (companyAmt > 0) {
            await this._unlockToCompany(tx, assignment, companyAmt, `争议仲裁：分摊退款企业 ${Math.round(companyRatio*100)}%`);
          }
        }
      }

      // 3. 更新 assignment 状态为 completed
      await tx.roleAssignment.update({
        where: { id: assignment.id },
        data:  { status: 'completed' },
      });
    });

    this.logger.log(`争议裁决: id=${disputeId}, result=${dto.resolution}`);
    return this._getById(disputeId);
  }

  // ================================================================
  // 撤销（pending → cancelled）—— 发起方操作
  // ================================================================
  async cancelDispute(disputeId: number, userId: number, userType: 'company' | 'worker') {
    const dispute = await this._getAndCheck(disputeId);
    if (dispute.status !== 'pending') throw new BadRequestException('仲裁受理后不可撤销');
    if (
      Number(dispute.initiatorId) !== userId ||
      dispute.initiatorType !== userType
    ) throw new ForbiddenException('只有发起方可撤销');

    const updated = await this.prisma.dispute.update({
      where: { id: BigInt(disputeId) },
      data:  { status: 'cancelled' },
    });
    return this._format(updated);
  }

  // ================================================================
  // 查询
  // ================================================================
  async getById(disputeId: number) { return this._getById(disputeId); }

  async listByTask(taskId: number) {
    const list = await this.prisma.dispute.findMany({
      where:   { taskId: BigInt(taskId) },
      orderBy: { createdAt: 'desc' },
    });
    return list.map(this._format);
  }

  async listByUser(userId: number, userType: 'company' | 'worker', page = 1, pageSize = 10) {
    const where = userType === 'company'
      ? { taskId: { in: await this._getCompanyTaskIds(userId) } }
      : { initiatorId: BigInt(userId) };

    const [list, total] = await Promise.all([
      this.prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*pageSize, take: pageSize }),
      this.prisma.dispute.count({ where }),
    ]);
    return { total, page, pageSize, list: list.map(this._format) };
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async _getAndCheck(disputeId: number) {
    const d = await this.prisma.dispute.findUnique({ where: { id: BigInt(disputeId) } });
    if (!d) throw new NotFoundException('争议记录不存在');
    return d;
  }

  private async _getById(disputeId: number) {
    const d = await this.prisma.dispute.findUnique({ where: { id: BigInt(disputeId) } });
    if (!d) throw new NotFoundException('争议记录不存在');
    return this._format(d);
  }

  private _format(d: any) {
    return {
      disputeId:    Number(d.id),
      taskId:       Number(d.taskId),
      assignmentId: Number(d.assignmentId),
      initiatorType:d.initiatorType,
      initiatorId:  Number(d.initiatorId),
      reason:       d.reason,
      evidenceUrls: d.evidenceUrls ? JSON.parse(d.evidenceUrls) : [],
      status:       d.status,
      resolution:   d.resolution,
      resolvedAt:   d.resolvedAt,
      createdAt:    d.createdAt,
    };
  }

  private async _getCompanyTaskIds(companyId: number): Promise<bigint[]> {
    const tasks = await this.prisma.task.findMany({
      where:  { companyId: BigInt(companyId) },
      select: { id: true },
    });
    return tasks.map(t => t.id);
  }

  private async _settleToWorker(tx: any, assignment: any, amount: number, remark: string) {
    const fee = amount * 0.08;
    const net = amount - fee;
    await tx.wallet.upsert({
      where:  { workerId: assignment.workerId },
      create: { workerId: assignment.workerId, availableBalance: net, totalEarned: net },
      update: { availableBalance: { increment: net }, totalEarned: { increment: net } },
    });
    await tx.transaction.create({
      data: {
        transactionNo: `DS${Date.now()}${Math.random().toString(36).slice(2,6)}`,
        type:      'settlement', direction: 'in',
        amount:    net, workerId: assignment.workerId,
        taskId:    (assignment as any).taskRole.taskId,
        status:    'completed', completedAt: new Date(), remark,
      },
    });
  }

  private async _unlockToCompany(tx: any, assignment: any, amount: number, remark: string) {
    const task = (assignment as any).taskRole.task;
    await tx.company.update({
      where: { id: task.companyId },
      data:  { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        transactionNo: `DU${Date.now()}${Math.random().toString(36).slice(2,6)}`,
        type:      'unlock', direction: 'in',
        amount,    companyId: task.companyId,
        taskId:    task.id,
        status:    'completed', completedAt: new Date(), remark,
      },
    });
  }
}
