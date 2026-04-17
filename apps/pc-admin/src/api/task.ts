import request from './request'

export interface CreateTaskParams {
  title: string
  description?: string
  taskMode: 'task_package' | 'daily_rate'
  totalBudget: number
  startDate?: string
  endDate?: string
  address?: string
  roles?: {
    roleName: string
    headcount: number
    budget: number
    skillTags?: string
    description?: string
  }[]
}

export const taskApi = {
  create: (data: CreateTaskParams) =>
    request.post<any, any>('/tasks', data),

  updateDraft: (id: number, data: Record<string, any>) =>
    request.put<any, any>(`/tasks/${id}/draft`, data),

  setRoles: (id: number, roles: CreateTaskParams['roles']) =>
    request.post<any, any>(`/tasks/${id}/roles`, { roles }),

  publish: (id: number) =>
    request.post<any, any>(`/tasks/${id}/publish`),

  cancel: (id: number) =>
    request.post<any, any>(`/tasks/${id}/cancel`),

  list: (params?: Record<string, any>) =>
    request.get<any, any>('/tasks', { params }),

  detail: (id: number) =>
    request.get<any, any>(`/tasks/${id}`),

  /** W4: 任务详情（含角色+交付物完整数据） */
  detailFull: (id: number) =>
    request.get<any, any>(`/tasks/${id}/full`),

  /** W4: 验收交付物 */
  review: (taskId: number, roleId: number, data: { result: 'approved' | 'rejected'; reviewNote?: string }) =>
    request.post<any, any>(`/tasks/${taskId}/roles/${roleId}/review`, data),

  getPlatformRoles: () =>
    request.get<any, any>('/common/platform-roles'),

  getSkillTags: (category?: string) =>
    request.get<any, any>('/common/skill-tags', { params: { category } }),

  /** W4: 获取 OSS 直传预签名 URL */
  getPresignUrl: (data: { category: string; originalName: string; fileSize: number }) =>
    request.post<any, any>('/common/upload/presign', data),
}
