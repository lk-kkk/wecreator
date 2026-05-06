<template>
  <a-layout class="main-layout">
    <!-- 侧边导航 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      :width="220"
      :collapsed-width="64"
      class="main-sider"
    >
      <!-- Logo -->
      <div class="sider-logo" :class="{ collapsed }">
        <div class="logo-icon">W</div>
        <transition name="logo-text">
          <span v-if="!collapsed" class="logo-text">WeCreator</span>
        </transition>
      </div>

      <!-- 导航菜单 — 对齐 PRD V3.6 §9.1 侧边栏结构 -->
      <a-menu
        mode="inline"
        :selected-keys="selectedKeys"
        :open-keys="openKeys"
        :inline-indent="16"
        class="main-menu"
        @openChange="onOpenChange"
      >
        <!-- 📊 工作台 -->
        <a-menu-item key="dashboard" @click="$router.push('/dashboard')">
          <template #icon><fund-outlined /></template>
          <span>工作台</span>
        </a-menu-item>

        <!-- 📦 任务管理 SubMenu -->
        <a-sub-menu key="task-group">
          <template #icon><project-outlined /></template>
          <template #title>任务管理</template>
          <a-menu-item key="task-square" @click="$router.push('/task/square')">
            <template #icon><appstore-outlined /></template>
            任务广场
          </a-menu-item>
          <a-menu-item key="task-create" @click="$router.push('/task/create')">
            <template #icon><plus-circle-outlined /></template>
            发布任务
          </a-menu-item>
          <a-menu-item key="dispute" @click="$router.push('/task/dispute')">
            <template #icon><audit-outlined /></template>
            争议管理
          </a-menu-item>
        </a-sub-menu>

        <!-- 📁 项目管理 SubMenu (V3.7) -->
        <a-sub-menu key="project-group">
          <template #icon><partition-outlined /></template>
          <template #title>项目管理</template>
          <a-menu-item key="project-list" @click="$router.push('/project/list')">
            <template #icon><unordered-list-outlined /></template>
            项目列表
          </a-menu-item>
          <a-menu-item key="project-board" @click="$router.push('/project/board')">
            <template #icon><appstore-outlined /></template>
            项目看板
          </a-menu-item>
        </a-sub-menu>

        <!-- 👥 零工库 -->
        <a-menu-item key="worker-pool" @click="$router.push('/worker/pool')">
          <template #icon><team-outlined /></template>
          <span>零工库</span>
        </a-menu-item>

        <!-- 💰 财务中心 SubMenu -->
        <a-sub-menu key="finance-group">
          <template #icon><wallet-outlined /></template>
          <template #title>财务中心</template>
          <a-menu-item key="finance" @click="$router.push('/finance')">
            <template #icon><wallet-outlined /></template>
            资金概览
          </a-menu-item>
          <a-menu-item key="invoices" @click="$router.push('/finance/invoices')">
            <template #icon><file-text-outlined /></template>
            发票管理
          </a-menu-item>
        </a-sub-menu>

        <!-- ⚙️ 系统管理 SubMenu — PRD V3.6: 仅 super_admin 可见 -->
        <a-sub-menu v-if="userStore.isSuperAdmin" key="settings-group">
          <template #icon><setting-outlined /></template>
          <template #title>系统管理</template>
          <a-menu-item key="subaccounts" @click="$router.push('/admin/subaccounts')">
            <template #icon><user-switch-outlined /></template>
            子账号管理
          </a-menu-item>
          <a-menu-item-group title="任务配置">
            <a-menu-item key="role-config" @click="$router.push('/settings/roles')">
              <template #icon><usergroup-add-outlined /></template>
              角色配置
            </a-menu-item>
            <a-menu-item key="checkpoint-config" @click="$router.push('/settings/checkpoints')">
              <template #icon><flag-outlined /></template>
              检查点配置
            </a-menu-item>
            <a-menu-item key="skill-config" @click="$router.push('/settings/skills')">
              <template #icon><tags-outlined /></template>
              技能配置
            </a-menu-item>
          </a-menu-item-group>
          <a-menu-item-group title="AI 设置">
            <a-menu-item key="llm-config" @click="$router.push('/settings/llm')">
              <template #icon><api-outlined /></template>
              大模型配置
            </a-menu-item>
            <a-menu-item key="agents" @click="$router.push('/settings/agents')">
              <template #icon><robot-outlined /></template>
              智能体管理
            </a-menu-item>
          </a-menu-item-group>
        </a-sub-menu>
      </a-menu>

      <!-- 底部折叠按钮 -->
      <div class="sider-collapse-btn" @click="collapsed = !collapsed">
        <menu-fold-outlined v-if="!collapsed" />
        <menu-unfold-outlined v-else />
        <span v-if="!collapsed" class="collapse-label">收起菜单</span>
      </div>
    </a-layout-sider>

    <!-- 主内容区 -->
    <a-layout class="content-layout">
      <!-- 顶部 Header -->
      <a-layout-header class="main-header">
        <div class="header-left">
          <a-breadcrumb v-if="breadcrumbs.length > 0" class="header-breadcrumb">
            <a-breadcrumb-item v-for="(bc, i) in breadcrumbs" :key="i">
              <router-link v-if="bc.path && i < breadcrumbs.length - 1" :to="bc.path">
                {{ bc.label }}
              </router-link>
              <span v-else>{{ bc.label }}</span>
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="header-right">
          <!-- 余额快捷显示 -->
          <router-link to="/finance" class="header-balance">
            <wallet-outlined class="balance-icon" />
            <span class="balance-label">余额</span>
            <span class="balance-value">¥ {{ balanceDisplay }}</span>
          </router-link>

          <a-divider type="vertical" style="height: 20px; margin: 0 8px;" />

          <!-- 通知 -->
          <NotificationBell />

          <a-divider type="vertical" style="height: 20px; margin: 0 8px;" />

          <!-- 用户信息 -->
          <a-dropdown placement="bottomRight">
            <div class="header-user">
              <a-avatar :style="{ background: 'var(--color-primary)', fontSize: '14px' }">
                {{ userInitial }}
              </a-avatar>
              <span class="user-name">{{ userStore.companyName || '企业账号' }}</span>
              <down-outlined style="font-size: 10px; color: var(--color-text-tertiary);" />
            </div>
            <template #overlay>
              <a-menu class="user-dropdown">
                <a-menu-item key="profile" disabled>
                  <div class="dropdown-user-info">
                    <div class="dropdown-company">{{ userStore.companyName }}</div>
                    <div class="dropdown-role">{{ userStore.userName }} · {{ userStore.isSuperAdmin ? '超级管理员' : '管理员' }}</div>
                  </div>
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="settings">
                  <setting-outlined />
                  <span style="margin-left: 8px;">账号设置</span>
                </a-menu-item>
                <a-menu-item key="logout" @click="handleLogout" class="logout-item">
                  <logout-outlined />
                  <span style="margin-left: 8px;">退出登录</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 页面内容 -->
      <a-layout-content class="main-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  FundOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  PlusCircleOutlined,
  TeamOutlined,
  AuditOutlined,
  WalletOutlined,
  FileTextOutlined,
  UserSwitchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DownOutlined,
  SettingOutlined,
  LogoutOutlined,
  PartitionOutlined,
  RobotOutlined,
  ApiOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
  FlagOutlined,
  TagsOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const collapsed = ref(false)
