import request from './request'

export const templateApi = {
  list: () => request.get('/task-templates'),

  save: (data: { name: string; fromTaskId?: number; title?: string; description?: string; taskMode?: string; roleConfig?: any[] }) =>
    request.post('/task-templates', data),

  remove: (id: number) =>
    request.delete(`/task-templates/${id}`),

  createTask: (data: { templateId: number; title?: string }) =>
    request.post('/task-templates/create-task', data),
}

export const customRoleApi = {
  list: () => request.get('/custom-roles'),

  create: (data: { roleName: string; description?: string; skillTags?: string; dailyRate?: number }) =>
    request.post('/custom-roles', data),

  update: (id: number, data: Partial<{ roleName: string; description: string; skillTags: string; dailyRate: number }>) =>
    request.patch(`/custom-roles/${id}`, data),

  remove: (id: number) =>
    request.delete(`/custom-roles/${id}`),
}
