/**
 * V3.3 服务广场 + 个人统计 API
 */
import { request } from './request'

// ══════════════════════════════════════════════════════
// 服务广场
// ══════════════════════════════════════════════════════

export interface MarketplaceTask {
  taskId: number
  title: string
  totalBudget: number
  taskMode: string
  address: string | null
  publishedAt: string | null
  company: { id: number; name: string; logoUrl: string | null }
  roles: { roleId: number; roleName: string; headcount: number; budget: number }[]
  matchScore: number | null
  dimensions: { skillMatch: number; cityMatch: number; budgetFit: number; freshness: number } | null
}

export interface CompanyGroup {
  company: { id: number; name: string; logoUrl: string | null }
  tasks: { taskId: number; title: string; totalBudget: number; taskMode: string; address: string | null; publishedAt: string | null }[]
}

export interface MarketplaceDetail {
  taskId: number
  title: string
  description: string | null
  totalBudget: number
  taskMode: string
  address: string | null
  startDate: string | null
  endDate: string | null
  publishedAt: string | null
  company: { id: number; name: string; logoUrl: string | null }
  roles: {
    roleId: number; roleName: string; headcount: number; budget: number
    skillTags: string | null; description: string | null; filledCount: number
    myApplicationStatus: string | null
  }[]
  matchScore: number | null
  dimensions: any
}

export const marketplaceApi = {
  /** 任务列表 */
  list: (params: {
    roleName?: string; city?: string; taskMode?: string
    sort?: string; keyword?: string; page?: number; pageSize?: number
  }) =>
    request<{ total: number; page: number; pageSize: number; list: MarketplaceTask[] }>({
      url: '/marketplace/tasks', data: params,
    }),

  /** 按企业分组 */
  listByCompany: () =>
    request<{ groups: CompanyGroup[] }>({
      url: '/marketplace/tasks', data: { groupBy: 'company' },
    }),

  /** 任务详情 */
  detail: (id: number) =>
    request<MarketplaceDetail>({ url: `/marketplace/tasks/${id}` }),

  /** 报名投递 */
  apply: (taskId: number, roleId: number, data: {
    intro: string; expectPay?: number; availableAt?: string
  }) =>
    request<{ message: string }>({
      url: `/marketplace/tasks/${taskId}/roles/${roleId}/apply`,
      method: 'POST', data,
    }),
}

// ══════════════════════════════════════════════════════
// 零工统计 + 信用分
// ══════════════════════════════════════════════════════

export interface WorkerStats {
  servedCompanies: number
  acceptedTasks: number
  inProgressTasks: number
  completedTasks: number
  creditScore: number
  creditLevel: { level: string; color: string }
  coverImage: string | null
  coverTemplate: string
}

export interface CreditDetail {
  total: number
  level: string
  color: string
  dimensions: {
    rating: { score: number; weight: string; raw: number }
    completion: { score: number; weight: string; raw: number }
    onTime: { score: number; weight: string; raw: number }
    noDispute: { score: number; weight: string; raw: number }
  }
}

export const workerStatsApi = {
  /** 个人统计 */
  getStats: () => request<WorkerStats>({ url: '/worker/stats' }),

  /** 信用分明细 */
  getCreditScore: () => request<CreditDetail>({ url: '/worker/credit-score' }),

  /** 更新封面 */
  updateCover: (data: { coverImage?: string; coverTemplate?: string }) =>
    request<{ message: string }>({ url: '/worker/cover-image', method: 'PUT', data }),
}
