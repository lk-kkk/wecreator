import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma';
import { WalletService } from '../wallet/wallet.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private readonly PLATFORM_FEE_RATE = 0.08;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  // ================================================================
  // 触发结算（企业验收通过后调用）
  // ================================================================
  async triggerSettlement(taskRoleId: number, companyId: number) {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { taskRoleId: BigInt(taskRoleId), status: 'accepted' },
      include: { taskRole: true },
    });
    if (!assignment) throw new NotFoundException('未找到已接单记录');

    const budget = Number((assignment as any).taskRole.budget);
    const taskId  = Number((assignment as any).taskRole.taskId);
    const workerId = Number(assignment.workerId);

    // 调用 WalletService 完成零工入账
    const result = await this.walletService.settleToWorker(
      workerId,
      taskId,
      Number(assignment.id),
      budget,
    );

    // 更新 Assignment 状态 → completed
    await this.prisma.roleAssignment.update({
      where: { id: assignment.id },
      data: { status: 'completed' },
    });

    // 解锁企业对应资金（已结算部分）
    await this.unlockAfterSettlement(companyId, taskId, budget);

    this.logger.log(`结算触发: task=${taskId}, worker=${workerId}, net=${result.netAmount}`);
    return result;
  }

  // ================================================================
  // 解锁企业余额（结算后）
  // ================================================================
  async unlockAfterSettlement(companyId: number, taskId: number, settledAmount: number) {
    const lockedAmount = Math.ceil(settledAmount * 1.08 * 100) / 100;
    try {
      const company = await this.prisma.company.findUnique({ where: { id: BigInt(companyId) } });
      if (!company) return;
      await this.prisma.company.updateMany({
        where: { id: BigInt(companyId), version: company.version },
        data: {
          lockedBalance: { decrement: lockedAmount },
          version:       { increment: 1 },
        },
      });
      // 记录解锁流水
      await this.prisma.transaction.create({
        data: {
          transactionNo: `UL${Date.now()}${randomBytes(4).toString('hex')}`,
          type:          'unlock',
          direction:     'out',
          amount:        lockedAmount,
          companyId:     BigInt(companyId),
          taskId:        BigInt(taskId),
          status:        'completed',
          completedAt:   new Date(),
        },
      });
    } catch (e) {
      this.logger.error('解锁资金失败', e);
    }
  }

  // ================================================================
  // 每日对账定时任务（每天 02:00）
  // ================================================================
  @Cron('0 2 * * *')
  async dailyReconciliation() {
    this.logger.log('对账任务开始...');
    try {
      const companies = await this.prisma.company.findMany({
        select: { id: true, balance: true, lockedBalance: true },
      });

      for (const company of companies) {
        const inSum = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            companyId: company.id,
            direction: 'in',
            status:    'completed',
          },
        });
        const outSum = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            companyId: company.id,
            direction: 'out',
            status:    'completed',
          },
        });

        const computed =
          Number(inSum._sum.amount || 0) - Number(outSum._sum.amount || 0);
        const actual = Number(company.balance);
        const diff = Math.abs(computed - actual);

        if (diff > 0.01) {
          this.logger.error(
            `[对账异常] 企业 ${company.id}: 计算余额=${computed.toFixed(2)}, 实际余额=${actual.toFixed(2)}, 差额=${diff.toFixed(2)}`,
          );
        }
      }
      this.logger.log('对账任务完成');
    } catch (e) {
      this.logger.error('对账任务异常', e);
    }
  }
}
