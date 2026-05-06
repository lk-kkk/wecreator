import request from './request'

export interface PendingApplication {
  applicationId: number
  workerName: string
  avatarUrl: string | null
  taskTitle: string
  taskId: number
  roleName: string
  createdAt: string
  introduction: string
  expectPay: number | null
  workerId: number
  city: string | null
  avgRating: number
  completedCount: number
  level: string | null
  bio: string | null
  skills: string[]
  verified: boolean
  taskMode: string
  roleBudget: number
}

export interface PendingApplicationResult {
  total: number
  page: number
  pageSize: number
  list: PendingApplication[]
}

export const dashboardApi = {
  company:  () => request.get('/dashboard'),
  platform: () => request.get('/dashboard/platform'),
  pendingApplications: (params?: { page?: number; pageSize?: number }) =>
    request.get<any, PendingApplicationResult>('/dashboard/pending-applications', { params }),
}
