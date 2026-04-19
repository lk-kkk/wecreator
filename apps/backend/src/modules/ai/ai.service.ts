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
  IsString, IsOptional, IsNumber, IsArray, IsBoolean,
  MaxLength, IsIn, Min, Max,
} from 'class-validator';
import { PrismaService } from '../../prisma';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { randomUUID } from 'crypto';
import * as https from 'https';

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
  // Custom HTTP
  @ApiPropertyOptional() @IsOptional() @IsIn(['openai_compatible', 'custom_http']) customProtocol?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customChatUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['bearer', 'header', 'query', 'none']) customAuthType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customAuthHeader?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customRequestTemplate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customResponsePath?: string;
  @ApiPropertyOptional({ description: 'JSON 格式的额外请求头，如 {"X-Custom":"val"}' })
  @IsOptional() @IsString() customHeaders?: string;  // JSON 字符串，前端传 JSON.stringify({})
  @ApiPropertyOptional({ description: '跳过 TLS 证书验证（适用于自签名证书/内网部署）' })
  @IsOptional() @IsBoolean() allowInsecureHttps?: boolean;
}

export class CreateAgentDto {
  @ApiProperty() @IsString() @MaxLength(40) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiProperty() @IsString() @MaxLength(200) description: string;
  @ApiProperty() @IsString() @MaxLength(10000) systemPrompt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modelName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() presetId?: number;  // 关联的模型预设 ID
  @ApiPropertyOptional() @IsOptional() @IsArray() tools?: string[];
}

export class UpdateAgentDto extends CreateAgentDto {}

export class CreateModelPresetDto {
  @ApiProperty({ description: '预设展示名称' }) @IsString() @MaxLength(60) displayName: string;
  @ApiProperty({ enum: SUPPORTED_PROVIDERS }) @IsIn(SUPPORTED_PROVIDERS) provider: string;
  @ApiProperty({ description: 'API Key（入库前加密）' }) @IsString() apiKey: string;
  @ApiProperty({ description: '模型名称' }) @IsString() @MaxLength(100) modelName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() baseUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(128000) maxTokens?: number;
  // Custom HTTP
  @ApiPropertyOptional() @IsOptional() @IsIn(['openai_compatible', 'custom_http']) customProtocol?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customChatUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['bearer', 'header', 'query', 'none']) customAuthType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customAuthHeader?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customRequestTemplate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customResponsePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customHeaders?: string;
  @ApiPropertyOptional({ description: '跳过 TLS 证书验证（适用于自签名证书/内网部署）' })
  @IsOptional() @IsBoolean() allowInsecureHttps?: boolean;
}

