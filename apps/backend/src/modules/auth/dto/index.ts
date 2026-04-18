/**
 * Auth DTOs — 全量 class-validator 校验
 *
 * R1 · wc-auth-dev · Sprint 1 W1
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';

// ============================================================
// 企业注册
// ============================================================
export class RegisterEnterpriseDto {
  @ApiProperty({ description: '企业名称', example: '杭州创意科技有限公司' })
  @IsString()
  @IsNotEmpty({ message: '企业名称不能为空' })
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: '统一社会信用代码（18位）',
    example: '91330100MA2EXAMPLE',
  })
  @IsString()
  @Matches(/^[0-9A-Za-z]{18}$/, {
    message: '信用代码格式不正确（18位字母数字）',
  })
  creditCode: string;

  @ApiProperty({ description: '管理员姓名', example: '张三' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  adminName: string;

  @ApiProperty({ description: '管理员手机号', example: '13800138000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  adminPhone: string;

  @ApiProperty({
    description: '登录密码（8-32位，含大小写+数字）',
    example: 'Test1234',
  })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: '密码需包含大小写字母和数字',
  })
  password: string;

  @ApiPropertyOptional({ description: '联系邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: '行业标签' })
  @IsOptional()
  @IsString()
  industryTag?: string;
}

// ============================================================
// 企业登录
// ============================================================
export class LoginEnterpriseDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '密码', example: 'Test1234' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

// ============================================================
// 零工微信登录
// ============================================================
export class LoginWorkerDto {
  @ApiProperty({
    description: '微信 wx.login 返回的 code',
    example: '0a1b2c3d4e',
  })
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  code: string;
}

// ============================================================
// 零工绑定手机号
// ============================================================
export class BindPhoneDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;
}

// ============================================================
// 零工实名认证
// ============================================================
export class VerifyIdentityDto {
  @ApiProperty({ description: '真实姓名', example: '李四' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  realName: string;

  @ApiProperty({
    description: '身份证号（18位）',
    example: '330102199001011234',
  })
  @IsString()
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确' })
  idCard: string;
}

// ============================================================
// Token 续期
// ============================================================
export class RefreshTokenDto {
  @ApiProperty({ description: 'refreshToken' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// ============================================================
// 更新企业信息
// ============================================================
export class UpdateEnterpriseDto {
  @ApiPropertyOptional({ description: '企业名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '企业 Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: '企业简介' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '联系邮箱' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: '行业标签' })
  @IsOptional()
  @IsString()
  industryTag?: string;
}

// ============================================================
// 更新零工信息（增强版：支持 V2 Schema 字段）
// ============================================================
export class UpdateWorkerProfileDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @ApiPropertyOptional({ description: '个人简介' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '封面模板 ID', example: 'template_01' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  coverTemplate?: string;

  @ApiPropertyOptional({
    description: '技能标签数组',
    example: ['UI设计', 'Figma', '品牌设计'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillTags?: string[];
}

// ============================================================
// 添加零工角色档案（P1-1 新增）
// ============================================================
export class AddWorkerRoleDto {
  @ApiProperty({ description: '角色名称', example: 'UI设计师' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  roleName: string;

  @ApiPropertyOptional({
    description: '关联平台角色 ID',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  platformRoleId?: number;

  @ApiPropertyOptional({
    description: '技能等级',
    enum: ['junior', 'mid', 'senior', 'expert'],
  })
  @IsOptional()
  @IsIn(['junior', 'mid', 'senior', 'expert'])
  level?: string;

  @ApiPropertyOptional({ description: '从业年限', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  yearsExp?: number;

  @ApiPropertyOptional({ description: '期望最低日薪', example: 800 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDailyRate?: number;

  @ApiPropertyOptional({ description: '期望最高日薪', example: 1500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyRate?: number;

  @ApiPropertyOptional({
    description: '专属技能标签',
    type: [String],
    example: ['Figma', 'Sketch', 'Photoshop'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillTags?: string[];

  @ApiPropertyOptional({ description: '经验描述', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  experienceDesc?: string;
}

// ============================================================
// 上传作品集（P1-2 新增）
// ============================================================
export class AddPortfolioDto {
  @ApiProperty({ description: '作品标题', example: '某品牌 VI 设计' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: '作品描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: '文件 URL（由文件模块上传后获得）' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({
    description: '文件类型',
    enum: ['image', 'document'],
    example: 'image',
  })
  @IsIn(['image', 'document'])
  fileType: string;

  @ApiPropertyOptional({ description: '是否设为精选', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
