import request from './request'

export const checkinApi = {
  /** 企业查看打卡记录列表 */
  list: (assignmentId: number, params?: { status?: string; page?: number; pageSize?: number }) =>
    request.get(`/tasks/assignments/${assignmentId}/checkins`, { params }),

  /** 确认工时打卡 */
  confirm: (checkinId: number) =>
    request.post(`/tasks/checkins/${checkinId}/confirm`, { checkinId }),

  /** 驳回工时打卡 */
  reject: (checkinId: number, reason: string) =>
    request.post(`/tasks/checkins/${checkinId}/reject`, { checkinId, reason }),
}
