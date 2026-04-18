<template>
  <div class="tcp-page">

    <!-- ══ 顶部导航行：面包屑 + 操作 ══ -->
    <div class="tcp-topbar">
      <div class="tcp-breadcrumb">
        <a class="tcp-bc-link" @click="$router.push('/task/square')">任务管理</a>
        <span class="tcp-bc-sep">/</span>
        <span class="tcp-bc-cur">{{ isEditMode ? '编辑任务' : '发布新任务' }}</span>
        <transition name="fade">
          <span v-if="lastSavedAt" class="tcp-saved-tag">
            <check-circle-outlined /> {{ lastSavedAt }}
          </span>
        </transition>
      </div>
      <div class="tcp-topbar-actions">
        <a-button v-if="hasLlm" class="tcp-ai-btn" @click="aiDrawerOpen = true">
          🤖 AI 顾问
        </a-button>
        <a-button @click="handleSaveDraft" :loading="saving">保存草稿</a-button>
        <a-button type="primary" :loading="publishing" :disabled="!canPublish" @click="handlePublish" class="tcp-pub-btn">
          确认发布
        </a-button>
      </div>
    </div>

    <!-- ══ 双栏主体 ══ -->
    <div class="tcp-layout">

      <!-- ── 左侧：表单区 ── -->
      <div class="tcp-main">

        <!-- § 1 基本信息 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 0)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">📋</div>
            <div>
              <div class="tcp-sec-title">基本信息</div>
              <div class="tcp-sec-sub">任务的核心描述，零工会在报名页看到这些内容</div>
            </div>
          </div>

          <a-form layout="vertical" class="tcp-form">
            <a-form-item required>
              <template #label><span class="tcp-fl">任务标题</span></template>
              <a-input v-model:value="form.title" placeholder="一句话说清任务，如：双11产品主图拍摄 · 50款SKU" :maxlength="100" show-count size="large" />
            </a-form-item>

            <a-form-item>
              <template #label>
                <span class="tcp-fl">任务描述</span>
                <span class="tcp-fl-hint">详细说明背景、交付物标准和注意事项</span>
              </template>
              <a-textarea v-model:value="form.description" :rows="4" placeholder="告诉零工需要做什么、做到什么程度、有哪些注意事项…" :maxlength="2000" show-count />
            </a-form-item>

            <!-- 工作模式 -->
            <a-form-item required>
              <template #label><span class="tcp-fl">工作模式</span></template>
              <div class="tcp-mode-row">
                <div class="tcp-mode-card" :class="{ sel: form.taskMode === 'task_package' }" @click="form.taskMode = 'task_package'">
                  <div class="tcp-mode-head">
                    <span class="tcp-mode-ico">📦</span>
                    <div class="tcp-mode-radio" :class="{ sel: form.taskMode === 'task_package' }"><div v-if="form.taskMode === 'task_package'" class="tcp-mode-radio-dot"></div></div>
                  </div>
                  <div class="tcp-mode-name">任务包模式</div>
                  <div class="tcp-mode-desc">按交付成果验收，完成即结算</div>
                  <div class="tcp-mode-tags"><span class="tcp-mtag blue">交付导向</span><span class="tcp-mtag green">结果付费</span></div>
                </div>
                <div class="tcp-mode-card" :class="{ sel: form.taskMode === 'daily_rate' }" @click="form.taskMode = 'daily_rate'">
                  <div class="tcp-mode-head">
                    <span class="tcp-mode-ico">📅</span>
                    <div class="tcp-mode-radio" :class="{ sel: form.taskMode === 'daily_rate' }"><div v-if="form.taskMode === 'daily_rate'" class="tcp-mode-radio-dot"></div></div>
                  </div>
                  <div class="tcp-mode-name">人天模式</div>
                  <div class="tcp-mode-desc">按实际工时计费，灵活弹性工期</div>
                  <div class="tcp-mode-tags"><span class="tcp-mtag orange">按天计费</span><span class="tcp-mtag purple">弹性工期</span></div>
                </div>
              </div>
            </a-form-item>

            <!-- 关联项目 -->
            <a-form-item>
              <template #label>
                <span class="tcp-fl">关联项目</span>
                <span class="tcp-fl-hint">可选，将任务归入已有项目</span>
              </template>
              <a-select v-model:value="form.projectId" placeholder="搜索或选择项目…" allow-clear show-search :filter-option="filterProjectOption" :options="projectOptions" @focus="loadProjects" style="width:380px" />
            </a-form-item>
          </a-form>
        </section>

        <!-- § 2 角色配置 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 1)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">👥</div>
            <div>
              <div class="tcp-sec-title">角色配置</div>
              <div class="tcp-sec-sub">至少添加一个角色才能发布任务</div>
            </div>
          </div>

          <!-- 快速添加 -->
          <div v-if="platformRoles.length > 0" class="tcp-quick-bar">
            <span class="tcp-quick-label">快速添加：</span>
            <button v-for="r in platformRoles.slice(0, 10)" :key="r.roleName" class="tcp-chip" @click="quickAddRole(r)">+ {{ r.roleName }}</button>
          </div>

          <!-- 空态 -->
          <div v-if="form.roles.length === 0" class="tcp-roles-empty">
            <div style="font-size:32px;margin-bottom:8px">👥</div>
            <p>点击上方按钮快速添加，或手动创建角色</p>
          </div>

          <!-- 角色列表 -->
          <div v-for="(role, idx) in form.roles" :key="idx" class="tcp-role-card">
            <div class="tcp-role-row1">
              <span class="tcp-role-idx">{{ idx + 1 }}</span>
              <a-select v-model:value="role.roleName" placeholder="选择角色" show-search :filter-option="filterOption" style="width:160px" @change="(v: string) => onRoleSelect(idx, v)">
                <a-select-option v-for="r in platformRoles" :key="r.roleName" :value="r.roleName">{{ r.roleName }}</a-select-option>
              </a-select>
              <span class="tcp-role-lbl">人数</span>
              <a-input-number v-model:value="role.headcount" :min="1" :max="50" style="width:72px" />
              <span class="tcp-role-lbl">单人预算</span>
              <a-input-number v-model:value="role.budget" :min="0" :step="500" :formatter="(v: any) => v ? `¥${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''" :parser="(v: any) => v.replace(/[¥,\s]/g, '')" style="width:130px" />
              <a-popconfirm title="删除该角色？" @confirm="removeRole(idx)">
                <button class="tcp-role-del"><close-outlined /></button>
              </a-popconfirm>
            </div>
            <div class="tcp-role-row2">
              <a-select v-model:value="role.skillTagsArr" mode="multiple" placeholder="技能要求（选填）" :options="skillTagOptions" allow-clear :max-tag-count="5" style="flex:1" />
              <a-input v-model:value="role.description" placeholder="补充说明（选填）" :maxlength="100" style="width:200px" />
            </div>
            <div v-if="role.budget > 0 && role.headcount > 0" class="tcp-role-sub">
              {{ role.roleName || '此角色' }} × {{ role.headcount }}人 = <strong>¥{{ ((role.budget||0)*(role.headcount||1)).toLocaleString() }}</strong>
            </div>
          </div>

          <button class="tcp-add-btn" @click="addRole"><plus-outlined /> 添加角色岗位</button>
        </section>

        <!-- § 3 检查点 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 2)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">🏁</div>
            <div>
              <div class="tcp-sec-title">执行检查点 <span class="tcp-optional">可选</span></div>
              <div class="tcp-sec-sub">里程碑节点，零工需上传阶段交付物供企业验收；不设则一次性验收</div>
            </div>
          </div>

          <!-- 模板 -->
          <div class="tcp-tpl-bar">
            <span class="tcp-tpl-label">套用模板：</span>
            <button v-for="t in cpTemplateKeys" :key="t.key" class="tcp-tpl-btn" @click="applyTemplate(t.key)">{{ t.icon }} {{ t.label }}</button>
          </div>

          <!-- 时间线 -->
          <div class="tcp-timeline">
            <div class="tcp-tl-node start"><div class="tcp-tl-dot start"></div><div class="tcp-tl-text"><strong>任务开始</strong><span>0%</span></div></div>

            <template v-for="(cp, idx) in checkpoints" :key="idx">
              <div class="tcp-tl-stem"></div>
              <div class="tcp-tl-node cp">
                <div class="tcp-tl-dot cp" :style="{ background: cpColor(cp.progress) }">{{ idx+1 }}</div>
                <div class="tcp-tl-cp-body">
                  <div class="tcp-tl-cp-top">
                    <a-input v-model:value="cp.name" placeholder="检查点名称" class="tcp-cp-name" :maxlength="50" />
                    <span class="tcp-cp-badge" :style="{ background: cpColorBg(cp.progress), color: cpColor(cp.progress) }">{{ cp.progress }}%</span>
                    <button class="tcp-cp-btn" :disabled="idx===0" @click="moveCP(idx,-1)">↑</button>
                    <button class="tcp-cp-btn" :disabled="idx===checkpoints.length-1" @click="moveCP(idx,1)">↓</button>
                    <a-popconfirm title="删除？" @confirm="removeCP(idx)"><button class="tcp-cp-btn del">✕</button></a-popconfirm>
                  </div>
                  <a-slider v-model:value="cp.progress" :min="5" :max="95" :step="5" :tooltip-formatter="(v: number) => v+'%'" style="margin:4px 0 0" />
                  <div class="tcp-cp-expand" @click="cp._expanded = !cp._expanded">
                    {{ cp._expanded ? '▾' : '▸' }} 交付物设置
                    <span v-if="cp.deliverableDesc && !cp._expanded" class="tcp-cp-expand-hint">{{ cp.deliverableDesc.slice(0,30) }}…</span>
                  </div>
                  <div v-if="cp._expanded" class="tcp-cp-detail">
                    <a-textarea v-model:value="cp.deliverableDesc" :rows="2" placeholder="描述交付物要求" :maxlength="300" />
                    <a-select v-model:value="cp.allowedFormats" mode="multiple" placeholder="允许格式（不限则留空）" :options="deliverableFormats" allow-clear style="margin-top:6px;width:100%" />
                  </div>
                </div>
              </div>
            </template>

            <div class="tcp-tl-stem" v-if="checkpoints.length > 0"></div>
            <div class="tcp-tl-node end"><div class="tcp-tl-dot end">✓</div><div class="tcp-tl-text"><strong>最终交付</strong><span>100% · 全款结算</span></div></div>
          </div>

          <button class="tcp-add-btn" @click="addCP"><plus-outlined /> 添加检查点</button>
        </section>

        <!-- § 4 时间地点 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 3)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">📅</div>
            <div>
              <div class="tcp-sec-title">时间与地点</div>
              <div class="tcp-sec-sub">任务的执行周期和工作地点</div>
            </div>
          </div>

          <a-form layout="vertical" class="tcp-form">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item><template #label><span class="tcp-fl">开始日期</span></template>
                  <a-date-picker v-model:value="startDate" style="width:100%" placeholder="选择开始日期" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item><template #label><span class="tcp-fl">截止日期</span></template>
                  <a-date-picker v-model:value="endDate" style="width:100%" placeholder="选择截止日期" :disabled-date="disabledEndDate" />
                </a-form-item>
              </a-col>
            </a-row>
            <div v-if="taskDurationDays > 0" class="tcp-duration">
              <clock-circle-outlined /> 工期 <strong>{{ taskDurationDays }}</strong> 天
            </div>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item><template #label><span class="tcp-fl">工作城市</span></template>
                  <a-cascader v-model:value="addressCascade" :options="regionOptions" placeholder="省份 / 城市" style="width:100%" change-on-select />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item><template #label><span class="tcp-fl">详细地址</span><span class="tcp-fl-hint">选填</span></template>
                  <a-input v-model:value="form.addressDetail" placeholder="楼栋/楼层" :maxlength="200" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
        </section>

        <!-- § 5 预算设定 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 4)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">💰</div>
            <div>
              <div class="tcp-sec-title">预算设定</div>
              <div class="tcp-sec-sub">发布后将锁定对应金额至企业账户余额</div>
            </div>
          </div>

          <a-form layout="vertical" class="tcp-form">
            <a-form-item required>
              <template #label><span class="tcp-fl">任务总预算</span></template>
              <div class="tcp-budget-row">
                <a-input-number v-model:value="form.totalBudget" :min="1" :step="1000" :formatter="(v: any) => v ? `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''" :parser="(v: any) => v.replace(/[¥\s,]/g, '')" placeholder="输入总预算" style="width:240px" size="large" />
                <a-button v-if="suggestedBudget > 0" type="link" @click="form.totalBudget = suggestedBudget" style="font-size:12px">
                  用角色估算值 ¥{{ suggestedBudget.toLocaleString() }}
                </a-button>
              </div>
            </a-form-item>
          </a-form>

          <!-- 费用分解 -->
          <div v-if="form.totalBudget > 0" class="tcp-fee-box">
            <div v-for="(r, i) in form.roles" :key="i" class="tcp-fee-line">
              <span>{{ r.roleName || '角色'+(i+1) }} × {{ r.headcount }}人</span>
              <span>¥{{ ((r.budget||0)*(r.headcount||1)).toLocaleString() }}</span>
            </div>
            <div class="tcp-fee-line sub"><span>平台服务费 (8%)</span><span>¥{{ Math.round(form.totalBudget * 0.08).toLocaleString() }}</span></div>
            <div class="tcp-fee-total"><span>锁定金额</span><span>¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</span></div>
            <a-alert v-if="rolesBudgetSum > form.totalBudget" message="角色预算合计超过总预算，请调整" type="error" :show-icon="false" banner style="margin-top:8px;border-radius:6px" />
          </div>
        </section>

        <!-- § 6 需求附件 -->
        <section class="tcp-section" :ref="el => setSectionRef(el, 5)">
          <div class="tcp-sec-head">
            <div class="tcp-sec-icon">📎</div>
            <div>
              <div class="tcp-sec-title">需求附件 <span class="tcp-optional">可选</span></div>
              <div class="tcp-sec-sub">上传参考文件、设计稿、需求文档等</div>
            </div>
          </div>

          <div class="tcp-upload" :class="{ dragover: isDragOver }" @drop.prevent="onFileDrop" @dragover.prevent @dragenter.prevent="isDragOver=true" @dragleave.prevent="isDragOver=false" @click="attachments.length===0 && triggerFileInput()">
            <div v-if="attachments.length === 0" class="tcp-upload-empty">
              <inbox-outlined style="font-size:28px;color:#bbb" />
              <div>拖拽文件到此处，或 <a @click.stop="triggerFileInput">点击上传</a></div>
              <div class="tcp-upload-hint">PDF·Word·Excel·PPT·ZIP·图片·PSD，≤50MB/个，最多10个</div>
            </div>
            <div v-else class="tcp-file-list">
              <div v-for="(f, i) in attachments" :key="i" class="tcp-file-row">
                <span class="tcp-file-ico">{{ fileIcon(f.fileType) }}</span>
                <span class="tcp-file-name" :title="f.fileName">{{ f.fileName }}</span>
                <span class="tcp-file-sz">{{ formatSize(f.fileSize) }}</span>
                <a-tag v-if="f.uploading" color="processing" size="small">处理中</a-tag>
                <a-tag v-else-if="f.error" color="error" size="small">失败</a-tag>
                <a-tag v-else color="success" size="small">就绪</a-tag>
                <button class="tcp-file-del" @click.stop="removeAttachment(i)">✕</button>
              </div>
              <a v-if="attachments.length < 10" class="tcp-file-add" @click.stop="triggerFileInput">+ 继续添加</a>
            </div>
          </div>
          <input ref="fileInputRef" type="file" multiple style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.psd,.ai,.sketch" @change="onFileSelect" />
        </section>

      </div><!-- /tcp-main -->

      <!-- ── 右侧：粘性摘要 ── -->
      <aside class="tcp-aside">
        <div class="tcp-aside-inner">

          <div class="tcp-aside-title">任务摘要</div>

          <!-- 完成度 -->
          <div class="tcp-comp">
            <div class="tcp-comp-top"><span>完成度</span><span class="tcp-comp-pct">{{ completionPct }}%</span></div>
            <div class="tcp-comp-bar"><div class="tcp-comp-fill" :style="{ width: completionPct + '%' }"></div></div>
          </div>

          <!-- 摘要条目 -->
          <div class="tcp-si" :class="{ done: !!form.title }">
            <div class="tcp-si-dot" :class="{ done: !!form.title }"></div>
            <div class="tcp-si-body">
              <div class="tcp-si-label">任务标题</div>
              <div class="tcp-si-val" :class="{ empty: !form.title }">{{ form.title || '未填写' }}</div>
            </div>
          </div>

          <div class="tcp-si done">
            <div class="tcp-si-dot done"></div>
            <div class="tcp-si-body">
              <div class="tcp-si-label">工作模式</div>
              <div class="tcp-si-val">
                <span class="tcp-si-tag" :class="form.taskMode === 'task_package' ? 'blue' : 'orange'">
                  {{ form.taskMode === 'task_package' ? '📦 任务包' : '📅 人天制' }}
                </span>
              </div>
            </div>
          </div>

          <div class="tcp-si" :class="{ done: form.roles.length > 0 && form.roles.every(r => r.roleName && r.budget > 0) }">
            <div class="tcp-si-dot" :class="{ done: form.roles.length > 0 }"></div>
            <div class="tcp-si-body" style="flex:1">
              <div class="tcp-si-label">角色配置</div>
              <div v-if="form.roles.length === 0" class="tcp-si-val empty">未添加</div>
              <div v-else class="tcp-si-roles">
                <div v-for="(r, i) in form.roles" :key="i" class="tcp-si-role">
                  <span>{{ r.roleName || '未命名' }}</span>
                  <span class="tcp-si-role-info">×{{ r.headcount }} · ¥{{ (r.budget||0).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="checkpoints.length > 0" class="tcp-si done">
            <div class="tcp-si-dot done"></div>
            <div class="tcp-si-body" style="flex:1">
              <div class="tcp-si-label">检查点（{{ checkpoints.length }}个）</div>
              <div class="tcp-si-cps">
                <div v-for="(cp, i) in checkpoints" :key="i" class="tcp-si-cp">
                  <div class="tcp-si-cp-dot" :style="{ background: cpColor(cp.progress) }"></div>
                  <span>{{ cp.name || '未命名' }}</span>
                  <span style="margin-left:auto;color:#aaa;font-size:11px">{{ cp.progress }}%</span>
                </div>
              </div>
            </div>
          </div>

          <div class="tcp-si" :class="{ done: startDate && endDate }">
            <div class="tcp-si-dot" :class="{ done: startDate && endDate }"></div>
            <div class="tcp-si-body">
              <div class="tcp-si-label">时间周期</div>
              <div class="tcp-si-val" :class="{ empty: !dateRange }">{{ dateRange || '未设置' }}</div>
            </div>
          </div>

          <div class="tcp-si" :class="{ done: form.totalBudget > 0 }">
            <div class="tcp-si-dot" :class="{ done: form.totalBudget > 0 }"></div>
            <div class="tcp-si-body">
              <div class="tcp-si-label">总预算</div>
              <div class="tcp-si-val" :class="{ empty: !form.totalBudget }">{{ form.totalBudget ? '¥' + form.totalBudget.toLocaleString() : '未设置' }}</div>
            </div>
          </div>

          <!-- 锁定金额 -->
          <div v-if="form.totalBudget > 0" class="tcp-lock-box">
            <div class="tcp-lock-label">发布锁定金额</div>
            <div class="tcp-lock-val">¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</div>
            <div class="tcp-lock-hint">含 8% 平台服务费</div>
          </div>

          <!-- 校验提示 -->
          <div v-if="!canPublish" class="tcp-checklist">
            <div class="tcp-checklist-title">发布前需完成：</div>
            <div v-if="!form.title" class="tcp-checklist-item">· 填写任务标题</div>
            <div v-if="form.roles.length === 0" class="tcp-checklist-item">· 添加角色配置</div>
            <div v-if="form.roles.some(r => !r.roleName)" class="tcp-checklist-item">· 为所有角色选择名称</div>
            <div v-if="form.roles.some(r => r.budget <= 0)" class="tcp-checklist-item">· 填写所有角色预算</div>
            <div v-if="!form.totalBudget" class="tcp-checklist-item">· 设置任务总预算</div>
          </div>

        </div>
      </aside>

    </div><!-- /tcp-layout -->

    <!-- ══ AI 顾问 Drawer ══ -->
    <a-drawer v-model:open="aiDrawerOpen" title="🤖 AI 任务顾问" placement="right" :width="560" :body-style="{ padding:0, display:'flex', flexDirection:'column', height:'100%' }">
      <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;gap:8px;align-items:center;flex-shrink:0">
        <span style="color:#666;font-size:13px;white-space:nowrap">智能体：</span>
        <a-select v-model:value="selectedAgentId" style="width:200px" size="small" :options="agentOptions" @change="onAgentChange" />
        <span style="color:#999;font-size:12px;margin-left:auto">{{ aiRoundCount }}/30 轮</span>
      </div>
      <div ref="msgListRef" class="ai-msg-list">
        <div v-if="aiMessages.length === 0" class="ai-welcome">
          <div style="font-size:48px;margin-bottom:12px">🤖</div>
          <div style="font-weight:600;font-size:15px">你好！我是 AI 任务顾问</div>
          <div style="color:#999;font-size:13px;margin-top:8px;line-height:1.6">告诉我你想做什么，我来帮你规划角色、预算和工期<br/>对话结束后可一键填充到表单</div>
        </div>
        <div v-for="(msg, i) in aiMessages" :key="i" :class="['ai-msg', msg.role]">
          <div class="ai-msg-bubble"><pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:14px;line-height:1.6">{{ msg.content }}</pre></div>
        </div>
        <div v-if="aiLoading" class="ai-msg assistant"><div class="ai-msg-bubble"><a-spin size="small" style="margin-right:8px" />AI 正在思考…</div></div>
      </div>
      <div v-if="aiSuggestion" style="padding:10px 16px;border-top:1px solid #f0f0f0;background:#f6ffed;flex-shrink:0">
        <a-alert type="success" message="AI 已生成建议，点击填充到表单" style="margin-bottom:8px" />
        <a-button type="primary" block @click="fillFromAI">⚡ 一键填充</a-button>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #f0f0f0;flex-shrink:0">
        <a-row :gutter="8">
          <a-col :flex="1"><a-textarea v-model:value="aiInput" :rows="3" placeholder="描述你的任务需求…" :disabled="aiLoading || aiRoundCount >= 30" @keydown.ctrl.enter="sendAiMessage" :maxlength="2000" /></a-col>
          <a-col><a-button type="primary" :loading="aiLoading" :disabled="aiRoundCount >= 30" @click="sendAiMessage" style="height:100%;min-height:72px">发送</a-button></a-col>
        </a-row>
        <div style="color:#999;font-size:11px;margin-top:4px">Ctrl+Enter 快速发送</div>
      </div>
    </a-drawer>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, LeftOutlined, CheckOutlined, CheckCircleOutlined,
  CloseOutlined, ClockCircleOutlined, InboxOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { taskApi } from '@/api/task'
import request from '@/api/request'

const router = useRouter()
const route = useRoute()
const publishing = ref(false)
const saving = ref(false)
const draftId = ref<number | null>(null)
const lastSavedAt = ref('')
const isEditMode = computed(() => !!draftId.value)
const platformRoles = ref<any[]>([])
const skillTags = ref<any[]>([])
const startDate = ref<any>(null)
const endDate = ref<any>(null)
const addressCascade = ref<string[]>([])

const sectionRefs = ref<(HTMLElement | null)[]>([null, null, null, null, null, null])
function setSectionRef(el: any, i: number) { sectionRefs.value[i] = el }

// ── 表单 ──
interface RoleItem { roleName: string; headcount: number; budget: number; skillTagsArr: string[]; description: string }
const form = reactive({
  title: '',
  description: '',
  taskMode: 'task_package' as 'task_package' | 'daily_rate',
  totalBudget: 0,
  addressDetail: '',
  roles: [] as RoleItem[],
  projectId: null as number | null,
})

// ── 检查点 ──
interface Checkpoint { name: string; progress: number; deliverableDesc: string; allowedFormats: string[]; _expanded: boolean }
const checkpoints = ref<Checkpoint[]>([])
const deliverableFormats = [
  { label: 'PDF', value: 'pdf' }, { label: 'Word', value: 'docx' },
  { label: 'Excel', value: 'xlsx' }, { label: 'PPT', value: 'pptx' },
  { label: '图片 (jpg/png)', value: 'image' }, { label: '设计源文件', value: 'design' },
  { label: '视频 (mp4)', value: 'mp4' }, { label: '压缩包', value: 'zip' },
]
const cpTemplateKeys = [
  { key: 'data', icon: '📊', label: '数据分析' }, { key: 'design', icon: '🎨', label: '设计类' },
  { key: 'photo', icon: '📷', label: '摄影类' }, { key: 'dev', icon: '💻', label: '开发类' },
  { key: 'copy', icon: '✍️', label: '文案类' },
]
const cpTemplates: Record<string, Omit<Checkpoint, '_expanded'>[]> = {
  data: [
    { name: '完成数据收集', progress: 20, deliverableDesc: '原始数据文件（Excel/CSV）', allowedFormats: ['xlsx', 'zip'] },
    { name: '完成数据清洗', progress: 50, deliverableDesc: '清洗后结构化数据 + 清洗说明报告', allowedFormats: ['xlsx', 'pdf'] },
    { name: '完成分析报告初稿', progress: 80, deliverableDesc: '数据分析报告（含可视化图表）', allowedFormats: ['pptx', 'pdf'] },
  ],
  design: [
    { name: '概念方案确认', progress: 25, deliverableDesc: '2-3 个设计方向草图/参考板', allowedFormats: ['image', 'pdf'] },
    { name: '初稿交付', progress: 60, deliverableDesc: '设计初稿（高保真稿）', allowedFormats: ['image', 'design', 'pdf'] },
    { name: '修改稿确认', progress: 85, deliverableDesc: '修改定稿 + 标注规范', allowedFormats: ['design', 'pdf'] },
  ],
  photo: [
    { name: '拍摄完成', progress: 40, deliverableDesc: '原始 RAW 文件压缩包', allowedFormats: ['zip'] },
    { name: '精修初稿', progress: 75, deliverableDesc: '精修后 JPG 文件（低分辨率预览）', allowedFormats: ['zip', 'image'] },
  ],
  dev: [
    { name: '需求评审通过', progress: 15, deliverableDesc: '需求分析文档 + 技术方案', allowedFormats: ['docx', 'pdf'] },
    { name: '前端/功能完成', progress: 55, deliverableDesc: '功能演示视频 + 代码仓库链接', allowedFormats: ['mp4', 'zip'] },
    { name: '测试通过', progress: 85, deliverableDesc: '测试报告 + Bug 修复清单', allowedFormats: ['pdf', 'docx'] },
  ],
  copy: [
    { name: '大纲确认', progress: 20, deliverableDesc: '内容大纲/脚本框架（Word）', allowedFormats: ['docx'] },
    { name: '初稿交付', progress: 60, deliverableDesc: '文案初稿（Word）', allowedFormats: ['docx'] },
  ],
}
function addCP() { const used = checkpoints.value.map(c => c.progress); let p = 20; while (used.includes(p) && p < 95) p += 10; checkpoints.value.push({ name: '', progress: p, deliverableDesc: '', allowedFormats: [], _expanded: false }) }
function removeCP(i: number) { checkpoints.value.splice(i, 1) }
function moveCP(i: number, dir: -1 | 1) { const arr = checkpoints.value; const t = i + dir; if (t < 0 || t >= arr.length) return; [arr[i], arr[t]] = [arr[t], arr[i]] }
function applyTemplate(key: string) { const apply = () => { checkpoints.value = cpTemplates[key].map(c => ({ ...c, _expanded: false })) }; if (checkpoints.value.length > 0) { Modal.confirm({ title: '替换现有检查点？', content: '确认用模板替换？', onOk: apply }) } else apply() }
function cpColor(p: number) { if (p <= 30) return '#1677ff'; if (p <= 65) return '#fa8c16'; return '#52c41a' }
function cpColorBg(p: number) { if (p <= 30) return '#e6f4ff'; if (p <= 65) return '#fff7e6'; return '#f6ffed' }

// ── 附件 ──
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const attachments = ref<Array<{ fileName: string; fileUrl: string; fileSize: number; fileType: string; uploading?: boolean; error?: boolean }>>([])
function triggerFileInput() { fileInputRef.value?.click() }
function fileIcon(type: string) { const m: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑', zip: '🗜', rar: '🗜', jpg: '🖼', jpeg: '🖼', png: '🖼', psd: '🎨', ai: '🎨', sketch: '🎨' }; return m[type?.toLowerCase()] || '📁' }
function formatSize(bytes: number) { if (bytes < 1024) return bytes+'B'; if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+'KB'; return (bytes/(1024*1024)).toFixed(1)+'MB' }
async function processFiles(files: FileList | File[]) {
  const arr = Array.from(files); if (attachments.value.length + arr.length > 10) { message.warning('附件最多 10 个'); return }
  for (const file of arr) {
    if (file.size > 50*1024*1024) { message.warning(`${file.name} 超过 50MB`); continue }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const entry = { fileName: file.name, fileUrl: '', fileSize: file.size, fileType: ext, uploading: true, error: false }
    attachments.value.push(entry); const idx = attachments.value.length - 1
    try { attachments.value[idx].fileUrl = URL.createObjectURL(file); attachments.value[idx].uploading = false }
    catch { attachments.value[idx].uploading = false; attachments.value[idx].error = true }
  }
}
function onFileSelect(e: Event) { const i = e.target as HTMLInputElement; if (i.files) processFiles(i.files); i.value = '' }
function onFileDrop(e: DragEvent) { isDragOver.value = false; if (e.dataTransfer?.files) processFiles(e.dataTransfer.files) }
function removeAttachment(idx: number) { attachments.value.splice(idx, 1) }

// ── 关联项目 ──
const projectOptions = ref<{ value: number; label: string }[]>([])
let projectsLoaded = false
async function loadProjects() { if (projectsLoaded) return; try { const res = await request.get('/projects', { params: { pageSize: 100 } }); projectOptions.value = (res.data?.list || []).map((p: any) => ({ value: p.id, label: `${p.projectNo} · ${p.name}` })); projectsLoaded = true } catch {} }
function filterProjectOption(input: string, option: any) { return (option.label as string).toLowerCase().includes(input.toLowerCase()) }
function filterOption(input: string, option: any) { return option.value?.toLowerCase().includes(input.toLowerCase()) }

// ── AI 顾问 ──
const aiDrawerOpen = ref(false); const hasLlm = ref(false)
const agentOptions = ref<{ value: number; label: string }[]>([]); const selectedAgentId = ref<number | null>(null)
const aiMessages = ref<{ role: 'user' | 'assistant'; content: string }[]>([]); const aiInput = ref('')
const aiLoading = ref(false); const aiSuggestion = ref<any>(null)
const aiSessionUuid = ref<string | null>(null); const aiRoundCount = ref(0)
const msgListRef = ref<HTMLElement | null>(null)
async function checkLlmConfig() { try { await request.get('/company/llm-config'); hasLlm.value = true; const agRes = await request.get('/company/agents'); const agents = (agRes.data || []).filter((a: any) => a.isActive); agentOptions.value = agents.map((a: any) => ({ value: a.id, label: a.name })); if (agents.length > 0) selectedAgentId.value = agents[0].id } catch { hasLlm.value = false } }
function onAgentChange() { aiSessionUuid.value = null; aiMessages.value = []; aiRoundCount.value = 0; aiSuggestion.value = null }
async function sendAiMessage() {
  const msg = aiInput.value.trim(); if (!msg || aiLoading.value) return
  if (aiRoundCount.value >= 30) { message.warning('对话已达 30 轮上限'); return }
  if (!selectedAgentId.value) { message.warning('请先选择智能体'); return }
  aiMessages.value.push({ role: 'user', content: msg }); aiInput.value = ''; aiLoading.value = true; aiRoundCount.value++
  await nextTick(); msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' })
  try {
    const res = await request.post('/ai/chat', { agentId: selectedAgentId.value, message: msg, ...(aiSessionUuid.value && { sessionUuid: aiSessionUuid.value }) })
    const data = (res as any).data || res; aiSessionUuid.value = data.sessionUuid
    aiMessages.value.push({ role: 'assistant', content: data.response })
    if (data.isComplete) { try { aiSuggestion.value = JSON.parse(data.response) } catch {} }
    if (!aiSuggestion.value) { const m = data.response.match(/```json\n?([\s\S]+?)\n?```/); if (m) { try { const p = JSON.parse(m[1]); if (p?.title) aiSuggestion.value = p } catch {} } }
  } catch { aiMessages.value.push({ role: 'assistant', content: '⚠️ AI 暂时无法回复，请稍后再试' }) }
  finally { aiLoading.value = false; await nextTick(); msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' }) }
}
function fillFromAI() {
  if (!aiSuggestion.value) return; const s = aiSuggestion.value; const has = !!(form.title || form.description)
  const doFill = () => { if (s.title) form.title = s.title; if (s.description) form.description = s.description; if (s.taskMode && ['task_package','daily_rate'].includes(s.taskMode)) form.taskMode = s.taskMode; if (s.startDate) startDate.value = dayjs(s.startDate); if (s.endDate) endDate.value = dayjs(s.endDate); if (Array.isArray(s.suggestedRoles) && s.suggestedRoles.length > 0) { form.roles = s.suggestedRoles.map((r: any) => ({ roleName: r.roleName || '', headcount: r.headcount || 1, budget: r.budget || 0, skillTagsArr: r.skillTags ? r.skillTags.split(',').map((x: string) => x.trim()) : [], description: '' })) }; aiDrawerOpen.value = false; message.success('AI 建议已填充') }
  if (has) Modal.confirm({ title: '覆盖已有内容？', content: '确认用 AI 建议覆盖？', onOk: doFill }); else doFill()
}

// ── 计算属性 ──
const rolesBudgetSum = computed(() => form.roles.reduce((s, r) => s + (r.budget||0) * (r.headcount||1), 0))
const suggestedBudget = computed(() => rolesBudgetSum.value)
const skillTagOptions = computed(() => skillTags.value.map(t => ({ label: `${t.name}${t.hot ? ' 🔥' : ''}`, value: t.name })))
const fullAddress = computed(() => [...(addressCascade.value || []), form.addressDetail].filter(Boolean).join(' '))
const dateRange = computed(() => { if (!startDate.value && !endDate.value) return ''; return `${startDate.value ? dayjs(startDate.value).format('MM/DD') : '?'} — ${endDate.value ? dayjs(endDate.value).format('MM/DD') : '?'}` })
const taskDurationDays = computed(() => { if (!startDate.value || !endDate.value) return 0; return dayjs(endDate.value).diff(dayjs(startDate.value), 'day') + 1 })
const completionPct = computed(() => { let s = 0; if (form.title) s += 25; if (form.roles.length > 0 && form.roles.every(r => r.roleName && r.budget > 0)) s += 35; if (form.totalBudget > 0) s += 25; if (startDate.value && endDate.value) s += 15; return s })
const canPublish = computed(() => !!(form.title && form.roles.length > 0 && form.roles.every(r => r.roleName && r.budget > 0) && form.totalBudget > 0))
function disabledEndDate(current: any) { return startDate.value ? current && current < dayjs(startDate.value).startOf('day') : false }
function addRole() { form.roles.push({ roleName: '', headcount: 1, budget: 0, skillTagsArr: [], description: '' }) }
function quickAddRole(r: any) { form.roles.push({ roleName: r.roleName, headcount: 1, budget: r.suggestedDaily || 0, skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' }) }
function onRoleSelect(idx: number, roleName: string) { const pr = platformRoles.value.find(r => r.roleName === roleName); if (pr) { const role = form.roles[idx]; if (role.budget === 0 && pr.suggestedDaily) role.budget = pr.suggestedDaily; if (role.skillTagsArr.length === 0 && pr.skillTags) role.skillTagsArr = pr.skillTags.split(',').map((s: string) => s.trim()) } }
function removeRole(idx: number) { form.roles.splice(idx, 1) }

function buildPayload() {
  return { title: form.title, description: form.description || undefined, taskMode: form.taskMode, totalBudget: form.totalBudget,
    startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
    endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined,
    address: fullAddress.value || undefined, ...(form.projectId && { projectId: form.projectId }),
    roles: form.roles.map(r => ({ roleName: r.roleName, headcount: r.headcount, budget: r.budget, skillTags: r.skillTagsArr.length > 0 ? r.skillTagsArr.join(',') : undefined, description: r.description || undefined })) }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave() { if (autoSaveTimer) clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(doAutoSave, 30000) }
async function doAutoSave() {
  if (!form.title.trim()) return
  try { if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else { await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget, startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined, endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0 && form.roles.every(r => r.roleName)) await taskApi.setRoles(draftId.value, buildPayload().roles) }
    lastSavedAt.value = `已自动保存 ${dayjs().format('HH:mm')}` } catch {}
}
watch(() => [form.title, form.description, form.taskMode, form.totalBudget, form.roles.length], scheduleAutoSave, { deep: true })

async function handleSaveDraft() {
  saving.value = true
  try { if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else { await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget, startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined, endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(draftId.value, buildPayload().roles) }
    message.success('草稿已保存'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || '保存失败') }
  finally { saving.value = false }
}

async function handlePublish() {
  publishing.value = true
  try { let taskId = draftId.value
    if (!taskId) { const res = await taskApi.create(buildPayload()); taskId = res.taskId }
    else { await taskApi.updateDraft(taskId, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget, startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined, endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(taskId, buildPayload().roles) }
    for (const att of attachments.value.filter(a => !a.error && a.fileUrl)) { try { await taskApi.addAttachment(taskId, { fileName: att.fileName, fileUrl: att.fileUrl, fileSize: att.fileSize, fileType: att.fileType }) } catch {} }
    await taskApi.publish(taskId); message.success('🎉 任务发布成功！'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || '发布失败') }
  finally { publishing.value = false }
}

async function loadDraft(id: number) {
  try { const task = await taskApi.detail(id); form.title = task.title || ''; form.description = task.description || ''
    form.taskMode = task.taskMode || 'task_package'; form.totalBudget = task.totalBudget || 0
    if (task.startDate) startDate.value = dayjs(task.startDate); if (task.endDate) endDate.value = dayjs(task.endDate)
    if (task.address) form.addressDetail = task.address; if (task.projectId) form.projectId = task.projectId
    if (task.roles?.length > 0) { form.roles = task.roles.map((r: any) => ({ roleName: r.roleName, headcount: r.headcount, budget: r.budget, skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' })) }
    draftId.value = id } catch { message.error('加载草稿失败'); router.push('/task/square') }
}

const regionOptions = [
  { value: '北京', label: '北京', children: [{ value: '北京市', label: '北京市' }] },
  { value: '上海', label: '上海', children: [{ value: '上海市', label: '上海市' }] },
  { value: '广东', label: '广东', children: [{ value: '广州市', label: '广州市' }, { value: '深圳市', label: '深圳市' }, { value: '东莞市', label: '东莞市' }] },
  { value: '浙江', label: '浙江', children: [{ value: '杭州市', label: '杭州市' }, { value: '宁波市', label: '宁波市' }] },
  { value: '江苏', label: '江苏', children: [{ value: '南京市', label: '南京市' }, { value: '苏州市', label: '苏州市' }] },
  { value: '四川', label: '四川', children: [{ value: '成都市', label: '成都市' }] },
  { value: '湖北', label: '湖北', children: [{ value: '武汉市', label: '武汉市' }] },
  { value: '湖南', label: '湖南', children: [{ value: '长沙市', label: '长沙市' }] },
  { value: '福建', label: '福建', children: [{ value: '厦门市', label: '厦门市' }, { value: '福州市', label: '福州市' }] },
  { value: '陕西', label: '陕西', children: [{ value: '西安市', label: '西安市' }] },
  { value: '山东', label: '山东', children: [{ value: '青岛市', label: '青岛市' }, { value: '济南市', label: '济南市' }] },
  { value: '远程', label: '🌐 远程/不限', children: [{ value: '远程办公', label: '远程办公' }] },
]

onMounted(async () => {
  try { platformRoles.value = await taskApi.getPlatformRoles() } catch {}
  try { skillTags.value = await taskApi.getSkillTags() } catch {}
  await checkLlmConfig()
  const editId = route.query.id ? Number(route.query.id) : null
  if (editId) await loadDraft(editId)
  const routeProjectId = route.query.projectId ? Number(route.query.projectId) : null
  if (routeProjectId) { form.projectId = routeProjectId; await loadProjects() }
})
onUnmounted(() => { if (autoSaveTimer) clearTimeout(autoSaveTimer) })
</script>

<style scoped>
/* ═══════ 页面根：不锁高度，允许原生滚动 ═══════ */
.tcp-page { min-height: 100%; background: #f5f6f8; }

/* ═══════ 顶部操作栏 ═══════ */
.tcp-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 28px 12px;
  position: sticky; top: 0; z-index: 20;
  background: #f5f6f8;
}
.tcp-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.tcp-bc-link { color: #8c8c8c; cursor: pointer; transition: color .15s; }
.tcp-bc-link:hover { color: #1677ff; }
.tcp-bc-sep { color: #d9d9d9; }
.tcp-bc-cur { font-weight: 600; color: #1a1a2e; }
.tcp-saved-tag { font-size: 12px; color: #52c41a; margin-left: 12px; display: inline-flex; align-items: center; gap: 4px; }
.tcp-topbar-actions { display: flex; align-items: center; gap: 8px; }
.tcp-ai-btn { background: linear-gradient(135deg,#667eea,#764ba2) !important; border: none !important; color: #fff !important; font-size: 13px; font-weight: 500; border-radius: 6px !important; }
.tcp-ai-btn:hover { opacity: .88 !important; }
.tcp-pub-btn { background: linear-gradient(135deg,#1677ff,#4096ff) !important; border: none !important; font-weight: 600 !important; box-shadow: 0 2px 8px rgba(22,119,255,.25) !important; }

/* ═══════ 双栏布局 ═══════ */
.tcp-layout { display: flex; align-items: flex-start; gap: 20px; padding: 0 28px 40px; }

/* ── 左侧主表单：自然展开 ── */
.tcp-main { flex: 1; min-width: 0; }

/* ── 区块 ── */
.tcp-section {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8eaed;
  padding: 24px 28px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.tcp-sec-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
.tcp-sec-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
.tcp-sec-title { font-size: 16px; font-weight: 700; color: #1a1a2e; line-height: 1.4; }
.tcp-sec-sub { font-size: 13px; color: #8c8c8c; margin-top: 2px; }
.tcp-optional {
  font-size: 11px; background: #f0f0f0; color: #8c8c8c;
  padding: 1px 8px; border-radius: 10px; font-weight: 400; vertical-align: middle; margin-left: 6px;
}

/* ── 表单 ── */
.tcp-form :deep(.ant-form-item) { margin-bottom: 18px; }
.tcp-fl { font-size: 13px; font-weight: 600; color: #1a1a2e; }
.tcp-fl-hint { font-size: 12px; color: #aaa; margin-left: 6px; font-weight: 400; }

/* 工作模式 */
.tcp-mode-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tcp-mode-card {
  border: 2px solid #e8eaed; border-radius: 10px; padding: 16px;
  cursor: pointer; transition: all .18s;
}
.tcp-mode-card:hover { border-color: #91caff; background: #fafcff; }
.tcp-mode-card.sel { border-color: #1677ff; background: #f0f7ff; }
.tcp-mode-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.tcp-mode-ico { font-size: 24px; }
.tcp-mode-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #d9d9d9; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.tcp-mode-radio.sel { border-color: #1677ff; }
.tcp-mode-radio-dot { width: 8px; height: 8px; border-radius: 50%; background: #1677ff; }
.tcp-mode-name { font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
.tcp-mode-desc { font-size: 12px; color: #8c8c8c; line-height: 1.5; margin-bottom: 10px; }
.tcp-mode-tags { display: flex; gap: 4px; }
.tcp-mtag { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.tcp-mtag.blue { background: #e6f4ff; color: #1677ff; }
.tcp-mtag.green { background: #f6ffed; color: #52c41a; }
.tcp-mtag.orange { background: #fff7e6; color: #fa8c16; }
.tcp-mtag.purple { background: #f9f0ff; color: #722ed1; }

/* 角色 */
.tcp-quick-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 10px 12px; background: #fafafa; border: 1px solid #f0f0f0;
  border-radius: 8px; margin-bottom: 14px;
}
.tcp-quick-label { font-size: 12px; color: #8c8c8c; white-space: nowrap; }
.tcp-chip {
  height: 26px; padding: 0 10px; border-radius: 13px;
  border: 1px solid #d9d9d9; background: #fff;
  font-size: 12px; color: #595959; cursor: pointer; transition: all .15s;
}
.tcp-chip:hover { border-color: #1677ff; color: #1677ff; background: #f0f7ff; }
.tcp-roles-empty { text-align: center; padding: 24px 0; color: #bbb; font-size: 13px; }
.tcp-role-card {
  border: 1px solid #e8eaed; border-radius: 8px; padding: 14px 16px;
  margin-bottom: 10px; background: #fafcff; transition: box-shadow .15s;
}
.tcp-role-card:hover { box-shadow: 0 2px 8px rgba(22,119,255,.08); }
.tcp-role-row1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.tcp-role-idx {
  width: 22px; height: 22px; border-radius: 50%; background: #1677ff; color: #fff;
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.tcp-role-lbl { font-size: 12px; color: #8c8c8c; white-space: nowrap; }
.tcp-role-del {
  margin-left: auto; width: 24px; height: 24px; border-radius: 50%;
  border: 1px solid #ffa39e; background: #fff; color: #ff4d4f; font-size: 11px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s;
}
.tcp-role-del:hover { background: #fff1f0; }
.tcp-role-row2 { display: flex; gap: 10px; }
.tcp-role-sub { margin-top: 8px; font-size: 12px; color: #8c8c8c; padding-top: 8px; border-top: 1px dashed #f0f0f0; }
.tcp-role-sub strong { color: #1677ff; }

.tcp-add-btn {
  width: 100%; height: 42px; border-radius: 8px; border: 1.5px dashed #d9d9d9;
  background: transparent; color: #8c8c8c; font-size: 13px; cursor: pointer;
  margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all .15s;
}
.tcp-add-btn:hover { border-color: #1677ff; color: #1677ff; background: #f0f7ff; }

/* 检查点 */
.tcp-tpl-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 8px 12px; background: #fffbe6; border: 1px solid #ffe58f;
  border-radius: 8px; margin-bottom: 16px;
}
.tcp-tpl-label { font-size: 12px; color: #ad6800; font-weight: 600; white-space: nowrap; }
.tcp-tpl-btn {
  padding: 3px 10px; border-radius: 6px; border: 1px solid #e8d48f;
  background: #fff; font-size: 12px; color: #595959; cursor: pointer; transition: all .15s;
}
.tcp-tpl-btn:hover { border-color: #fa8c16; color: #fa8c16; background: #fff7e6; }

.tcp-timeline { padding: 0 0 4px 4px; }
.tcp-tl-node { display: flex; align-items: center; gap: 12px; padding: 2px 0; }
.tcp-tl-dot {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 11px; font-weight: 700;
}
.tcp-tl-dot.start { background: #e6f4ff; border: 2px solid #1677ff; color: #1677ff; }
.tcp-tl-dot.end { background: #f6ffed; border: 2px solid #52c41a; color: #52c41a; font-size: 13px; }
.tcp-tl-dot.cp { color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
.tcp-tl-text { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.tcp-tl-text strong { color: #1a1a2e; }
.tcp-tl-text span { color: #8c8c8c; font-size: 12px; }
.tcp-tl-stem { width: 2px; height: 12px; background: #e8eaed; margin-left: 13px; }
.tcp-tl-cp-body { flex: 1; min-width: 0; }
.tcp-tl-cp-top { display: flex; align-items: center; gap: 8px; }
.tcp-cp-name { flex: 1; }
.tcp-cp-badge { flex-shrink: 0; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.tcp-cp-btn {
  width: 22px; height: 22px; border-radius: 4px; border: 1px solid #e8eaed;
  background: #fff; font-size: 11px; cursor: pointer; color: #595959; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
}
.tcp-cp-btn:hover:not(:disabled) { border-color: #1677ff; color: #1677ff; }
.tcp-cp-btn:disabled { opacity: .3; cursor: default; }
.tcp-cp-btn.del:hover { border-color: #ff4d4f; color: #ff4d4f; }
.tcp-cp-expand { font-size: 12px; color: #8c8c8c; cursor: pointer; padding: 4px 0; display: flex; align-items: center; gap: 6px; user-select: none; }
.tcp-cp-expand:hover { color: #1677ff; }
.tcp-cp-expand-hint { color: #bbb; font-size: 11px; }
.tcp-cp-detail { margin-top: 6px; padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #f0f0f0; }

/* 时间 */
.tcp-duration {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: #1677ff; background: #e6f4ff;
  padding: 4px 12px; border-radius: 20px; margin: -4px 0 12px;
}

/* 预算 */
.tcp-budget-row { display: flex; align-items: center; gap: 10px; }
.tcp-fee-box {
  background: #fafafa; border: 1px solid #f0f0f0; border-radius: 8px;
  padding: 12px 16px; margin-top: 8px;
}
.tcp-fee-line { display: flex; justify-content: space-between; font-size: 13px; color: #595959; padding: 4px 0; }
.tcp-fee-line.sub { color: #8c8c8c; }
.tcp-fee-total {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 8px; margin-top: 6px; border-top: 1.5px solid #e8eaed;
  font-weight: 700; font-size: 15px; color: #1677ff;
}

/* 附件 */
.tcp-upload {
  border: 2px dashed #d9d9d9; border-radius: 10px; padding: 20px;
  text-align: center; cursor: pointer; transition: all .18s; background: #fafafa;
}
.tcp-upload:hover, .tcp-upload.dragover { border-color: #1677ff; background: #f0f7ff; }
.tcp-upload-empty { font-size: 14px; color: #595959; }
.tcp-upload-hint { font-size: 12px; color: #bbb; margin-top: 4px; }
.tcp-file-list { text-align: left; }
.tcp-file-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
.tcp-file-ico { font-size: 16px; flex-shrink: 0; }
.tcp-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.tcp-file-sz { color: #bbb; font-size: 12px; flex-shrink: 0; }
.tcp-file-del { border: none; background: none; color: #bbb; font-size: 13px; cursor: pointer; padding: 0 4px; }
.tcp-file-del:hover { color: #ff4d4f; }
.tcp-file-add { font-size: 13px; color: #1677ff; margin-top: 8px; display: inline-block; cursor: pointer; }

/* ═══════ 右侧粘性摘要 ═══════ */
.tcp-aside { width: 272px; flex-shrink: 0; }
.tcp-aside-inner {
  position: sticky; top: 64px;
  background: #fff; border: 1px solid #e8eaed; border-radius: 10px;
  padding: 20px 18px; box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.tcp-aside-title { font-size: 12px; font-weight: 700; color: #8c8c8c; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 14px; }

.tcp-comp { margin-bottom: 16px; }
.tcp-comp-top { display: flex; justify-content: space-between; font-size: 12px; color: #595959; margin-bottom: 6px; }
.tcp-comp-pct { font-weight: 700; color: #1677ff; }
.tcp-comp-bar { height: 5px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.tcp-comp-fill { height: 100%; background: linear-gradient(90deg,#1677ff,#36cfc9); transition: width .4s ease; border-radius: 3px; }

.tcp-si { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.tcp-si:last-of-type { border-bottom: none; }
.tcp-si-dot { width: 8px; height: 8px; border-radius: 50%; background: #e0e0e0; flex-shrink: 0; margin-top: 4px; transition: background .2s; }
.tcp-si-dot.done { background: #52c41a; }
.tcp-si-body { flex: 1; min-width: 0; }
.tcp-si-label { font-size: 11px; color: #aaa; margin-bottom: 2px; }
.tcp-si-val { font-size: 13px; color: #1a1a2e; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tcp-si-val.empty { color: #bbb; font-weight: 400; }
.tcp-si-tag { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.tcp-si-tag.blue { background: #e6f4ff; color: #1677ff; }
.tcp-si-tag.orange { background: #fff7e6; color: #fa8c16; }
.tcp-si-roles { display: flex; flex-direction: column; gap: 3px; }
.tcp-si-role { display: flex; justify-content: space-between; font-size: 12px; }
.tcp-si-role-info { color: #8c8c8c; font-size: 11px; }
.tcp-si-cps { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; }
.tcp-si-cp { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #595959; }
.tcp-si-cp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.tcp-lock-box {
  background: linear-gradient(135deg,#fff7e6,#ffe7ba); border: 1px solid #ffd591;
  border-radius: 10px; padding: 12px; margin: 12px 0; text-align: center;
}
.tcp-lock-label { font-size: 11px; color: #ad6800; margin-bottom: 4px; }
.tcp-lock-val { font-size: 22px; font-weight: 800; color: #d46b08; }
.tcp-lock-hint { font-size: 11px; color: #ad6800; margin-top: 2px; }

.tcp-checklist { margin-top: 10px; padding: 10px 12px; background: #fff7e6; border-radius: 8px; border: 1px solid #ffe58f; }
.tcp-checklist-title { font-size: 11px; font-weight: 700; color: #ad6800; margin-bottom: 4px; }
.tcp-checklist-item { font-size: 12px; color: #d46b08; line-height: 1.8; }

/* ═══════ 响应式 ═══════ */
@media (max-width: 1024px) { .tcp-aside { display: none; } }

/* ═══════ 动画 ═══════ */
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ═══════ AI 对话 ═══════ */
.ai-msg-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.ai-welcome { text-align: center; padding: 40px 24px; color: #666; }
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-msg-bubble { max-width: 84%; padding: 10px 14px; border-radius: 12px; }
.ai-msg.user .ai-msg-bubble { background: #1677ff; color: #fff; border-radius: 12px 12px 2px 12px; }
.ai-msg.assistant .ai-msg-bubble { background: #f5f5f5; border-radius: 12px 12px 12px 2px; }
</style>
