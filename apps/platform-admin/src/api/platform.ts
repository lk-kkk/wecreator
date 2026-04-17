import request from './request'

// ── Auth ──────────────────────────────────────────
export const platformApi = {
  login: (data: { username: string; password: string }) =>
    request.post<any, any>('/platform/login', data),
  refreshToken: (refreshToken: string) =>
    request.post<any, any>('/platform/refresh-token', { refreshToken }),
  getProfile: () => request.get<any, any>('/platform/profile'),
  logout: () => request.post<any, any>('/platform/logout'),

  // ── Dashboard ────────────────────────────────────
  getDashboard: () => request.get<any, any>('/platform/dashboard'),
  getTrends: () => request.get<any, any>('/platform/dashboard/trends'),
  getAlerts: () => request.get<any, any>('/platform/dashboard/alerts'),

  // ── Companies ────────────────────────────────────
  listCompanies: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/companies', { params }),
  getCompany: (id: number) => request.get<any, any>(`/platform/companies/${id}`),
  approveCompany: (id: number) => request.patch<any, any>(`/platform/companies/${id}/approve`),
  rejectCompany: (id: number, reason: string) =>
    request.patch<any, any>(`/platform/companies/${id}/reject`, { reason }),
  freezeCompany: (id: number, data: { action: string; reason: string }) =>
    request.patch<any, any>(`/platform/companies/${id}/freeze`, data),

  // ── Workers ──────────────────────────────────────
  listWorkers: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/workers', { params }),
  getWorker: (id: number) => request.get<any, any>(`/platform/workers/${id}`),
  banWorker: (id: number, data: { action: string; reason: string }) =>
    request.patch<any, any>(`/platform/workers/${id}/ban`, data),
  adjustCredit: (id: number, data: { adjustment: number; reason: string }) =>
    request.patch<any, any>(`/platform/workers/${id}/credit`, data),

  // ── Tasks ────────────────────────────────────────
  listTasks: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/tasks', { params }),
  getTask: (id: number) => request.get<any, any>(`/platform/tasks/${id}`),
  forceCloseTask: (id: number, reason: string) =>
    request.patch<any, any>(`/platform/tasks/${id}/close`, { reason }),
  freezeTaskFund: (id: number, data: { action: string; reason: string }) =>
    request.patch<any, any>(`/platform/tasks/${id}/freeze-fund`, data),

  // ── Disputes ─────────────────────────────────────
  listDisputes: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/disputes', { params }),
  getDispute: (id: number) => request.get<any, any>(`/platform/disputes/${id}`),
  acceptDispute: (id: number) => request.patch<any, any>(`/platform/disputes/${id}/accept`),
  resolveDispute: (id: number, data: { type: string; ratio?: number; explanation: string }) =>
    request.patch<any, any>(`/platform/disputes/${id}/resolve`, data),

  // ── Finance ──────────────────────────────────────
  getFinanceOverview: () => request.get<any, any>('/platform/finance/overview'),
  listTransactions: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/finance/transactions', { params }),
  listWithdrawals: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/finance/withdrawals', { params }),
  reviewWithdrawal: (id: number, data: { action: string; reason?: string }) =>
    request.patch<any, any>(`/platform/finance/withdrawals/${id}`, data),
  refund: (data: { companyId: number; amount: number; reason: string }) =>
    request.post<any, any>('/platform/finance/refund', data),

  // ── Config ───────────────────────────────────────
  getConfig: () => request.get<any, any>('/platform/config'),
  updateConfig: (data: Record<string, any>) =>
    request.put<any, any>('/platform/config', data),
  listAdmins: () => request.get<any, any>('/platform/admins'),
  createAdmin: (data: { username: string; password: string; displayName: string; role: string }) =>
    request.post<any, any>('/platform/admins', data),
  updateAdmin: (id: number, data: Record<string, any>) =>
    request.patch<any, any>(`/platform/admins/${id}`, data),
  listAuditLogs: (params?: Record<string, any>) =>
    request.get<any, any>('/platform/audit-logs', { params }),
}
