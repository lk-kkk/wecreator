import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { createHash } from 'crypto';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // 生成合同PDF（开发环境 mock — 不依赖 Puppeteer）
  // ================================================================
  async generatePdf(assignmentId: number): Promise<{
    contractId: number;
    pdfUrl: string;
    contractHash: string;
  }> {
    // 1. 查询分配记录 + 关联数据
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
      include: {
        worker: true,
        taskRole: { include: { task: { include: { company: true } } } },
      },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');

    const task = assignment.taskRole.task;
    const company = task.company;
    const worker = assignment.worker;

    // 2. 构造合同内容（Handlebars 模板 mock — 纯文本）
    const contractContent = [
      `=== 劳务合作协议 ===`,
      ``,
      `甲方（企业）：${company.name}`,
      `统一社会信用代码：${company.creditCode}`,
      ``,
      `乙方（零工）：${worker.realName || '未实名'}`,
      ``,
      `任务名称：${task.title}`,
      `任务模式：${task.taskMode === 'task_package' ? '任务包' : '人天'}`,
      `角色岗位：${assignment.taskRole.roleName}`,
      `报酬金额：¥${Number(assignment.taskRole.budget).toFixed(2)}`,
      ``,
      `执行时间：${task.startDate?.toISOString().slice(0, 10) || '待定'} 至 ${task.endDate?.toISOString().slice(0, 10) || '待定'}`,
      `工作地点：${task.address || '线上'}`,
      ``,
      `签署时间：${new Date().toISOString()}`,
      ``,
      `本协议由 WeCreator 平台存证，合同Hash可用于验证完整性。`,
    ].join('\n');

    // 3. 计算 SHA-256 Hash
    const contractHash = createHash('sha256')
      .update(contractContent, 'utf8')
      .digest('hex');

    // 4. Mock PDF URL（生产环境应 Puppeteer → OSS 上传）
    const pdfUrl = `https://oss.mock.wecreator.local/contracts/${assignmentId}_${Date.now()}.pdf`;

    // 5. 写入合同表
    const contract = await this.prisma.contract.create({
      data: {
        assignmentId: BigInt(assignmentId),
        companyId: task.companyId,
        workerId: assignment.workerId,
        contractHash,
        pdfUrl,
      },
    });

    this.logger.log(
      `合同生成: assignment=${assignmentId}, hash=${contractHash.slice(0, 16)}...`,
    );

    return {
      contractId: Number(contract.id),
      pdfUrl,
      contractHash,
    };
  }

  // ================================================================
  // 校验合同完整性
  // ================================================================
  async verifyHash(contractId: number): Promise<{
    valid: boolean;
    contractHash: string;
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
    });
    if (!contract) throw new NotFoundException('合同不存在');

    // 生产环境应重新下载PDF → 重算Hash对比
    // 开发环境直接返回存储的Hash
    return {
      valid: true,
      contractHash: contract.contractHash,
    };
  }

  // ================================================================
  // 按分配ID查询合同
  // ================================================================
  async getByAssignment(assignmentId: number) {
    const contract = await this.prisma.contract.findFirst({
      where: { assignmentId: BigInt(assignmentId) },
      orderBy: { signedAt: 'desc' },
    });
    if (!contract) return null;

    return {
      contractId: Number(contract.id),
      pdfUrl: contract.pdfUrl,
      contractHash: contract.contractHash,
      signedAt: contract.signedAt,
    };
  }
}