const balanceDisplay = ref('—')

// ── SubMenu 展开状态 ───────────────────────────────────────────
// 初始展开任务管理组
const openKeys = ref<string[]>(['task-group'])
function onOpenChange(keys: string[]) {
  openKeys.value = keys
}

// ── 路由 → 选中菜单 key ── 对齐 PRD V3.6 路由路径 ──────────
const selectedKeys = computed(() => {
  const path = route.path
  if (path.includes('/task/create'))       return ['task-create']
  if (path.includes('/task/dispute'))      return ['dispute']
  if (path.includes('/task/square'))       return ['task-square']
  if (path.includes('/task'))              return ['task-square']
  if (path.includes('/project/board'))     return ['project-board']
  if (path.includes('/project'))           return ['project-list']
  if (path.includes('/worker'))            return ['worker-pool']
  if (path.includes('/finance/invoices'))  return ['invoices']
  if (path.includes('/finance'))           return ['finance']
  if (path.includes('/admin/subaccounts'))  return ['subaccounts']
  if (path.includes('/settings/llm'))      return ['llm-config']
  if (path.includes('/settings/agents'))   return ['agents']
  if (path.includes('/settings/roles'))    return ['role-config']
  if (path.includes('/settings/checkpoints')) return ['checkpoint-config']
  if (path.includes('/settings/skills'))      return ['skill-config']
  if (path.includes('/dashboard'))         return ['dashboard']
  if (path.includes('/notifications'))     return ['notifications']
  return ['dashboard']
})

