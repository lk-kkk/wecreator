import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsIn } from 'class-validator';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

class PresignDto {
  @ApiProperty({
    description: '文件类别',
    enum: ['avatar', 'portfolio', 'deliverable', 'id_card', 'license', 'im_image', 'im_file'],
  })
  @IsString()
  @IsIn(['avatar', 'portfolio', 'deliverable', 'id_card', 'license', 'im_image', 'im_file'])
  category: string;

  @ApiProperty({ description: '原始文件名（含扩展名）' })
  @IsString()
  originalName: string;

  @ApiProperty({ description: '文件字节大小' })
  @IsNumber()
  @Min(1)
  fileSize: number;
}

@ApiTags('file')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('common')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * POST /api/v1/common/upload/presign
   * 获取 OSS 直传预签名 URL（客户端直传）
   *
   * 响应：
   *   uploadUrl  — 直传地址（PUT，10 分钟有效）
   *   fileUrl    — OSS 源站地址
   *   cdnUrl     — CDN 加速地址（配置了 OSS_CDN_DOMAIN 才有）
   *   key        — 对象 Key（提交业务接口时传入，保存到数据库）
   *   expiresIn  — 有效秒数（600）
   *   headers    — 直传时必须携带的请求头（Content-Type）
   */
  @Post('upload/presign')
  @ApiOperation({ summary: '获取 OSS 直传预签名 URL（P0-09）' })
  async presign(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PresignDto,
  ) {
    return this.fileService.getPresignUrl(
      dto.category,
      dto.originalName,
      dto.fileSize,
      user.userId,
    );
  }

  /**
   * GET /api/v1/common/upload/rules
   * 文件校验规则（供前端动态获取）
   */
  @Get('upload/rules')
  @ApiOperation({ summary: '获取文件上传规则' })
  rules() {
    return this.fileService.getFileRules();
  }

  /**
   * GET /api/v1/common/upload/oss-status
   * OSS 配置状态诊断（开发/运维使用）
   */
  @Get('upload/oss-status')
  @ApiOperation({ summary: 'OSS 配置状态诊断' })
  ossStatus() {
    return this.fileService.getOssStatus();
  }
}
