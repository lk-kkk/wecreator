/**
 * W9 Controllers
 * - SubaccountController  (S2-019)
 * - DashboardController   (S2-020)
 * - InvoiceController     (S2-021)
 * - TaskTemplateController (S2-022 + S2-023)
 */
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { CurrentUser }     from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { SubaccountService, CreateSubaccountDto, UpdateSubaccountDto } from '../auth/subaccount.service';
import { DashboardService }        from '../task/dashboard.service';
import { InvoiceService, ApplyInvoiceDto, IssueInvoiceDto, RejectInvoiceDto } from '../finance/invoice.service';
import { TaskTemplateService, CreateTemplateDto, CreateFromTemplateDto, CreateCustomRoleDto, CreateCheckpointTemplateDto, CreateCustomSkillDto } from '../task/task-template.service';

// ═══════════════════════════════════════════════════════════════════
// SubaccountController — /admin/subaccounts
// ═══════════════════════════════════════════════════════════════════
@ApiTags('admin/subaccounts')
@Controller('admin/subaccounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SubaccountController {
  constructor(private readonly svc: SubaccountService) {}

  @Get()
  @ApiOperation({ summary: '列出所有子账号' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.list(user.companyId!);
  }

  @Post()
  @ApiOperation({ summary: '创建子账号（需 super_admin）' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateSubaccountDto) {
    return this.svc.create(user.companyId!, user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改子账号（角色/密码）' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateSubaccountDto,
  ) {
    return this.svc.update(user.companyId!, user.userId, id, dto);
  }

  @Patch(':id/enable')
  @ApiOperation({ summary: '启用子账号' })
  enable(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.setStatus(user.companyId!, user.userId, id, true);
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: '禁用子账号' })
  disable(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.setStatus(user.companyId!, user.userId, id, false);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除子账号（软删除）' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.remove(user.companyId!, user.userId, id);
  }

  @Get('roles/permissions')
  @ApiOperation({ summary: '查看角色权限矩阵' })
  @ApiQuery({ name: 'role', required: false })
  getPermissions(@Query('role') role?: string) {
    const roles = ['super_admin', 'task_admin', 'finance_admin', 'operator'];
    if (role) return this.svc.getRolePermissions(role);
    return roles.map(r => this.svc.getRolePermissions(r));
  }
}

// ═══════════════════════════════════════════════════════════════════
// DashboardController — /dashboard
// ═══════════════════════════════════════════════════════════════════
@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get()
  @ApiOperation({ summary: '企业数据看板（6指标+30日趋势）' })
  company(@CurrentUser() user: CurrentUserPayload) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.svc.getCompanyDashboard(user.companyId!);
  }

  @Get('pending-applications')
  @ApiOperation({ summary: '工作台待审批报名列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  pendingApplications(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    if (user.userType !== 'company') throw new ForbiddenException('仅企业账号可访问');
    return this.svc.getPendingApplications(user.companyId!, Number(page), Number(pageSize));
  }

  @Get('platform')
  @ApiOperation({ summary: '平台全局看板（管理员）' })
  platform() {
    return this.svc.getPlatformDashboard();
  }
}

// ═══════════════════════════════════════════════════════════════════
// InvoiceController — /invoices
// ═══════════════════════════════════════════════════════════════════
@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class InvoiceController {
  constructor(private readonly svc: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: '申请开票' })
  apply(@CurrentUser() user: CurrentUserPayload, @Body() dto: ApplyInvoiceDto) {
    return this.svc.apply(user.companyId!, dto);
  }

  @Get()
  @ApiOperation({ summary: '我的发票列表' })
  @ApiQuery({ name: 'page',     required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page')     page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    return this.svc.listByCompany(user.companyId!, Number(page), Number(pageSize));
  }

  @Get('pending')
  @ApiOperation({ summary: '待审核发票列表（管理员）' })
  listPending(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.svc.listPending(Number(page), Number(pageSize));
  }

  @Get(':id')
  @ApiOperation({ summary: '发票详情' })
  getById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.getById(id, user.userType === 'company' ? user.companyId : undefined);
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: '开具发票（管理员）' })
  issue(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueInvoiceDto) {
    return this.svc.issue(id, dto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: '驳回申请（管理员）' })
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectInvoiceDto) {
    return this.svc.reject(id, dto);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TaskTemplateController — /task-templates  +  /custom-roles
// ═══════════════════════════════════════════════════════════════════
@ApiTags('task-templates')
@Controller('task-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TaskTemplateController {
  constructor(private readonly svc: TaskTemplateService) {}

  @Get()
  @ApiOperation({ summary: '列出任务模板' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listTemplates(user.companyId!);
  }

  @Post()
  @ApiOperation({ summary: '保存任务模板（可从已有任务复制）' })
  save(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateTemplateDto) {
    return this.svc.saveTemplate(user.companyId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除模板' })
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.deleteTemplate(user.companyId!, id);
  }

  @Post('create-task')
  @ApiOperation({ summary: '从模板创建草稿任务' })
  createTask(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateFromTemplateDto) {
    return this.svc.createFromTemplate(user.companyId!, dto);
  }
}

@ApiTags('custom-roles')
@Controller('custom-roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CustomRoleController {
  constructor(private readonly svc: TaskTemplateService) {}

  @Get()
  @ApiOperation({ summary: '企业自定义角色列表' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listCustomRoles(user.companyId!);
  }

  @Post()
  @ApiOperation({ summary: '创建自定义角色（上限50个）' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCustomRoleDto) {
    return this.svc.createCustomRole(user.companyId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改自定义角色' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Partial<CreateCustomRoleDto>,
  ) {
    return this.svc.updateCustomRole(user.companyId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除自定义角色' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.deleteCustomRole(user.companyId!, id);
  }
}

// ═════════════════════════════════════════════════════════════════
// CheckpointTemplateController — /checkpoint-templates
// ═════════════════════════════════════════════════════════════════
@ApiTags('checkpoint-templates')
@Controller('checkpoint-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CheckpointTemplateController {
  constructor(private readonly svc: TaskTemplateService) {}

  @Get()
  @ApiOperation({ summary: '企业检查点模板列表' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listCheckpointTemplates(user.companyId!);
  }

  @Post()
  @ApiOperation({ summary: '创建检查点模板（上限5^0个）' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCheckpointTemplateDto) {
    return this.svc.createCheckpointTemplate(user.companyId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改检查点模板' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Partial<CreateCheckpointTemplateDto>,
  ) {
    return this.svc.updateCheckpointTemplate(user.companyId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除检查点模板' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.deleteCheckpointTemplate(user.companyId!, id);
  }

  @Post('reorder')
  @ApiOperation({ summary: '调整检查点模板排序' })
  reorder(@CurrentUser() user: CurrentUserPayload, @Body() body: { templateIds: number[] }) {
    return this.svc.reorderCheckpointTemplates(user.companyId!, body.templateIds);
  }
}

// ═════════════════════════════════════════════════════════════════
// CustomSkillController — /custom-skills
// ═════════════════════════════════════════════════════════════════
@ApiTags('custom-skills')
@Controller('custom-skills')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CustomSkillController {
  constructor(private readonly svc: TaskTemplateService) {}

  @Get()
  @ApiOperation({ summary: '企业自定义技能列表' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listCustomSkills(user.companyId!);
  }

  @Post()
  @ApiOperation({ summary: '创建自定义技能（上限200个）' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCustomSkillDto) {
    return this.svc.createCustomSkill(user.companyId!, dto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量添加技能（从模板）' })
  batchCreate(@CurrentUser() user: CurrentUserPayload, @Body() body: { skills: CreateCustomSkillDto[] }) {
    return this.svc.batchCreateCustomSkills(user.companyId!, body.skills);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改自定义技能' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Partial<CreateCustomSkillDto>,
  ) {
    return this.svc.updateCustomSkill(user.companyId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除自定义技能' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.deleteCustomSkill(user.companyId!, id);
  }
}
