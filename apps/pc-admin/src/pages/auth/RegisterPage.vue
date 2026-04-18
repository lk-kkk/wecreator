<template>
  <div class="register-root">
    <!-- 左侧：品牌区域 -->
    <div class="register-brand">
      <div class="brand-content">
        <div class="brand-logo">
          <div class="brand-icon">W</div>
          <span class="brand-name">WeCreator</span>
        </div>
        <h1 class="brand-headline">
          开始您的<br />高效用工之旅
        </h1>
        <p class="brand-desc">
          注册企业账号，即可发布任务、撮合零工、资金托管，全程线上一站式管理
        </p>

        <!-- 注册流程说明 -->
        <div class="steps-preview">
          <div class="step-item">
            <div class="step-num">01</div>
            <div class="step-text">
              <div class="step-title">填写企业信息</div>
              <div class="step-desc">企业名称、统一社会信用代码</div>
            </div>
          </div>
          <div class="step-divider" />
          <div class="step-item">
            <div class="step-num">02</div>
            <div class="step-text">
              <div class="step-title">设置管理员账号</div>
              <div class="step-desc">手机号 + 安全密码</div>
            </div>
          </div>
          <div class="step-divider" />
          <div class="step-item">
            <div class="step-num done">03</div>
            <div class="step-text">
              <div class="step-title">发布首个任务</div>
              <div class="step-desc">5分钟内快速完成</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 装饰元素 -->
      <div class="brand-decoration">
        <div class="deco-circle deco-1" />
        <div class="deco-circle deco-2" />
      </div>
    </div>

    <!-- 右侧：注册表单 -->
    <div class="register-panel">
      <div class="register-card">
        <div class="register-header">
          <h2 class="register-title">创建企业账号</h2>
          <p class="register-subtitle">已有账号？<router-link to="/login">立即登录</router-link></p>
        </div>

        <!-- 错误提示 -->
        <a-alert
          v-if="errorMsg"
          :message="errorMsg"
          type="error"
          show-icon
          closable
          @close="errorMsg = ''"
          style="margin-bottom: 16px;"
        />

        <a-form
          ref="formRef"
          :model="form"
          :rules="rules"
          layout="vertical"
          @finish="handleRegister"
          class="register-form"
        >
          <!-- 企业信息分组 -->
          <div class="form-section-title">企业信息</div>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="企业全称" name="name">
                <a-input
                  v-model:value="form.name"
                  placeholder="请输入营业执照上的企业全称"
                  size="large"
                >
                  <template #prefix>
                    <bank-outlined style="color: var(--color-text-tertiary);" />
                  </template>
                </a-input>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="统一社会信用代码" name="creditCode">
            <a-input
              v-model:value="form.creditCode"
              placeholder="18位统一社会信用代码"
              size="large"
              :maxlength="18"
            >
              <template #prefix>
                <idcard-outlined style="color: var(--color-text-tertiary);" />
              </template>
            </a-input>
          </a-form-item>

          <!-- 账号信息分组 -->
          <div class="form-section-title" style="margin-top: 16px;">管理员账号</div>

          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="管理员姓名" name="adminName">
                <a-input
                  v-model:value="form.adminName"
                  placeholder="真实姓名"
                  size="large"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="管理员手机号" name="adminPhone">
                <a-input
                  v-model:value="form.adminPhone"
                  placeholder="用于登录"
                  size="large"
                  :maxlength="11"
                >
                  <template #prefix>
                    <phone-outlined style="color: var(--color-text-tertiary);" />
                  </template>
                </a-input>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="登录密码" name="password">
            <a-input-password
              v-model:value="form.password"
              placeholder="8位以上，含大小写字母和数字"
              size="large"
            >
              <template #prefix>
                <lock-outlined style="color: var(--color-text-tertiary);" />
              </template>
            </a-input-password>
            <!-- 密码强度指示 -->
            <div v-if="form.password" class="password-strength">
              <div class="strength-bars">
                <div class="strength-bar" :class="{ active: passwordStrength >= 1, weak: passwordStrength === 1 }" />
                <div class="strength-bar" :class="{ active: passwordStrength >= 2, medium: passwordStrength === 2 }" />
                <div class="strength-bar" :class="{ active: passwordStrength >= 3, strong: passwordStrength >= 3 }" />
              </div>
              <span class="strength-label" :class="strengthClass">{{ strengthText }}</span>
            </div>
          </a-form-item>

          <a-form-item label="联系邮箱（选填）" name="contactEmail">
            <a-input
              v-model:value="form.contactEmail"
              placeholder="用于接收通知（可选）"
              size="large"
            >
              <template #prefix>
                <mail-outlined style="color: var(--color-text-tertiary);" />
              </template>
            </a-input>
          </a-form-item>

          <!-- 协议 -->
          <div class="agreement-row">
            <a-checkbox v-model:checked="agreed">
              我已阅读并同意
            </a-checkbox>
            <a class="agreement-link">《用户服务协议》</a>
            <span style="color: var(--color-text-tertiary);">和</span>
            <a class="agreement-link">《隐私政策》</a>
          </div>

          <a-form-item style="margin-top: 16px; margin-bottom: 0;">
            <a-button
              type="primary"
              html-type="submit"
              block
              size="large"
              :loading="loading"
              :disabled="!agreed"
              class="register-btn"
            >
              {{ loading ? '注册中...' : '免费注册' }}
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 安全说明 -->
        <div class="security-footer">
          <safety-outlined class="security-icon" />
          <span>企业信息受《数据安全法》保护，平台承诺不用于任何商业目的</span>
        </div>
      </div>
    </div>

    <!-- 注册成功弹窗 -->
    <a-modal
      v-model:open="showSuccessModal"
      :footer="null"
      :closable="false"
      :maskClosable="false"
      width="420px"
      centered
    >
      <div class="success-modal-body">
        <div class="success-icon-wrapper">
          <check-circle-outlined class="success-icon" />
        </div>
        <h3 class="success-title">注册成功！</h3>
        <p class="success-text">
          您的企业账号已创建，平台将在 <strong>1-3 个工作日</strong> 内完成资质审核。
        </p>
        <p class="success-hint">
          审核通过前您可以登录浏览平台功能，部分高级功能将在审核通过后解锁。
        </p>
        <a-button
          type="primary"
          block
          size="large"
          @click="goToLogin"
          class="success-btn"
        >
          前往登录
        </a-button>
        <div class="success-countdown">
          {{ countdown }} 秒后自动跳转
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  BankOutlined, IdcardOutlined, PhoneOutlined,
  LockOutlined, MailOutlined, SafetyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const agreed = ref(false)
