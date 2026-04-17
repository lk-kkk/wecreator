import {
  IsDateString, IsOptional, IsNumber, IsString, Min, Max,
  IsDecimal, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckinDto {
  @ApiProperty({ description: '打卡日期 YYYY-MM-DD', example: '2026-04-17' })
  @IsDateString()
  checkinDate: string;

  @ApiPropertyOptional({ description: 'GPS纬度', example: 30.24 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsLat?: number;

  @ApiPropertyOptional({ description: 'GPS经度', example: 120.15 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsLng?: number;

  @ApiPropertyOptional({ description: '截图 URL（OSS key 或完整 URL）' })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @ApiPropertyOptional({ description: '工作日志', maxLength: 500 })
  @IsOptional()
  @IsString()
  workLog?: string;
}

export class CheckoutDto {
  @ApiProperty({ description: '打卡日期 YYYY-MM-DD', example: '2026-04-17' })
  @IsDateString()
  checkinDate: string;

  @ApiPropertyOptional({ description: '下班截图 URL' })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @ApiPropertyOptional({ description: '工作日志更新' })
  @IsOptional()
  @IsString()
  workLog?: string;
}

export class ConfirmCheckinDto {
  @ApiProperty({ description: '打卡记录 ID' })
  @IsNumber()
  @Type(() => Number)
  checkinId: number;

  @ApiPropertyOptional({ description: '拒绝原因（驳回时必填）' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** 多维度评价 DTO（替换简版单评分）*/
export class CreateReviewV2Dto {
  @ApiProperty({ description: '专业能力 1-5', example: 5 })
  @IsNumber() @Min(1) @Max(5) @Type(() => Number)
  qualityScore: number;

  @ApiProperty({ description: '沟通配合 1-5', example: 4 })
  @IsNumber() @Min(1) @Max(5) @Type(() => Number)
  communicationScore: number;

  @ApiProperty({ description: '工作态度 1-5', example: 5 })
  @IsNumber() @Min(1) @Max(5) @Type(() => Number)
  attitudeScore: number;

  @ApiProperty({ description: '按时交付 1-5', example: 4 })
  @IsNumber() @Min(1) @Max(5) @Type(() => Number)
  deliveryScore: number;

  @ApiProperty({ description: '整体满意度 1-5', example: 5 })
  @IsNumber() @Min(1) @Max(5) @Type(() => Number)
  overallScore: number;

  @ApiPropertyOptional({ description: '文字评价', maxLength: 500 })
  @IsOptional()
  @IsString()
  comment?: string;
}
