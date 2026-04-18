import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================
// 角色岗位 DTO
// ============================================================
export class TaskRoleDto {
  @ApiProperty({ description: '角色名称', example: '摄影师' })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiProperty({ description: '需求人数', example: 2 })
  @IsNumber()
  @Min(1)
  headcount: number;

  @ApiProperty({ description: '该角色预算', example: 5000 })
  @IsNumber()
  @Min(0)
  budget: number;

  @ApiPropertyOptional({ description: '技能标签（逗号分隔）', example: '商业摄影,产品拍摄' })
  @IsOptional()
  @IsString()
  skillTags?: string;

  @ApiPropertyOptional({ description: '角色要求描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// ============================================================
// 创建任务
// ============================================================
export class CreateTaskDto {
  @ApiProperty({ description: '任务标题', example: '双11电商产品拍摄' })
  @IsString()
  @IsNotEmpty({ message: '任务标题不能为空' })
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: '任务描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '任务模式', enum: ['task_package', 'daily_rate'] })
  @IsEnum(['task_package', 'daily_rate'], { message: '任务模式只能是 task_package 或 daily_rate' })
  taskMode: 'task_package' | 'daily_rate';

  @ApiProperty({ description: '总预算', example: 20000 })
  @IsNumber()
  @Min(1, { message: '总预算必须大于0' })
  totalBudget: number;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '工作地点' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: '角色列表', type: [TaskRoleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskRoleDto)
  roles?: TaskRoleDto[];

  @ApiPropertyOptional({ description: '关联项目ID（可选）' })
  @IsOptional()
  @IsNumber()
  projectId?: number;
}

// ============================================================
// 更新草稿（局部更新）
// ============================================================
export class UpdateDraftDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) totalBudget?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
}

// ============================================================
// 配置角色岗位
// ============================================================
export class SetTaskRolesDto {
  @ApiProperty({ type: [TaskRoleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskRoleDto)
  roles: TaskRoleDto[];
}

// ============================================================
// 任务列表查询
// ============================================================
export class TaskQueryDto {
  @ApiPropertyOptional({ description: '状态筛选' })
  @IsOptional()
  @IsIn(['draft', 'pending_review', 'published', 'in_progress', 'reviewing', 'completed', 'closed', 'cancelled'], { message: '无效的任务状态' })
  status?: string;

  @ApiPropertyOptional({ description: '关键词搜索（标题/描述模糊匹配）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '任务模式', enum: ['task_package', 'daily_rate'] })
  @IsOptional()
  @IsIn(['task_package', 'daily_rate'])
  taskMode?: string;

  @ApiPropertyOptional({ description: '排序字段', enum: ['createdAt', 'totalBudget', 'publishedAt', 'endDate'] })
  @IsOptional()
  @IsIn(['createdAt', 'totalBudget', 'publishedAt', 'endDate'])
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: '创建开始日期' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: '创建截止日期' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: '仅含有待审批报名的任务', default: false })
  @IsOptional()
  hasPendingApplications?: boolean;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;
}

// ============================================================
// W4 — 进度更新 / 交付物 / 验收
// ============================================================
export class UpdateProgressDto {
  @ApiProperty({ description: '进度百分比 0-100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiPropertyOptional({ description: '进度备注' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitDeliverableDto {
  @ApiProperty({ description: 'OSS 文件 URL' })
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: '原始文件名' })
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: '文件大小（字节）' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ description: '文件类型' })
  @IsOptional()
  @IsString()
  fileType?: string;
}

export class ReviewDeliverableDto {
  @ApiProperty({ description: '验收结果', enum: ['approved', 'rejected'] })
  @IsString()
  @IsIn(['approved', 'rejected'])
  result: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: '退回原因（rejected时必填）' })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

// ============================================================
// 附件上传
// ============================================================
export class AddAttachmentDto {
  @ApiProperty({ description: '文件名', example: '需求文档.pdf' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ description: '文件访问URL（OSS地址）' })
  @IsString()
  @MaxLength(500)
  fileUrl: string;

  @ApiProperty({ description: '文件大小（字节）', example: 1048576 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ description: '文件类型', example: 'pdf' })
  @IsString()
  @MaxLength(20)
  fileType: string;
}