const errorMsg = ref('')
const showSuccessModal = ref(false)
const countdown = ref(5)
const formRef = ref()
let countdownTimer: ReturnType<typeof setInterval> | null = null

const form = reactive({
  name: '',
  creditCode: '',
  adminName: '',
  adminPhone: '',
  password: '',
  contactEmail: '',
})

const rules = {
  name: [{ required: true, message: '请输入企业名称' }],
  creditCode: [
    { required: true, message: '请输入信用代码' },
    { pattern: /^[0-9A-Za-z]{18}$/, message: '信用代码为18位字母数字' },
  ],
  adminName: [{ required: true, message: '请输入管理员姓名' }],
  adminPhone: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
  ],
  password: [
    { required: true, message: '请设置密码' },
    { min: 8, message: '密码至少8位' },
    { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: '需包含大小写字母和数字' },
  ],
}

// ── 密码强度 ──────────────────────────────────
const passwordStrength = computed(() => {
  const p = form.password
  if (!p) return 0
  let score = 0
  if (p.length >= 8) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p)) score++
  else if (/\d/.test(p) || /[^a-zA-Z0-9]/.test(p)) score += 0.5
  return Math.min(Math.ceil(score), 3)
})

const strengthText = computed(() => {
  const map = ['', '弱', '中', '强']
  return map[passwordStrength.value] || ''
})

