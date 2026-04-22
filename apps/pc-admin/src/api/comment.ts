/**
 * 任务评论 API — V3.7 §4.1
 * 对接 /tasks/:taskId/comments
 */
import request from '@/api/request'

export interface CommentAuthor {
  id: number
  name: string
  avatar?: string | null
  roleName?: string | null
}

export interface TaskComment {
  id: number
  taskId: number
  parentId?: number | null
  authorType: 'company_user' | 'worker'
  authorId: number
  author?: CommentAuthor
  content: string
  attachments?: string[] | null
  isImportant: boolean
  isDeleted: boolean
  createdAt: string
  replies?: TaskComment[]
}

export const commentApi = {
  list: (taskId: number, params?: { page?: number; pageSize?: number }) =>
    request.get<any, { total: number; items: TaskComment[] }>(
      `/tasks/${taskId}/comments`,
      { params },
    ),

  create: (
    taskId: number,
    data: {
      content: string
      parentId?: number
      attachments?: string[]
      isImportant?: boolean
    },
  ) => request.post<any, TaskComment>(`/tasks/${taskId}/comments`, data),

  remove: (taskId: number, commentId: number) =>
    request.delete<any, any>(`/tasks/${taskId}/comments/${commentId}`),
}