// ── 面包屑 ── 对齐 PRD V3.6 菜单名称 ─────────────────────────
interface Breadcrumb { label: string; path?: string }
const breadcrumbs = computed<Breadcrumb[]>(() => {
  const path = route.path
  const map: Record<string, Breadcrumb[]> = {
    '/dashboard':              [{ label: '工作台' }],
    '/task/square':            [{ label: '任务管理' }, { label: '任务广场' }],
    '/task/create':            [{ label: '任务管理' }, { label: '发布任务' }],
    '/task/dispute':           [{ label: '争议管理' }],
    '/worker/pool':            [{ label: '零工库' }],
    '/finance':                [{ label: '财务中心' }],
    '/finance/recharge':       [{ label: '财务中心', path: '/finance' }, { label: '充值' }],
    '/finance/invoices':       [{ label: '财务中心', path: '/finance' }, { label: '发票管理' }],
    '/project/list':           [{ label: '项目管理' }, { label: '项目列表' }],
    '/project/board':          [{ label: '项目管理' }, { label: '项目看板' }],
    '/admin/subaccounts':        [{ label: '系统管理' }, { label: '子账号管理' }],
    '/settings/llm':           [{ label: '系统管理' }, { label: '大模型配置' }],
    '/settings/agents':        [{ label: '系统管理' }, { label: '智能体管理' }],
    '/settings/roles':         [{ label: '系统管理' }, { label: '角色配置' }],
    '/settings/checkpoints':   [{ label: '系统管理' }, { label: '检查点配置' }],
    '/settings/skills':        [{ label: '系统管理' }, { label: '技能配置' }],
    '/notifications':          [{ label: '通知中心' }],
  }
  // 任务详情动态路由
  if (/^\/task\/\w+/.test(path) && !path.includes('/create') && !path.includes('/dispute')) {
    return [{ label: '任务管理' }, { label: '任务广场', path: '/task/square' }, { label: '任务详情' }]
  }
  // 项目详情动态路由
  if (/^\/project\/\w+/.test(path) && !path.includes('/list')) {
    return [{ label: '项目管理', path: '/project/list' }, { label: '项目详情' }]
  }
  return map[path] || []
})

// ── 用户头像首字母 ────────────────────────────────────────────
const userInitial = computed(() => {
  return userStore.avatarInitial
})

// ── 加载余额 ──────────────────────────────────────────────────
async function loadBalance() {
  try {
    const res: any = await request.get('/finance/balance')
    const data = res.data ?? res
    const val = data.availableBalance ?? 0
    balanceDisplay.value = val >= 10000
      ? (val / 10000).toFixed(1) + '万'
      : val.toFixed(2)
  } catch {
    balanceDisplay.value = '—'
  }
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

onMounted(loadBalance)
</script>

<style scoped>
/* ── 整体布局 ──────────────────────────────────────────────── */
.main-layout {
  height: 100vh;
  background: var(--color-bg-page);
}

/* ── 侧边栏 ────────────────────────────────────────────────── */
.main-sider {
  background: var(--color-bg-sidebar) !important;
  border-right: 1px solid var(--color-border-light) !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--duration-normal) var(--ease-in-out);
}

