import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { TaskService } from '../task/task.service';
import { UpdateProgressDto, SubmitDeliverableDto } from '../task/dto';

// 企业端
@ApiTags('assignment')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Get('workers')
  @ApiOperation({ summary: '零工库列表' })
  async getWorkerPool(
    @Query('keyword') keyword?: string,
    @Query('city') city?: string,
    @Query('roleName') roleName?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.assignmentService.getWorkerPool({ keyword, city, roleName, page, pageSize });
  }

  @Post('tasks/:taskId/roles/:roleId/invite/:workerId')
  @ApiOperation({ summary: '定向邀约零工' })
  async invite(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('workerId', ParseIntPipe) workerId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assignmentService.inviteWorker(taskId, roleId, workerId, user.companyId!);
  }
}

// 零工端
@ApiTags('worker-task')
@Controller('worker/tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WorkerTaskController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly taskService: TaskService,
  ) {}

  @Get()
  @ApiOperation({ summary: '零工任务列表' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
  ) {
    return this.assignmentService.getWorkerTasks(user.userId, status);
  }

  @Post(':assignmentId/accept')
  @ApiOperation({ summary: '接受邀约' })
  async accept(
    @Param('assignmentId', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assignmentService.acceptInvite(id, user.userId);
  }

  @Post(':assignmentId/reject')
  @ApiOperation({ summary: '婉拒邀约' })
  async reject(
    @Param('assignmentId', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assignmentService.rejectInvite(id, user.userId);
  }

  // W4 — 更新进度
  @Post(':assignmentId/progress')
  @ApiOperation({ summary: '更新进度（只增不减）' })
  async updateProgress(
    @Param('assignmentId', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.taskService.updateProgress(id, user.userId, dto.progress, dto.note);
  }

  // W4 — 提交交付物
  @Post(':assignmentId/deliverables')
  @ApiOperation({ summary: '提交交付物（版本管理）' })
  async submitDeliverable(
    @Param('assignmentId', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitDeliverableDto,
  ) {
    return this.taskService.submitDeliverable(id, user.userId, dto);
  }
}
