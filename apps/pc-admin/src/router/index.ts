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
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/auth/RegisterPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/task/list',
      },
      {
        path: 'task/list',
        name: 'TaskList',
        component: () => import('@/pages/task/TaskListPage.vue'),
      },
      {
        path: 'task/create',
        name: 'TaskCreate',
        component: () => import('@/pages/task/TaskCreatePage.vue'),
      },
      {
        path: 'task/:id',
        name: 'TaskDetail',
        component: () => import('@/pages/task/TaskDetailPage.vue'),
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('@/pages/finance/FinancePage.vue'),
      },
      {
        path: 'finance/recharge',
        name: 'Recharge',
        component: () => import('@/pages/finance/RechargePage.vue'),
      },
      {
        path: 'worker/pool',
        name: 'WorkerPool',
        component: () => import('@/pages/worker/WorkerPoolPage.vue'),
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },
      {
        path: 'admin/subaccounts',
        name: 'Subaccounts',
        component: () => import('@/pages/admin/SubaccountPage.vue'),
      },
      {
        path: 'finance/invoices',
        name: 'Invoices',
        component: () => import('@/pages/finance/InvoicePage.vue'),
      },
      {
        path: 'task/dispute',
        name: 'Dispute',
        component: () => import('@/pages/task/DisputePage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('wc_token')

  if (to.meta.requiresAuth !== false && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'Login' || to.name === 'Register') && token) {
    next('/')
  } else {
    next()
  }
})

export default router
