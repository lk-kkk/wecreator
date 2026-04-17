import request from './request'

export const subaccountApi = {
  list: () => request.get('/admin/subaccounts'),

  create: (data: { name: string; phone: string; password: string; role: string }) =>
    request.post('/admin/subaccounts', data),

  update: (id: number, data: { name?: string; role?: string; newPassword?: string }) =>
    request.patch(`/admin/subaccounts/${id}`, data),

  setStatus: (id: number, active: boolean) =>
    request.patch(`/admin/subaccounts/${id}/${active ? 'enable' : 'disable'}`),

  remove: (id: number) =>
    request.delete(`/admin/subaccounts/${id}`),

  getRolePermissions: (role?: string) =>
    request.get('/admin/subaccounts/roles/permissions', { params: { role } }),
}
