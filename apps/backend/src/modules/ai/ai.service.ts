/**
 * AiService — R2-b AI智能体系统
 * Schema: llm_configs + ai_agents + ai_chat_sessions + MongoDB(ai_chat_messages)
 *
 * LLM Adapter架构（Strategy Pattern）:
 *   OpenAI / Claude / Azure / Qwen / OpenAI-Compatible / Custom HTTP
 */
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsArray,
  MaxLength, IsIn, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { randomUUID } from 'crypto';

const logger = new Logger('AiService');

// ─── DTOs ───
export class UpdateLlmConfigDto {
  @ApiProperty() @IsIn(['openai', 'azure_openai', 'claude', 'qwen', 'zhipu', 'openai_compatible', 'custom_http'])
  provider: string;
  @ApiPropertyOptional({ description: '留空则保留原有API Key' }) @IsOptional() @IsString() apiKey?: string; // 明文，入库前AES加密；不传则保留原有加密值
  @ApiPropertyOptional() @IsOptional() @IsString() baseUrl?: string;
  @ApiProperty() @IsString() @MaxLength(100) defaultModel: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(128000) maxTokens?: number;
  // Custom HTTP fields
  @ApiPropertyOptional() @IsOptional() @IsIn(['openai_compatible', 'custom_http']) customProtocol?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customChatUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['bearer', 'header', 'query', 'none']) customAuthType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customAuthHeader?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customRequestTemplate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customResponsePath?: string;
}

export class CreateAgentDto {
  @ApiProperty() @IsString() @MaxLength(40) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiProperty() @IsString() @MaxLength(200) description: string;
  @ApiProperty() @IsString() @MaxLength(10000) systemPrompt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modelName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() tools?: string[];
}

export class UpdateAgentDto extends CreateAgentDto {}

export class ChatDto {
  @ApiProperty() @IsNumber() agentId: number;
  @ApiProperty() @IsString() @MaxLength(2000) message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionUuid?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() taskDraftId?: number;
}