const strengthClass = computed(() => {
  const map = ['', 'weak', 'medium', 'strong']
  return map[passwordStrength.value] || ''
})

// ── 注册 ──────────────────────────────────────
async function handleRegister() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  if (!agreed.value) {
    message.warning('请先阅读并同意用户协议')
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    await userStore.register(form)
    // 注册成功 → 显示成功弹窗
    showSuccessModal.value = true
    startCountdown()
  } catch (err: any) {
    const backendMsg = err?.response?.data?.message
    if (backendMsg) {
      errorMsg.value = backendMsg
    } else if (err?.message) {
      errorMsg.value = err.message
    } else {
      errorMsg.value = '注册失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}

// ── 倒计时跳转 ────────────────────────────────
function startCountdown() {
  countdown.value = 5
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      goToLogin()
    }
  }, 1000)
}

function goToLogin() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  showSuccessModal.value = false
  router.push('/login')
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped>
/* ── 整体布局 ──────────────────────────────────── */
.register-root {
  min-height: 100vh;
  display: flex;
}

/* ── 左侧品牌区 ──────────────────────────────── */
.register-brand {
  flex: 1;
  background: linear-gradient(140deg, #0446D0 0%, #0858F4 50%, #2C70F4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  position: relative;
  overflow: hidden;
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
  width: 40px; height: 40px;
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
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  margin: 0 0 20px;
}

.brand-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.80);
  line-height: 1.7;
  margin-bottom: 40px;
}

/* 步骤预览 */
.steps-preview {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.step-divider {
  width: 2px;
  height: 20px;
  background: rgba(255, 255, 255, 0.25);
  margin-left: 15px;
}

.step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-num.done {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.step-text {
  padding-top: 4px;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.step-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

/* 装饰 */
.brand-decoration { position: absolute; inset: 0; pointer-events: none; }

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
}

.deco-1 { width: 360px; height: 360px; top: -80px; right: -60px; }
.deco-2 { width: 200px; height: 200px; bottom: 80px; left: 5%; background: rgba(252, 100, 0, 0.12); }

/* ── 右侧表单区 ──────────────────────────────── */
.register-panel {
  width: 560px;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow-y: auto;
}

.register-card {
  width: 100%;
  max-width: 460px;
}

.register-header {
  margin-bottom: 28px;
}

.register-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 6px;
}

.register-subtitle {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
}

.register-subtitle a {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

/* 分组标题 */
.form-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 8px 0 6px;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 16px;
}

/* 密码强度 */
.password-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.strength-bars {
  display: flex;
  gap: 4px;
}

.strength-bar {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: var(--color-border-light);
  transition: background-color 0.3s;
}

.strength-bar.active.weak { background: #E8383C; }
.strength-bar.active.medium { background: #faad14; }
.strength-bar.active.strong { background: #38D048; }

.strength-label {
  font-size: 11px;
  font-weight: 500;
}

.strength-label.weak { color: #E8383C; }
.strength-label.medium { color: #faad14; }
.strength-label.strong { color: #38D048; }

/* 协议 */
.agreement-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.agreement-row :deep(.ant-checkbox-wrapper) {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.agreement-link {
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}

.agreement-link:hover { text-decoration: underline; }

/* 注册按钮 */
.register-btn {
  height: 44px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
}

/* 安全说明 */
.security-footer {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light);
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}

.security-icon {
  color: var(--color-primary);
  font-size: 13px;
  margin-top: 1px;
  flex-shrink: 0;
}

/* ── 成功弹窗 ──────────────────────────────── */
.success-modal-body {
  text-align: center;
  padding: 16px 0 0;
}

.success-icon-wrapper {
  margin-bottom: 16px;
}

.success-icon {
  font-size: 56px;
  color: #38D048;
}

.success-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 12px;
}

.success-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  line-height: 1.6;
}

.success-hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-bottom: 24px;
}

.success-btn {
  height: 44px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
}

.success-countdown {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 响应式 */
@media (max-width: 1024px) {
  .register-brand { display: none; }
  .register-panel { width: 100%; }
}
</style>
