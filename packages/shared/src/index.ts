// ============================================================
// WeCreator 共享类型定义包
// 前后端共用的类型、常量、工具函数
// ============================================================

// V3.7 埋点事件常量
export * from './analytics';


// ── 从 Prisma 客户端 re-export 枚举（单一来源，杜绝不同步）──
// 注意：前端项目如果不安装 @prisma/client，则使用下方手写镜像
// 后端直接 import { TaskStatus } from '@prisma/client' 亦可
// ── 枚举镜像（与 prisma/schema.prisma 保持一致）─────────────

// ===== 任务状态（PRD §6.1 · 8种状态） =====
export type TaskStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'in_progress'
  | 'reviewing'
  | 'completed'
  | 'closed'
  | 'cancelled'

// ===== 角色分配状态 =====
export type AssignmentStatus =
  | 'invited'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'completed'

// ===== 任务模式 =====
export type TaskMode = 'task_package' | 'daily_rate'

// ===== 企业用户角色（RBAC 4角色） =====
export type CompanyUserRole = 'super_admin' | 'task_admin' | 'finance_admin' | 'operator'

// ===== 企业状态 =====
export type CompanyStatus = 'pending' | 'active' | 'suspended'

// ===== 零工等级 =====
export type WorkerLevel = 'unverified' | 'verified' | 'premium'

// ===== 交付物状态 =====
export type DeliverableStatus = 'submitted' | 'approved' | 'rejected'

// ===== 支付状态 =====
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ===== 交易类型 =====
export type TransactionType = 'recharge' | 'lock' | 'unlock' | 'settlement' | 'withdraw' | 'refund'

// ===== 交易方向 =====
export type Direction = 'in' | 'out'

// ===== 通知类型 =====
export type NotificationType =
  | 'task_invite'
  | 'task_accepted'
  | 'task_rejected'
  | 'deliverable_submitted'
  | 'review_result'
  | 'settlement_completed'
  | 'withdraw_completed'
  | 'system'

// ===== 评价者类型 / 用户类型 =====
export type ReviewerType = 'company' | 'worker'
export type UserType = 'company' | 'worker'

// ===== 打卡状态 =====
export type CheckinStatus = 'pending' | 'confirmed' | 'auto_confirmed' | 'rejected'

// ===== 争议状态 =====
export type DisputeStatus = 'pending' | 'investigating' | 'resolved_company' | 'resolved_worker' | 'resolved_split' | 'cancelled'

// ===== 发票状态 =====
export type InvoiceStatus = 'pending' | 'processing' | 'issued' | 'rejected'

// ============================================================
// API 通用类型
// ============================================================

// ===== API 统一响应格式 =====
export interface ApiResponse<T = unknown> {
  code: number       // 0=成功, 非0=HTTP状态码
  message: string
  data: T
  timestamp: number
}

// ===== 分页请求 =====
export interface PageRequest {
  page?: number      // 默认1
  pageSize?: number  // 默认20
}

// ===== 分页响应 =====
export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ============================================================
// 常量映射
// ============================================================

// ===== 任务状态中文映射 =====
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  published: '招募中',
  in_progress: '进行中',
  reviewing: '验收中',
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
}

// ===== 任务状态颜色映射（Ant Design色值）=====
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: '#999',
  pending_review: '#faad14',
  published: '#1890ff',
  in_progress: '#52c41a',
  reviewing: '#722ed1',
  completed: '#52c41a',
  closed: '#999',
  cancelled: '#ff4d4f',
}

// ===== 分配状态中文映射 =====
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  invited: '已邀约',
  accepted: '已接单',
  rejected: '已婉拒',
  expired: '已过期',
  withdrawn: '已撤回',
  completed: '已完成',
}

// ===== 平台费率（PRD §3.2.3）=====
export const PLATFORM_RATE = 0.08
// ===== 资金锁定倍率（预算 × 1.08）=====
export const LOCK_MULTIPLIER = 1.08

// ============================================================
// 类型同步校验说明
// ============================================================
// 
// 本文件中的枚举类型是 prisma/schema.prisma 中 enum 的 TypeScript 镜像。
// 每次修改 schema.prisma 中的 enum 后，必须同步更新此文件。
// 
// 校验命令（由 R10 Schema-Ops 负责）：
//   grep "^enum " apps/backend/prisma/schema.prisma
//   → 对比此文件中的 export type 声明
// 
// 未来可自动化：添加 prisma generate 后的 post-hook 脚本。
