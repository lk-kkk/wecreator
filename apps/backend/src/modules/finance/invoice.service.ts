/**
 * InvoiceService — 发票申请（S2-021）
 *
 * 流程：
 *   企业申请 → pending → 平台审核 → issued（OSS PDF URL）
 *                              → rejected
 *
 * 发票类型：增值税专用发票（专票）/ 普通发票（普票）
 * 税率：专票 9%  普票 6%（可配置）
 */
import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { IsString, IsIn, IsNumber, Min, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';

// ── DTOs ──────────────────────────────────────────────────────────
export class ApplyInvoiceDto {
  @ApiProperty({ description: '申请金额（元）', example: 10000 })
  @IsNumber() @Min(100) @Type(() => Number) amount: number;

  @ApiProperty({ enum: ['专票', '普票'], description: '发票类型' })
  @IsIn(['专票', '普票']) invoiceType: string;

  @ApiPropertyOptional({ description: '抬头（留空使用企业名称）' })
  @IsOptional() @IsString() @MaxLength(100) title?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional() @IsString() @MaxLength(200) remark?: string;
}

export class IssueInvoiceDto {
  @ApiProperty({ description: '发票号' })
  @IsString() invoiceNo: string;

  @ApiProperty({ description: 'PDF OSS URL' })
  @IsString() pdfUrl: string;
}

export class RejectInvoiceDto {
  @ApiProperty({ description: '驳回原因' })
  @IsString() @MaxLength(200) reason: string;
}

// ── Service ───────────────────────────────────────────────────────
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  private readonly TAX_RATES: Record<string, number> = {
    '专票': 0.09,
    '普票': 0.06,
  };

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 申请发票
  // ================================================================
  async apply(companyId: number, dto: ApplyInvoiceDto) {
    // 校验可开票余额（已结算未开票金额）
    const settledAmount = await this._getUnbilledAmount(companyId);
    if (dto.amount > settledAmount) {
      throw new BadRequestException(
        `申请金额 ¥${dto.amount} 超过可开票余额 ¥${settledAmount.toFixed(2)}`
      );
    }

    const taxRate = this.TAX_RATES[dto.invoiceType] ?? 0.06;
    const company = await this.prisma.company.findUnique({
      where: { id: BigInt(companyId) }, select: { name: true },
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId:   BigInt(companyId),
        amount:      dto.amount,
        taxRate,
        invoiceType: dto.invoiceType,
        status:      'pending',
      },
    });

    this.logger.log(`发票申请: company=${companyId}, id=${invoice.id}, amount=${dto.amount}`);
    return this._format(invoice, company?.name ?? '');
  }

  // ================================================================
  // 列出我的发票
  // ================================================================
  async listByCompany(companyId: number, page = 1, pageSize = 10) {
    const where = { companyId: BigInt(companyId) };
    const company = await this.prisma.company.findUnique({
      where: { id: BigInt(companyId) }, select: { name: true },
    });

    const [list, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      total, page, pageSize,
      list: list.map(i => this._format(i, company?.name ?? '')),
      unbilledAmount: await this._getUnbilledAmount(companyId),
    };
  }

  // ================================================================
  // 发票详情
  // ================================================================
  async getById(invoiceId: number, companyId?: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
    if (!invoice) throw new NotFoundException('发票不存在');
    if (companyId && Number(invoice.companyId) !== companyId) {
      throw new NotFoundException('发票不存在');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId }, select: { name: true },
    });
    return this._format(invoice, company?.name ?? '');
  }

  // ================================================================
  // 管理员：开具发票（pending → issued）
  // ================================================================
  async issue(invoiceId: number, dto: IssueInvoiceDto) {
    const invoice = await this._getAndCheck(invoiceId, 'pending');

    const updated = await this.prisma.invoice.update({
      where: { id: BigInt(invoiceId) },
      data:  {
        invoiceNo: dto.invoiceNo,
        pdfUrl:    dto.pdfUrl,
        status:    'issued',
        issuedAt:  new Date(),
      },
    });
    this.logger.log(`发票开具: id=${invoiceId}, no=${dto.invoiceNo}`);
    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId }, select: { name: true },
    });
    return this._format(updated, company?.name ?? '');
  }

  // ================================================================
  // 管理员：驳回（pending → rejected）—— 复用 InvoiceStatus 中 rejected
  // ================================================================
  async reject(invoiceId: number, dto: RejectInvoiceDto) {
    await this._getAndCheck(invoiceId, 'pending');

    const updated = await this.prisma.invoice.update({
      where: { id: BigInt(invoiceId) },
      data:  { status: 'rejected' },      // rejected 在 InvoiceStatus enum 中
    });
    return this._format(updated, '');
  }

  // ================================================================
  // 管理员：列出所有待审核发票
  // ================================================================
  async listPending(page = 1, pageSize = 20) {
    const [list, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where:   { status: 'pending' },
        orderBy: { appliedAt: 'asc' },
        skip:    (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.invoice.count({ where: { status: 'pending' } }),
    ]);

    const companyIds = [...new Set(list.map(i => i.companyId))];
    const companies  = await this.prisma.company.findMany({
      where: { id: { in: companyIds } }, select: { id: true, name: true },
    });
    const cMap = Object.fromEntries(companies.map(c => [c.id.toString(), c.name]));

    return {
      total, page, pageSize,
      list: list.map(i => this._format(i, cMap[i.companyId.toString()] ?? '')),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /** 计算可开票金额 = 已结算总额 - 已开票总额 */
  private async _getUnbilledAmount(companyId: number): Promise<number> {
    const [settled, billed] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          companyId: BigInt(companyId),
          type:      'settlement', direction: 'out', status: 'completed',
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where:  { companyId: BigInt(companyId), status: { in: ['pending', 'issued'] } },
        _sum:   { amount: true },
      }),
    ]);
    return Math.max(
      0,
      Number(settled._sum.amount ?? 0) - Number(billed._sum.amount ?? 0),
    );
  }

  private async _getAndCheck(invoiceId: number, requiredStatus: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: BigInt(invoiceId) } });
    if (!invoice) throw new NotFoundException('发票不存在');
    if (invoice.status !== requiredStatus) {
      throw new BadRequestException(`发票状态为 ${invoice.status}，无法操作`);
    }
    return invoice;
  }

  private _format(i: any, companyName: string) {
    return {
      invoiceId:   Number(i.id),
      companyId:   Number(i.companyId),
      companyName,
      invoiceNo:   i.invoiceNo,
      amount:      Number(i.amount),
      taxAmount:   Math.round(Number(i.amount) * Number(i.taxRate) * 100) / 100,
      taxRate:     Number(i.taxRate),
      invoiceType: i.invoiceType,
      status:      i.status,
      pdfUrl:      i.pdfUrl,
      appliedAt:   i.appliedAt,
      issuedAt:    i.issuedAt,
    };
  }
}
