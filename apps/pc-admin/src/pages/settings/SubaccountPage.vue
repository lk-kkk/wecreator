<template>
  <div class="page-container">
    <a-page-header title="子账号管理" sub-title="Team Members & Permissions">
      <template #extra>
        <a-button type="primary" @click="showCreate">
          <template #icon><PlusOutlined /></template>
          新建子账号
        </a-button>
      </template>
    </a-page-header>

    <!-- 权限说明 -->
    <a-alert type="info" show-icon closable style="margin-bottom:16px">
      <template #message>
        当前企业支持 4 种角色：<strong>super_admin</strong>（全部权限）、<strong>admin</strong>（任务+财务）、<strong>operator</strong>（任务管理）、<strong>viewer</strong>（只读）
      </template>
    </a-alert>

    <!-- 列表 -->
    <a-card>
      <a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="roleColor(record.role)">{{ record.role }}</a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-badge :status="record.isActive ? 'success' : 'error'" :text="record.isActive ? '启用' : '停用'" />
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="editAccount(record)">编辑</a-button>
              <a-button v-if="record.isActive" type="link" size="small" danger @click="toggleStatus(record, false)">停用</a-button>
              <a-button v-else type="link" size="small" @click="toggleStatus(record, true)">启用</a-button>
              <a-popconfirm title="确认删除？" @confirm="deleteAccount(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑 Modal -->
    <a-modal v-model:open="modal.open" :title="modal.isEdit ? '编辑子账号' : '新建子账号'" @ok="submitForm" :confirm-loading="modal.saving">
      <a-form :model="form" layout="vertical">
        <a-form-item label="姓名" required>
          <a-input v-model:value="form.name" placeholder="请输入姓名" />
        </a-form-item>
        <a-form-item label="手机号" required>
          <a-input v-model:value="form.phone" placeholder="请输入手机号" :disabled="modal.isEdit" />
        </a-form-item>
        <a-form-item label="角色" required>
          <a-select v-model:value="form.role">
            <a-select-option value="admin">admin</a-select-option>
            <a-select-option value="operator">operator</a-select-option>
            <a-select-option value="viewer">viewer</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="!modal.isEdit" label="初始密码" required>
          <a-input-password v-model:value="form.password" placeholder="初始密码" />
        </a-form-item>
        <a-form-item label="权限配置">
          <a-checkbox-group v-model:value="form.permissions" :options="allPermissions" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 权限矩阵 -->
    <a-card title="权限矩阵" style="margin-top:16px">
      <a-table :columns="permColumns" :data-source="permMatrix" :pagination="false" size="small" bordered>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key !== 'permission'">
            <CheckCircleFilled v-if="record[column.key]" style="color:#38D048" />
            <CloseCircleFilled v-else style="color:#E8383C" />
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons-vue'
import request from '@/api/request'

const loading = ref(false)
const list = ref<any[]>([])
const modal = reactive({ open: false, isEdit: false, saving: false, editId: 0 })
const form = reactive({ name: '', phone: '', role: 'operator', password: '', permissions: [] as string[] })

const allPermissions = [
  { label: '任务查看', value: 'task:read' },
  { label: '任务管理', value: 'task:write' },
  { label: '财务查看', value: 'finance:read' },
  { label: '财务操作', value: 'finance:write' },
  { label: '零工库查看', value: 'worker:read' },
  { label: '零工库管理', value: 'worker:write' },
  { label: '合同查看', value: 'contract:read' },
  { label: '合同管理', value: 'contract:write' },
  { label: '争议查看', value: 'dispute:read' },
  { label: '争议管理', value: 'dispute:write' },
  { label: '设置查看', value: 'settings:read' },
  { label: '设置管理', value: 'settings:write' },
]

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '角色', key: 'role', width: 120 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
]

const roleColor = (r: string) => ({ super_admin: 'red', admin: 'blue', operator: 'green', viewer: 'default' }[r] ?? 'default')

const permColumns = [
  { title: '权限点', dataIndex: 'permission', key: 'permission', width: 160 },
  { title: 'super_admin', key: 'super_admin', width: 120, align: 'center' as const },
  { title: 'admin', key: 'admin', width: 100, align: 'center' as const },
  { title: 'operator', key: 'operator', width: 100, align: 'center' as const },
  { title: 'viewer', key: 'viewer', width: 100, align: 'center' as const },
]

const permMatrix = computed(() => allPermissions.map(p => ({
  permission: p.label,
  super_admin: true,
  admin: ['task:read','task:write','finance:read','finance:write','worker:read','worker:write','contract:read','contract:write'].includes(p.value),
  operator: ['task:read','task:write','worker:read','dispute:read'].includes(p.value),
  viewer: p.value.endsWith(':read'),
})))

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get<any, any>('/admin/subaccounts')
    const data = res.data ?? res
    list.value = data.list ?? data.subaccounts ?? (Array.isArray(data) ? data : [])
  } catch { /* */ } finally { loading.value = false }
}

function showCreate() {
  Object.assign(form, { name: '', phone: '', role: 'operator', password: '', permissions: [] })
  modal.isEdit = false; modal.open = true
}

function editAccount(record: any) {
  Object.assign(form, { name: record.name, phone: record.phone, role: record.role, password: '', permissions: record.permissions || [] })
  modal.isEdit = true; modal.editId = record.id; modal.open = true
}

async function submitForm() {
  modal.saving = true
  try {
    if (modal.isEdit) {
      await request.patch<any, any>(`/admin/subaccounts/${modal.editId}`, { name: form.name, role: form.role, permissions: form.permissions })
    } else {
      await request.post<any, any>('/admin/subaccounts', form)
    }
    message.success(modal.isEdit ? '更新成功' : '创建成功')
    modal.open = false; fetchList()
  } catch { message.error('操作失败') } finally { modal.saving = false }
}

async function toggleStatus(record: any, enable: boolean) {
  try {
    await request.patch<any, any>(`/admin/subaccounts/${record.id}/${enable ? 'enable' : 'disable'}`)
    message.success(enable ? '已启用' : '已停用')
    fetchList()
  } catch { message.error('操作失败') }
}

async function deleteAccount(record: any) {
  try {
    await request.delete<any, any>(`/admin/subaccounts/${record.id}`)
    message.success('已删除'); fetchList()
  } catch { message.error('删除失败') }
}

onMounted(fetchList)
</script>

<style scoped>
.page-container { padding: 0; }
</style>
