/**
 * ProjectController — R2-a 项目管理 12 路由
 */
import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProjectService, CreateProjectDto, UpdateProjectDto, UpdateProjectStatusDto,
  CreateMilestoneDto, UpdateMilestoneDto, ProjectQueryDto } from './project.service';


@ApiTags('Project')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class ProjectController {
  constructor(private readonly svc: ProjectService) {}

  @Get()
  @ApiOperation({ summary: '项目列表' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: ProjectQueryDto) {
    return this.svc.getProjects(user.companyId!, query);
  }

  @Post()
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '创建项目' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProjectDto) {
    return this.svc.createProject(user.companyId!, user.userId, dto);
  }

  @Get('board')
  @Roles('super_admin', 'task_admin', 'operator')
  @ApiOperation({ summary: '看板数据' })
  board(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getBoard(user.companyId!);
  }

  @Get('stats')
  @ApiOperation({ summary: '项目统计' })
  stats(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getStats(user.companyId!);
  }

  @Get(':id')
  @ApiOperation({ summary: '项目详情' })
  detail(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getProjectById(user.companyId!, id);
  }

  @Put(':id')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '更新项目' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.svc.updateProject(user.companyId!, id, dto);
  }

  @Patch(':id/status')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '更新项目状态/阶段' })
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectStatusDto,
  ) {
    return this.svc.updateProjectStatus(user.companyId!, id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '删除项目（仅规划中/已归档）' })
  deleteProject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.deleteProject(user.companyId!, id);
  }

  // ─── Milestones ───

  @Get(':id/milestones')
  @ApiOperation({ summary: '里程碑列表' })
  milestones(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getMilestones(user.companyId!, id);
  }

  @Post(':id/milestones')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '创建里程碑' })
  createMilestone(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.svc.createMilestone(user.companyId!, id, user.userId, dto);
  }

  @Put(':id/milestones/:mid')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '更新里程碑' })
  updateMilestone(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('mid', ParseIntPipe) mid: number,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.svc.updateMilestone(user.companyId!, id, mid, dto);
  }

  @Delete(':id/milestones/:mid')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '删除里程碑' })
  deleteMilestone(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('mid', ParseIntPipe) mid: number,
  ) {
    return this.svc.deleteMilestone(user.companyId!, id, mid);
  }

  @Post(':id/milestones/:mid/complete')
  @Roles('super_admin', 'task_admin')
  @ApiOperation({ summary: '完成里程碑' })
  completeMilestone(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('mid', ParseIntPipe) mid: number,
  ) {
    return this.svc.completeMilestone(user.companyId!, id, mid);
  }
}
