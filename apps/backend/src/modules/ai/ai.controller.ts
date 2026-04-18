/**
 * AiController + LlmConfigController — R2-b 11 路由
 * LlmConfig 限 super_admin
 */
import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
  UseGuards, ParseIntPipe, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AiService, UpdateLlmConfigDto, CreateAgentDto, UpdateAgentDto, ChatDto } from './ai.service';


function requireSuperAdmin(user: CurrentUserPayload) {
  if (user.role !== 'super_admin') throw new ForbiddenException('仅超级管理员可操作');
}

@ApiTags('LLM Config')
@Controller('company/llm-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class LlmConfigController {
  constructor(private readonly svc: AiService) {}

  @Get()
  @ApiOperation({ summary: '获取LLM配置' })
  get(@CurrentUser() user: CurrentUserPayload) {
    requireSuperAdmin(user);
    return this.svc.getLlmConfig(user.companyId!);
  }

  @Put()
  @ApiOperation({ summary: '更新LLM配置' })
  update(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateLlmConfigDto) {
    requireSuperAdmin(user);
    return this.svc.updateLlmConfig(user.companyId!, dto);
  }

  @Post('test')
  @ApiOperation({ summary: '测试LLM连接' })
  test(@CurrentUser() user: CurrentUserPayload) {
    requireSuperAdmin(user);
    return this.svc.testLlmConnection(user.companyId!);
  }
}

@ApiTags('AI Agents & Chat')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AiController {
  constructor(private readonly svc: AiService) {}

  // ─── Agents ───
  @Get('company/agents')
  @ApiOperation({ summary: '智能体列表' })
  listAgents(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getAgents(user.companyId!);
  }

  @Post('company/agents')
  @ApiOperation({ summary: '创建智能体' })
  createAgent(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateAgentDto) {
    requireSuperAdmin(user);
    return this.svc.createAgent(user.companyId!, user.userId, dto);
  }

  @Put('company/agents/:id')
  @ApiOperation({ summary: '更新智能体' })
  updateAgent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
  ) {
    requireSuperAdmin(user);
    return this.svc.updateAgent(user.companyId!, id, dto);
  }

  @Delete('company/agents/:id')
  @ApiOperation({ summary: '删除智能体' })
  deleteAgent(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseIntPipe) id: number) {
    requireSuperAdmin(user);
    return this.svc.deleteAgent(user.companyId!, id);
  }

  @Patch('company/agents/:id/toggle')
  @ApiOperation({ summary: '启停智能体' })
  toggleAgent(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseIntPipe) id: number) {
    requireSuperAdmin(user);
    return this.svc.toggleAgent(user.companyId!, id);
  }

  // ─── Chat ───
  @Post('ai/chat')
  @ApiOperation({ summary: 'AI对话' })
  chat(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChatDto) {
    return this.svc.chat(user.companyId!, user.userId, dto);
  }

  @Get('ai/sessions')
  @ApiOperation({ summary: '对话历史' })
  sessions(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getChatSessions(user.companyId!, user.userId);
  }
}
