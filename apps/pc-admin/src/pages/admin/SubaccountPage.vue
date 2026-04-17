<template>
  <div class="sub-page">
    <a-page-header title="子账号管理" @back="$router.back()">
      <template #extra>
        <a-button type="primary" @click="showCreate = true">+ 新增子账号</a-button>
      </template>
    </a-page-header>

    <!-- 权限矩阵说明 -->
    <a-collapse class="perm-collapse" ghost>
      <a-collapse-panel key="1" header="📋 角色权限矩阵">
        <div class="perm-table-wrap">
          <table class="perm-table">
            <thead>
              <tr>
                <th>功能模块</th>
                <th v-for="r in ROLES" :key="r.key">
                  <a-tag :color="r.color">{{ r.label }}</a-tag>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="perm in PERM_MATRIX" :key="perm.feature">
                <td>{{ perm.feature }}</td>
                <td v-for="r in ROLES" :key="r.key" class="perm-cell">
                  <span v-if="perm[r.key]" class="perm-yes">✅</span>
                  <span v-else class="perm-no">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </a-collapse-panel>
    </a-collapse>

    <!-- 账号列表 -->
    <div class="account-section">
      <a-spin :spinning="loading">
        <a-table
          :dataSource="accounts"
          :columns="columns"
          :pagination="false"
          rowKey="id"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <a-tag :color="roleColor[record.role]">{{ roleLabel[record.role] }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-badge
                :status="record.status === 'active' ? 'success' : 'default'"
                :text="record.status === 'active' ? '正常' : '已禁用'"
              />
            </template>
            <template v-if="column.key === 'lastLoginAt'">
              {{ record.lastLoginAt ? new Date(record.lastLoginAt).toLocaleString('zh-CN') : '从未登录' }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button size="small" @click="startEdit(record)">编辑</a-button>
                <a-popconfirm
                  v-if="record.status === 'active'"
                  title="确认禁用该账号？"
                  @confirm="toggleStatus(record, false)"
                >
                  <a-button size="small" danger>禁用</a-button>
                </a-popconfirm>
                <a-button
                  v-else
                  size="small" type="primary" ghost
                  @click="toggleStatus(record, true)"
                >启用</a-button>
                <a-popconfirm title="确认删除该账号？此操作不可恢复" @confirm="remove(record.id)">
                  <a-button size="small" danger ghost>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-spin>
    </div>

    <!-- 新增子账号弹窗 -->
    <a-modal
      v-model:open="showCreate"
      title="新增子账号"
      @ok="handleCreate"
      ok-text="创建"
      :confirm-loading="creating"
    >
      <a-form layout="vertical" :model="createForm">
        <a-form-item label="姓名" required>
          <a-input v-model:value="createForm.name" placeholder="真实姓名" :maxlength="20" />
        </a-form-item>
        <a-form-item label="手机号" required>
          <a-input v-model:value="createForm.phone" placeholder="13800138000" />
        </a-form-item>
        <a-form-item label="初始密码" required>
          <a-input-password v-model:value="createForm.password" placeholder="8-32位，含大小写+数字" />
        </a-form-item>
        <a-form-item label="角色" required>
          <a-select v-model:value="createForm.role" style="width:100%">
            <a-select-option v-for="r in ROLES" :key="r.key" :value="r.key">
              <a-tag :color="r.color" size="small">{{ r.label }}</a-tag>
              {{ r.desc }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑子账号弹窗 -->
    <a-modal
      v-model:open="showEdit"
      title="编辑子账号"
      @ok="handleUpdate"
      ok-text="保存"
      :confirm-loading="updating"
    >
      <a-form layout="vertical" :model="editForm">
        <a-form-item label="姓名">
          <a-input v-model:value="editForm.name" :maxlength="20" />
        </a-form-item>
        <a-form-item label="角色">
          <a-select v-model:value="editForm.role" style="width:100%">
            <a-select-option v-for="r in ROLES" :key="r.key" :value="r.key">
              <a-tag :color="r.color" size="small">{{ r.label }}</a-tag> {{ r.desc }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="重置密码（选填）">
          <a-input-password v-model:value="editForm.newPassword" placeholder="留空则不修改" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { subaccountApi } from '@/api/subaccount'

const loading  = ref(false)
const accounts = ref<any[]>([])
const showCreate = ref(false)
const showEdit   = ref(false)
const creating   = ref(false)
const updating   = ref(false)
const editingId  = ref<number | null>(null)

const createForm = reactive({ name: '', phone: '', password: '', role: 'operator' })
const editForm   = reactive({ name: '', role: '', newPassword: '' })

const ROLES = [
  { key: 'super_admin',   label: '超级管理员', color: 'red',    desc: '全部操作权限' },
  { key: 'task_admin',    label: '任务管理员', color: 'purple', desc: '任务发布/撮合/验收' },
  { key: 'finance_admin', label: '财务管理员', color: 'blue',   desc: '充值/财务报表' },
  { key: 'operator',      label: '普通操作员', color: 'default',desc: '只读查看' },
]

const roleLabel: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.key, r.label]))
const roleColor: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.key, r.color]))

