import request from '@/api/request'

export const projectApi = {
  list: (params?: any) => request.get<any, any>('/projects', { params }).then((r: any) => r.data),
  board: () => request.get<any, any>('/projects/board').then((r: any) => r.data),
  create: (data: any) => request.post<any, any>('/projects', data).then((r: any) => r.data),
  detail: (id: number) => request.get<any, any>(`/projects/${id}`).then((r: any) => r.data),
  update: (id: number, data: any) => request.put<any, any>(`/projects/${id}`, data),
  updateStatus: (id: number, data: { status?: string; phase?: string }) =>
    request.patch<any, any>(`/projects/${id}/status`, data),
}
