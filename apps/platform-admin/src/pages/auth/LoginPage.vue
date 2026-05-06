<template>
  <div class="login-container">
    <!-- 装饰元素 -->
    <div class="bg-decoration">
      <div class="deco-circle deco-1" />
      <div class="deco-circle deco-2" />
      <div class="deco-circle deco-3" />
    </div>

    <div class="login-card">
      <div class="login-header">
        <div class="logo-wrapper">
          <div class="logo-icon">🛡️</div>
        </div>
        <h1 class="login-title">WeCreator</h1>
        <p class="login-subtitle">平台运营管理后台</p>
      </div>

      <a-form :model="form" @finish="handleLogin" layout="vertical" class="login-form">
        <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="form.username" placeholder="请输入用户名" size="large" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" placeholder="请输入密码" size="large" @pressEnter="handleLogin" />
        </a-form-item>
        <a-form-item style="margin-bottom: 0;">
          <a-button type="primary" html-type="submit" block size="large" :loading="loading" class="login-btn">
            {{ loading ? '登录中...' : '登 录' }}
          </a-button>
        </a-form-item>
      </a-form>

      <div class="security-footer">
        <span>🔒 数据全程 HTTPS 加密传输</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function handleLogin() {
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    message.success('登录成功')
    router.push('/dashboard')
  } catch (e: any) {
    message.error(e?.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.deco-1 {
  width: 500px;
  height: 500px;
  top: -150px;
  right: -100px;
  background: rgba(255, 255, 255, 0.06);
}

.deco-2 {
  width: 350px;
  height: 350px;
  bottom: -100px;
  left: -80px;
  background: rgba(255, 255, 255, 0.05);
}

.deco-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 15%;
  background: rgba(255, 255, 255, 0.03);
}

/* 登录卡片 */
.login-card {
  width: 420px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12),
              0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

/* 头部 */
.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-icon {
  font-size: 48px;
  filter: drop-shadow(0 2px 8px rgba(102, 126, 234, 0.3));
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-subtitle {
  font-size: 12px;
  color: #666;
  margin: 0;
}

/* 表单 */
.login-form :deep(.ant-form-item-label > label) {
  font-size: 12px;
  font-weight: 500;
  color: #475467;
}

.login-btn {
  height: 44px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  letter-spacing: 2px;
  border-radius: 8px !important;
  margin-top: 8px;
}

/* 安全说明 */
.security-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #999;
}
</style>
