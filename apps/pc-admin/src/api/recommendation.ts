import request from './request'

export const recommendApi = {
  /** 为任务角色推荐零工（含评分维度） */
  forRole: (roleId: number, limit?: number) =>
    request.get(`/recommendations/roles/${roleId}/workers`, { params: { limit } }),

  /** 零工搜索 */
  searchWorkers: (params: {
    keyword?: string
    city?: string
    skillTag?: string
    minRating?: number
    page?: number
    pageSize?: number
  }) => request.get('/recommendations/workers/search', { params }),

  /** 零工侧：推荐任务列表 */
  forWorker: (page?: number, limit?: number) =>
    request.get('/recommendations/tasks', { params: { page, limit } }),
}