const PERM_MATRIX: Array<{ feature: string; [key: string]: boolean | string }> = [
  { feature: '发布/编辑任务',   super_admin: true,  task_admin: true,  finance_admin: false, operator: false },
  { feature: '定向分配零工',    super_admin: true,  task_admin: true,  finance_admin: false, operator: false },
  { feature: '验收交付物',      super_admin: true,  task_admin: true,  finance_admin: false, operator: false },
  { feature: '查看零工档案',    super_admin: true,  task_admin: true,  finance_admin: false, operator: true  },
  { feature: '充值/锁定资金',   super_admin: true,  task_admin: false, finance_admin: true,  operator: false },
  { feature: '查看财务报表',    super_admin: true,  task_admin: false, finance_admin: true,  operator: true  },
  { feature: '申请发票',        super_admin: true,  task_admin: false, finance_admin: true,  operator: false },
  { feature: '管理子账号',      super_admin: true,  task_admin: false, finance_admin: false, operator: false },
  { feature: '查看数据看板',    super_admin: true,  task_admin: true,  finance_admin: true,  operator: true  },
]

const columns = [
  { title: '姓名',     dataIndex: 'name',        key: 'name'        },
  { title: '手机号',   dataIndex: 'phone',       key: 'phone'       },
  { title: '角色',     dataIndex: 'role',        key: 'role'        },
  { title: '状态',     dataIndex: 'status',      key: 'status'      },
  { title: '最后登录', dataIndex: 'lastLoginAt', key: 'lastLoginAt' },
  { title: '操作',     key: 'actions'                               },
]

async function loadAccounts() {
  loading.value = true
  try {
    const res = await subaccountApi.list()
    accounts.value = Array.isArray(res) ? res : (res.data || [])
  } catch { message.error('加载失败') }
  finally { loading.value = false }
}

async function handleCreate() {
  if (!createForm.name.trim())    { message.warning('请填写姓名'); return }
  if (!createForm.phone.trim())   { message.warning('请填写手机号'); return }
  if (!createForm.password.trim()){ message.warning('请填写密码'); return }
  creating.value = true
  try {
    await subaccountApi.create(createForm)
    message.success('子账号已创建 ✅')
    showCreate.value = false
    Object.assign(createForm, { name: '', phone: '', password: '', role: 'operator' })
    loadAccounts()
  } catch (e: any) { message.error(e?.response?.data?.message || '创建失败') }
  finally { creating.value = false }
}

function startEdit(record: any) {
  editingId.value = record.id
  Object.assign(editForm, { name: record.name, role: record.role, newPassword: '' })
  showEdit.value = true
}

async function handleUpdate() {
  if (!editingId.value) return
  updating.value = true
  try {
    const payload: any = { name: editForm.name, role: editForm.role }
    if (editForm.newPassword) payload.newPassword = editForm.newPassword
    await subaccountApi.update(editingId.value, payload)
    message.success('已更新 ✅')
    showEdit.value = false
    loadAccounts()
  } catch (e: any) { message.error(e?.response?.data?.message || '更新失败') }
  finally { updating.value = false }
}

async function toggleStatus(record: any, active: boolean) {
  try {
    await subaccountApi.setStatus(record.id, active)
    message.success(active ? '已启用' : '已禁用')
    loadAccounts()
  } catch (e: any) { message.error(e?.response?.data?.message || '操作失败') }
}

async function remove(id: number) {
  try {
    await subaccountApi.remove(id)
    message.success('已删除')
    loadAccounts()
  } catch (e: any) { message.error(e?.response?.data?.message || '删除失败') }
}

onMounted(loadAccounts)
</script>

<style scoped>
.sub-page { background: var(--color-bg-page); min-height: 100vh; }

.perm-collapse { margin: 0 24px 16px; background: #fff; border-radius: 12px; }
.perm-table-wrap { overflow-x: auto; }
.perm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.perm-table th, .perm-table td {
  padding: 8px 14px; border-bottom: 1px solid var(--color-border-light); text-align: center;
}
.perm-table th:first-child, .perm-table td:first-child { text-align: left; }
.perm-cell { font-size: 16px; }
.perm-yes  { color: var(--color-success); }
.perm-no   { color: var(--color-border); }

.account-section { padding: 0 24px; background: #fff; margin: 0 24px; border-radius: 12px; }
</style>
