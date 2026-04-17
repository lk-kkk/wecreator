import {
  Controller,
  Post,
  Get,
  Put,
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
