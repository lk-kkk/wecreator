/**
 * V3.7 Phase 6 — Analytics API
 */
import request from './request'

export interface AnalyticsEventPayload {
  event: string
  refType?: string
  refId?: number
  props?: Record<string, unknown>
}

export const analyticsApi = {
  /** 前端埋点上报 */
  track: (payload: AnalyticsEventPayload) =>
    request.post('/analytics/events', payload).catch(() => {
      /* 埋点失败不应打断业务 */
    }),

  tasks:    () => request.get('/analytics/tasks'),
  projects: () => request.get('/analytics/projects'),
  quality:  () => request.get('/analytics/quality'),
}
