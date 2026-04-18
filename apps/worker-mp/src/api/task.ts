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

  /** 更新进度 */
  updateProgress: (assignmentId: number, progress: number, note?: string) =>
    request<{ message: string }>({
      url: `/worker/tasks/${assignmentId}/progress`,
      method: 'POST',
      data: { progress, note },
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
}
