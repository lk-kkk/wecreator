import request from './request'

export type TaskPriority = 'p0' | 'p1' | 'p2'
export type RiskLevel = 'green' | 'yellow' | 'red'
export type AcceptanceStatus = 'pending' | 'partial' | 'all_passed' | null

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  p0: 'P0 紧急',
  p1: 'P1 重要',
  p2: 'P2 常规',
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  p0: 'red',
  p1: 'orange',
  p2: 'blue',
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  green: '正常',
  yellow: '关注',
  red: '风险',
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  green: '#52c41a',
  yellow: '#faad14',
  red: '#ff4d4f',
}

export interface CreateTaskParams {
  title: string
  description?: string
  taskMode: 'task_package' | 'daily_rate'
  totalBudget: number
  startDate?: string
  endDate?: string
  address?: string
  /** V3.7 优先级 */
  priority?: TaskPriority
  /** V3.7 验收标准 */
  acceptanceCriteria?: string
  roles?: {
    roleName: string
    headcount: number
    budget: number
    skillTags?: string
    description?: string
  }[]
}

export interface TaskListParams {
  status?: string
  keyword?: string
  taskMode?: string
  /** V3.7 优先级筛选 */
  priority?: TaskPriority
  sortBy?: 'createdAt' | 'totalBudget' | 'publishedAt' | 'endDate' | 'priority'
  sortOrder?: 'asc' | 'desc'
  createdFrom?: string
  createdTo?: string
  hasPendingApplications?: boolean
  page?: number
  pageSize?: number
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

  list: (params?: TaskListParams) =>
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

  /** 附件管理 */
  listAttachments: (taskId: number) =>
    request.get<any, any>(`/tasks/${taskId}/attachments`).then((r: any) => r.data || []),
  addAttachment: (taskId: number, data: {
    fileName: string; fileUrl: string; fileSize: number; fileType: string;
  }) => request.post<any, any>(`/tasks/${taskId}/attachments`, data).then((r: any) => r.data),
  deleteAttachment: (taskId: number, attachmentId: number) =>
    request.delete<any, any>(`/tasks/${taskId}/attachments/${attachmentId}`),
}
