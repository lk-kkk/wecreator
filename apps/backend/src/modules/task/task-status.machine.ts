import { BadRequestException } from '@nestjs/common';

/**
 * 任务 8 态状态机 (V3.9)
 *
 * draft → pending_review → published → in_progress → reviewing → pending_payment → completed → closed
 *                                                       ↗ (驳回重新提交)
 * draft/published → cancelled
 */

export type TaskStatusType =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'in_progress'
  | 'reviewing'
  | 'pending_payment'
  | 'completed'
  | 'closed'
  | 'cancelled';

// 合法状态转换表
const TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_review', 'cancelled'],
  pending_review: ['published', 'draft'], // 审核不通过退回草稿
  published: ['in_progress', 'cancelled'], // V3.9: 审批通过→进行中
  in_progress: ['reviewing'],              // 零工发起验收申请
  reviewing: ['pending_payment', 'in_progress'], // V3.9: 验收确认→待付款；驳回→进行中
  pending_payment: ['completed'],          // V3.9: 付款完成→已完成
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

/**
 * 校验状态转换是否合法
 */
export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

/**
 * 执行状态转换，不合法则抛异常
 */
export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `不允许从 ${from} 转换到 ${to}`,
    );
  }
}

/**
 * 获取状态的中文标签
 */
export const STATUS_LABELS: Record<TaskStatusType, string> = {
  draft: '草稿',
  pending_review: '待审核',
  published: '招募中',
  in_progress: '进行中',
  reviewing: '验收中',
  pending_payment: '待付款', // V3.9
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
};
