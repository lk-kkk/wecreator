<template>
  <div class="finance-page">
    <!-- 页头 -->
    <div class="wc-page-header">
      <div>
        <h1 class="wc-page-title">财务中心</h1>
        <p class="wc-page-subtitle">账户余额管理与交易流水</p>
      </div>
      <a-button type="primary" size="large" @click="showRechargeModal = true">
        <template #icon><plus-circle-outlined /></template>
        立即充值
      </a-button>
    </div>

    <!-- 余额卡片区 -->
    <div class="balance-grid">
      <!-- 账户总余额 -->
      <div class="balance-card balance-primary">
        <div class="balance-label">账户总余额</div>
        <div class="balance-amount">
          <span class="balance-unit">¥</span>
          <span class="balance-value amount-number">{{ formatMoney(balance.balance) }}</span>
        </div>
        <div class="balance-footer">
          <router-link to="/finance/invoices" class="balance-link">
            <file-text-outlined />
            申请发票
          </router-link>
          <a-button type="primary" size="small" @click="showRechargeModal = true" class="recharge-btn-inline">
            充值
          </a-button>
        </div>
      </div>

      <!-- 可用余额 -->
      <div class="balance-card">
        <div class="balance-icon-wrap success-wrap">
          <check-circle-outlined class="balance-icon-main success-icon" />
        </div>
        <div class="balance-label">可用余额</div>
        <div class="balance-amount">
          <span class="balance-unit success-unit">¥</span>
          <span class="balance-value amount-number success-value">{{ formatMoney(balance.availableBalance) }}</span>
        </div>
        <div class="balance-hint">可立即用于发布任务</div>
      </div>

      <!-- 锁定中 -->
      <div class="balance-card">
        <div class="balance-icon-wrap frozen-wrap">
          <lock-outlined class="balance-icon-main frozen-icon" />
        </div>
        <div class="balance-label">锁定中</div>
        <div class="balance-amount">
          <span class="balance-unit frozen-unit">¥</span>
          <span class="balance-value amount-number frozen-value">{{ formatMoney(balance.lockedBalance) }}</span>
        </div>
        <div class="balance-hint">验收通过后自动解锁</div>
      </div>

      <!-- 安全保障 -->
      <div class="balance-card security-card">
        <div class="security-title">
          <safety-outlined class="security-logo" />
          平台资金保障
        </div>
        <div class="security-items">
          <div class="security-item">
            <check-circle-filled class="sec-check" />
            <span>资金由平台托管，企业侧全程可控</span>
          </div>
          <div class="security-item">
            <check-circle-filled class="sec-check" />
            <span>验收通过才结算，交付有保障</span>
          </div>
          <div class="security-item">
            <check-circle-filled class="sec-check" />
            <span>微信支付官方通道，安全可信赖</span>
          </div>
          <div class="security-item">
            <check-circle-filled class="sec-check" />
            <span>HTTPS 全程加密，数据安全传输</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 交易流水 -->
    <div class="wc-card tx-section">
      <div class="tx-header">
        <div class="wc-card-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
          交易流水
        </div>
        <a-space>
          <a-select
            v-model:value="filterType"
            placeholder="全部类型"
            allow-clear
            style="width: 130px;"
            @change="load"
          >
            <a-select-option value="recharge">充值</a-select-option>
            <a-select-option value="lock">锁定</a-select-option>
            <a-select-option value="unlock">解锁</a-select-option>
            <a-select-option value="settlement">结算</a-select-option>
          </a-select>
          <a-button @click="exportExcel">
            <template #icon><export-outlined /></template>
            导出 Excel
          </a-button>
        </a-space>
      </div>

      <a-table
        :data-source="transactions"
        :columns="columns"
        :loading="loading"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (t: number) => `共 ${t} 条`,
        }"
        row-key="transactionNo"
        size="middle"
        style="margin-top: 16px;"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">

          <!-- 流水号 -->
          <template v-if="column.key === 'transactionNo'">
            <span class="tx-no">{{ record.transactionNo }}</span>
          </template>

          <!-- 类型 -->
          <template v-if="column.key === 'type'">
            <span class="tx-type-badge" :class="typeBadgeClass(record.type)">
              {{ typeLabel[record.type] || record.type }}
            </span>
          </template>

          <!-- 方向 -->
          <template v-if="column.key === 'direction'">
            <span class="direction-badge" :class="record.direction === 'in' ? 'dir-in' : 'dir-out'">
              {{ record.direction === 'in' ? '收入' : '支出' }}
            </span>
          </template>

          <!-- 金额 -->
          <template v-if="column.key === 'amount'">
            <span class="tx-amount amount-number" :class="record.direction === 'in' ? 'amount-income' : 'amount-expense'">
              {{ record.direction === 'in' ? '+' : '-' }}¥{{ Number(record.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </span>
          </template>

          <!-- 状态 -->
          <template v-if="column.key === 'status'">
            <a-badge
              :status="statusBadge[record.status]"
              :text="statusLabel[record.status]"
              class="tx-status"
            />
          </template>

          <!-- 时间 -->
          <template v-if="column.key === 'createdAt'">
            <span class="time-text">{{ formatDate(record.createdAt) }}</span>
          </template>

        </template>
      </a-table>
    </div>

    <!-- 充值弹窗 -->
    <a-modal
      v-model:open="showRechargeModal"
      title="账户充值"
      :width="480"
      @ok="submitRecharge"
      :confirm-loading="recharging"
      ok-text="确认充值"
      cancel-text="取消"
    >
      <div class="recharge-modal-body">
        <!-- 快速金额选择 -->
        <div class="quick-amounts">
          <div class="quick-label">快速选择金额</div>
          <div class="quick-grid">
            <div
              v-for="amt in quickAmounts"
              :key="amt"
              class="quick-btn"
              :class="{ active: rechargeAmount === amt }"
              @click="rechargeAmount = amt"
            >
              ¥{{ amt.toLocaleString() }}
            </div>
          </div>
        </div>

        <div class="custom-amount-row">
          <span class="custom-label">自定义金额</span>
          <a-input-number
            v-model:value="rechargeAmount"
            :min="100"
            :step="100"
            style="width: 180px;"
            :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(v: any) => v.replace(/¥\s?|(,*)/g, '')"
            placeholder="最低 ¥100"
          />
        </div>

        <!-- 费率说明 -->
        <div class="fee-tip">
          <info-circle-outlined style="color: var(--color-primary); margin-right: 6px;" />
          <span>实际锁定金额 = 任务预算 × 108%（含8%平台服务费）</span>
        </div>

        <!-- 支付码区域 -->
        <div v-if="qrcodeUrl" class="qr-section">
          <div class="qr-title">
            <wechat-outlined class="wechat-icon" />
            请使用微信扫码完成支付
          </div>
          <div class="qr-code-box">
            <div class="qr-mock">{{ qrcodeUrl }}</div>
          </div>
          <a-button type="link" size="small" @click="mockPaid">
            模拟支付完成（仅开发环境）
          </a-button>
        </div>

        <!-- 安全说明 -->
        <div class="wc-security-box" style="margin-top: 16px;">
          <div class="wc-security-item">
            <safety-outlined class="wc-security-icon" />
            <span>资金存入平台托管账户，随时可查看余额</span>
          </div>
          <div class="wc-security-item">
            <lock-outlined class="wc-security-icon" />
            <span>支付通道由微信支付官方提供，安全可靠</span>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import {
  PlusCircleOutlined, FileTextOutlined, LockOutlined,
  SafetyOutlined, CheckCircleOutlined, CheckCircleFilled,
  ExportOutlined, WechatOutlined, InfoCircleOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'

const loading = ref(false)
const showRechargeModal = ref(false)
const recharging = ref(false)
const rechargeAmount = ref<number>(500)
const qrcodeUrl = ref('')
const currentTxNo = ref('')
const filterType = ref<string | undefined>(undefined)

const balance = reactive({ balance: 0, availableBalance: 0, lockedBalance: 0 })
const transactions = ref<any[]>([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000]

const typeLabel: Record<string, string> = {
  recharge: '充值', lock: '锁定', unlock: '解锁',
  settlement: '结算', withdraw: '提现', refund: '退款',
}

const typeBadgeClassMap: Record<string, string> = {
  recharge: 'type-income',
  settlement: 'type-income',
  refund: 'type-income',
  lock: 'type-frozen',
  unlock: 'type-info',
  withdraw: 'type-expense',
}

const statusBadge: Record<string, any> = {
  pending: 'warning',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
}

const statusLabel: Record<string, string> = {
  pending: '待处理', processing: '处理中', completed: '已完成', failed: '失败',
}

const columns = [
  { title: '流水号', key: 'transactionNo', ellipsis: true },
  { title: '类型', key: 'type', width: 90 },
  { title: '方向', key: 'direction', width: 80 },
  { title: '金额', key: 'amount', width: 140, align: 'right' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '时间', key: 'createdAt', width: 130 },
]

function formatMoney(v?: number) {
  if (v == null) return '0.00'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string) {
  return dayjs(d).format('MM-DD HH:mm')
}

function typeBadgeClass(type: string) {
  return typeBadgeClassMap[type] || 'type-info'
}

async function loadBalance() {
  const res: any = await request.get('/finance/balance')
  Object.assign(balance, res.data ?? res)
}

async function load() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, pageSize: pagination.pageSize }
    if (filterType.value) params.type = filterType.value
    const res: any = await request.get('/finance/transactions', { params })
    const data = res.data ?? res
    transactions.value = data.list
    pagination.total = data.total
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  load()
}

async function submitRecharge() {
  if (!rechargeAmount.value || rechargeAmount.value < 100) {
    message.warning('充值金额最低 ¥100')
    return
  }
  recharging.value = true
  try {
    const res: any = await request.post('/finance/recharge', { amount: rechargeAmount.value })
    const data = res.data ?? res
    qrcodeUrl.value = data.qrcodeUrl
    currentTxNo.value = data.transactionNo
  } finally {
    recharging.value = false
  }
}

async function mockPaid() {
  await request.post('/finance/recharge/callback', { transactionNo: currentTxNo.value })
  message.success('充值成功！余额已更新')
  showRechargeModal.value = false
  qrcodeUrl.value = ''
  loadBalance()
  load()
}

function exportExcel() {
  const params = new URLSearchParams({ export: '1' })
  if (filterType.value) params.append('type', filterType.value)
  const url = `/api/v1/finance/transactions?${params}`
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions_${dayjs().format('YYYYMMDD')}.csv`
  a.click()
}

onMounted(() => {
  loadBalance()
  load()
})
</script>

<style scoped>
.finance-page { padding-bottom: 32px; }

/* ── 余额卡片网格 ──────────────────────────────── */
.balance-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 16px;
  margin-bottom: 16px;
}

.balance-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 主余额卡（蓝色主题） */
.balance-primary {
  background: linear-gradient(135deg, #0858F4 0%, #2C70F4 100%);
  color: #fff;
}

.balance-primary .balance-label {
  color: rgba(255, 255, 255, 0.8);
}

.balance-primary .balance-unit {
  color: rgba(255, 255, 255, 0.8);
}

.balance-primary .balance-value {
  color: #fff;
  font-size: 32px;
}

.balance-primary .balance-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.balance-link {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.balance-link:hover {
  color: #fff;
}

.recharge-btn-inline {
  background: rgba(255, 255, 255, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  color: #fff !important;
}

.recharge-btn-inline:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

/* 图标包裹 */
.balance-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.success-wrap { background: var(--color-success-bg); }
.frozen-wrap  { background: var(--color-accent-bg); }

.balance-icon-main { font-size: 18px; }
.success-icon { color: var(--color-success); }
.frozen-icon  { color: var(--color-accent); }

.balance-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.balance-unit {
  font-size: 16px;
  font-weight: 600;
}

.success-unit { color: var(--color-success); }
.frozen-unit  { color: var(--color-accent); }

.balance-value {
  font-size: 24px;
  font-weight: 700;
}

.success-value { color: var(--color-success); }
.frozen-value  { color: var(--color-accent); }

.balance-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 8px;
}

/* 安全保障卡 */
.security-card {
  background: var(--color-primary-bg-soft);
  border: 1px solid var(--color-primary-border);
}

.security-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.security-logo {
  font-size: 16px;
}

.security-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.security-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.sec-check {
  color: var(--color-success);
  font-size: 13px;
  margin-top: 1px;
  flex-shrink: 0;
}

/* ── 流水区域 ──────────────────────────────────── */
.tx-section { padding: 20px; }

.tx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

/* 流水号 */
.tx-no {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: 'DIN Pro', 'DIN Alternate', monospace;
}

/* 类型徽标 */
.tx-type-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-income  { background: var(--color-success-bg);  color: var(--color-success); }
.type-expense { background: var(--color-error-bg);    color: var(--color-error); }
.type-frozen  { background: var(--color-accent-bg);   color: var(--color-accent); }
.type-info    { background: var(--color-primary-bg-soft); color: var(--color-primary); }

/* 方向徽标 */
.direction-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.dir-in  { background: var(--color-success-bg); color: var(--color-success); }
.dir-out { background: var(--color-error-bg);   color: var(--color-error); }

/* 金额 */
.tx-amount {
  font-size: 14px;
}

/* 充值弹窗 */
.recharge-modal-body { padding: 4px 0; }

.quick-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.quick-btn {
  height: 40px;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.quick-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg-soft);
}

.quick-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.custom-amount-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.custom-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.fee-tip {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  background: var(--color-primary-bg-soft);
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 0;
}

.qr-section {
  margin-top: 20px;
  text-align: center;
}

.qr-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.wechat-icon {
  font-size: 18px;
  color: #07C160;
}

.qr-code-box {
  display: inline-block;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  margin-bottom: 8px;
}

.qr-mock {
  width: 160px;
  height: 160px;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text-tertiary);
  border-radius: 4px;
  word-break: break-all;
  padding: 8px;
}

/* 响应式 */
@media (max-width: 1440px) {
  .balance-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 1024px) {
  .balance-grid { grid-template-columns: 1fr; }
}
</style>
