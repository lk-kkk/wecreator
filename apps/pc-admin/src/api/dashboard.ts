import request from './request'

export const dashboardApi = {
  company:  () => request.get('/dashboard'),
  platform: () => request.get('/dashboard/platform'),
}
