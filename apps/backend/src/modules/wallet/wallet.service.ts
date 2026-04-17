import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { RedisLockService } from '../../common/redis-lock.service';
import { randomBytes } from 'crypto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly PLATFORM_FEE_RATE = 0.08; // 8% 平台服务费

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
  ) {}

  // ================================================================
  // 查询零工钱包
  // ================================================================
  async getWallet(workerId: number) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { workerId: BigInt(workerId) },
    });
    // 首次查询自动创建钱包
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { workerId: BigInt(workerId) },
      });
    }
    return {
      availableBalance: Number(wallet.availableBalance),
      frozenBalance:    Number(wallet.frozenBalance),
      totalEarned:      Number(wallet.totalEarned),
    };
  }

  // ================================================================
  // 零工提现（Redis分布式锁保护）
  // ================================================================
  async withdraw(workerId: number, amount: number) {
    if (amount <= 0) throw new BadRequestException('提现金额必须大于0');
    const minWithdraw = 1;
    if (amount < minWithdraw) throw new BadRequestException(`最低提现金额为 ¥${minWithdraw}`);

    const lockKey = `withdraw:lock:${workerId}`;
    return this.redisLock.withLock(lockKey, async () => {
      const wallet = await this.prisma.wallet.findUnique({
        where: { workerId: BigInt(workerId) },
      });
      if (!wallet) throw new NotFoundException('钱包不存在');
      if (Number(wallet.availableBalance) < amount) {
        throw new BadRequestException(
          `可用余额不足，当前可用 ¥${Number(wallet.availableBalance).toFixed(2)}`,
        );
      }

      const transactionNo = `WD${Date.now()}${randomBytes(4).toString('hex')}`;
      const idempotencyKey = `withdraw_${workerId}_${transactionNo}`;

      await this.prisma.$transaction(async (prisma) => {
        // 1. 乐观锁扣减钱包余额
        const result = await prisma.wallet.updateMany({
          where: { workerId: BigInt(workerId), version: wallet.version },
          data: {
            availableBalance: { decrement: amount },
            frozenBalance:    { increment: amount },
            version:          { increment: 1 },
          },
        });
        if (result.count === 0) throw new BadRequestException('并发冲突，请重试');

        // 2. 创建提现流水（processing 状态，等待合规通道回调）
        await prisma.transaction.create({
          data: {
            transactionNo,
            type:           'withdraw',
            direction:      'out',
            amount,
            workerId:       BigInt(workerId),
            status:         'processing',
            idempotencyKey,
            remark:         '零工提现申请',
          },
        });
      });

      this.logger.log(`提现发起: worker=${workerId}, amount=${amount}, txNo=${transactionNo}`);

      // 开发环境模拟：直接异步完成提现
      setTimeout(() => this.completeWithdraw(transactionNo, workerId, amount), 2000);

      return {
        transactionNo,
        amount,
        status: 'processing',
        message: '提现申请已提交，预计1-3工作日到账',
      };
    }, 30_000);
  }

  // ================================================================
  // 提现完成（模拟合规通道回调）
  // ================================================================
  async completeWithdraw(transactionNo: string, workerId: number, amount: number) {
    try {
      await this.prisma.$transaction(async (prisma) => {
        await prisma.transaction.update({
          where: { transactionNo },
          data: { status: 'completed', completedAt: new Date() },
        });
        // 冻结→解冻（实际已划扣）
        const wallet = await prisma.wallet.findUnique({ where: { workerId: BigInt(workerId) } });
        if (!wallet) return;
        await prisma.wallet.updateMany({
          where: { workerId: BigInt(workerId), version: wallet.version },
          data: {
            frozenBalance: { decrement: amount },
            version:       { increment: 1 },
          },
        });
      });
      this.logger.log(`提现完成: txNo=${transactionNo}`);
    } catch (e) {
      this.logger.error(`提现完成失败: ${transactionNo}`, e);
    }
  }

  // ================================================================
  // 零工流水明细
  // ================================================================
  async getWorkerTransactions(workerId: number, query: { page?: number; pageSize?: number; type?: string }) {
    const { page = 1, pageSize = 20, type } = query;
    const where: any = { workerId: BigInt(workerId) };
    if (type) where.type = type;

    const [list, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      list: list.map((t) => ({
        transactionNo: t.transactionNo,
        type:          t.type,
        direction:     t.direction,
        amount:        Number(t.amount),
        status:        t.status,
        remark:        t.remark,
        createdAt:     t.createdAt,
        completedAt:   t.completedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // ================================================================
  // 合规结算（企业验收通过后，R2 Task-Dev 调用此方法）
  // POST /settlement/complete（内部 Service 调用）
  // ================================================================
  async settleToWorker(
    workerId: number,
    taskId: number,
    assignmentId: number,
    grossAmount: number,
  ) {
    const netAmount = Math.floor(grossAmount * (1 - this.PLATFORM_FEE_RATE) * 100) / 100;
    const platformFee = grossAmount - netAmount;
    const transactionNo = `ST${Date.now()}${randomBytes(4).toString('hex')}`;
    const idempotencyKey = `settle_${assignmentId}_${transactionNo}`;

    await this.prisma.$transaction(async (prisma) => {
      const wallet = await prisma.wallet.findUnique({ where: { workerId: BigInt(workerId) } });
      if (!wallet) {
        // 首次结算自动建钱包
        await prisma.wallet.create({ data: { workerId: BigInt(workerId) } });
      }

      // 乐观锁增加钱包余额
      const w = await prisma.wallet.findUnique({ where: { workerId: BigInt(workerId) } });
      if (!w) throw new BadRequestException('钱包不存在');
      const res = await prisma.wallet.updateMany({
        where: { workerId: BigInt(workerId), version: w.version },
        data: {
          availableBalance: { increment: netAmount },
          totalEarned:      { increment: netAmount },
          version:          { increment: 1 },
        },
      });
      if (res.count === 0) throw new BadRequestException('并发冲突，请重试');

      // 记录结算流水
      await prisma.transaction.create({
        data: {
          transactionNo,
          type:           'settlement',
          direction:      'in',
          amount:         netAmount,
          workerId:       BigInt(workerId),
          taskId:         BigInt(taskId),
          status:         'completed',
          completedAt:    new Date(),
          idempotencyKey,
          remark:         `任务结算（平台费 ¥${platformFee.toFixed(2)}）`,
        },
      });
    });

    this.logger.log(
      `结算完成: worker=${workerId}, task=${taskId}, gross=${grossAmount}, net=${netAmount}`,
    );
    return { workerId, netAmount, platformFee, transactionNo };
  }
}
