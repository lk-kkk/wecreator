import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('settlement')
@Controller('finance/settlement')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * POST /finance/settlement/tasks/:taskRoleId/settle
   * 企业验收通过后触发结算
   */
  @Post('tasks/:taskRoleId/settle')
  @ApiOperation({ summary: '触发合规结算（验收通过后）' })
  async settle(
    @Param('taskRoleId', ParseIntPipe) taskRoleId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.settlementService.triggerSettlement(taskRoleId, user.companyId!);
  }
}
