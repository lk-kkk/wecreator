<template>
  <div>
    <h2>管理员账号</h2>
    <a-button type="primary" @click="showCreate = true" style="margin-bottom: 16px">+ 创建管理员</a-button>
    <a-table :dataSource="admins" :columns="columns" rowKey="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'role'"><a-tag color="purple">{{ record.role?.replace('platform_', '') }}</a-tag></template>
        <template v-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status }}</a-tag></template>
      </template>
    </a-table>
    <a-modal v-model:open="showCreate" title="创建管理员" @ok="create">
      <a-form :model="form" layout="vertical">
        <a-form-item label="用户名"><a-input v-model:value="form.username" /></a-form-item>
        <a-form-item label="密码"><a-input-password v-model:value="form.password" /></a-form-item>
        <a-form-item label="显示名"><a-input v-model:value="form.displayName" /></a-form-item>
        <a-form-item label="角色">
          <a-select v-model:value="form.role">
            <a-select-option v-for="r in ['platform_super_admin','platform_ops','platform_arbitrator','platform_finance','platform_viewer']" :key="r" :value="r">{{ r.replace('platform_','') }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { platformApi } from '@/api/platform'
const admins = ref<any[]>([]), showCreate = ref(false)
const form = reactive({ username: '', password: '', displayName: '', role: 'platform_ops' })
const columns = [
  { title: '用户名', dataIndex: 'username' }, { title: '显示名', dataIndex: 'displayName' },
  { title: '角色', key: 'role' }, { title: '状态', key: 'status' },
  { title: '最后登录', dataIndex: 'lastLoginAt', customRender: ({ text }: any) => text?.slice(0, 19) || '-' },
]
async function load() { admins.value = await platformApi.listAdmins() }
async function create() {
  await platformApi.createAdmin(form as any); showCreate.value = false; message.success('已创建'); load()
  Object.assign(form, { username: '', password: '', displayName: '', role: 'platform_ops' })
}
onMounted(load)
</script>
