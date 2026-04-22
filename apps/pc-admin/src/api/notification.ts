/**
 * 企业端通知中心 API — V3.7 §4.3
 * 对接 CompanyNotificationController（/company-notifications）
 */
import request from '@/api/request'

export interface Notification {
  id: number
  type: string
  title: string
  content: string
  refType?: string | null
  refId?: number | null
  isRead: boolean
  createdAt: string
}

export interface NotificationListParams {
  page?: number
  pageSize?: number
  type?: string
  isRead?: boolean
}

export interface NotificationListResult {
  total: number
  unread: number
  page: number
  pageSize: number
  list: Notification[]
}

export const notificationApi = {
  /** 列表（分页 + 类型/未读筛选） */
  list: (params?: NotificationListParams) =>
    request.get<any, NotificationListResult>('/company-notifications', { params }),

  /** 未读数量（顶栏徽标 + 轮询） */
  unreadCount: () =>
    request.get<any, { count: number }>('/company-notifications/unread-count'),

  /** 批量已读（单条：传 [id]） */
  markRead: (ids: number[]) =>
    request.put<any, { updated: number }>('/company-notifications/read', { ids }),

  /** 全部已读 */
  markAllRead: () =>
    request.put<any, { updated: number }>('/company-notifications/read', { all: true }),
}
