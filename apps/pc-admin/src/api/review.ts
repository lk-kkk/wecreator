import request from './request'

export interface CreateReviewV2Params {
  qualityScore:       number
  communicationScore: number
  attitudeScore:      number
  deliveryScore:      number
  overallScore:       number
  comment?:           string
}

export const reviewApi = {
  /** V1 简版评价 */
  create: (assignmentId: number, data: { rating: number; comment?: string }) =>
    request.post(`/reviews/${assignmentId}`, data),

  /** V2 多维度评价 */
  createV2: (assignmentId: number, data: CreateReviewV2Params) =>
    request.post(`/reviews/${assignmentId}/v2`, data),

  /** 获取评价列表 */
  list: (assignmentId: number) =>
    request.get(`/reviews/${assignmentId}`),

  /** 零工历史评价 */
  workerReviews: (workerId: number, page?: number) =>
    request.get(`/reviews/workers/${workerId}`, { params: { page } }),
}
