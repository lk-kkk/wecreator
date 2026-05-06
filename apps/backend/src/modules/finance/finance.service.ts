import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { randomBytes } from 'crypto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly LOCK_MULTIPLIER = 1.08; // 108%锁定

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 企业充值（模拟微信Native支付）
  // ================================================================
  async createRecharge(companyId: number, amount: number) {
    if (amount <= 0) throw new BadRequestException('充值金额必须大于0');

    const transactionNo = `RC${Date.now()}${randomBytes(4).toString('hex')}`;
    const idempotencyKey = `recharge_${companyId}_${transactionNo}`;

    // 创建充值流水（待支付）
    const tx = await this.prisma.transaction.create({
      data: {
        transactionNo,
        type: 'recharge',
        direction: 'in',
        amount,
        companyId: BigInt(companyId),
        status: 'pending',
        idempotencyKey,
      },
    });

    // 开发环境：模拟支付二维码URL
    const qrcodeUrl = `weixin://wxpay/mock?out_trade_no=${transactionNo}&total_fee=${amount * 100}`;

    this.logger.log(`充值发起: company=${companyId}, amount=${amount}, txNo=${transactionNo}`);

    return {
      transactionNo,
      amount,
      qrcodeUrl,
      message: '请使用微信扫码支付',
    };
  }

  // ================================================================
  // 支付回调处理（模拟微信回调）
  // ================================================================
  async handlePayCallback(transactionNo: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { transactionNo },
    });
    if (!tx) throw new BadRequestException('交易不存在');
    if (tx.status !== 'pending') return { message: '已处理' };

    // 事务：更新流水+增加企业余额（乐观锁）
    await this.prisma.$transaction(async (prisma) => {
      // 1. 更新流水状态
      await prisma.transaction.update({
        where: { transactionNo },
        data: { status: 'completed', completedAt: new Date() },
      });

      // 2. 乐观锁更新企业余额
      const company = await prisma.company.findUnique({
        where: { id: tx.companyId! },
      });
      if (!company) throw new BadRequestException('企业不存在');

      const result = await prisma.company.updateMany({
        where: {
          id: tx.companyId!,
          version: company.version, // 乐观锁
        },
        data: {
          balance: { increment: Number(tx.amount) },
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new BadRequestException('并发冲突，请重试');
      }
    });

    this.logger.log(`充值到账: txNo=${transactionNo}, amount=${tx.amount}`);
    return { message: '充值成功' };
  }

  // ================================================================
  // 资金锁定（发布任务时调用，乐观锁）
  // ================================================================
  async lockFund(companyId: number, taskId: number, budget: number) {
    const lockAmount = Math.ceil(budget * this.LOCK_MULTIPLIER * 100) / 100;

    await this.prisma.$transaction(async (prisma) => {
      const company = await prisma.company.findUnique({
        where: { id: BigInt(companyId) },
      });
      if (!company) throw new BadRequestException('企业不存在');

      const available = Number(company.balance) - Number(company.lockedBalance);
      if (available < lockAmount) {
        throw new BadRequestException(
          `余额不足，需锁定 ¥${lockAmount}，可用余额 ¥${available.toFixed(2)}`,
        );
      }

      // 乐观锁更新
      const result = await prisma.company.updateMany({
        where: { id: BigInt(companyId), version: company.version },
        data: {
          lockedBalance: { increment: lockAmount },
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new BadRequestException('并发冲突，请重试');
      }

      // 更新任务锁定金额
      await prisma.task.update({
        where: { id: BigInt(taskId) },
        data: { lockedAmount: lockAmount },
      });

      // 记录锁定流水
      await prisma.transaction.create({
        data: {
          transactionNo: `LK${Date.now()}${randomBytes(4).toString('hex')}`,
          type: 'lock',
          direction: 'out',
          amount: lockAmount,
          companyId: BigInt(companyId),
          taskId: BigInt(taskId),
          status: 'completed',
          completedAt: new Date(),
        },
      });
    });

    this.logger.log(`资金锁定: company=${companyId}, task=${taskId}, locked=${lockAmount}`);
    return { lockedAmount: lockAmount, message: '资金已锁定' };
  }

  // ================================================================
  // 查询企业余额
  // ================================================================
  async getBalance(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: BigInt(companyId) },
    });
    if (!company) throw new BadRequestException('企业不存在');

    return {
      balance: Number(company.balance),
      lockedBalance: Number(company.lockedBalance),
      availableBalance: Number(company.balance) - Number(company.lockedBalance),
    };
  }

  // ================================================================
  // 交易流水查询
  // ================================================================
  async getTransactions(
    companyId: number,
    query: { type?: string; page?: number; pageSize?: number },
  ) {
    const { type, page = 1, pageSize = 20 } = query;

    const where: any = { companyId: BigInt(companyId) };
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
        type: t.type,
        direction: t.direction,
        amount: Number(t.amount),
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // ================================================================
  // 查询充值状态（前端轮询用）
  // ================================================================
  async getRechargeStatus(transactionNo: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { transactionNo },
    });
    if (!tx) throw new BadRequestException('交易不存在');

    return {
      transactionNo: tx.transactionNo,
      status: tx.status,
      amount: Number(tx.amount),
    };
  }

  // ================================================================
  // V3.9: 任务付款（pending_payment → completed）
  // ================================================================
  async payForTask(companyId: number, taskId: number) {
    // 1. 查找任务
    const task = await this.prisma.task.findFirst({
      where: { id: BigInt(taskId), companyId: BigInt(companyId) },
    });
    if (!task) throw new BadRequestException('任务不存在');
    if (task.status !== 'pending_payment') {
      throw new BadRequestException('任务当前状态不支持付款操作');
    }

    const amount = Number(task.lockedAmount) > 0 ? Number(task.lockedAmount) : Number(task.totalBudget);
    const transactionNo = `ST${Date.now()}${randomBytes(4).toString('hex')}`;

    await this.prisma.$transaction(async (prisma) => {
      // 2. 创建结算流水
      await prisma.transaction.create({
        data: {
          transactionNo,
          type: 'settlement',
          direction: 'out',
          amount,
          companyId: BigInt(companyId),
          taskId: BigInt(taskId),
          status: 'completed',
          completedAt: new Date(),
          remark: `任务结算: ${task.title}`,
        },
      });

      // 3. 解锁资金
      const company = await prisma.company.findUnique({
        where: { id: BigInt(companyId) },
      });
      if (!company) throw new BadRequestException('企业不存在');

      const lockedAmount = Number(task.lockedAmount);
      const result = await prisma.company.updateMany({
        where: { id: BigInt(companyId), version: company.version },
        data: {
          balance: { decrement: amount },
          lockedBalance: { decrement: lockedAmount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new BadRequestException('并发冲突，请重试');

      // 4. 任务状态 → completed
      await prisma.task.update({
        where: { id: BigInt(taskId) },
        data: {
          status: 'completed',
          completedAt: new Date(),
          lockedAmount: 0,
        },
      });
    });

    this.logger.log(`任务付款完成: task=${taskId}, amount=${amount}, txNo=${transactionNo}`);
    return { message: '付款成功，任务已完成', transactionNo, amount, status: 'completed' };
  }
}