export class UpdateModelPresetDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) displayName?: string;
  @ApiPropertyOptional({ enum: SUPPORTED_PROVIDERS }) @IsOptional() @IsIn(SUPPORTED_PROVIDERS) provider?: string;
  @ApiPropertyOptional({ description: '留空则保留原有Key' }) @IsOptional() @IsString() apiKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) modelName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() baseUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(128000) maxTokens?: number;
  // Custom HTTP
  @ApiPropertyOptional() @IsOptional() @IsIn(['openai_compatible', 'custom_http']) customProtocol?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customChatUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['bearer', 'header', 'query', 'none']) customAuthType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customAuthHeader?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customRequestTemplate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customResponsePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customHeaders?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowInsecureHttps?: boolean;
}

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
      customHeaders: config.customHeaders,
      allowInsecureHttps: config.allowInsecureHttps,
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
      customHeaders: dto.customHeaders ? (() => { try { return JSON.parse(dto.customHeaders!); } catch { return null; } })() : null,
      allowInsecureHttps: dto.allowInsecureHttps ?? false,
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
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, config.defaultModel, config as any);

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
      include: { preset: true },
    });
    return list.map(a => this.serializeAgent(a));
  }

  async createAgent(companyId: number, userId: number, dto: CreateAgentDto) {
    const count = await this.prisma.aiAgent.count({ where: { companyId: BigInt(companyId) } });
    if (count >= 20) throw new BadRequestException('智能体数量已达上限(20)');

    // 如果指定了 presetId，验证预设属于该公司
    if (dto.presetId) {
      const preset = await this.prisma.llmModelPreset.findFirst({
        where: { id: BigInt(dto.presetId), companyId: BigInt(companyId), isActive: true },
      });
      if (!preset) throw new NotFoundException('模型预设不存在或已停用');
    }

    const agent = await this.prisma.aiAgent.create({
      data: {
        companyId: BigInt(companyId),
        name: dto.name, avatarUrl: dto.avatarUrl,
        description: dto.description, systemPrompt: dto.systemPrompt,
        modelName: dto.modelName, temperature: dto.temperature,
        presetId: dto.presetId ? BigInt(dto.presetId) : null,
        tools: dto.tools || [], createdBy: BigInt(userId),
      },
    });
    return { agentId: Number(agent.id) };
  }

  async updateAgent(companyId: number, agentId: number, dto: UpdateAgentDto) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(agentId), companyId: BigInt(companyId) },
    });
    if (!agent) throw new NotFoundException('智能体不存在');

    if (dto.presetId) {
      const preset = await this.prisma.llmModelPreset.findFirst({
        where: { id: BigInt(dto.presetId), companyId: BigInt(companyId), isActive: true },
      });
      if (!preset) throw new NotFoundException('模型预设不存在或已停用');
    }

    await this.prisma.aiAgent.update({
      where: { id: BigInt(agentId) },
      data: {
        name: dto.name, description: dto.description, systemPrompt: dto.systemPrompt,
        avatarUrl: dto.avatarUrl, modelName: dto.modelName, temperature: dto.temperature,
        presetId: dto.presetId !== undefined ? (dto.presetId ? BigInt(dto.presetId) : null) : undefined,
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

  // ═══════ Model Presets ═══════

  async getModelPresets(companyId: number) {
    const list = await this.prisma.llmModelPreset.findMany({
      where: { companyId: BigInt(companyId) },
      orderBy: { createdAt: 'asc' },
    });
    return list.map(p => this.serializePreset(p));
  }

  async createModelPreset(companyId: number, dto: CreateModelPresetDto) {
    const count = await this.prisma.llmModelPreset.count({ where: { companyId: BigInt(companyId) } });
    if (count >= 20) throw new BadRequestException('模型预设数量已达上限(20)');

    const preset = await this.prisma.llmModelPreset.create({
      data: {
        companyId: BigInt(companyId),
        displayName: dto.displayName,
        provider: dto.provider as any,
        apiKeyEncrypted: this.crypto.encrypt(dto.apiKey),
        modelName: dto.modelName,
        baseUrl: dto.baseUrl || null,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 4096,
        customProtocol: (dto.customProtocol as any) || null,
        customChatUrl: dto.customChatUrl || null,
        customAuthType: (dto.customAuthType as any) || null,
        customAuthHeader: dto.customAuthHeader || null,
        customRequestTemplate: dto.customRequestTemplate || null,
        customResponsePath: dto.customResponsePath || null,
        customHeaders: dto.customHeaders ? (() => { try { return JSON.parse(dto.customHeaders!); } catch { return null; } })() : null,
        allowInsecureHttps: dto.allowInsecureHttps ?? false,
      },
    });
    return { presetId: Number(preset.id), displayName: preset.displayName };
  }

  async updateModelPreset(companyId: number, presetId: number, dto: UpdateModelPresetDto) {
    const preset = await this.prisma.llmModelPreset.findFirst({
      where: { id: BigInt(presetId), companyId: BigInt(companyId) },
    });
    if (!preset) throw new NotFoundException('预设不存在');

    const newKey = dto.apiKey?.trim();
    const encrypted = (newKey && newKey !== '__unchanged__')
      ? this.crypto.encrypt(newKey)
      : preset.apiKeyEncrypted;

    await this.prisma.llmModelPreset.update({
      where: { id: BigInt(presetId) },
      data: {
        displayName: dto.displayName ?? preset.displayName,
        provider: (dto.provider as any) ?? preset.provider,
        apiKeyEncrypted: encrypted,
        modelName: dto.modelName ?? preset.modelName,
        baseUrl: dto.baseUrl !== undefined ? (dto.baseUrl || null) : preset.baseUrl,
        temperature: dto.temperature ?? preset.temperature,
        maxTokens: dto.maxTokens ?? preset.maxTokens,
        customProtocol: dto.customProtocol !== undefined ? ((dto.customProtocol as any) || null) : preset.customProtocol,
        customChatUrl: dto.customChatUrl !== undefined ? (dto.customChatUrl || null) : preset.customChatUrl,
        customAuthType: dto.customAuthType !== undefined ? ((dto.customAuthType as any) || null) : preset.customAuthType,
        customAuthHeader: dto.customAuthHeader !== undefined ? (dto.customAuthHeader || null) : preset.customAuthHeader,
        customRequestTemplate: dto.customRequestTemplate !== undefined ? (dto.customRequestTemplate || null) : preset.customRequestTemplate,
        customResponsePath: dto.customResponsePath !== undefined ? (dto.customResponsePath || null) : preset.customResponsePath,
        customHeaders: dto.customHeaders !== undefined
          ? (dto.customHeaders ? (() => { try { return JSON.parse(dto.customHeaders!); } catch { return null; } })() : null)
          : preset.customHeaders,
        allowInsecureHttps: dto.allowInsecureHttps !== undefined ? dto.allowInsecureHttps : preset.allowInsecureHttps,
      },
    });
    return { presetId };
  }

  async deleteModelPreset(companyId: number, presetId: number) {
    const preset = await this.prisma.llmModelPreset.findFirst({
      where: { id: BigInt(presetId), companyId: BigInt(companyId) },
    });
    if (!preset) throw new NotFoundException('预设不存在');

    // 检查是否有智能体正在使用
    const inUse = await this.prisma.aiAgent.count({
      where: { presetId: BigInt(presetId), companyId: BigInt(companyId) },
    });
    if (inUse > 0) throw new BadRequestException(`有 ${inUse} 个智能体正在使用此预设，请先更改其使用的模型`);

    await this.prisma.llmModelPreset.delete({ where: { id: BigInt(presetId) } });
    return { deleted: true };
  }

  async testModelPreset(companyId: number, presetId: number) {
    const preset = await this.prisma.llmModelPreset.findFirst({
      where: { id: BigInt(presetId), companyId: BigInt(companyId) },
    });
    if (!preset) throw new NotFoundException('预设不存在');

    const apiKey = this.crypto.decrypt(preset.apiKeyEncrypted);
    const adapter = this.getAdapter(preset.provider, apiKey, preset.baseUrl, preset.modelName, preset as any);

    try {
      const result = await adapter.testConnection();
      return { success: true, model: preset.modelName, latency: result.latency };
    } catch (e: any) {
      const msg = e.message || '';
      let friendlyError = msg;
      if (msg.includes('401')) friendlyError = 'API Key 无效或已过期（401）';
      else if (msg.includes('403')) friendlyError = '无权访问该模型（403）';
      else if (msg.includes('429')) friendlyError = '配额耗尽（429）';
      else if (msg.includes('404')) friendlyError = 'Base URL 地址错误（404）';
      else if (e.name === 'AbortError' || msg.includes('aborted')) friendlyError = '连接超时（10秒）';
      return { success: false, error: friendlyError };
    }
  }

  private serializePreset(p: any) {
    return {
      id: Number(p.id),
      displayName: p.displayName,
      provider: p.provider,
      modelName: p.modelName,
      baseUrl: p.baseUrl,
      temperature: Number(p.temperature),
      maxTokens: p.maxTokens,
      isActive: p.isActive,
      apiKeyMasked: '****' + this.crypto.decrypt(p.apiKeyEncrypted).slice(-4),
      // Custom HTTP
      customProtocol: p.customProtocol,
      customChatUrl: p.customChatUrl,
      customAuthType: p.customAuthType,
      customAuthHeader: p.customAuthHeader,
      customRequestTemplate: p.customRequestTemplate,
      customResponsePath: p.customResponsePath,
      customHeaders: p.customHeaders,
      allowInsecureHttps: p.allowInsecureHttps,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  // ═══════ Model Preset Stats ═══════

  async getModelPresetStats(companyId: number, presetId: number) {
    const preset = await this.prisma.llmModelPreset.findFirst({
      where: { id: BigInt(presetId), companyId: BigInt(companyId) },
      include: { agents: { select: { id: true, name: true, monthlyCallCount: true } } },
    });
    if (!preset) throw new NotFoundException('模型预设不存在');

    // Aggregate chat sessions through agents bound to this preset
    const agentIds = preset.agents.map(a => a.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalSessions = 0;
    let totalMessages = 0;
    let totalTokens = BigInt(0);
    let monthlySessions = 0;
    let monthlyMessages = 0;
    let monthlyTokens = BigInt(0);

    if (agentIds.length > 0) {
      const allTimeAgg = await this.prisma.aiChatSession.aggregate({
        where: { agentId: { in: agentIds } },
        _count: { id: true },
        _sum: { messageCount: true, totalTokens: true },
      });
      totalSessions = allTimeAgg._count.id || 0;
      totalMessages = allTimeAgg._sum.messageCount || 0;
      totalTokens = allTimeAgg._sum.totalTokens || BigInt(0);

      const monthAgg = await this.prisma.aiChatSession.aggregate({
        where: { agentId: { in: agentIds }, createdAt: { gte: monthStart } },
        _count: { id: true },
        _sum: { messageCount: true, totalTokens: true },
      });
      monthlySessions = monthAgg._count.id || 0;
      monthlyMessages = monthAgg._sum.messageCount || 0;
      monthlyTokens = monthAgg._sum.totalTokens || BigInt(0);
    }

    return {
      presetId: Number(preset.id),
      displayName: preset.displayName,
      modelName: preset.modelName,
      provider: preset.provider,
      boundAgents: preset.agents.map(a => ({
        id: Number(a.id), name: a.name, monthlyCallCount: a.monthlyCallCount,
      })),
      allTime: {
        sessions: totalSessions,
        messages: totalMessages,
        tokens: Number(totalTokens),
      },
      thisMonth: {
        sessions: monthlySessions,
        messages: monthlyMessages,
        tokens: Number(monthlyTokens),
      },
      createdAt: preset.createdAt,
    };
  }

  // ═══════ AI Chat ═══════

  async chat(companyId: number, userId: number, dto: ChatDto) {
    // 1. 获取LLM配置
    const config = await this.prisma.llmConfig.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    if (!config || !config.isActive) throw new BadRequestException('LLM未配置或已禁用');

    // 2. 获取智能体（include 绑定的 preset）
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id: BigInt(dto.agentId), companyId: BigInt(companyId), isActive: true },
      include: { preset: true },
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

    // 5. 调用LLM — 优先使用智能体绑定 preset 的 key/model，否则回退到全局 config
    const presetData = (agent as any).preset;
    const apiKey = presetData
      ? this.crypto.decrypt(presetData.apiKeyEncrypted)
      : this.crypto.decrypt(config.apiKeyEncrypted);
    const model = agent.modelName || presetData?.modelName || config.defaultModel;
    const provider = presetData?.provider || config.provider;
    const baseUrl = presetData?.baseUrl ?? config.baseUrl;
    // 合并 preset 或 config 的 custom 字段
    const adapterConfig = presetData ?? config;
    const adapter = this.getAdapter(provider, apiKey, baseUrl, model, adapterConfig as any);

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
    const adapter = this.getAdapter(config.provider, apiKey, config.baseUrl, config.defaultModel, config as any);

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
  /**
   * 根据 provider 创建对应的 LLM 适配器
   * configObj: 包含 customChatUrl / customAuthType / customAuthHeader /
   *            customRequestTemplate / customResponsePath / customHeaders / allowInsecureHttps
   */
  private getAdapter(
    provider: string,
    apiKey: string,
    baseUrl: string | null,
    model: string,
    configObj?: {
      customChatUrl?: string | null;
      customAuthType?: string | null;
      customAuthHeader?: string | null;
      customRequestTemplate?: string | null;
      customResponsePath?: string | null;
      customHeaders?: any;
      allowInsecureHttps?: boolean;
    },
  ): LLMAdapter {
    // custom_http / custom — 使用专用适配器
    if (provider === 'custom_http' || provider === 'custom') {
      const chatUrl = configObj?.customChatUrl || baseUrl || '';
      if (!chatUrl) throw new Error('自定义 HTTP 模式必须提供 Chat URL 或 Base URL');
      const extraHeaders: Record<string, string> = (() => {
        if (!configObj?.customHeaders) return {};
        try { return typeof configObj.customHeaders === 'string'
          ? JSON.parse(configObj.customHeaders) : (configObj.customHeaders || {}); }
        catch { return {}; }
      })();
      return new CustomHttpAdapter(
        apiKey,
        chatUrl,
        model,
        configObj?.customAuthType || 'bearer',
        configObj?.customAuthHeader || '',
        configObj?.customRequestTemplate || null,
        configObj?.customResponsePath || null,
        extraHeaders,
        configObj?.allowInsecureHttps ?? false,
      );
    }

    const allowInsecure = configObj?.allowInsecureHttps ?? false;
    const map: Record<string, () => LLMAdapter> = {
      openai:            () => new OpenAIAdapter(apiKey, baseUrl || 'https://api.openai.com/v1', model, allowInsecure),
      azure_openai:      () => new OpenAIAdapter(apiKey, baseUrl || '', model, allowInsecure),
      qwen:              () => new OpenAIAdapter(apiKey, baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1', model, allowInsecure),
      zhipu:             () => new OpenAIAdapter(apiKey, baseUrl || 'https://open.bigmodel.cn/api/paas/v4', model, allowInsecure),
      deepseek:          () => new OpenAIAdapter(apiKey, baseUrl || 'https://api.deepseek.com/v1', model, allowInsecure),
      openai_compatible: () => new OpenAIAdapter(apiKey, baseUrl || '', model, allowInsecure),
      claude:            () => new ClaudeAdapter(apiKey, baseUrl || 'https://api.anthropic.com', model, allowInsecure),
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
      presetId: a.presetId ? Number(a.presetId) : null,
      preset: a.preset ? this.serializePreset(a.preset) : null,
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

/**
 * 带超时 + 可选跳过 TLS 验证的 fetch
 * allowInsecure=true 时使用 undici.fetch + dispatcher（跳过自签名证书）
 * 适用于内网私有部署、自签名证书等场景
 */
function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  allowInsecure = false,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (allowInsecure && url.startsWith('https')) {
    // 使用 undici 包的 fetch，支持 dispatcher 选项跳过 TLS 证书验证
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { fetch: undiciFetch, Agent } = require('undici');
      const agent = new Agent({ connect: { rejectUnauthorized: false } });
      return (undiciFetch as typeof fetch)(url, {
        ...init,
        // @ts-ignore — undici fetch 扩展了标准 RequestInit 支持 dispatcher
        dispatcher: agent,
        signal: controller.signal,
      } as any).finally(() => clearTimeout(timer)) as Promise<Response>;
    } catch (e) {
      logger.warn('undici unavailable, falling back to standard fetch (TLS will be verified)');
    }
  }

  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

class OpenAIAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
    private allowInsecure = false,
  ) {}

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
      this.allowInsecure,
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
      this.allowInsecure,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`连接失败: ${res.status} ${body.slice(0, 100)}`);
    }
    return { latency: Date.now() - start };
  }
}

class ClaudeAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
    private allowInsecure = false,
  ) {}

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
      this.allowInsecure,
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
      this.allowInsecure,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`连接失败: ${res.status} ${body.slice(0, 100)}`);
    }
    return { latency: Date.now() - start };
  }
}

class CustomHttpAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private chatUrl: string,
    private model: string,
    private authType: string,
    private authHeader: string,
    private requestTemplate: string | null,
    private responsePath: string | null,
    private extraHeaders: Record<string, string>,
    private allowInsecure: boolean,
  ) {}

  /** 构建请求头（bearer / header / query / none） */
  private buildHeaders(base: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...base, ...this.extraHeaders };
    if (this.authType === 'bearer' || !this.authType) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (this.authType === 'header' && this.authHeader) {
      headers[this.authHeader] = this.apiKey;
    }
    // query 鉴权在 URL 中处理
    return headers;
  }

  /** 构建完整请求 URL（处理 query 鉴权） */
  private buildUrl(base: string): string {
    if (this.authType === 'query') {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}api_key=${encodeURIComponent(this.apiKey)}`;
    }
    return base;
  }

  /** 从响应 JSON 中按路径取值，如 "choices.0.message.content" */
  private extractByPath(data: any, path: string | null): string {
    if (!path) {
      // 尝试 OpenAI 标准格式
      return data?.choices?.[0]?.message?.content
        || data?.result
        || data?.output?.text
        || data?.content?.[0]?.text
        || JSON.stringify(data);
    }
    const parts = path.split('.');
    let cur: any = data;
    for (const p of parts) {
      if (cur === null || cur === undefined) break;
      cur = cur[isNaN(Number(p)) ? p : Number(p)];
    }
    return typeof cur === 'string' ? cur : JSON.stringify(cur ?? '');
  }

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

    // 支持自定义请求体模板（{{model}}、{{messages}}、{{temperature}}、{{max_tokens}} 占位符替换）
    let bodyStr: string;
    if (this.requestTemplate) {
      bodyStr = this.requestTemplate
        .replace('{{model}}', this.model)
        .replace('"{{messages}}"', JSON.stringify(messages))
        .replace('{{messages}}', JSON.stringify(messages))
        .replace('{{temperature}}', String(temperature))
        .replace('{{max_tokens}}', String(maxTokens));
    } else {
      bodyStr = JSON.stringify({ model: this.model, messages, temperature, max_tokens: maxTokens });
    }

    const res = await fetchWithTimeout(
      this.buildUrl(this.chatUrl),
      { method: 'POST', headers: this.buildHeaders(), body: bodyStr },
      30_000,
      this.allowInsecure,
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Custom HTTP API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as any;
    const contentText = this.extractByPath(data, this.responsePath);
    const totalTokens = data?.usage?.total_tokens
      || data?.usage?.completion_tokens
      || contentText.length / 4;  // 粗估

    return { content: contentText, totalTokens: Math.round(totalTokens) };
  }

  async testConnection() {
    const start = Date.now();
    // 发送一个极简的探测请求
    const testBody = this.requestTemplate
      ? this.requestTemplate
          .replace('{{model}}', this.model)
          .replace('"{{messages}}"', JSON.stringify([{ role: 'user', content: 'hi' }]))
          .replace('{{messages}}', JSON.stringify([{ role: 'user', content: 'hi' }]))
          .replace('{{temperature}}', '0')
          .replace('{{max_tokens}}', '1')
      : JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'hi' }],
          temperature: 0, max_tokens: 1,
        });

    const res = await fetchWithTimeout(
      this.buildUrl(this.chatUrl),
      { method: 'POST', headers: this.buildHeaders(), body: testBody },
      10_000,
      this.allowInsecure,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`连接失败: ${res.status} ${body.slice(0, 100)}`);
    }
    return { latency: Date.now() - start };
  }
}
