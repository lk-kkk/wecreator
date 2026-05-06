import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  CreateTaskDto,
  UpdateDraftDto,
  SetTaskRolesDto,
  TaskQueryDto,
  ReviewDeliverableDto,
  AddAttachmentDto,
  RejectAcceptanceDto,
} from './dto';

@ApiTags('task')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @ApiOperation({ summary: '创建任务（草稿）' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.createTask(user.companyId!, user.userId, dto);
  }

  @Put(':id/draft')
  @ApiOperation({ summary: '草稿自动保存' })
  async updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.taskService.updateDraft(id, user.companyId!, dto);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: '配置角色岗位' })
  async setRoles(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetTaskRolesDto,
  ) {
    return this.taskService.setTaskRoles(id, user.companyId!, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '提交发布' })
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.publishTask(id, user.companyId!);
  }

  @Get()
  @ApiOperation({ summary: '任务列表（多维筛选）' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: TaskQueryDto,
  ) {
    return this.taskService.getTaskList(user.companyId!, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '任务详情' })
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.getTaskDetail(id, user.companyId!);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消任务' })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.cancelTask(id, user.companyId!);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务（仅草稿/已取消/已关闭）' })
  async deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.deleteTask(id, user.companyId!);
  }

  // W4 — 任务详情（含角色+交付物完整版）
  @Get(':id/full')
  @ApiOperation({ summary: '任务详情（含交付物）' })
  async detailFull(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.getTaskDetailFull(id, user.companyId!);
  }

  // W4 — 验收
  @Post(':taskId/roles/:roleId/review')
  @ApiOperation({ summary: '验收交付物（通过/退回）' })
  async review(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReviewDeliverableDto,
  ) {
    return this.taskService.reviewDeliverable(taskId, roleId, user.companyId!, dto.result, dto.reviewNote);
  }

  // ── 附件管理 ──
  @Get(':id/attachments')
  @ApiOperation({ summary: '任务附件列表' })
  async listAttachments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.getAttachments(id, user.companyId!);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: '添加任务附件（OSS上传完成后调用）' })
  async addAttachment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddAttachmentDto,
  ) {
    return this.taskService.addAttachment(id, user.companyId!, user.userId, dto);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: '删除任务附件' })
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.deleteAttachment(id, attachmentId, user.companyId!);
  }

  // ── V3.9: 任务审批（招募完成 → 进行中）──
  @Post(':id/approve')
  @ApiOperation({ summary: 'V3.9 任务审批通过' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.approveTask(id, user.companyId!);
  }

  // ── V3.9: 验收确认（验收中 → 待付款）──
  @Post(':id/accept')
  @ApiOperation({ summary: 'V3.9 验收确认' })
  async accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.acceptTask(id, user.companyId!);
  }

  // ── V3.9: 验收驳回（验收中 → 进行中）──
  @Post(':id/reject-acceptance')
  @ApiOperation({ summary: 'V3.9 验收驳回' })
  async rejectAcceptance(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RejectAcceptanceDto,
  ) {
    return this.taskService.rejectAcceptance(id, user.companyId!, dto.reason);
  }

  // ── V3.9: 任务执行过程节点 ──
  @Get(':id/execution-nodes')
  @ApiOperation({ summary: 'V3.9 任务执行过程节点列表' })
  async executionNodes(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.getExecutionNodes(id, user.companyId!);
  }
}

// ============================================================
// 公共字典接口（不需要企业身份）
// ============================================================
@ApiTags('common')
@Controller('common')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CommonController {
  constructor(private readonly taskService: TaskService) {}

  @Get('platform-roles')
  @ApiOperation({ summary: '平台角色库' })
  async getPlatformRoles() {
    return this.taskService.getPlatformRoles();
  }

  @Get('skill-tags')
  @ApiOperation({ summary: '技能标签字典' })
  async getSkillTags(@Query('category') category?: string) {
    return this.taskService.getSkillTags(category);
  }
}