// ─── Service ───
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoUtil,
  ) {}

  // ═══════ LLM Config ═══════

  async getLlmConfig(companyId: number) {
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config) return null;
    return {
      id: Number(config.id),
      provider: config.provider,
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
      temperature: Number(config.temperature),
      maxTokens: config.maxTokens,
      customProtocol: config.customProtocol,
      customChatUrl: config.customChatUrl,
      customAuthType: config.customAuthType,
      customAuthHeader: config.customAuthHeader,
      customRequestTemplate: config.customRequestTemplate,
      customResponsePath: config.customResponsePath,
      isActive: config.isActive,
      monthlyCallCount: config.monthlyCallCount,
      monthlyTokenCount: Number(config.monthlyTokenCount),
      updatedAt: config.updatedAt,
      // apiKey masked
      apiKeyMasked: '****' + this.crypto.decrypt(config.apiKeyEncrypted).slice(-4),
    };
  }

  async updateLlmConfig(companyId: number, dto: UpdateLlmConfigDto) {
    // R9 SSRF 防护：禁止内网地址作为 LLM baseUrl
    if (dto.baseUrl) {
      const url = dto.baseUrl.toLowerCase();
      const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '172.17.', '172.18.',
        '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
        '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.', '[::1]', '[::]'];
      if (blocked.some(b => url.includes(b))) {
        throw new BadRequestException('Base URL 不允许指向内网地址');
      }
    }
    // 当 apiKey 为空或特殊占位符时，保留原有加密值（更新配置时不强制重填key）
    let encrypted: string | undefined;
    if (dto.apiKey && dto.apiKey !== '__unchanged__' && dto.apiKey.trim().length > 0) {
      encrypted = this.crypto.encrypt(dto.apiKey);
    } else {
      // 查询现有配置保留旧key
      const existing = await this.prisma.llmConfig.findUnique({
        where: { companyId: BigInt(companyId) },
        select: { apiKeyEncrypted: true },
      });
      if (!existing) {
        throw new BadRequestException('首次配置必须提供 API Key');
      }
      encrypted = existing.apiKeyEncrypted;
    }
    const data: any = {
      provider: dto.provider,
      apiKeyEncrypted: encrypted,
      defaultModel: dto.defaultModel,
      baseUrl: dto.baseUrl || null,
      temperature: dto.temperature ?? 0.7,
      maxTokens: dto.maxTokens ?? 4096,
      customProtocol: dto.customProtocol || null,
      customChatUrl: dto.customChatUrl || null,
      customAuthType: dto.customAuthType || null,
      customAuthHeader: dto.customAuthHeader || null,
      customRequestTemplate: dto.customRequestTemplate || null,
      customResponsePath: dto.customResponsePath || null,
    };

    const config = await this.prisma.llmConfig.upsert({
      where: { companyId: BigInt(companyId) },
      create: { companyId: BigInt(companyId), ...data },
      update: data,
    });
    return { configId: Number(config.id), provider: config.provider };
  }

  async testLlmConnection(companyId: number) {
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config) throw new BadRequestException('请先配置LLM');

    const apiKey = this.crypto.decrypt(config.apiKeyEncrypted);
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, config.defaultModel);

    try {
      const result = await adapter.testConnection();
      return { success: true, model: config.defaultModel, latency: result.latency };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ═══════ Agents ═══════

  async getAgents(companyId: number) {
    const list = await this.prisma.aiAgent.findMany({
      where: { companyId: BigInt(companyId) },
      orderBy: { createdAt: 'desc' },
    });
    return list.map(a => this.serializeAgent(a));
  }

  async createAgent(companyId: number, userId: number, dto: CreateAgentDto) {
    const count = await this.prisma.aiAgent.count({ where: { companyId: BigInt(companyId) } });
    if (count >= 20) throw new BadRequestException('智能体数量已达上限(20)');

    const agent = await this.prisma.aiAgent.create({
      data: {
        companyId: BigInt(companyId),
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        modelName: dto.modelName,
        temperature: dto.temperature,
        tools: dto.tools || [],
        createdBy: BigInt(userId),
      },
    });
    return { agentId: Number(agent.id) };
  }

  async updateAgent(companyId: number, agentId: number, dto: UpdateAgentDto) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(agentId), companyId: BigInt(companyId) },
    });
    if (!agent) throw new NotFoundException('智能体不存在');

    await this.prisma.aiAgent.update({
      where: { id: BigInt(agentId) },
      data: {
        name: dto.name, description: dto.description, systemPrompt: dto.systemPrompt,
        avatarUrl: dto.avatarUrl, modelName: dto.modelName, temperature: dto.temperature,
        tools: dto.tools ?? undefined,
      },
    });
    return { agentId };
  }

  async deleteAgent(companyId: number, agentId: number) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(agentId), companyId: BigInt(companyId) },
    });
    if (!agent) throw new NotFoundException('智能体不存在');
    if (agent.isPreset) throw new BadRequestException('预设智能体不可删除');

    await this.prisma.aiAgent.delete({ where: { id: BigInt(agentId) } });
    return { deleted: true };
  }

  async toggleAgent(companyId: number, agentId: number) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(agentId), companyId: BigInt(companyId) },
    });
    if (!agent) throw new NotFoundException('智能体不存在');

    const updated = await this.prisma.aiAgent.update({
      where: { id: BigInt(agentId) },
      data: { isActive: !agent.isActive },
    });
    return { agentId, isActive: updated.isActive };
  }

  // ═══════ AI Chat ═══════

  async chat(companyId: number, userId: number, dto: ChatDto) {
    // 获取LLM配置
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config || !config.isActive) throw new BadRequestException('LLM未配置或已禁用');

    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(dto.agentId), companyId: BigInt(companyId), isActive: true },
    });
    if (!agent) throw new NotFoundException('智能体不存在或已禁用');

    // 获取或创建session
    let session: any;
    if (dto.sessionUuid) {
      session = await this.prisma.aiChatSession.findUnique({
        where: { sessionUuid: dto.sessionUuid },
      });
      if (!session || Number(session.companyId) !== companyId)
        throw new NotFoundException('会话不存在');
    } else {
      session = await this.prisma.aiChatSession.create({
        data: {
          sessionUuid: randomUUID(),
          companyId: BigInt(companyId),
          userId: BigInt(userId),
          agentId: BigInt(dto.agentId),
          taskDraftId: dto.taskDraftId ? BigInt(dto.taskDraftId) : null,
        },
      });
    }

    // 调用LLM
    const apiKey = this.crypto.decrypt(config.apiKeyEncrypted);
    const model = agent.modelName || config.defaultModel;
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, model);

    const aiResponse = await adapter.chat(agent.systemPrompt, dto.message,
      Number(agent.temperature ?? config.temperature),
      config.maxTokens);

    // 更新统计
    await Promise.all([
      this.prisma.aiChatSession.update({
        where: { id: session.id },
        data: {
          messageCount: { increment: 2 }, // user + assistant
          totalTokens: { increment: BigInt(aiResponse.totalTokens || 0) },
        },
      }),
      this.prisma.llmConfig.update({
        where: { id: config.id },
        data: {
          monthlyCallCount: { increment: 1 },
          monthlyTokenCount: { increment: BigInt(aiResponse.totalTokens || 0) },
        },
      }),
    ]);

    // 检测响应是否含完整结构化JSON
    let isComplete = false;
    try {
      const parsed = JSON.parse(aiResponse.content);
      if (parsed && typeof parsed === 'object' && parsed.title) isComplete = true;
    } catch {
      const match = aiResponse.content.match(/```json\n?([\s\S]+?)\n?```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && typeof parsed === 'object' && parsed.title) isComplete = true;
        } catch { /* noop */ }
      }
    }

    return {
      sessionUuid: session.sessionUuid,
      response: aiResponse.content,
      isComplete,
      model,
      tokensUsed: aiResponse.totalTokens || 0,
    };
  }

  async getChatSessions(companyId: number, userId: number) {
    const list = await this.prisma.aiChatSession.findMany({
      where: { companyId: BigInt(companyId), userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { agent: { select: { name: true, avatarUrl: true } } },
    });
    return list.map(s => ({
      id: Number(s.id),
      sessionUuid: s.sessionUuid,
      agentName: (s as any).agent?.name,
      agentAvatar: (s as any).agent?.avatarUrl,
      messageCount: s.messageCount,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /** C23: AI生成任务建议（被R2调用） */
  async generateTaskSuggestion(companyId: number, prompt: string) {
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config || !config.isActive) return null;

    const apiKey = this.crypto.decrypt(config.apiKeyEncrypted);
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, config.defaultModel);

    const systemPrompt = `你是WeCreator任务规划顾问。根据用户描述，输出JSON格式的任务建议：
{
  "title": "任务标题",
  "description": "任务描述",
  "taskMode": "task_package|daily_rate",
  "suggestedRoles": [{"roleName":"角色名","headcount":1,"budget":10000,"skillTags":"标签1,标签2"}],
  "estimatedDays": 7,
  "tips": "执行建议"
}
只输出JSON，不加其他说明。`;

    const result = await adapter.chat(systemPrompt, prompt,
      Number(config.temperature), config.maxTokens);
    return result.content;
  }

  // ═══════ Monthly cron ═══════
  @Cron('0 0 1 * *') // 每月1日00:00
  async resetMonthlyStats() {
    logger.log('🔄 重置月度AI统计...');
    await this.prisma.llmConfig.updateMany({
      data: { monthlyCallCount: 0, monthlyTokenCount: BigInt(0) },
    });
    await this.prisma.aiAgent.updateMany({
      data: { monthlyCallCount: 0 },
    });
    logger.log('✅ 月度AI统计已重置');
  }

  // ═══════ LLM Adapter (Strategy Pattern) ═══════
  private getAdapter(provider: string, apiKey: string, baseUrl: string | null, model: string): LLMAdapter {
    const providerMap: Record<string, () => LLMAdapter> = {
      openai: () => new OpenAIAdapter(apiKey, baseUrl || 'https://api.openai.com/v1', model),
      claude: () => new ClaudeAdapter(apiKey, baseUrl || 'https://api.anthropic.com', model),
      azure_openai: () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      qwen: () => new OpenAIAdapter(apiKey, baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1', model),
      zhipu: () => new OpenAIAdapter(apiKey, baseUrl || 'https://open.bigmodel.cn/api/paas/v4', model),
      openai_compatible: () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      custom_http: () => new OpenAIAdapter(apiKey, baseUrl || '', model), // fallback
    };
    return (providerMap[provider] || providerMap.openai)();
  }

  private serializeAgent(a: any) {
    return {
      id: Number(a.id),
      name: a.name,
      avatarUrl: a.avatarUrl,
      description: a.description,
      systemPrompt: a.systemPrompt,
      modelName: a.modelName,
      temperature: a.temperature ? Number(a.temperature) : null,
      tools: a.tools,
      isActive: a.isActive,
      isPreset: a.isPreset,
      monthlyCallCount: a.monthlyCallCount,
      createdAt: a.createdAt,
    };
  }
}

// ═══════ Adapter Interfaces ═══════
interface LLMAdapter {
  chat(systemPrompt: string, userMessage: string, temperature: number, maxTokens: number):
    Promise<{ content: string; totalTokens: number }>;
  testConnection(): Promise<{ latency: number }>;
}

class OpenAIAdapter implements LLMAdapter {
  constructor(private apiKey: string, private baseUrl: string, private model: string) {}

  async chat(systemPrompt: string, userMessage: string, temperature: number, maxTokens: number) {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature, max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`LLM API ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      totalTokens: data.usage?.total_tokens || 0,
    };
  }

  async testConnection() {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`连接失败: ${res.status}`);
    return { latency: Date.now() - start };
  }
}

class ClaudeAdapter implements LLMAdapter {
  constructor(private apiKey: string, private baseUrl: string, private model: string) {}

  async chat(systemPrompt: string, userMessage: string, temperature: number, maxTokens: number) {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature, max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    return {
      content: data.content?.[0]?.text || '',
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  async testConnection() {
    const start = Date.now();
    // Claude没有/models端点，用轻量消息测试
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5,
      }),
    });
    if (!res.ok) throw new Error(`连接失败: ${res.status}`);
    return { latency: Date.now() - start };
  }
}
