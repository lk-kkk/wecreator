/**
 * 里程碑 API — V3.7 §2.3
 * 对接 ProjectController 的 milestones 子路由
 */
import request from '@/api/request'

export interface Milestone {
  id: number
  projectId: number
  name: string
  description?: string | null
  plannedDate: string
  completedAt?: string | null
  status: 'pending' | 'completed' | 'overdue'
  sortOrder: number
  attachments?: MilestoneAttachment[]
  createdAt: string
  updatedAt: string
}

export interface MilestoneAttachment {
  id: number
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
}

export const milestoneApi = {
  list: (projectId: number) =>
    request.get<any, Milestone[]>(`/projects/${projectId}/milestones`),

  create: (projectId: number, data: { name: string; description?: string; plannedDate: string }) =>
    request.post<any, Milestone>(`/projects/${projectId}/milestones`, data),

  update: (
    projectId: number,
    mid: number,
    data: { name?: string; description?: string; plannedDate?: string },
  ) => request.put<any, Milestone>(`/projects/${projectId}/milestones/${mid}`, data),

  /** 标记完成（可上传附件） */
  complete: (projectId: number, mid: number, attachments?: MilestoneAttachment[]) =>
    request.post<any, Milestone>(`/projects/${projectId}/milestones/${mid}/complete`, {
      attachments,
    }),

  remove: (projectId: number, mid: number) =>
    request.delete<any, any>(`/projects/${projectId}/milestones/${mid}`),
}
