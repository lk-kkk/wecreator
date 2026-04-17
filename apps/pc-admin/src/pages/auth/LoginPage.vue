<template>
  <div class="login-root">
    <!-- 左侧：品牌区域 -->
    <div class="login-brand">
      <div class="brand-content">
        <div class="brand-logo">
          <div class="brand-icon">W</div>
          <span class="brand-name">WeCreator</span>
        </div>
        <h1 class="brand-headline">
          专业零工创作者<br />管理平台
        </h1>
        <p class="brand-desc">
          连接企业与创意零工，高效完成撮合·协作·结算一体化管理
        </p>
        <div class="brand-features">
          <div class="feature-item">
            <span class="feature-icon">🚀</span>
            <span>5步发布任务，极速撮合人才</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🔒</span>
            <span>资金托管，验收后自动结算</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📊</span>
            <span>实时数据看板，全程可视化管理</span>
          </div>
        </div>
      </div>
      <!-- 装饰元素 -->
      <div class="brand-decoration">
        <div class="deco-circle deco-1" />
        <div class="deco-circle deco-2" />
        <div class="deco-circle deco-3" />
      </div>
    </div>

    <!-- 右侧：登录表单 -->
    <div class="login-panel">
      <div class="login-card">
        <div class="login-header">
          <h2 class="login-title">欢迎回来</h2>
          <p class="login-subtitle">登录企业管理账号</p>
        </div>

        <a-form
          :model="form"
          :rules="rules"
          layout="vertical"
          @finish="handleLogin"
          class="login-form"
        >
          <a-form-item label="手机号" name="phone">
            <a-input
              v-model:value="form.phone"
              placeholder="请输入管理员手机号"
              size="large"
              :maxlength="11"
              class="form-input"
            >
              <template #prefix>
                <phone-outlined style="color: var(--color-text-tertiary);" />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password
              v-model:value="form.password"
              placeholder="请输入密码"
              size="large"
              class="form-input"
            >
              <template #prefix>
                <lock-outlined style="color: var(--color-text-tertiary);" />
              </template>
            </a-input-password>
          </a-form-item>

          <div class="form-options">
            <a-checkbox v-model:checked="rememberMe">记住我</a-checkbox>
            <a class="forgot-link">忘记密码？</a>
          </div>

          <a-form-item style="margin-bottom: 12px; margin-top: 8px;">
            <a-button
              type="primary"
              html-type="submit"
              block
              size="large"
              :loading="loading"
              class="login-btn"
            >
              {{ loading ? '登录中...' : '登录' }}
            </a-button>
          </a-form-item>

          <div class="register-link">
            还没有企业账号？
            <router-link to="/register">立即免费注册</router-link>
          </div>
        </a-form>

        <!-- 安全说明 -->
        <div class="security-footer">
          <safety-outlined class="security-icon" />
          <span>由微信支付官方通道保障 · 数据全程 HTTPS 加密</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PhoneOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const loading = ref(false)
const rememberMe = ref(false)

const form = reactive({ phone: '', password: '' })

const rules = {
  phone: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 8, message: '密码至少8位' },
  ],
}

async function handleLogin() {
  loading.value = true
  try {
    await userStore.login(form)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (err: any) {
    message.error(err?.response?.data?.message || '登录失败，请检查手机号和密码')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── 整体布局：左品牌 + 右表单 ────────────────────────── */
.login-root {
  min-height: 100vh;
  display: flex;
}

/* ── 左侧品牌区 ──────────────────────────────────────── */
.login-brand {
  flex: 1;
  background: linear-gradient(140deg, #0446D0 0%, #0858F4 45%, #2C70F4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
}

.brand-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.brand-name {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.brand-headline {
  font-size: 40px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  margin: 0 0 20px;
  letter-spacing: -0.5px;
}

.brand-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.80);
  line-height: 1.7;
  margin-bottom: 40px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.90);
  font-size: 15px;
}

.feature-icon {
  font-size: 20px;
  flex-shrink: 0;
}

/* 装饰圆形 */
.brand-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
}

.deco-1 {
  width: 400px; height: 400px;
  top: -100px; right: -100px;
}

.deco-2 {
  width: 280px; height: 280px;
  bottom: 60px; right: 40px;
  background: rgba(255, 255, 255, 0.03);
}

.deco-3 {
  width: 160px; height: 160px;
  bottom: -40px; left: 10%;
  background: rgba(252, 100, 0, 0.15);
}

/* ── 右侧表单区 ──────────────────────────────────────── */
.login-panel {
  width: 480px;
  flex-shrink: 0;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.login-header {
  margin-bottom: 32px;
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.login-subtitle {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin: 0;
}

/* 表单 */
.login-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.form-input :deep(input) {
  font-size: 14px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.form-options :deep(.ant-checkbox-wrapper) {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.forgot-link {
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}

.forgot-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.login-btn {
  height: 44px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 2px;
  border-radius: 8px !important;
}

.register-link {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.register-link a {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

.register-link a:hover {
  text-decoration: underline;
}

/* 安全说明 */
.security-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light);
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.security-icon {
  color: var(--color-primary);
  font-size: 13px;
}

/* ── 响应式 ──────────────────────────────────────────── */
@media (max-width: 1024px) {
  .login-brand { display: none; }
  .login-panel { width: 100%; }
}
</style>
