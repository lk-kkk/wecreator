import request from './request'

export const invoiceApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    request.get('/invoices', { params }),

  apply: (data: { amount: number; invoiceType: string; remark?: string }) =>
    request.post('/invoices', data),

  getById: (id: number) =>
    request.get(`/invoices/${id}`),

  listPending: (params?: { page?: number; pageSize?: number }) =>
    request.get('/invoices/pending', { params }),

  issue: (id: number, data: { invoiceNo: string; pdfUrl: string }) =>
    request.patch(`/invoices/${id}/issue`, data),

  reject: (id: number, data: { reason: string }) =>
    request.patch(`/invoices/${id}/reject`, data),
}
