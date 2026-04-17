import request from './request'

export const disputeApi = {
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    request.get('/disputes', { params }),

  getById: (id: number) =>
    request.get(`/disputes/${id}`),

  create: (data: { taskId: number; assignmentId: number; reason: string; evidenceUrls?: string[] }) =>
    request.post('/disputes', data),

  addEvidence: (id: number, evidenceUrls: string[]) =>
    request.post(`/disputes/${id}/evidence`, { evidenceUrls }),

  cancel: (id: number) =>
    request.patch(`/disputes/${id}/cancel`),

  accept: (id: number) =>
    request.patch(`/disputes/${id}/accept`),

  resolve: (id: number, data: { resolution: string; resolutionNote: string; splitRatioCompany?: number }) =>
    request.patch(`/disputes/${id}/resolve`, data),

  listByTask: (taskId: number) =>
    request.get(`/disputes/tasks/${taskId}`),
}
