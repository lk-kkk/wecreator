/**
 * IssueService — R2 问题上报（Sprint 4 · V3.7）
 * Schema: task_issues (13字段, 4状态: open→in_progress→resolved→closed)
 * SLA: 首次响应 ≤24h, 超时标记 sla_breached
 */
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsArray, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma';
import { CompanyNotificationService } from '../notification/company-notification.service';

export class CreateIssueDto {
  @ApiProperty() @IsString() @MaxLength(100) title: string;
  @ApiProperty() @IsIn(['requirement_unclear', 'technical_block', 'resource_missing', 'other']) type: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class UpdateIssueDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['open', 'in_progress', 'resolved', 'closed']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() response?: string; // 回复内容
}

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: CompanyNotificationService,
  ) {}

  async list(taskId: number) {
    const items = await this.prisma.taskIssue.findMany({
      where: { taskId: BigInt(taskId) },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(i => this.serialize(i));
  }

  async create(taskId: number, reporterType: string, reporterId: number, dto: CreateIssueDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(taskId) },
      select: { id: true, title: true, companyId: true, createdBy: true, projectId: true },
    });
    if (!task) throw new NotFoundException('任务不存在');

    const issue = await this.prisma.taskIssue.create({
      data: {
        taskId: BigInt(taskId),
        reporterType: reporterType as any,
        reporterId: BigInt(reporterId),
        title: dto.title,
        type: dto.type as any,
        description: dto.description.replace(/<[^>]*>/g, ''), // XSS防护
        attachments: dto.attachments || [],
      },
    });

    // V3.7 — 通知企业 PM（任务创建人 + 项目负责人）
    const recipientIds = new Set<number>();
    recipientIds.add(Number(task.createdBy));
    if (task.projectId) {
      const proj = await this.prisma.project.findUnique({
        where: { id: task.projectId },
        select: { managerId: true },
      });
      if (proj) recipientIds.add(Number(proj.managerId));
    }
    if (recipientIds.size > 0) {
      await this.notify.createMany([...recipientIds], {
        companyId: Number(task.companyId),
        type: 'issue_report',
        title: `新的问题上报：${dto.title}`,
        content: `任务《${task.title}》有新的阻塞问题，类型: ${dto.type}`,
        refType: 'issue',
        refId: Number(issue.id),
      });
    }

    return { issueId: Number(issue.id) };
  }

  async update(issueId: number, dto: UpdateIssueDto) {
    const issue = await this.prisma.taskIssue.findUnique({ where: { id: BigInt(issueId) } });
    if (!issue) throw new NotFoundException('问题不存在');

    const data: any = {};
    if (dto.status) {
      data.status = dto.status;
      // 首次响应记录
      if (dto.status === 'in_progress' && !issue.firstResponseAt) {
        data.firstResponseAt = new Date();
      }
      if (dto.status === 'resolved') {
        data.resolvedAt = new Date();
      }
    }

    await this.prisma.taskIssue.update({ where: { id: BigInt(issueId) }, data });
    return { issueId, status: dto.status ?? issue.status };
  }

  /** SLA检查(被cron调用): 超24h未响应→标记breached */
  async checkSla() {
    const threshold = new Date(Date.now() - 24 * 3600 * 1000);
    const result = await this.prisma.taskIssue.updateMany({
      where: {
        status: 'open',
        firstResponseAt: null,
        slaBreached: false,
        createdAt: { lt: threshold },
      },
      data: { slaBreached: true },
    });
    return result.count;
  }

  private serialize(i: any) {
    return {
      id: Number(i.id), taskId: Number(i.taskId),
      reporterType: i.reporterType, reporterId: Number(i.reporterId),
      title: i.title, type: i.type, description: i.description,
      attachments: i.attachments, status: i.status,
      firstResponseAt: i.firstResponseAt, resolvedAt: i.resolvedAt,
      slaBreached: i.slaBreached, createdAt: i.createdAt,
    };
  }
}
