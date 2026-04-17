<template>
  <div class="invoice-page">
    <a-page-header title="发票管理" @back="$router.back()" />

    <!-- 余额提示卡 -->
    <div class="balance-card">
      <div class="balance-item">
        <span class="bl-label">账户余额</span>
        <span class="bl-val">¥{{ formatMoney(balanceInfo.balance) }}</span>
      </div>
      <div class="balance-divider" />
      <div class="balance-item">
        <span class="bl-label">可开票金额</span>
        <span class="bl-val green">¥{{ formatMoney(unbilledAmount) }}</span>
      </div>
      <div class="balance-divider" />
      <div class="balance-item">
        <a-button type="primary" @click="showApply = true" :disabled="unbilledAmount <= 0">
          申请开票
        </a-button>
      </div>
    </div>

    <!-- 发票列表 -->
    <div class="invoice-section">
      <a-spin :spinning="loading">
        <a-table
          :dataSource="invoices"
          :columns="columns"
          :pagination="{ total, current: page, pageSize, onChange: onPageChange }"
          rowKey="invoiceId"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'invoiceType'">
              <a-tag :color="record.invoiceType === '专票' ? 'blue' : 'default'">
                {{ record.invoiceType }}
              </a-tag>
            </template>
            <template v-if="column.key === 'amount'">
              <span>¥{{ formatMoney(record.amount) }}</span>
            </template>
            <template v-if="column.key === 'taxAmount'">
              <span class="tax-amt">¥{{ formatMoney(record.taxAmount) }}（税率 {{ (record.taxRate * 100).toFixed(0) }}%）</span>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor[record.status]">{{ statusLabel[record.status] }}</a-tag>
            </template>
            <template v-if="column.key === 'actions'">
              <a
                v-if="record.pdfUrl"
                :href="record.pdfUrl"
                target="_blank"
                class="dl-link"
              >📄 下载PDF</a>
              <span v-else class="no-pdf">—</span>
            </template>
          </template>
        </a-table>
      </a-spin>
    </div>

    <!-- 申请开票弹窗 -->
    <a-modal
      v-model:open="showApply"
      title="申请开票"
      @ok="handleApply"
      ok-text="提交申请"
      :confirm-loading="applying"
    >
      <a-form layout="vertical" :model="applyForm">
        <a-form-item label="申请金额（元）" required>
          <a-input-number
            v-model:value="applyForm.amount"
            :min="100" :max="unbilledAmount"
            :step="100"
            style="width:100%"
            :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
          />
          <div class="amount-hint">可开票上限：¥{{ formatMoney(unbilledAmount) }}</div>
        </a-form-item>

        <a-form-item label="发票类型" required>
          <a-radio-group v-model:value="applyForm.invoiceType">
            <a-radio value="专票">增值税专用发票（税率 9%）</a-radio>
            <a-radio value="普票">增值税普通发票（税率 6%）</a-radio>
          </a-radio-group>
        </a-form-item>

        <!-- 税额预览 -->
        <div v-if="applyForm.amount > 0" class="tax-preview">
          <span>含税金额：</span>
          <span class="tax-bold">¥{{ (applyForm.amount * (1 + (applyForm.invoiceType === '专票' ? 0.09 : 0.06))).toFixed(2) }}</span>
          <span class="tax-note">（税额 ¥{{ (applyForm.amount * (applyForm.invoiceType === '专票' ? 0.09 : 0.06)).toFixed(2) }}）</span>
        </div>

        <a-form-item label="备注（选填）">
          <a-textarea v-model:value="applyForm.remark" :rows="2" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { invoiceApi } from '@/api/invoice'
import { financeApi } from '@/api/finance'

const loading       = ref(false)
const applying      = ref(false)
const showApply     = ref(false)
const invoices      = ref<any[]>([])
const total         = ref(0)
const page          = ref(1)
const pageSize      = ref(10)
const unbilledAmount = ref(0)
const balanceInfo   = reactive({ balance: 0, lockedBalance: 0 })

const applyForm = reactive({ amount: 0, invoiceType: '普票', remark: '' })

const statusLabel: Record<string, string> = {
  pending:  '审核中', issued: '已开具', rejected: '已驳回',
}
const statusColor: Record<string, string> = {
  pending: 'orange', issued: 'green', rejected: 'red',
}

const formatMoney = (v?: number) => {
  if (v == null || isNaN(v)) return '0.00'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const columns = [
  { title: '申请时间',   dataIndex: 'appliedAt',   key: 'appliedAt', customRender: ({ text }: any) => text ? new Date(text).toLocaleString('zh-CN') : '—' },
  { title: '发票类型',   dataIndex: 'invoiceType', key: 'invoiceType' },
  { title: '申请金额',   dataIndex: 'amount',      key: 'amount' },
  { title: '税额',       key: 'taxAmount' },
  { title: '发票号',     dataIndex: 'invoiceNo',   key: 'invoiceNo', customRender: ({ text }: any) => text || '—' },
  { title: '状态',       dataIndex: 'status',      key: 'status' },
  { title: '操作',       key: 'actions' },
]

async function loadData() {
  loading.value = true
  try {
    const [invoiceRes, balanceRes] = await Promise.all([
      invoiceApi.list({ page: page.value, pageSize: pageSize.value }),
      financeApi.getBalance(),
    ])
    invoices.value      = invoiceRes.data?.list ?? []
    total.value         = invoiceRes.data?.total ?? 0
    unbilledAmount.value = invoiceRes.data?.unbilledAmount ?? 0
    balanceInfo.balance = balanceRes.data?.balance ?? 0
  } catch { message.error('加载失败') }
  finally { loading.value = false }
}

function onPageChange(p: number) { page.value = p; loadData() }

async function handleApply() {
  if (!applyForm.amount || applyForm.amount < 100) { message.warning('申请金额最少 ¥100'); return }
  if (applyForm.amount > unbilledAmount.value) { message.warning('超过可开票金额'); return }
  applying.value = true
  try {
    await invoiceApi.apply(applyForm)
    message.success('申请已提交，预计 3-5 个工作日处理 ✅')
    showApply.value = false
    Object.assign(applyForm, { amount: 0, invoiceType: '普票', remark: '' })
    loadData()
  } catch (e: any) { message.error(e?.response?.data?.message || '申请失败') }
  finally { applying.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.invoice-page { background: var(--color-bg-page); min-height: 100vh; }

.balance-card {
  display: flex; align-items: center; gap: 24px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  margin: 0 24px 16px; border-radius: 16px; padding: 24px 32px;
}
.balance-item { display: flex; flex-direction: column; gap: 4px; }
.bl-label { font-size: 13px; color: rgba(255,255,255,.8); }
.bl-val   { font-size: 24px; font-weight: 800; color: #fff; }
.bl-val.green { color: var(--color-success-bg); }
.balance-divider { width: 1px; height: 40px; background: rgba(255,255,255,.3); }

.invoice-section { padding: 0 24px; background: #fff; margin: 0 24px; border-radius: 12px; }

.amount-hint { font-size: 12px; color: #aaa; margin-top: 4px; }
.tax-preview {
  background: var(--color-bg-hover); border-radius: 8px; padding: 10px 14px;
  font-size: 13px; margin-bottom: 12px;
}
.tax-bold { font-weight: 700; color: #333; margin: 0 4px; }
.tax-note { color: #aaa; }

.tax-amt  { font-size: 12px; color: #aaa; }
.dl-link  { color: var(--color-primary); font-size: 13px; }
.no-pdf   { color: #ccc; }
</style>
