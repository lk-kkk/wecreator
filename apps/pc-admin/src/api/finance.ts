import request from './request'

export const financeApi = {
  getBalance: () =>
    request.get('/finance/balance'),

  getTransactions: (params?: { page?: number; pageSize?: number; type?: string }) =>
    request.get('/finance/transactions', { params }),

  createRecharge: (amount: number) =>
    request.post('/finance/recharge', { amount }),

  getRechargeStatus: (transactionNo: string) =>
    request.get(`/finance/recharge/${transactionNo}/status`),
}
