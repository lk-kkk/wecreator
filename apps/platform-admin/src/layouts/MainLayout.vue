<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light" width="220" class="platform-sider">
      <div class="logo" :class="{ collapsed }">
        <span class="logo-icon">W</span>
        <span v-if="!collapsed" class="logo-text">WeCreator 运营</span>
      </div>
      <a-menu theme="light" mode="inline" :selectedKeys="selectedKeys" @click="onMenuClick" class="platform-menu">
        <a-menu-item key="/dashboard"><template #icon><DashboardOutlined /></template>数据看板</a-menu-item>
        <a-menu-item key="/company"><template #icon><BankOutlined /></template>企业管理</a-menu-item>
        <a-menu-item key="/worker"><template #icon><UserOutlined /></template>零工管理</a-menu-item>
        <a-menu-item key="/task"><template #icon><ProjectOutlined /></template>任务监控</a-menu-item>
        <a-menu-item key="/dispute"><template #icon><AuditOutlined /></template>争议仲裁</a-menu-item>
        <a-sub-menu key="finance-sub">
          <template #icon><DollarOutlined /></template>
          <template #title>资金监控</template>
          <a-menu-item key="/finance">资金总览</a-menu-item>
          <a-menu-item key="/finance/transactions">交易流水</a-menu-item>
        </a-sub-menu>
        <a-menu-item key="/invoice"><template #icon><FileTextOutlined /></template>发票管理</a-menu-item>
        <a-sub-menu key="config-sub">
          <template #icon><SettingOutlined /></template>
          <template #title>系统配置</template>
          <a-menu-item key="/config">平台参数</a-menu-item>
          <a-menu-item key="/config/admins">管理员</a-menu-item>
          <a-menu-item key="/config/audit-logs">审计日志</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="platform-header">
        <span style="font-size: 16px; font-weight: 500">平台运营管理后台</span>
        <a-space :size="12">
          <a-tag color="blue">{{ userStore.admin?.role?.replace('platform_', '') }}</a-tag>
          <span class="user-name">{{ userStore.admin?.displayName }}</span>
          <a-button type="link" danger @click="handleLogout">退出</a-button>
        </a-space>
      </a-layout-header>
      <a-layout-content class="platform-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  DashboardOutlined, BankOutlined, UserOutlined, ProjectOutlined,
  AuditOutlined, DollarOutlined, FileTextOutlined, SettingOutlined,
} from '@ant-design/icons-vue'
const collapsed = ref(false)
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const selectedKeys = computed(() => [route.path])

function onMenuClick({ key }: { key: string }) {
  router.push(key)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
/* ── 侧边栏 ── */
.platform-sider {
  background: var(--color-bg-sidebar) !important;
  border-right: 1px solid var(--color-border-light) !important;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border-light);
  overflow: hidden;
}

.logo.collapsed {
  padding: 0;
  justify-content: center;
}

.logo-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary, linear-gradient(135deg, #4E8CFF 0%, #2B6BE5 100%));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  border-radius: 8px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.platform-menu {
  border-right: none !important;
  padding: 8px 0;
}

.platform-menu :deep(.ant-menu-item),
.platform-menu :deep(.ant-menu-submenu-title) {
  margin: 2px 8px !important;
  width: calc(100% - 16px) !important;
  border-radius: 8px !important;
}

/* ── 顶栏 ── */
.platform-header {
  background: var(--color-bg-header) !important;
  padding: 0 24px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
  height: 56px;
}

.user-name {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ── 内容区 ── */
.platform-content {
  margin: 16px;
  padding: 24px;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  min-height: 360px;
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
}
</style>
