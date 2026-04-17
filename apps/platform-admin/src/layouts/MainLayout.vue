<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="dark" width="220">
      <div class="logo">{{ collapsed ? 'WC' : 'WeCreator 运营' }}</div>
      <a-menu theme="dark" mode="inline" :selectedKeys="selectedKeys" @click="onMenuClick">
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
      <a-layout-header style="background: #fff; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,0,0,.08)">
        <span style="font-size: 16px; font-weight: 500">平台运营管理后台</span>
        <a-space>
          <a-tag color="purple">{{ userStore.admin?.role?.replace('platform_', '') }}</a-tag>
          <span>{{ userStore.admin?.displayName }}</span>
          <a-button type="link" danger @click="handleLogout">退出</a-button>
        </a-space>
      </a-layout-header>
      <a-layout-content style="margin: 16px; padding: 24px; background: #fff; border-radius: 8px; min-height: 360px">
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
.logo {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  background: rgba(255,255,255,.1);
  margin: 8px;
  border-radius: 6px;
}
</style>
