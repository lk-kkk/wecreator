import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由结构对齐 PRD V3.6 §9.1 企业端页面清单
 * 侧边栏菜单结构见 PRD V3.6 §9.1 侧边栏菜单结构
 */
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
      // ── 默认首页 → 任务广场 ──
      { path: '', redirect: '/task/square' },

      // ── 📊 工作台 (Dashboard) ──
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },

      // ── 📦 任务管理 ──
      {
        path: 'task/square',
        name: 'TaskSquare',
        component: () => import('@/pages/task/TaskListPage.vue'),
      },
      { path: 'task/list', redirect: '/task/square' }, // 兼容旧路由
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

      // ── 📁 项目管理 ── PRD: /project/list
      {
        path: 'project/list',
        name: 'ProjectList',
        component: () => import('@/pages/project/ProjectListPage.vue'),
      },
      { path: 'project', redirect: '/project/list' }, // 兼容短路径
      {
        path: 'project/:id',
        name: 'ProjectDetail',
        component: () => import('@/pages/project/ProjectDetailPage.vue'),
      },

      // ── 👥 零工库 ──
      {
        path: 'worker/pool',
        name: 'WorkerPool',
        component: () => import('@/pages/worker/WorkerPoolPage.vue'),
      },

      // ── ⚖️ 争议管理 ──
      {
        path: 'task/dispute',
        name: 'Dispute',
        component: () => import('@/pages/dispute/DisputePage.vue'),
      },

      // ── 💰 财务中心 ──
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

      // ── 🧾 发票管理 ──
      {
        path: 'finance/invoices',
        name: 'Invoices',
        component: () => import('@/pages/finance/InvoicePage.vue'),
      },

      // ── ⚙️ 系统管理 ── PRD V3.6: SubMenu (仅 super_admin 可见)
      {
        path: 'admin/subaccounts',
        name: 'Subaccounts',
        component: () => import('@/pages/settings/SubaccountPage.vue'),
        meta: { requiresRole: 'super_admin' },
      },
      { path: 'settings/users', redirect: '/admin/subaccounts' }, // PRD页面清单兼容
      {
        path: 'settings/llm',
        name: 'LlmConfig',
        component: () => import('@/pages/settings/LlmConfigPage.vue'),
        meta: { requiresRole: 'super_admin' },
      },
      { path: 'ai/config', redirect: '/settings/llm' }, // 兼容旧路由
      {
        path: 'settings/agents',
        name: 'AgentList',
        component: () => import('@/pages/settings/AgentListPage.vue'),
        meta: { requiresRole: 'super_admin' },
      },
      { path: 'ai/agents', redirect: '/settings/agents' }, // 兼容旧路由

      // ── 🔔 通知中心 ──
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('@/pages/notification/NotificationPage.vue'),
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
