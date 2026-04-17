import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/pages/dashboard/DashboardPage.vue') },
      { path: 'company', name: 'CompanyList', component: () => import('@/pages/company/CompanyListPage.vue') },
      { path: 'worker', name: 'WorkerList', component: () => import('@/pages/worker/WorkerListPage.vue') },
      { path: 'task', name: 'TaskList', component: () => import('@/pages/task/TaskListPage.vue') },
      { path: 'dispute', name: 'DisputeList', component: () => import('@/pages/dispute/DisputeListPage.vue') },
      { path: 'finance', name: 'FinanceOverview', component: () => import('@/pages/finance/FinanceOverviewPage.vue') },
      { path: 'finance/transactions', name: 'Transactions', component: () => import('@/pages/finance/TransactionListPage.vue') },
      { path: 'invoice', name: 'InvoiceList', component: () => import('@/pages/invoice/InvoiceListPage.vue') },
      { path: 'config', name: 'Config', component: () => import('@/pages/config/ConfigPage.vue') },
      { path: 'config/admins', name: 'AdminList', component: () => import('@/pages/config/AdminListPage.vue') },
      { path: 'config/audit-logs', name: 'AuditLogs', component: () => import('@/pages/config/AuditLogPage.vue') },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('platform_token')
  if (to.meta.requiresAuth !== false && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
