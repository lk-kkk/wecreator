import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface JwtPayload {
  userId: number;
  companyId?: number;
  userType: 'company' | 'worker';
}

@ApiTags('message')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * GET /api/v1/conversations
   * 会话列表（含最后一条消息 + 未读数）
   */
  @Get()
  @ApiOperation({ summary: '会话列表' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async listConversations(
    @CurrentUser() user: JwtPayload,
    @Query('page',     new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.messageService.listConversations(user.userId, user.userType, page, pageSize);
  }

  /**
   * POST /api/v1/conversations/:id/messages
   * 通过 HTTP 发消息（不依赖 WebSocket）
   */
  @Post(':id/messages')
  @ApiOperation({ summary: '发送消息（HTTP）' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: { content: string; type?: 'text' | 'image' | 'file'; fileName?: string; fileSize?: number },
  ) {
    const content = (dto?.content ?? '').toString().trim();
    if (!content) throw new BadRequestException('消息内容不能为空');
    return this.messageService.sendMessage(
      conversationId,
      user.userId,
      user.userType,
      {
        content,
        type:     dto?.type ?? 'text',
        fileName: dto?.fileName ?? null,
        fileSize: dto?.fileSize ?? null,
      },
    );
  }

  /**
   * POST /api/v1/conversations/open
   * 企业端主动打开或创建一个会话（taskId + workerId 幂等）
   * 用于「给零工发消息」入口前确保会话存在
   */
  @Post('open')
  @ApiOperation({ summary: '打开或创建会话（企业→零工）' })
  async openConversation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { taskId: number; workerId: number },
  ) {
    if (user.userType !== 'company') {
      throw new ForbiddenException('仅企业用户可主动创建会话');
    }
    if (!dto?.taskId || !dto?.workerId) {
      throw new BadRequestException('taskId 和 workerId 必填');
    }
    const conv = await this.messageService.getOrCreateConversation(
      BigInt(dto.taskId),
      BigInt(user.userId),
      BigInt(dto.workerId),
    );
    return {
      id:             Number(conv.id),
      taskId:         Number(conv.taskId),
      companyUserId:  Number(conv.companyUserId),
      workerId:       Number(conv.workerId),
      lastMsgAt:      conv.lastMsgAt,
    };
  }

  /**
   * GET /api/v1/conversations/:id/messages
   * 历史消息（分页，加载时自动标记已读）
   */
  @Get(':id/messages')
  @ApiOperation({ summary: '历史消息（分页）' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query('page',     new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(30), ParseIntPipe) pageSize: number,
  ) {
    return this.messageService.listMessages(conversationId, user.userId, user.userType, page, pageSize);
  }
}
