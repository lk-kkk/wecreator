/**
 * AiService — R2-b AI智能体系统
 * Schema: llm_configs + ai_agents + ai_chat_sessions + MySQL
 *
 * 修复记录:
 *   - provider枚举对齐：DTO/DB/getAdapter全部支持 deepseek/openai_compatible/custom_http
 *   - 多轮对话：session内存历史（每个sessionUuid维护 messages[]）
 *   - fetch超时：30s AbortSignal，连通测试10s
 *   - apiKey保留逻辑：不传/空/占位符时保留原有加密值
 */
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsArray,
  MaxLength, IsIn, Min, Max,
} from 'class-validator';
import { PrismaService } from '../../prisma';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { randomUUID } from 'crypto';

const logger = new Logger('AiService');

// ─── 支持的 Provider 列表（DTO + getAdapter 共用此常量）───
const SUPPORTED_PROVIDERS = [
  'openai', 'azure_openai', 'claude', 'qwen', 'zhipu',
  'deepseek', 'openai_compatible', 'custom_http', 'custom',
] as const;

// ─── DTOs ───
export class UpdateLlmConfigDto {
  @ApiProperty({ enum: SUPPORTED_PROVIDERS }) @IsIn(SUPPORTED_PROVIDERS)
  provider: string;

  @ApiPropertyOptional({ description: '留空则保留原有API Key' })
  @IsOptional() @IsString() apiKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() baseUrl?: string;
  @ApiProperty() @IsString() @MaxLength(100) defaultModel: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(128000) maxTokens?: number;
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

// ─── 多轮对话内存历史 ───
// key = sessionUuid, value = messages[]（保留最近20轮 = 40条）
const sessionHistoryCache = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
const MAX_HISTORY = 40; // 20轮 × 2

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
      apiKeyMasked: '****' + this.crypto.decrypt(config.apiKeyEncrypted).slice(-4),
    };
  }

  async updateLlmConfig(companyId: number, dto: UpdateLlmConfigDto) {
    // R9 SSRF 防护
    if (dto.baseUrl) {
      const url = dto.baseUrl.toLowerCase();
      const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '172.17.', '172.18.',
        '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
        '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.', '[::1]', '[::]'];
      if (blocked.some(b => url.includes(b))) {
        throw new BadRequestException('Base URL 不允许指向内网地址');
      }
    }

    // apiKey 处理：空值/占位符 → 保留原有加密值
    let encrypted: string;
    const newKey = dto.apiKey?.trim();
    if (newKey && newKey !== '__unchanged__') {
      encrypted = this.crypto.encrypt(newKey);
    } else {
      const existing = await this.prisma.llmConfig.findUnique({
        where: { companyId: BigInt(companyId) },
        select: { apiKeyEncrypted: true },
      });
      if (!existing) throw new BadRequestException('首次配置必须提供 API Key');
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
      // 解析常见错误码给出友好说明
      const msg: string = e.message || '';
      let friendlyError = msg;
      if (msg.includes('401')) friendlyError = 'API Key 无效或已过期（401 Unauthorized）';
      else if (msg.includes('403')) friendlyError = 'API Key 无权访问该模型（403 Forbidden）';
      else if (msg.includes('429')) friendlyError = '请求过于频繁或配额耗尽（429 Rate Limit）';
      else if (msg.includes('404')) friendlyError = '接口地址不存在，请检查 Base URL（404 Not Found）';
      else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) friendlyError = '无法连接到服务地址，请检查 Base URL';
      else if (e.name === 'AbortError' || msg.includes('aborted') || msg.toLowerCase().includes('timeout')) friendlyError = '连接超时（10秒），请检查网络或 Base URL';
      return { success: false, error: friendlyError };
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
    // 1. 获取LLM配置
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config || !config.isActive) throw new BadRequestException('LLM未配置或已禁用');

    // 2. 获取智能体
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(dto.agentId), companyId: BigInt(companyId), isActive: true },
    });
    if (!agent) throw new NotFoundException('智能体不存在或已禁用');

    // 3. 获取或创建session
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

    // 4. 读取本 session 历史消息（内存缓存，重启后丢失但不影响功能）
    const sessionKey = session.sessionUuid;
    if (!sessionHistoryCache.has(sessionKey)) {
      sessionHistoryCache.set(sessionKey, []);
    }
    const history = sessionHistoryCache.get(sessionKey)!;

    // 5. 调用LLM（携带历史 messages）
    const apiKey = this.crypto.decrypt(config.apiKeyEncrypted);
    const model = agent.modelName || config.defaultModel;
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, model);

    const aiResponse = await adapter.chatWithHistory(
      agent.systemPrompt,
      history,
      dto.message,
      Number(agent.temperature ?? config.temperature),
      config.maxTokens,
    );

    // 6. 更新内存历史（追加本轮）
    history.push({ role: 'user', content: dto.message });
    history.push({ role: 'assistant', content: aiResponse.content });
    // 超出上限则滚动丢弃最早的一轮（2条）
    while (history.length > MAX_HISTORY) history.splice(0, 2);

    // 7. 更新统计
    await Promise.all([
      this.prisma.aiChatSession.update({
        where: { id: session.id },
        data: {
          messageCount: { increment: 2 },
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

    // 8. 检测是否为完整结构化建议
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
      historyLength: history.length / 2, // 轮数
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

  /** C23: AI生成任务建议 */
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

    const result = await adapter.chatWithHistory(systemPrompt, [], prompt,
      Number(config.temperature), config.maxTokens);
    return result.content;
  }

  // ═══════ Monthly cron ═══════
  @Cron('0 0 1 * *')
  async resetMonthlyStats() {
    logger.log('🔄 重置月度AI统计...');
    await this.prisma.llmConfig.updateMany({
      data: { monthlyCallCount: 0, monthlyTokenCount: BigInt(0) },
    });
    await this.prisma.aiAgent.updateMany({ data: { monthlyCallCount: 0 } });
    logger.log('✅ 月度AI统计已重置');
  }

  // ═══════ LLM Adapter (Strategy Pattern) ═══════
  private getAdapter(provider: string, apiKey: string, baseUrl: string | null, model: string): LLMAdapter {
    const map: Record<string, () => LLMAdapter> = {
      openai:            () => new OpenAIAdapter(apiKey, baseUrl || 'https://api.openai.com/v1', model),
      azure_openai:      () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      qwen:              () => new OpenAIAdapter(apiKey, baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1', model),
      zhipu:             () => new OpenAIAdapter(apiKey, baseUrl || 'https://open.bigmodel.cn/api/paas/v4', model),
      deepseek:          () => new OpenAIAdapter(apiKey, baseUrl || 'https://api.deepseek.com/v1', model),
      openai_compatible: () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      custom_http:       () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      custom:            () => new OpenAIAdapter(apiKey, baseUrl || '', model),
      claude:            () => new ClaudeAdapter(apiKey, baseUrl || 'https://api.anthropic.com', model),
    };
    return (map[provider] || map.openai)();
  }

  private serializeAgent(a: any) {
    return {
      id: Number(a.id), name: a.name, avatarUrl: a.avatarUrl,
      description: a.description, systemPrompt: a.systemPrompt,
      modelName: a.modelName,
      temperature: a.temperature ? Number(a.temperature) : null,
      tools: a.tools, isActive: a.isActive, isPreset: a.isPreset,
      monthlyCallCount: a.monthlyCallCount, createdAt: a.createdAt,
    };
  }
}

// ═══════ Adapter Interfaces ═══════
interface LLMAdapter {
  chatWithHistory(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    temperature: number,
    maxTokens: number,
  ): Promise<{ content: string; totalTokens: number }>;
  testConnection(): Promise<{ latency: number }>;
}

/** 带超时的 fetch */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

class OpenAIAdapter implements LLMAdapter {
  constructor(private apiKey: string, private baseUrl: string, private model: string) {}

  async chatWithHistory(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    temperature: number,
    maxTokens: number,
  ) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];
    const res = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages, temperature, max_tokens: maxTokens }),
      },
      30_000,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      totalTokens: data.usage?.total_tokens || 0,
    };
  }

  async testConnection() {
    const start = Date.now();
    const res = await fetchWithTimeout(
      `${this.baseUrl}/models`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
      10_000,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`连接失败: ${res.status} ${body.slice(0, 100)}`);
    }
    return { latency: Date.now() - start };
  }
}

class ClaudeAdapter implements LLMAdapter {
  constructor(private apiKey: string, private baseUrl: string, private model: string) {}

  async chatWithHistory(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    temperature: number,
    maxTokens: number,
  ) {
    const messages = [...history, { role: 'user', content: userMessage }];
    const res = await fetchWithTimeout(
      `${this.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model, system: systemPrompt,
          messages, temperature, max_tokens: maxTokens,
        }),
      },
      30_000,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as any;
    return {
      content: data.content?.[0]?.text || '',
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  async testConnection() {
    const start = Date.now();
    const res = await fetchWithTimeout(
      `${this.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5,
        }),
      },
      10_000,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`连接失败: ${res.status} ${body.slice(0, 100)}`);
    }
    return { latency: Date.now() - start };
  }
}
