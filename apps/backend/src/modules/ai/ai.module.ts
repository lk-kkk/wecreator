/**
 * AiModule — R2-b AI智能体系统（Sprint 3）
 *
 * API 清单（~11个）:
 *   GET    /company/llm-config          — 获取LLM配置
 *   PUT    /company/llm-config          — 更新LLM配置
 *   POST   /company/llm-config/test     — 测试LLM连接
 *   GET    /company/agents              — 智能体列表
 *   POST   /company/agents              — 创建智能体
 *   PUT    /company/agents/:id          — 更新智能体
 *   DELETE /company/agents/:id          — 删除智能体
 *   PATCH  /company/agents/:id/toggle   — 启停智能体
 *   POST   /ai/chat                     — AI对话
 *   GET    /ai/sessions                 — 对话历史列表
 *   GET    /ai/sessions/:id/messages    — 对话消息记录
 */
import { Module } from '@nestjs/common';
import { AiController, LlmConfigController } from './ai.controller';
import { AiService } from './ai.service';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Module({
  controllers: [AiController, LlmConfigController],
  providers: [AiService, CryptoUtil],
  exports: [AiService],
})
export class AiModule {}
