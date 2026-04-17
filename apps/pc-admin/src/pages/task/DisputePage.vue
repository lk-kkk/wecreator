<template>
  <div class="dispute-page">
    <a-page-header title="争议仲裁" @back="$router.back()">
      <template #extra>
        <a-button type="primary" @click="showCreate = true">+ 发起争议</a-button>
      </template>
    </a-page-header>

    <!-- 状态筛选 -->
    <div class="filter-bar">
      <a-radio-group v-model:value="filterStatus" @change="loadList">
        <a-radio-button value="">全部</a-radio-button>
        <a-radio-button v-for="s in statusOptions" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <div class="page-body">
      <!-- 左栏：列表 -->
      <div class="list-panel">
        <a-spin :spinning="loading">
          <div
            v-for="item in list"
            :key="item.disputeId"
            class="dispute-card"
            :class="{ active: selected?.disputeId === item.disputeId }"
            @click="select(item)"
          >
            <div class="card-top">
              <span class="dispute-id">#{{ item.disputeId }}</span>
              <a-tag :color="statusColor[item.status]">{{ statusLabel[item.status] }}</a-tag>
            </div>
            <div class="card-reason">{{ item.reason.slice(0, 60) }}{{ item.reason.length > 60 ? '…' : '' }}</div>
            <div class="card-meta">
              <span>发起方：{{ item.initiatorType === 'company' ? '企业' : '零工' }}</span>
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
          <a-empty v-if="list.length === 0" description="暂无争议" />
        </a-spin>
        <a-pagination
          v-if="total > pageSize"
          :total="total" :pageSize="pageSize"
          :current="page" @change="onPage"
          class="list-pager"
          size="small"
        />
      </div>

      <!-- 右栏：详情 -->
      <div class="detail-panel" v-if="selected">
        <!-- 基本信息 -->
        <a-card :bordered="false" class="detail-card">
          <a-descriptions :column="2" size="small">
            <a-descriptions-item label="任务ID">{{ selected.taskId }}</a-descriptions-item>
            <a-descriptions-item label="分配ID">{{ selected.assignmentId }}</a-descriptions-item>
            <a-descriptions-item label="发起方">{{ selected.initiatorType === 'company' ? '企业' : '零工' }}</a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="statusColor[selected.status]">{{ statusLabel[selected.status] }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="创建时间" :span="2">{{ formatDate(selected.createdAt) }}</a-descriptions-item>
          </a-descriptions>

          <div class="reason-block">
            <div class="section-label">争议原因</div>
            <p class="reason-text">{{ selected.reason }}</p>
          </div>
        </a-card>

        <!-- 证据材料 -->
        <a-card title="证据材料" :bordered="false" class="detail-card">
          <div class="evidence-list">
            <template v-if="selected.evidenceUrls?.length">
              <a
                v-for="(url, i) in selected.evidenceUrls"
                :key="i"
                :href="url"
                target="_blank"
                class="evidence-link"
              >
                📎 证据{{ (i as number) + 1 }}
              </a>
            </template>
            <span v-else class="no-evidence">暂无证据</span>
          </div>

          <!-- 补充证据 -->
          <div v-if="['pending', 'investigating'].includes(selected.status)" class="add-evidence">
            <OssUploader
              category="deliverable"
              mode="dragger"
              :multiple="true"
              :max-count="10"
              :show-list="true"
              @uploaded="onEvidenceUploaded"
            />
            <a-button
              v-if="newEvidenceUrls.length > 0"
              type="primary" size="small"
              style="margin-top:8px"
              @click="submitEvidence"
            >提交证据（{{ newEvidenceUrls.length }}个）</a-button>
          </div>
        </a-card>

        <!-- 仲裁操作面板（管理员） -->
        <a-card title="仲裁操作" :bordered="false" class="detail-card">
          <!-- 受理 -->
          <div v-if="selected.status === 'pending'" class="action-section">
            <a-button type="primary" @click="handleAccept">📋 受理仲裁</a-button>
          </div>

          <!-- 裁决 -->
          <div v-else-if="selected.status === 'investigating'" class="action-section">
            <a-form layout="vertical" :model="resolveForm">
              <a-form-item label="裁决结果" required>
                <a-radio-group v-model:value="resolveForm.resolution">
                  <a-radio value="resolved_company">企业胜诉（退款企业）</a-radio>
                  <a-radio value="resolved_worker">零工胜诉（结算零工）</a-radio>
                  <a-radio value="resolved_split">按比例分摊</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item
                v-if="resolveForm.resolution === 'resolved_split'"
                label="企业分得比例（%）"
              >
                <a-slider
                  v-model:value="resolveForm.splitRatioCompany"
                  :min="0" :max="100" :step="10"
                  :marks="{ 0:'0%', 50:'50%', 100:'100%' }"
                />
                <div class="split-preview">
                  企业 {{ resolveForm.splitRatioCompany }}% ／ 零工 {{ 100 - resolveForm.splitRatioCompany }}%
                </div>
              </a-form-item>

              <a-form-item label="裁决说明" required>
                <a-textarea
                  v-model:value="resolveForm.resolutionNote"
                  :rows="3" :maxlength="500" show-count
                  placeholder="请详细说明裁决依据"
                />
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary" danger
                  :loading="resolving"
                  @click="handleResolve"
                >⚖️ 确认裁决</a-button>
              </a-form-item>
            </a-form>
          </div>

          <!-- 已裁决 -->
          <div v-else-if="['resolved_company','resolved_worker','resolved_split'].includes(selected.status)" class="resolution-result">
            <a-result
              :status="'success'"
              :title="statusLabel[selected.status]"
              :sub-title="selected.resolution"
            />
            <p v-if="selected.resolvedAt" class="resolve-time">
              裁决时间：{{ formatDate(selected.resolvedAt) }}
            </p>
          </div>

          <!-- 已取消 -->
          <div v-else-if="selected.status === 'cancelled'">
            <a-tag color="default">争议已撤销</a-tag>
          </div>
        </a-card>
      </div>

      <a-empty v-else description="请选择左侧争议记录查看详情" class="empty-detail" />
    </div>

    <!-- 发起争议弹窗 -->
    <a-modal
      v-model:open="showCreate"
      title="发起争议"
      @ok="handleCreate"
      ok-text="提交争议"
      :confirm-loading="creating"
    >
      <a-form layout="vertical" :model="createForm">
        <a-form-item label="关联任务ID" required>
          <a-input-number v-model:value="createForm.taskId" :min="1" style="width:100%" />
        </a-form-item>
        <a-form-item label="关联分配ID" required>
          <a-input-number v-model:value="createForm.assignmentId" :min="1" style="width:100%" />
        </a-form-item>
        <a-form-item label="争议原因" required>
          <a-textarea
            v-model:value="createForm.reason"
            :rows="4" :maxlength="500" show-count
            placeholder="请详细描述争议内容"
          />
        </a-form-item>
        <a-form-item label="初始证据（选填）">
          <OssUploader
            category="deliverable"
            mode="dragger"
            :multiple="true"
            :show-list="true"
            @uploaded="(f: any) => createForm.evidenceUrls.push(f.cdnUrl)"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import OssUploader from '@/components/OssUploader.vue'
import { disputeApi } from '@/api/dispute'

const loading   = ref(false)
const list      = ref<any[]>([])
const selected  = ref<any>(null)
const total     = ref(0)
const page      = ref(1)
const pageSize  = ref(20)
const filterStatus = ref('')
const showCreate = ref(false)
const creating   = ref(false)
const resolving  = ref(false)
const newEvidenceUrls = ref<string[]>([])

const createForm = reactive({
  taskId:      0,
  assignmentId: 0,
  reason:      '',
  evidenceUrls: [] as string[],
})

const resolveForm = reactive<{
  resolution:         string
  resolutionNote:     string
  splitRatioCompany:  number
}>({
  resolution:         '',
  resolutionNote:     '',
  splitRatioCompany:  50,
})

const statusOptions = [
  { value: 'pending',        label: '待受理' },
  { value: 'investigating',  label: '仲裁中' },
  { value: 'resolved_company', label: '企业胜诉' },
  { value: 'resolved_worker',  label: '零工胜诉' },
  { value: 'resolved_split',   label: '按比例' },
  { value: 'cancelled',      label: '已取消' },
]
const statusLabel: Record<string, string> = Object.fromEntries(statusOptions.map(s => [s.value, s.label]))
const statusColor: Record<string, string> = {
  pending: 'orange', investigating: 'blue',
  resolved_company: 'green', resolved_worker: 'green', resolved_split: 'cyan',
  cancelled: 'default',
}

const formatDate = (d: any) => d ? new Date(d).toLocaleString('zh-CN') : '—'

async function loadList() {
  loading.value = true
  try {
    const res = await disputeApi.list({ status: filterStatus.value || undefined, page: page.value, pageSize: pageSize.value })
    list.value  = res.data.list || []
    total.value = res.data.total || 0
  } catch { message.error('加载失败') }
  finally { loading.value = false }
}

function select(item: any) {
  selected.value = item
  newEvidenceUrls.value = []
  Object.assign(resolveForm, { resolution: '', resolutionNote: '', splitRatioCompany: 50 })
}

function onPage(p: number) { page.value = p; loadList() }

function onEvidenceUploaded(f: any) { newEvidenceUrls.value.push(f.cdnUrl) }

async function submitEvidence() {
  try {
    const res = await disputeApi.addEvidence(selected.value.disputeId, newEvidenceUrls.value)
    selected.value = res.data
    newEvidenceUrls.value = []
    message.success('证据已提交')
    loadList()
  } catch (e: any) { message.error(e?.response?.data?.message || '提交失败') }
}

async function handleAccept() {
  try {
    const res = await disputeApi.accept(selected.value.disputeId)
    selected.value = res.data
    message.success('已受理')
    loadList()
  } catch (e: any) { message.error(e?.response?.data?.message || '操作失败') }
}

async function handleResolve() {
  if (!resolveForm.resolution) { message.warning('请选择裁决结果'); return }
  if (!resolveForm.resolutionNote.trim()) { message.warning('请填写裁决说明'); return }
  resolving.value = true
  try {
    const res = await disputeApi.resolve(selected.value.disputeId, resolveForm)
    selected.value = res.data
    message.success('裁决已提交 ✅')
    loadList()
  } catch (e: any) { message.error(e?.response?.data?.message || '裁决失败') }
  finally { resolving.value = false }
}

async function handleCreate() {
  if (!createForm.taskId || !createForm.assignmentId) { message.warning('请填写任务ID和分配ID'); return }
  if (!createForm.reason.trim()) { message.warning('请填写争议原因'); return }
  creating.value = true
  try {
    await disputeApi.create(createForm)
    message.success('争议已发起')
    showCreate.value = false
    Object.assign(createForm, { taskId: 0, assignmentId: 0, reason: '', evidenceUrls: [] })
    loadList()
  } catch (e: any) { message.error(e?.response?.data?.message || '发起失败') }
  finally { creating.value = false }
}

onMounted(loadList)
</script>

<style scoped>
.dispute-page { background: var(--color-bg-page); min-height: 100vh; }
.filter-bar { padding: 12px 24px; background: #fff; border-bottom: 1px solid var(--color-border-light); }

.page-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0;
  height: calc(100vh - 120px);
  overflow: hidden;
}

.list-panel {
  background: #fff;
  border-right: 1px solid var(--color-border-light);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dispute-card {
  padding: 12px; border-radius: 8px;
  border: 1px solid var(--color-border-light); cursor: pointer;
  transition: all .15s;
}
.dispute-card:hover, .dispute-card.active {
  border-color: var(--color-primary); background: var(--color-primary-bg-soft);
}
.card-top   { display: flex; justify-content: space-between; margin-bottom: 6px; }
.dispute-id { font-size: 12px; color: #aaa; }
.card-reason { font-size: 13px; color: #333; margin-bottom: 6px; }
.card-meta  { display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
.list-pager { text-align: center; padding: 8px 0; }

.detail-panel {
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.detail-card {}
.section-label { font-weight: 600; color: #555; margin-bottom: 6px; }
.reason-text   { color: #333; line-height: 1.6; margin: 0; }

.evidence-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.evidence-link { color: var(--color-primary); font-size: 13px; }
.no-evidence   { color: #ccc; font-size: 13px; }
.add-evidence  { margin-top: 8px; }

.action-section { padding: 8px 0; }
.split-preview  { text-align: center; color: var(--color-primary); font-weight: 600; margin-top: 4px; }
.resolution-result { text-align: center; }
.resolve-time  { color: #aaa; font-size: 12px; text-align: center; }

.empty-detail { display: flex; align-items: center; justify-content: center; }
</style>