/* Logo */
.sider-logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
  overflow: hidden;
}

.sider-logo.collapsed {
  padding: 0;
  justify-content: center;
}

.logo-icon {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #4E8CFF 0%, #2B6BE5 100%);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.logo-text-enter-active, .logo-text-leave-active {
  transition: opacity var(--duration-fast), width var(--duration-normal);
}
.logo-text-enter-from, .logo-text-leave-to {
  opacity: 0;
  width: 0;
}

/* 菜单 */
.main-menu {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important;
}

.main-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

.main-menu :deep(.ant-menu-submenu-title) {
  margin: 2px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

.main-menu :deep(.ant-menu-sub.ant-menu-inline) {
  background: transparent !important;
}

.main-menu :deep(.ant-menu-sub .ant-menu-item) {
  margin: 1px 8px 1px 12px;
  width: calc(100% - 20px);
  padding-left: 40px !important;
  font-size: 13px;
}

.menu-divider {
  height: 1px;
  background: var(--color-border-light);
  margin: 8px 16px;
}

/* 菜单项分组标题 */
.main-menu :deep(.ant-menu-item-group-title) {
  padding: 8px 16px 4px 24px !important;
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.main-menu :deep(.ant-menu-item-group-list .ant-menu-item) {
  margin: 1px 8px 1px 12px;
  padding-left: 36px !important;
}

/* 底部折叠按钮 */
.sider-collapse-btn {
  height: 48px;
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  font-size: 14px;
  transition: color var(--duration-fast), background var(--duration-fast);
  flex-shrink: 0;
}

.sider-collapse-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg-soft);
}

.collapse-label {
  font-size: 12px;
  white-space: nowrap;
}

/* ── Header ────────────────────────────────────────────────── */
.main-header {
  background: var(--color-bg-header) !important;
  border-bottom: 1px solid var(--color-border-light) !important;
  height: var(--layout-header-height) !important;
  padding: 0 24px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-breadcrumb :deep(.ant-breadcrumb-link) {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.header-breadcrumb :deep(.ant-breadcrumb-link a) {
  color: var(--color-text-tertiary);
}

.header-breadcrumb :deep(.ant-breadcrumb-link a:hover) {
  color: var(--color-primary);
}

.header-breadcrumb :deep(.ant-breadcrumb-item:last-child .ant-breadcrumb-link) {
  color: var(--color-text-primary);
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 余额显示 */
.header-balance {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  text-decoration: none;
  transition: background var(--duration-fast);
}

.header-balance:hover {
  background: var(--color-primary-bg-soft);
}

.balance-icon {
  color: var(--color-primary);
  font-size: 14px;
}

.balance-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.balance-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: 'DIN Pro', 'DIN Alternate', -apple-system, sans-serif;
}

/* 通知图标 */
.header-notify {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon {
  font-size: 18px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--duration-fast);
}

.header-icon:hover {
  color: var(--color-primary);
}

/* 用户信息 */
.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--duration-fast);
}

.header-user:hover {
  background: var(--color-bg-hover);
}

.user-name {
  font-size: 13px;
  color: var(--color-text-secondary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 用户下拉 */
.dropdown-user-info {
  padding: 4px 0;
}

.dropdown-company {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dropdown-role {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.logout-item {
  color: var(--color-error) !important;
}

/* ── 内容区 ────────────────────────────────────────────────── */
.content-layout {
  background: var(--color-bg-page);
  display: flex !important;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* main-content 是内容区内的可滚动区域 */
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  background: var(--color-bg-page);
}

/* 发布任务页面：去掉 padding，保留滚动 */
.main-content:has(.tcp-page) {
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
