import request from './request'

export interface WorkerPoolItem {
  id: number
  nickname: string | null
  realName: string | null
  avatarUrl: string | null
  city: string | null
  roles: { roleName: string }[]
  avgRating: number
  completedCount: number
  level: string
}

export interface WorkerPoolResult {
  total: number
  page: number
  pageSize: number
  list: WorkerPoolItem[]
}

export const workerApi = {
  /** 零工库搜索 */
  getPool: (params?: { keyword?: string; city?: string; roleName?: string; page?: number; pageSize?: number }) =>
    request.get<any, WorkerPoolResult>('/workers', { params }),

  /** 邀约零工到任务角色 */
  invite: (taskId: number, roleId: number, workerId: number) =>
    request.post<any, any>(`/tasks/${taskId}/roles/${roleId}/invite/${workerId}`),
}
