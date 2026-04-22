/**
 * 任务检查点 API — V3.7 §3.2
 * 对接 /tasks/:taskId/checkpoints
 */
import request from '@/api/request'

export type CheckpointType = 'progress_check' | 'quality_gate'
export type CheckpointStatus =
  | 'pending'
  | 'submitted'
  | 'passed'
  | 'rejected'
  | 'overdue'

export interface Checkpoint {
  id: number
  taskId: number
  name: string
  type: CheckpointType
  plannedDate: string
  reviewerId: number
  description?: string | null
  status: CheckpointStatus
  submitContent?: string | null
  submitAttachments?: string[] | null
  submittedAt?: string | null
  reviewComment?: string | null
  reviewedAt?: string | null
  revisionCount: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const checkpointApi = {
  list: (taskId: number) =>
    request.get<any, Checkpoint[]>(`/tasks/${taskId}/checkpoints`),

  create: (
    taskId: number,
    data: {
      name: string
      type: CheckpointType
      plannedDate: string
      reviewerId: number
      description?: string
    },
  ) => request.post<any, Checkpoint>(`/tasks/${taskId}/checkpoints`, data),

  /** 零工提交 */
  submit: (
    taskId: number,
    cpId: number,
    data: { submitContent: string; submitAttachments?: string[] },
  ) => request.post<any, Checkpoint>(`/tasks/${taskId}/checkpoints/${cpId}/submit`, data),

  /** 企业审核 */
  review: (
    taskId: number,
    cpId: number,
    data: { result: 'passed' | 'rejected'; reviewComment?: string },
  ) => request.post<any, Checkpoint>(`/tasks/${taskId}/checkpoints/${cpId}/review`, data),

  remove: (taskId: number, cpId: number) =>
    request.delete<any, any>(`/tasks/${taskId}/checkpoints/${cpId}`),
}
