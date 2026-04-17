import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
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
