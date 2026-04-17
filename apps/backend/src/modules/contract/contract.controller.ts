import {
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('contract')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post('generate/:assignmentId')
  @ApiOperation({ summary: '生成合同PDF' })
  async generate(@Param('assignmentId', ParseIntPipe) id: number) {
    return this.contractService.generatePdf(id);
  }

  @Get('verify/:contractId')
  @ApiOperation({ summary: '校验合同Hash' })
  async verify(@Param('contractId', ParseIntPipe) id: number) {
    return this.contractService.verifyHash(id);
  }

  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: '按分配ID查询合同' })
  async getByAssignment(@Param('assignmentId', ParseIntPipe) id: number) {
    return this.contractService.getByAssignment(id);
  }
}
