/**
 * 零工端任务 API
 */
import { request } from './request'

export interface WorkerTask {
  assignmentId: number
  status: 'invited' | 'accepted' | 'rejected' | 'completed' | 'expired' | 'withdrawn'
  progress: number
  slotIndex: number
  invitedAt: string
  acceptedAt: string | null
  task: {
    taskId: number
    title: string
    taskMode: string
    status: string
  }
  role: {
    roleName: string
    budget: number
  }
  /** V3.7: 未解决问题数（任务卡片 ⚠️ 展示） */
  unresolvedIssueCount?: number
}

export interface UpdateProgressPayload {
  progress: number
  note?: string
  /** V3.7 日报：今日摘要、5–0-500 字 */
  dailySummary?: string
  /** V3.7 日报：明日计划 */
  tomorrowPlan?: string
  /** V3.7 日报：遇到的问题 */
  issues?: string
}

export const taskApi = {
  /** 我的任务列表 */
  list: (status?: string) =>
    request<WorkerTask[]>({
      url: '/worker/tasks',
      data: status ? { status } : undefined,
    }),

  /** 接受邀约 */
  accept: (assignmentId: number) =>
    request<{ message: string }>({
      url: `/worker/tasks/${assignmentId}/accept`,
      method: 'POST',
    }),

  /** 婉拒邀约 */
  reject: (assignmentId: number) =>
    request<{ message: string }>({
      url: `/worker/tasks/${assignmentId}/reject`,
      method: 'POST',
    }),

  /** 更新进度 + V3.7 结构化日报 */
  updateProgress: (assignmentId: number, payload: UpdateProgressPayload) =>
    request<{ message: string; progressUpdateId?: number }>({
      url: `/worker/tasks/${assignmentId}/progress`,
      method: 'POST',
      data: payload,
    }),

  /** 提交交付物 */
  submitDeliverable: (assignmentId: number, data: {
    title: string; fileUrl: string; fileType?: string; note?: string
  }) =>
    request<{ message: string }>({
      url: `/worker/tasks/${assignmentId}/deliverables`,
      method: 'POST',
      data,
    }),

  /** V3.9: 发起验收申请 */
  requestAcceptance: (assignmentId: number) =>
    request<{ message: string; status: string }>({
      url: `/worker/tasks/${assignmentId}/request-acceptance`,
      method: 'POST',
    }),
}
