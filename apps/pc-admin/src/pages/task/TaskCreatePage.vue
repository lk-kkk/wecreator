<template>
  <div class="task-create-page">
    <a-page-header title="发布任务" @back="$router.back()" />

    <a-steps :current="currentStep" style="margin-bottom: 32px; max-width: 800px">
      <a-step title="基本信息" />
      <a-step title="角色配置" />
      <a-step title="预算设定" />
      <a-step title="时间地点" />
      <a-step title="确认发布" />
    </a-steps>

    <!-- 步骤1：基本信息 -->
    <div v-show="currentStep === 0">
      <a-form :model="form" layout="vertical" style="max-width: 600px">
        <a-form-item label="任务标题" required>
          <a-input v-model:value="form.title" placeholder="例如：双11电商产品拍摄" :maxlength="100" show-count />
        </a-form-item>
        <a-form-item label="任务描述">
          <a-textarea v-model:value="form.description" :rows="4" placeholder="详细描述任务需求、交付标准、注意事项等..." show-count :maxlength="2000" />
        </a-form-item>
        <a-form-item label="任务模式" required>
          <a-radio-group v-model:value="form.taskMode" button-style="solid">
            <a-radio-button value="task_package">
              <span>📦 任务包模式</span>
              <div style="font-size:11px;color:#999;margin-top:2px">按交付物验收结算</div>
            </a-radio-button>
            <a-radio-button value="daily_rate">
              <span>📅 人天模式</span>
              <div style="font-size:11px;color:#999;margin-top:2px">按工时计费结算</div>
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </div>

    <!-- 步骤2：角色配置 -->
    <div v-show="currentStep === 1">
      <div style="max-width: 800px">
        <a-alert
          v-if="form.roles.length === 0"
          message="请至少添加一个角色岗位"
          description="点击下方按钮添加角色，配置需求人数和预算。"
          type="info"
          show-icon
          style="margin-bottom: 16px"
        />

        <div v-for="(role, idx) in form.roles" :key="idx" class="role-item">
          <div class="role-header">
            <span class="role-index">角色 {{ idx + 1 }}</span>
            <a-popconfirm title="确定删除该角色？" @confirm="removeRole(idx)">
              <a-button type="link" danger size="small">
                <delete-outlined /> 删除
              </a-button>
            </a-popconfirm>
          </div>

          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="角色名称" required>
                <a-select
                  v-model:value="role.roleName"
                  placeholder="选择或搜索角色"
                  show-search
                  :filter-option="filterOption"
                >
                  <a-select-option v-for="r in platformRoles" :key="r.roleName" :value="r.roleName">
                    {{ r.roleName }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="需求人数" required>
                <a-input-number v-model:value="role.headcount" :min="1" :max="50" style="width:100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="单人预算(元)" required>
                <a-input-number v-model:value="role.budget" :min="100" :step="500" :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')" style="width:100%" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="16">
              <a-form-item label="技能要求">
                <a-select
                  v-model:value="role.skillTagsArr"
                  mode="multiple"
                  placeholder="选择技能标签"
                  :options="skillTagOptions"
                  allow-clear
                  :max-tag-count="4"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="角色要求说明">
                <a-input v-model:value="role.description" placeholder="简述该角色的具体工作内容" :maxlength="200" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <a-button type="dashed" block @click="addRole" class="add-role-btn">
          <plus-outlined /> 添加角色岗位
        </a-button>
      </div>
    </div>

    <!-- 步骤3：预算设定 -->
    <div v-show="currentStep === 2">
      <a-form layout="vertical" style="max-width: 500px">
        <a-form-item label="任务总预算(元)" required>
          <a-input-number
            v-model:value="form.totalBudget"
            :min="1" :step="1000" style="width:100%"
            :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
          />
        </a-form-item>

        <div class="budget-summary">
          <div class="budget-row">
            <span>角色预算合计</span>
            <span :class="{ 'over-budget': rolesBudgetSum > form.totalBudget }">¥{{ rolesBudgetSum.toLocaleString() }}</span>
          </div>
          <div class="budget-row">
            <span>平台服务费 (8%)</span>
            <span>¥{{ (form.totalBudget * 0.08).toLocaleString() }}</span>
          </div>
          <div class="budget-row total">
            <span>发布需锁定金额</span>
            <span>¥{{ (form.totalBudget * 1.08).toLocaleString() }}</span>
          </div>
        </div>

        <a-alert
          v-if="rolesBudgetSum > form.totalBudget"
          message="角色预算合计超过总预算"
          description="请增加总预算或调整角色预算。"
          type="error"
          show-icon
          style="margin-top:12px"
        />
        <a-alert
          v-else-if="form.totalBudget > 0 && rolesBudgetSum <= form.totalBudget"
          :message="`预算匹配 ✓ 剩余 ¥${(form.totalBudget - rolesBudgetSum).toLocaleString()}`"
          type="success"
          show-icon
          style="margin-top:12px"
        />
      </a-form>
    </div>

    <!-- 步骤4：时间地点 -->
    <div v-show="currentStep === 3">
      <a-form layout="vertical" style="max-width: 600px">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="开始日期">
              <a-date-picker v-model:value="startDate" style="width: 100%" placeholder="请选择开始日期" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束日期">
              <a-date-picker v-model:value="endDate" style="width: 100%" placeholder="请选择结束日期" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="工作地点">
          <a-cascader
            v-model:value="addressCascade"
            :options="regionOptions"
            placeholder="选择省份 / 城市"
            style="width: 100%"
            change-on-select
          />
        </a-form-item>
        <a-form-item label="详细地址">
          <a-input v-model:value="form.addressDetail" placeholder="例如：西湖区文三路XX号XX楼（选填）" :maxlength="200" />
        </a-form-item>
      </a-form>
    </div>

    <!-- 步骤5：确认发布 -->
    <div v-show="currentStep === 4">
      <a-descriptions bordered :column="2" style="max-width: 700px">
        <a-descriptions-item label="任务标题" :span="2">{{ form.title }}</a-descriptions-item>
        <a-descriptions-item label="任务模式">{{ form.taskMode === 'task_package' ? '📦 任务包' : '📅 人天制' }}</a-descriptions-item>
        <a-descriptions-item label="总预算">¥{{ form.totalBudget.toLocaleString() }}</a-descriptions-item>
        <a-descriptions-item label="角色岗位" :span="2">
          <div v-for="(r, i) in form.roles" :key="i" style="margin-bottom:4px">
            <a-tag color="blue">{{ r.roleName }}</a-tag>
            × {{ r.headcount }}人 · ¥{{ r.budget.toLocaleString() }}/人
            <span v-if="r.description" style="color:#999;margin-left:8px">{{ r.description }}</span>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="工作地点">{{ fullAddress || '远程/未指定' }}</a-descriptions-item>
        <a-descriptions-item label="时间">{{ dateRange || '未指定' }}</a-descriptions-item>
        <a-descriptions-item label="锁定金额" :span="2">
          <span style="color:var(--color-warning);font-weight:700">¥{{ (form.totalBudget * 1.08).toLocaleString() }}</span>
          <span style="color:#999;margin-left:8px">（含8%平台服务费）</span>
        </a-descriptions-item>
      </a-descriptions>
      <a-alert
        message="发布后将自动锁定账户资金，请确认余额充足"
        type="warning"
        show-icon
        style="margin-top:16px;max-width:700px"
      />
    </div>

    <!-- 底部操作栏 -->
    <div class="step-actions">
      <a-button v-if="currentStep > 0" @click="currentStep--">
        <left-outlined /> 上一步
      </a-button>
      <a-button v-if="currentStep < 4" type="primary" @click="nextStep">
        下一步 <right-outlined />
      </a-button>
      <a-button v-if="currentStep === 4" @click="handleSaveDraft" :loading="saving">
        保存草稿
      </a-button>
      <a-button v-if="currentStep === 4" type="primary" :loading="publishing" @click="handlePublish">
        确认发布
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { taskApi } from '@/api/task'

const router = useRouter()
const currentStep = ref(0)
const publishing = ref(false)
const saving = ref(false)
const platformRoles = ref<any[]>([])
const skillTags = ref<any[]>([])
const startDate = ref<any>(null)
const endDate = ref<any>(null)
const addressCascade = ref<string[]>([])

interface RoleItem {
  roleName: string
  headcount: number
  budget: number
  skillTagsArr: string[]
  description: string
}

const form = reactive({
  title: '',
  description: '',
  taskMode: 'task_package' as 'task_package' | 'daily_rate',
  totalBudget: 0,
  addressDetail: '',
  roles: [] as RoleItem[],
})

const rolesBudgetSum = computed(() =>
  form.roles.reduce((s, r) => s + (r.budget || 0) * (r.headcount || 1), 0),
)

const skillTagOptions = computed(() =>
  skillTags.value.map(t => ({ label: t.name, value: t.name }))
)

const fullAddress = computed(() => {
  const parts = addressCascade.value || []
  const detail = form.addressDetail || ''
  return [...parts, detail].filter(Boolean).join(' ')
})

const dateRange = computed(() => {
  if (!startDate.value && !endDate.value) return ''
  const s = startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : '?'
  const e = endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : '?'
  return `${s} 至 ${e}`
})

function filterOption(input: string, option: any) {
  return option.value?.toLowerCase().includes(input.toLowerCase())
}

function addRole() {
  form.roles.push({ roleName: '', headcount: 1, budget: 0, skillTagsArr: [], description: '' })
}

function removeRole(idx: number) {
  form.roles.splice(idx, 1)
}

function nextStep() {
  if (currentStep.value === 0) {
    if (!form.title.trim()) { message.warning('请填写任务标题'); return }
  }
  if (currentStep.value === 1) {
    if (form.roles.length === 0) { message.warning('请至少添加一个角色'); return }
    for (const r of form.roles) {
      if (!r.roleName) { message.warning('请为所有角色选择名称'); return }
      if (r.budget <= 0) { message.warning(`角色「${r.roleName}」预算需大于0`); return }
    }
  }
  if (currentStep.value === 2) {
    if (form.totalBudget <= 0) { message.warning('总预算需大于0'); return }
    if (rolesBudgetSum.value > form.totalBudget) { message.warning('角色预算合计超过总预算'); return }
  }
  currentStep.value++
}

function buildPayload() {
  return {
    title: form.title,
    description: form.description || undefined,
    taskMode: form.taskMode,
    totalBudget: form.totalBudget,
    startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
    endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined,
    address: fullAddress.value || undefined,
    roles: form.roles.map(r => ({
      roleName: r.roleName,
      headcount: r.headcount,
      budget: r.budget,
      skillTags: r.skillTagsArr.length > 0 ? r.skillTagsArr.join(',') : undefined,
      description: r.description || undefined,
    })),
  }
}

async function handleSaveDraft() {
  saving.value = true
  try {
    await taskApi.create(buildPayload())
    message.success('草稿已保存')
    router.push('/task/list')
  } catch (err: any) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handlePublish() {
  publishing.value = true
  try {
    const res = await taskApi.create(buildPayload())
    await taskApi.publish(res.taskId)
    message.success('🎉 任务发布成功！')
    router.push('/task/list')
  } catch (err: any) {
    message.error(err?.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

// ── 地区选项（主要城市） ────────────────────────────────
const regionOptions = [
  { value: '北京', label: '北京', children: [{ value: '北京市', label: '北京市' }] },
  { value: '上海', label: '上海', children: [{ value: '上海市', label: '上海市' }] },
  { value: '广东', label: '广东', children: [
    { value: '广州市', label: '广州市' }, { value: '深圳市', label: '深圳市' },
    { value: '东莞市', label: '东莞市' }, { value: '佛山市', label: '佛山市' },
  ]},
  { value: '浙江', label: '浙江', children: [
    { value: '杭州市', label: '杭州市' }, { value: '宁波市', label: '宁波市' },
    { value: '温州市', label: '温州市' }, { value: '嘉兴市', label: '嘉兴市' },
  ]},
  { value: '江苏', label: '江苏', children: [
    { value: '南京市', label: '南京市' }, { value: '苏州市', label: '苏州市' },
    { value: '无锡市', label: '无锡市' }, { value: '常州市', label: '常州市' },
  ]},
  { value: '四川', label: '四川', children: [
    { value: '成都市', label: '成都市' }, { value: '绵阳市', label: '绵阳市' },
  ]},
  { value: '湖北', label: '湖北', children: [
    { value: '武汉市', label: '武汉市' }, { value: '宜昌市', label: '宜昌市' },
  ]},
  { value: '湖南', label: '湖南', children: [
    { value: '长沙市', label: '长沙市' }, { value: '株洲市', label: '株洲市' },
  ]},
  { value: '福建', label: '福建', children: [
    { value: '福州市', label: '福州市' }, { value: '厦门市', label: '厦门市' },
  ]},
  { value: '山东', label: '山东', children: [
    { value: '济南市', label: '济南市' }, { value: '青岛市', label: '青岛市' },
  ]},
  { value: '天津', label: '天津', children: [{ value: '天津市', label: '天津市' }] },
  { value: '重庆', label: '重庆', children: [{ value: '重庆市', label: '重庆市' }] },
  { value: '河南', label: '河南', children: [
    { value: '郑州市', label: '郑州市' }, { value: '洛阳市', label: '洛阳市' },
  ]},
  { value: '河北', label: '河北', children: [
    { value: '石家庄市', label: '石家庄市' }, { value: '唐山市', label: '唐山市' },
  ]},
  { value: '陕西', label: '陕西', children: [
    { value: '西安市', label: '西安市' },
  ]},
  { value: '辽宁', label: '辽宁', children: [
    { value: '沈阳市', label: '沈阳市' }, { value: '大连市', label: '大连市' },
  ]},
  { value: '远程', label: '🌐 远程/不限地区', children: [{ value: '远程办公', label: '远程办公' }] },
]

onMounted(async () => {
  try {
    platformRoles.value = await taskApi.getPlatformRoles()
  } catch {}
  try {
    skillTags.value = await taskApi.getSkillTags()
  } catch {}
})
</script>

<style scoped>
.task-create-page {
  padding-bottom: 80px;
}

.role-item {
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
}
.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.role-index {
  font-weight: 600;
  color: var(--color-primary);
}

.add-role-btn {
  height: 48px;
  border-style: dashed;
  margin-top: 8px;
}

.budget-summary {
  background: var(--color-bg-hover);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-top: 16px;
}
.budget-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}
.budget-row.total {
  border-top: 1px solid #e0e0e0;
  margin-top: 8px;
  padding-top: 10px;
  font-weight: 700;
  font-size: 16px;
}
.over-budget {
  color: var(--color-error);
  font-weight: 700;
}

.step-actions {
  position: fixed;
  bottom: 0;
  left: 220px;
  right: 0;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border-light);
  padding: 12px 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  z-index: 10;
}
</style>
