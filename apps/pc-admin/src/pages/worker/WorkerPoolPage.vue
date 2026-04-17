<template>
  <div class="worker-pool-page">
    <div class="page-header">
      <h2>零工库</h2>
    </div>

    <!-- 搜索和筛选栏 -->
    <div class="filter-bar">
      <a-input-search
        v-model:value="filters.keyword"
        placeholder="搜索零工姓名/简介"
        style="width:240px"
        allow-clear
        @search="fetchWorkers"
      />
      <a-input
        v-model:value="filters.city"
        placeholder="城市"
        style="width:120px"
        allow-clear
        @change="fetchWorkers"
      />
      <a-select
        v-model:value="filters.roleName"
        placeholder="角色筛选"
        style="width:160px"
        allow-clear
        @change="fetchWorkers"
      >
        <a-select-option v-for="r in platformRoles" :key="r.roleName" :value="r.roleName">
          {{ r.roleName }}
        </a-select-option>
      </a-select>
      <a-button @click="fetchWorkers">查询</a-button>
    </div>

    <!-- 零工列表 -->
    <a-table
      :columns="columns"
      :data-source="workers"
      :loading="loading"
      :pagination="pagination"
      row-key="workerId"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div class="worker-cell">
            <a-avatar :size="32" :style="{ background: 'var(--color-primary)' }">{{ (record.realName || '?')[0] }}</a-avatar>
            <div>
              <div class="worker-name-text">{{ record.realName || '未填写' }}</div>
              <div class="worker-city">{{ record.city || '—' }}</div>
            </div>
          </div>
        </template>
        <template v-if="column.key === 'roles'">
          <a-tag v-for="r in (record.roles || []).slice(0, 3)" :key="r.roleName" color="blue" size="small">
            {{ r.roleName }}
          </a-tag>
          <span v-if="(record.roles || []).length > 3" style="color:#999">+{{ record.roles.length - 3 }}</span>
          <span v-if="!record.roles?.length" style="color:#ccc">—</span>
        </template>
        <template v-if="column.key === 'rating'">
          <a-rate :value="record.avgRating" :count="5" disabled allow-half style="font-size:14px" />
          <span style="margin-left:4px;color:#666">{{ record.avgRating?.toFixed(1) }}</span>
        </template>
        <template v-if="column.key === 'completionRate'">
          <a-progress
            :percent="Math.round((record.completionRate || 0) * 100)"
            :size="[100, 8]"
            :stroke-color="record.completionRate >= 0.9 ? '#38D048' : record.completionRate >= 0.7 ? '#FC8C40' : '#E8383C'"
          />
        </template>
        <template v-if="column.key === 'level'">
          <a-tag :color="levelColor[record.level] || 'default'">{{ levelLabel[record.level] || record.level }}</a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="viewWorker(record)">查看</a-button>
            <a-button type="primary" size="small" ghost @click="openInviteModal(record)">邀约</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 零工详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="selectedWorker?.realName || '零工详情'"
      width="480"
      placement="right"
    >
      <template v-if="selectedWorker">
        <div class="profile-section">
          <a-avatar :size="64" :style="{ background: 'var(--color-primary)', fontSize: '24px' }">
            {{ (selectedWorker.realName || '?')[0] }}
          </a-avatar>
          <div class="profile-info">
            <h3>{{ selectedWorker.realName || '未填写' }}</h3>
            <a-tag :color="levelColor[selectedWorker.level]">{{ levelLabel[selectedWorker.level] || '—' }}</a-tag>
            <p style="color:#999;margin-top:4px">{{ selectedWorker.city || '未填写城市' }}</p>
          </div>
        </div>

        <a-divider />

        <a-descriptions :column="2" size="small">
          <a-descriptions-item label="评分">
            <a-rate :value="selectedWorker.avgRating" disabled allow-half style="font-size:14px" />
            <span style="margin-left:4px">{{ selectedWorker.avgRating?.toFixed(1) }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="完成数">{{ selectedWorker.completedCount ?? 0 }} 单</a-descriptions-item>
          <a-descriptions-item label="完成率">{{ ((selectedWorker.completionRate || 0) * 100).toFixed(0) }}%</a-descriptions-item>
          <a-descriptions-item label="ID">{{ selectedWorker.workerId }}</a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">角色技能</a-divider>
        <div v-if="selectedWorker.roles?.length">
          <div v-for="r in selectedWorker.roles" :key="r.roleName" style="margin-bottom:8px">
            <a-tag color="blue">{{ r.roleName }}</a-tag>
            <span v-if="r.yearsExp" style="color:#999;margin-left:4px">{{ r.yearsExp }}年经验</span>
            <div v-if="r.skillTags" style="margin-top:4px">
              <a-tag v-for="tag in r.skillTags.split(',')" :key="tag" size="small">{{ tag.trim() }}</a-tag>
            </div>
          </div>
        </div>
        <a-empty v-else description="该零工暂未配置角色技能" />

        <a-divider orientation="left">个人简介</a-divider>
        <p style="color:#666">{{ selectedWorker.bio || '该零工暂未填写简介' }}</p>

        <div style="margin-top:24px">
          <a-button type="primary" block @click="drawerVisible = false; openInviteModal(selectedWorker)">
            邀约该零工
          </a-button>
        </div>
      </template>
    </a-drawer>

    <!-- 邀约弹窗 -->
    <a-modal
      v-model:open="inviteVisible"
      title="邀约零工"
      :confirm-loading="inviting"
      ok-text="确认邀约"
      cancel-text="取消"
      @ok="handleInvite"
    >
      <div v-if="inviteWorker" style="margin-bottom:16px">
        <span>邀约对象：</span>
        <a-tag color="blue">{{ inviteWorker.realName }}</a-tag>
      </div>

      <a-form layout="vertical">
        <a-form-item label="选择任务" required>
          <a-select
            v-model:value="inviteForm.taskId"
            placeholder="请选择要邀约的任务"
            style="width:100%"
            show-search
            :filter-option="(input: string, option: any) => option.label?.includes(input)"
            :options="publishedTasks.map(t => ({ value: t.taskId, label: `#${t.taskId} ${t.title}` }))"
            @change="onTaskSelected"
          />
        </a-form-item>
        <a-form-item label="选择角色岗位" required>
          <a-select
            v-model:value="inviteForm.roleId"
            placeholder="请选择角色"
            style="width:100%"
            :disabled="!inviteForm.taskId"
          >
            <a-select-option v-for="r in selectedTaskRoles" :key="r.taskRoleId" :value="r.taskRoleId">
              {{ r.roleName }} (需{{ r.headcount }}人 · ¥{{ Number(r.budget).toLocaleString() }})
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>

      <a-alert
        v-if="inviteForm.taskId && inviteForm.roleId"
        message="邀约后零工将在小程序中收到通知，可选择接受或拒绝"
        type="info"
        show-icon
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import request from '@/api/request'
import { taskApi } from '@/api/task'

const loading = ref(false)
const workers = ref<any[]>([])
const platformRoles = ref<any[]>([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const filters = reactive({
  keyword: '',
  city: '',
  roleName: undefined as string | undefined,
})

const columns = [
  { title: '零工', key: 'name', width: 200 },
  { title: '角色', key: 'roles', width: 200 },
  { title: '评分', key: 'rating', width: 180 },
  { title: '完成率', key: 'completionRate', width: 140 },
  { title: '完成数', dataIndex: 'completedCount', key: 'count', width: 80, sorter: (a: any, b: any) => a.completedCount - b.completedCount },
  { title: '等级', key: 'level', width: 90 },
  { title: '操作', key: 'action', width: 130, fixed: 'right' as const },
]

const levelLabel: Record<string, string> = {
  unverified: '未认证', basic: '基础', skilled: '熟练',
  expert: '专家', master: '大师',
}
const levelColor: Record<string, string> = {
  unverified: 'default', basic: 'blue', skilled: 'cyan',
  expert: 'purple', master: 'gold',
}

// ── 抽屉：查看零工详情 ──
const drawerVisible = ref(false)
const selectedWorker = ref<any>(null)

function viewWorker(record: any) {
  selectedWorker.value = record
  drawerVisible.value = true
}

// ── 邀约弹窗 ──
const inviteVisible = ref(false)
const inviting = ref(false)
const inviteWorker = ref<any>(null)
const publishedTasks = ref<any[]>([])
const selectedTaskRoles = ref<any[]>([])
const inviteForm = reactive({ taskId: undefined as number | undefined, roleId: undefined as number | undefined })

async function openInviteModal(worker: any) {
  inviteWorker.value = worker
  inviteForm.taskId = undefined
  inviteForm.roleId = undefined
  selectedTaskRoles.value = []
  inviteVisible.value = true

  // 加载该企业已发布的任务
  try {
    const res = await taskApi.list({ status: 'published', pageSize: 100 })
    // also include in_progress tasks
    const res2 = await taskApi.list({ status: 'in_progress', pageSize: 100 })
    publishedTasks.value = [...(res.list || []), ...(res2.list || [])]
  } catch {
    message.error('加载任务列表失败')
  }
}

async function onTaskSelected(taskId: number) {
  inviteForm.roleId = undefined
  try {
    const res = await taskApi.detailFull(taskId)
    const data = res.data ?? res
    selectedTaskRoles.value = data.roles || []
  } catch {
    message.error('加载角色信息失败')
  }
}

async function handleInvite() {
  if (!inviteForm.taskId) { message.warning('请选择任务'); return }
  if (!inviteForm.roleId) { message.warning('请选择角色'); return }

  inviting.value = true
  try {
    await request.post(
      `/tasks/${inviteForm.taskId}/roles/${inviteForm.roleId}/invite/${inviteWorker.value.workerId}`,
    )
    message.success(`已成功邀约 ${inviteWorker.value.realName}！`)
    inviteVisible.value = false
  } catch (err: any) {
    message.error(err?.message || '邀约失败')
  } finally {
    inviting.value = false
  }
}

// ── 数据加载 ──
async function fetchWorkers() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.city) params.city = filters.city
    if (filters.roleName) params.roleName = filters.roleName

    const res = await request.get<any, any>('/workers', { params })
    workers.value = res.list || []
    pagination.total = res.total || 0
  } catch {
    message.error('加载零工列表失败')
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  fetchWorkers()
}

onMounted(async () => {
  fetchWorkers()
  try {
    platformRoles.value = await taskApi.getPlatformRoles()
  } catch {}
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.worker-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.worker-name-text {
  font-weight: 600;
  font-size: 13px;
}
.worker-city {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.profile-section {
  display: flex;
  gap: 16px;
  align-items: center;
}
.profile-info h3 {
  margin: 0 0 4px;
  font-size: 18px;
}
</style>
