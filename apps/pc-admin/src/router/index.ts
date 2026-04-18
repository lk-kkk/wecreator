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
        redirect: '/task/square',
      },
      {
        path: 'task/square',
        name: 'TaskSquare',
        component: () => import('@/pages/task/TaskListPage.vue'),
      },
      {
        // V3.5 兼容旧路由
        path: 'task/list',
        redirect: '/task/square',
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
        component: () => import('@/pages/settings/SubaccountPage.vue'),
        meta: { requiresRole: 'super_admin' },
      },
      {
        path: 'finance/invoices',
        name: 'Invoices',
        component: () => import('@/pages/finance/InvoicePage.vue'),
      },
      {
        path: 'task/dispute',
        name: 'Dispute',
        component: () => import('@/pages/dispute/DisputePage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── 路由守卫 ──────────────────────────────────
let profileFetched = false

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('wc_token')

  // 1. 未登录但需要认证 → 跳登录
  if (to.meta.requiresAuth !== false && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 2. 已登录访问登录/注册页 → 跳首页
  if ((to.name === 'Login' || to.name === 'Register') && token) {
    next('/')
    return
  }

  // 3. 登录后首次访问：自动获取 Profile
  if (token && !profileFetched) {
    profileFetched = true
    try {
      const { useUserStore } = await import('@/stores/user')
      const userStore = useUserStore()
      if (userStore.isLoggedIn && !userStore.companyProfile) {
        await userStore.fetchProfile()
      }
    } catch {
      // Profile 获取失败不阻塞导航
    }
  }

  // 4. 角色权限检查
  if (to.meta.requiresRole) {
    try {
      const { useUserStore } = await import('@/stores/user')
      const userStore = useUserStore()
      if (userStore.userRole !== to.meta.requiresRole) {
        next('/')
        return
      }
    } catch {
      next('/')
      return
    }
  }

  next()
})

// 登出时重置 flag
router.afterEach((to) => {
  if (to.name === 'Login') {
    profileFetched = false
  }
})

export default router
