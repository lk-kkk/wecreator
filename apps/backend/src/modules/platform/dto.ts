import {
  IsString, IsOptional, IsIn, IsInt, Min, Max, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Auth ──────────────────────────────────────────────────
export class PlatformLoginDto {
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(20) username: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(32) password: string;
}

// ── Company Management ───────────────────────────────────
export class RejectCompanyDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class FreezeCompanyDto {
  @ApiProperty({ enum: ['freeze', 'unfreeze'] })
  @IsIn(['freeze', 'unfreeze']) action: 'freeze' | 'unfreeze';
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

// ── Worker Management ────────────────────────────────────
export class BanWorkerDto {
  @ApiProperty({ enum: ['ban', 'unban'] })
  @IsIn(['ban', 'unban']) action: 'ban' | 'unban';
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class AdjustCreditDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(-100) @Max(100) adjustment: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

// ── Task Management ──────────────────────────────────────
export class ForceCloseTaskDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class FreezeTaskFundDto {
  @ApiProperty({ enum: ['freeze', 'unfreeze'] })
  @IsIn(['freeze', 'unfreeze']) action: 'freeze' | 'unfreeze';
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

// ── Dispute ──────────────────────────────────────────────
export class PlatformResolveDisputeDto {
  @ApiProperty({
    enum: ['full_settlement', 'partial_settlement', 'full_refund', 'negotiate'],
    description: '裁决类型：全额结算/部分结算/全额退款/协商',
  })
  @IsIn(['full_settlement', 'partial_settlement', 'full_refund', 'negotiate'])
  type: string;

  @ApiPropertyOptional({ description: '部分结算比例 0-100' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) ratio?: number;

  @ApiProperty({ description: '裁决说明 200-2000字' })
  @IsString() @MinLength(10) @MaxLength(2000) explanation: string;
}

// ── Finance ──────────────────────────────────────────────
export class WithdrawalReviewDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject']) action: 'approve' | 'reject';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class RefundDto {
  @ApiProperty() @Type(() => Number) @IsInt() companyId: number;
  @ApiProperty() @Type(() => Number) amount: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

// ── System Config ────────────────────────────────────────
export class UpdateConfigDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) serviceFeeRate?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) withdrawalSingleLimit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) withdrawalDailyLimit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) rechargeSingleLimit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) acceptanceTimeoutDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) disputeSlaHours?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) invitationExpiryHours?: number;
}

export class CreateAdminDto {
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(20) username: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(32) password: string;
  @ApiProperty() @IsString() @MaxLength(100) displayName: string;
  @ApiProperty({
    enum: ['platform_super_admin', 'platform_ops', 'platform_arbitrator', 'platform_finance', 'platform_viewer'],
  })
  @IsIn(['platform_super_admin', 'platform_ops', 'platform_arbitrator', 'platform_finance', 'platform_viewer'])
  role: string;
}

export class UpdateAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(8) @MaxLength(32) password?: string;
  @ApiPropertyOptional({
    enum: ['platform_super_admin', 'platform_ops', 'platform_arbitrator', 'platform_finance', 'platform_viewer'],
  })
  @IsOptional()
  @IsIn(['platform_super_admin', 'platform_ops', 'platform_arbitrator', 'platform_finance', 'platform_viewer'])
  role?: string;
  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional() @IsIn(['active', 'disabled']) status?: string;
}

// ── Common Query ─────────────────────────────────────────
export class PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
