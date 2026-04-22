/**
 * 任务问题上报 API — V3.7 §4.2
 * 对接 /tasks/:taskId/issues
 */
import request from '@/api/request'

export type IssueType =
  | 'requirement_unclear'
  | 'technical_block'
  | 'resource_missing'
  | 'other'

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface TaskIssue {
  id: number
  taskId: number
  reporterType: 'company_user' | 'worker'
  reporterId: number
  reporterName?: string
  title: string
  type: IssueType
  description: string
  attachments?: string[] | null
  status: IssueStatus
  firstResponseAt?: string | null
  resolvedAt?: string | null
  slaBreached: boolean
  response?: string | null
  createdAt: string
  updatedAt: string
}

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  requirement_unclear: '需求不明确',
  technical_block: '技术障碍',
  resource_missing: '资源缺失',
  other: '其他',
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: '待响应',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
}

export const issueApi = {
  list: (taskId: number, params?: { status?: IssueStatus }) =>
    request.get<any, TaskIssue[]>(`/tasks/${taskId}/issues`, { params }),

  create: (
    taskId: number,
    data: {
      title: string
      type: IssueType
      description: string
      attachments?: string[]
    },
  ) => request.post<any, TaskIssue>(`/tasks/${taskId}/issues`, data),

  /** 更新（企业/零工均可；status + response 回复）*/
  update: (
    taskId: number,
    issueId: number,
    data: { status?: IssueStatus; response?: string },
  ) => request.put<any, TaskIssue>(`/tasks/${taskId}/issues/${issueId}`, data),
}
