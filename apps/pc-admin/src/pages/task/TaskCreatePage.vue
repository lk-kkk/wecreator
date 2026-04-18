<template>
  <div class="task-create-page">

    <!-- 顶部 Header -->
    <div class="page-header">
      <div class="page-header-left">
        <a-button type="text" class="back-btn" @click="$router.back()">
          <left-outlined /> 返回
        </a-button>
        <div class="page-header-title">
          <h2>{{ isEditMode ? '编辑任务' : '发布任务' }}</h2>
          <div class="page-header-meta">
            <a-tag v-if="draftId" color="blue" size="small">草稿 #{{ draftId }}</a-tag>
            <span v-if="lastSavedAt" class="auto-save-hint">
              <check-circle-outlined /> {{ lastSavedAt }}
            </span>
          </div>
        </div>
      </div>
      <div class="page-header-right">
        <a-button v-if="hasLlm" @click="aiDrawerOpen = true" class="ai-btn">
          <span class="ai-btn-icon">🤖</span> AI 任务顾问
        </a-button>
      </div>
    </div>

    <!-- 主体布局：左侧步骤 + 右侧内容 -->
    <div class="page-body">

      <!-- 左侧步骤导航 -->
      <div class="step-nav">
        <div
          v-for="(step, i) in steps"
          :key="i"
          class="step-nav-item"
          :class="{ active: currentStep === i, done: currentStep > i, clickable: currentStep > i }"
          @click="currentStep > i && (currentStep = i)"
        >
          <div class="step-nav-icon">
            <check-outlined v-if="currentStep > i" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <div class="step-nav-info">
            <div class="step-nav-title">{{ step.title }}</div>
            <div class="step-nav-desc">{{ step.desc }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="step-content">

        <!-- ─── Step 1：基本信息 ─── -->
        <div v-show="currentStep === 0" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">📋</div>
            <div>
              <h3 class="step-panel-title">基本信息</h3>
              <p class="step-panel-subtitle">填写任务标题、描述及工作模式</p>
            </div>
          </div>

          <a-form layout="vertical" class="panel-form">
            <div class="form-section">
              <div class="form-section-title">任务信息</div>
              <a-form-item label="任务标题" required>
                <a-input
                  v-model:value="form.title"
                  placeholder="例如：双11电商产品拍摄、品牌LOGO设计升级"
                  :maxlength="100"
                  show-count
                  size="large"
                  class="title-input"
                />
              </a-form-item>
              <a-form-item label="任务描述">
                <a-textarea
                  v-model:value="form.description"
                  :rows="5"
                  placeholder="详细描述任务需求、交付标准、注意事项等...&#10;&#10;例如：&#10;1. 拍摄主要产品线共20款单品，每款提供正面、侧面、细节三张图&#10;2. 要求白底图，分辨率不低于3000×3000px&#10;3. 最终交付 JPG + RAW 格式"
                  show-count
                  :maxlength="2000"
                />
              </a-form-item>
            </div>

            <div class="form-section">
              <div class="form-section-title">工作模式</div>
              <div class="task-mode-cards">
                <div
                  class="mode-card"
                  :class="{ selected: form.taskMode === 'task_package' }"
                  @click="form.taskMode = 'task_package'"
                >
                  <div class="mode-card-icon">📦</div>
                  <div class="mode-card-content">
                    <div class="mode-card-name">任务包模式</div>
                    <div class="mode-card-desc">按交付物成果验收，完成即结算</div>
                    <div class="mode-card-tags">
                      <a-tag color="blue" size="small">明确交付物</a-tag>
                      <a-tag color="green" size="small">结果导向</a-tag>
                    </div>
                  </div>
                  <check-circle-filled v-if="form.taskMode === 'task_package'" class="mode-check" />
                </div>
                <div
                  class="mode-card"
                  :class="{ selected: form.taskMode === 'daily_rate' }"
                  @click="form.taskMode = 'daily_rate'"
                >
                  <div class="mode-card-icon">📅</div>
                  <div class="mode-card-content">
                    <div class="mode-card-name">人天模式</div>
                    <div class="mode-card-desc">按工时天数计费，弹性合作</div>
                    <div class="mode-card-tags">
                      <a-tag color="orange" size="small">按天计费</a-tag>
                      <a-tag color="purple" size="small">灵活工期</a-tag>
                    </div>
                  </div>
                  <check-circle-filled v-if="form.taskMode === 'daily_rate'" class="mode-check" />
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">关联项目 <span class="optional-label">可选</span></div>
              <a-form-item>
                <a-select
                  v-model:value="form.projectId"
                  placeholder="🗂 选择要关联的项目（可选）"
                  allow-clear
                  show-search
                  :filter-option="filterProjectOption"
                  :options="projectOptions"
                  @focus="loadProjects"
                  style="width:100%"
                  size="large"
                />
              </a-form-item>
            </div>

            <div class="form-section">
              <div class="form-section-title">需求附件 <span class="optional-label">可选，最多10个</span></div>
              <div
                class="attachment-upload-area"
                @drop.prevent="onFileDrop"
                @dragover.prevent
                @dragenter.prevent="isDragOver = true"
                @dragleave="isDragOver = false"
                :class="{ 'drag-over': isDragOver }"
                @click="attachments.length === 0 && triggerFileInput()"
              >
                <div v-if="attachments.length === 0" class="upload-empty">
                  <inbox-outlined class="upload-icon" />
                  <p class="upload-text">将文件拖拽至此，或 <a @click.stop="triggerFileInput">点击上传</a></p>
                  <p class="upload-hint-text">PDF / Word / Excel / PPT / ZIP / 图片 / PSD，单文件 ≤ 50MB</p>
                </div>
                <div v-else class="attachment-list">
                  <div v-for="(f, i) in attachments" :key="i" class="attachment-item">
                    <span class="file-icon">{{ fileIcon(f.fileType) }}</span>
                    <span class="file-name" :title="f.fileName">{{ f.fileName }}</span>
                    <span class="file-size">{{ formatSize(f.fileSize) }}</span>
                    <a-tag v-if="f.uploading" color="processing" size="small">处理中</a-tag>
                    <a-tag v-else-if="f.error" color="error" size="small">失败</a-tag>
                    <a-tag v-else color="success" size="small">就绪</a-tag>
                    <a-button type="text" danger size="small" @click.stop="removeAttachment(i)" class="del-btn">✕</a-button>
                  </div>
                  <div class="attachment-add-more" v-if="attachments.length < 10">
                    <a-button type="dashed" size="small" @click.stop="triggerFileInput">
                      <plus-outlined /> 继续添加
                    </a-button>
                  </div>
                </div>
              </div>
              <input ref="fileInputRef" type="file" multiple style="display:none"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.psd,.ai,.sketch"
                @change="onFileSelect" />
            </div>
          </a-form>
        </div>

        <!-- ─── Step 2：角色配置 ─── -->
        <div v-show="currentStep === 1" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">👥</div>
            <div>
              <h3 class="step-panel-title">角色配置</h3>
              <p class="step-panel-subtitle">添加所需的创作角色和岗位</p>
            </div>
          </div>

          <!-- 快速添加 -->
          <div v-if="platformRoles.length > 0" class="quick-roles-bar">
            <span class="quick-label">⚡ 快速添加</span>
            <div class="quick-role-chips">
              <a-button
                v-for="r in platformRoles.slice(0, 10)" :key="r.roleName"
                size="small" class="role-chip"
                @click="quickAddRole(r)"
              >+ {{ r.roleName }}</a-button>
            </div>
          </div>

          <div v-if="form.roles.length === 0" class="roles-empty">
            <team-outlined style="font-size:40px;color:#d9d9d9;margin-bottom:12px" />
            <p style="color:#999">还没有添加角色，点击下方按钮或快速选择</p>
          </div>

          <div v-for="(role, idx) in form.roles" :key="idx" class="role-card">
            <div class="role-card-header">
              <div class="role-card-badge">
                <span class="role-badge-num">{{ idx + 1 }}</span>
                <span class="role-badge-text">{{ role.roleName || '未命名角色' }}</span>
              </div>
              <a-popconfirm title="确定删除该角色？" @confirm="removeRole(idx)">
                <a-button type="text" danger size="small"><delete-outlined /> 删除</a-button>
              </a-popconfirm>
            </div>
            <a-row :gutter="[16, 0]">
              <a-col :span="8">
                <a-form-item label="角色名称" required>
                  <a-select
                    v-model:value="role.roleName"
                    placeholder="选择角色"
                    show-search
                    :filter-option="filterOption"
                    @change="(val: string) => onRoleSelect(idx, val)"
                    size="large"
                  >
                    <a-select-option v-for="r in platformRoles" :key="r.roleName" :value="r.roleName">
                      {{ r.roleName }}
                      <span v-if="r.suggestedDaily" style="color:#999;float:right;font-size:12px">¥{{ r.suggestedDaily }}/天</span>
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="5">
                <a-form-item label="需求人数" required>
                  <a-input-number v-model:value="role.headcount" :min="1" :max="50" style="width:100%" size="large" />
                </a-form-item>
              </a-col>
              <a-col :span="11">
                <a-form-item label="单人预算（元）" required>
                  <a-input-number
                    v-model:value="role.budget"
                    :min="100" :step="500"
                    :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
                    style="width:100%"
                    size="large"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="[16, 0]">
              <a-col :span="16">
                <a-form-item label="技能要求">
                  <a-select v-model:value="role.skillTagsArr" mode="multiple" placeholder="选择技能标签"
                    :options="skillTagOptions" allow-clear :max-tag-count="5" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="补充说明">
                  <a-input v-model:value="role.description" placeholder="具体工作内容" :maxlength="100" />
                </a-form-item>
              </a-col>
            </a-row>
          </div>

          <a-button type="dashed" block @click="addRole" class="add-role-btn" size="large">
            <plus-outlined /> 添加角色岗位
          </a-button>
        </div>

        <!-- ─── Step 3：检查点 ─── -->
        <div v-show="currentStep === 2" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">🏁</div>
            <div>
              <h3 class="step-panel-title">检查点设置</h3>
              <p class="step-panel-subtitle">设置任务关键里程碑，零工到达检查点时需上传交付物</p>
            </div>
          </div>

          <!-- 说明卡片 -->
          <div class="checkpoint-intro">
            <div class="cp-intro-item">
              <flag-outlined class="cp-intro-icon" />
              <div>
                <div class="cp-intro-title">什么是检查点？</div>
                <div class="cp-intro-desc">任务执行中的关键节点，零工完成阶段性工作后上传交付物，企业验收后继续推进。</div>
              </div>
            </div>
            <div class="cp-intro-item">
              <safety-certificate-outlined class="cp-intro-icon" />
              <div>
                <div class="cp-intro-title">如何保障质量？</div>
                <div class="cp-intro-desc">每个检查点均需企业方审核通过，确保任务质量可控，降低返工风险。</div>
              </div>
            </div>
          </div>

          <!-- 快速模板 -->
          <div class="cp-templates">
            <span class="cp-tpl-label">快速套用模板：</span>
            <a-button size="small" @click="applyCheckpointTemplate('data')">📊 数据分析</a-button>
            <a-button size="small" @click="applyCheckpointTemplate('design')">🎨 设计类</a-button>
            <a-button size="small" @click="applyCheckpointTemplate('photo')">📷 摄影类</a-button>
            <a-button size="small" @click="applyCheckpointTemplate('dev')">💻 开发类</a-button>
            <a-button size="small" @click="applyCheckpointTemplate('copy')">✍️ 文案类</a-button>
          </div>

          <!-- 检查点列表 -->
          <div class="checkpoint-list">
            <div class="cp-progress-track">
              <div class="cp-track-line"></div>
            </div>
            <div v-if="checkpoints.length === 0" class="checkpoints-empty">
              <flag-outlined style="font-size:36px;color:#d9d9d9;margin-bottom:10px" />
              <p style="color:#999;margin:0">暂无检查点，可选择上方模板或手动添加</p>
              <p style="color:#bbb;font-size:12px;margin-top:4px">（检查点为可选项，不设置则按最终交付物验收）</p>
            </div>

            <div v-for="(cp, idx) in checkpoints" :key="idx" class="checkpoint-card">
              <div class="cp-card-left">
                <div class="cp-dot" :style="{ background: cpColor(cp.progress) }">
                  <span class="cp-dot-num">{{ idx + 1 }}</span>
                </div>
              </div>
              <div class="cp-card-body">
                <div class="cp-card-header">
                  <div class="cp-name-row">
                    <a-input
                      v-model:value="cp.name"
                      placeholder="检查点名称，如：完成数据收集"
                      :maxlength="50"
                      size="large"
                      class="cp-name-input"
                    />
                    <div class="cp-progress-badge" :style="{ background: cpColorLight(cp.progress), color: cpColor(cp.progress) }">
                      {{ cp.progress }}%
                    </div>
                  </div>
                </div>

                <div class="cp-card-fields">
                  <div class="cp-field">
                    <label>进度占比</label>
                    <div class="cp-progress-row">
                      <a-slider
                        v-model:value="cp.progress"
                        :min="5" :max="95" :step="5"
                        :marks="progressMarks"
                        class="cp-slider"
                        :tooltip-formatter="(v: number) => v + '%'"
                      />
                      <a-input-number
                        v-model:value="cp.progress"
                        :min="5" :max="95" :step="5"
                        :formatter="(v: any) => v + '%'"
                        :parser="(v: any) => parseInt(v)"
                        style="width:72px;flex-shrink:0"
                      />
                    </div>
                  </div>

                  <div class="cp-field">
                    <label>交付物要求</label>
                    <a-textarea
                      v-model:value="cp.deliverableDesc"
                      :rows="2"
                      placeholder="描述零工到达此检查点时需要上传的交付物，如：原始数据文件（Excel/CSV）、处理报告（PDF）..."
                      :maxlength="300"
                    />
                  </div>

                  <div class="cp-field">
                    <label>允许上传格式</label>
                    <a-select
                      v-model:value="cp.allowedFormats"
                      mode="multiple"
                      placeholder="不限格式（留空则不限制）"
                      :options="deliverableFormatOptions"
                      allow-clear
                      :max-tag-count="4"
                    />
                  </div>
                </div>
              </div>
              <div class="cp-card-actions">
                <a-button type="text" size="small" :disabled="idx === 0" @click="moveCheckpoint(idx, -1)">
                  <arrow-up-outlined />
                </a-button>
                <a-button type="text" size="small" :disabled="idx === checkpoints.length - 1" @click="moveCheckpoint(idx, 1)">
                  <arrow-down-outlined />
                </a-button>
                <a-popconfirm title="删除此检查点？" @confirm="removeCheckpoint(idx)">
                  <a-button type="text" danger size="small"><delete-outlined /></a-button>
                </a-popconfirm>
              </div>
            </div>
          </div>

          <!-- 最终交付节点（固定） -->
          <div class="final-delivery-node">
            <div class="fd-dot">
              <trophy-outlined />
            </div>
            <div class="fd-content">
              <div class="fd-title">最终交付 · 100%</div>
              <div class="fd-desc">完成所有检查点后，零工提交最终交付物，验收通过后结算尾款</div>
            </div>
          </div>

          <a-button type="dashed" block @click="addCheckpoint" class="add-cp-btn" size="large">
            <plus-outlined /> 添加检查点
          </a-button>
        </div>

        <!-- ─── Step 4：预算设定 ─── -->
        <div v-show="currentStep === 3" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">💰</div>
            <div>
              <h3 class="step-panel-title">预算设定</h3>
              <p class="step-panel-subtitle">设置任务总预算，系统将自动核算锁定金额</p>
            </div>
          </div>

          <div class="budget-layout">
            <div class="budget-form">
              <a-form layout="vertical">
                <a-form-item label="任务总预算（元）" required>
                  <a-input-number
                    v-model:value="form.totalBudget"
                    :min="1" :step="1000"
                    style="width:100%"
                    size="large"
                    :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
                  />
                  <div v-if="suggestedBudget > 0" class="budget-suggest">
                    💡 按角色配置建议：
                    <a-button type="link" size="small" @click="form.totalBudget = suggestedBudget">
                      使用 ¥{{ suggestedBudget.toLocaleString() }}
                    </a-button>
                  </div>
                </a-form-item>
              </a-form>

              <a-alert v-if="rolesBudgetSum > form.totalBudget && form.totalBudget > 0"
                message="⚠️ 角色预算合计超过总预算，请调整" type="error" show-icon />
              <a-alert v-else-if="form.totalBudget > 0 && rolesBudgetSum > 0 && rolesBudgetSum <= form.totalBudget"
                :message="`✓ 预算匹配，剩余备用金 ¥${(form.totalBudget - rolesBudgetSum).toLocaleString()}`"
                type="success" show-icon />
            </div>

            <div class="budget-breakdown">
              <div class="breakdown-title">费用明细</div>
              <div class="breakdown-item" v-for="(r, i) in form.roles" :key="i">
                <span class="bi-label">
                  <a-tag color="blue" size="small">{{ r.roleName || '角色' }}</a-tag> × {{ r.headcount }}人
                </span>
                <span class="bi-value">¥{{ ((r.budget || 0) * (r.headcount || 1)).toLocaleString() }}</span>
              </div>
              <div v-if="form.roles.length === 0" class="breakdown-empty">暂无角色配置</div>
              <div class="breakdown-divider"></div>
              <div class="breakdown-item">
                <span class="bi-label">角色预算合计</span>
                <span class="bi-value" :class="{ 'over': rolesBudgetSum > form.totalBudget }">
                  ¥{{ rolesBudgetSum.toLocaleString() }}
                </span>
              </div>
              <div class="breakdown-item">
                <span class="bi-label">平台服务费 <a-tag size="small">8%</a-tag></span>
                <span class="bi-value">¥{{ Math.round(form.totalBudget * 0.08).toLocaleString() }}</span>
              </div>
              <div class="breakdown-total">
                <span class="bt-label">发布锁定金额</span>
                <span class="bt-value">¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── Step 5：时间地点 ─── -->
        <div v-show="currentStep === 4" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">📍</div>
            <div>
              <h3 class="step-panel-title">时间 & 地点</h3>
              <p class="step-panel-subtitle">设置任务时间周期和工作地点</p>
            </div>
          </div>

          <a-form layout="vertical" class="panel-form">
            <div class="form-section">
              <div class="form-section-title">任务周期</div>
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="开始日期">
                    <a-date-picker v-model:value="startDate" style="width:100%" placeholder="选择开始日期" size="large" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="结束日期">
                    <a-date-picker v-model:value="endDate" style="width:100%" placeholder="选择结束日期" size="large" :disabled-date="disabledEndDate" />
                  </a-form-item>
                </a-col>
              </a-row>
              <div v-if="startDate && endDate" class="date-duration-badge">
                <clock-circle-outlined /> 工期约 {{ taskDurationDays }} 天
              </div>
            </div>

            <div class="form-section">
              <div class="form-section-title">工作地点</div>
              <a-form-item label="城市">
                <a-cascader v-model:value="addressCascade" :options="regionOptions" placeholder="选择省份 / 城市" size="large" style="width:100%" change-on-select />
              </a-form-item>
              <a-form-item label="详细地址 （选填）">
                <a-input v-model:value="form.addressDetail" placeholder="例如：西湖区文三路XX号XX楼" :maxlength="200" size="large" />
              </a-form-item>
            </div>
          </a-form>
        </div>

        <!-- ─── Step 6：确认发布 ─── -->
        <div v-show="currentStep === 5" class="step-panel">
          <div class="step-panel-header">
            <div class="step-panel-icon">🚀</div>
            <div>
              <h3 class="step-panel-title">确认发布</h3>
              <p class="step-panel-subtitle">请核对任务信息，确认无误后发布</p>
            </div>
          </div>

          <div class="confirm-layout">
            <!-- 左侧信息卡 -->
            <div class="confirm-main">
              <div class="confirm-section">
                <div class="cs-title">📋 基本信息</div>
                <div class="cs-row"><span class="cs-label">任务标题</span><span class="cs-value strong">{{ form.title }}</span></div>
                <div class="cs-row" v-if="form.description"><span class="cs-label">任务描述</span><span class="cs-value desc">{{ form.description }}</span></div>
                <div class="cs-row">
                  <span class="cs-label">工作模式</span>
                  <span class="cs-value">
                    <a-tag :color="form.taskMode === 'task_package' ? 'blue' : 'orange'">
                      {{ form.taskMode === 'task_package' ? '📦 任务包' : '📅 人天制' }}
                    </a-tag>
                  </span>
                </div>
                <div class="cs-row" v-if="form.projectId">
                  <span class="cs-label">关联项目</span>
                  <span class="cs-value">{{ projectOptions.find(p => p.value === form.projectId)?.label || '#' + form.projectId }}</span>
                </div>
              </div>

              <div class="confirm-section">
                <div class="cs-title">👥 角色配置（{{ form.roles.length }} 个角色）</div>
                <div v-for="(r, i) in form.roles" :key="i"
                  class="role-confirm-row">
                  <a-tag color="blue">{{ r.roleName }}</a-tag>
                  × {{ r.headcount }} 人
                  <span class="sep">·</span>
                  ¥{{ (r.budget || 0).toLocaleString() }}/人
                  <span v-if="r.description" class="role-confirm-desc">{{ r.description }}</span>
                </div>
              </div>

              <div class="confirm-section" v-if="checkpoints.length > 0">
                <div class="cs-title">🏁 检查点（{{ checkpoints.length }} 个）</div>
                <div v-for="(cp, i) in checkpoints" :key="i" class="cp-confirm-row">
                  <div class="cpc-dot" :style="{ background: cpColor(cp.progress) }"></div>
                  <span class="cpc-name">{{ cp.name }}</span>
                  <a-tag :color="cpTagColor(cp.progress)" size="small">{{ cp.progress }}%</a-tag>
                  <span v-if="cp.deliverableDesc" class="cpc-deliverable">📎 {{ cp.deliverableDesc.slice(0,40) }}...</span>
                </div>
              </div>

              <div class="confirm-section">
                <div class="cs-title">📍 时间 & 地点</div>
                <div class="cs-row"><span class="cs-label">时间周期</span><span class="cs-value">{{ dateRange || '未指定' }}</span></div>
                <div class="cs-row"><span class="cs-label">工作地点</span><span class="cs-value">{{ fullAddress || '远程/不限' }}</span></div>
              </div>

              <div v-if="attachments.length > 0" class="confirm-section">
                <div class="cs-title">📎 需求附件（{{ attachments.length }} 个）</div>
                <div class="attachment-confirm-list">
                  <span v-for="(a, i) in attachments" :key="i" class="attach-confirm-tag">
                    {{ fileIcon(a.fileType) }} {{ a.fileName }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 右侧费用卡 -->
            <div class="confirm-sidebar">
              <div class="cost-card">
                <div class="cost-card-title">💳 费用确认</div>
                <div class="cost-row"><span>角色预算合计</span><span>¥{{ rolesBudgetSum.toLocaleString() }}</span></div>
                <div class="cost-row"><span>平台服务费 (8%)</span><span>¥{{ Math.round(form.totalBudget * 0.08).toLocaleString() }}</span></div>
                <div class="cost-divider"></div>
                <div class="cost-total-row">
                  <span>锁定金额</span>
                  <span class="cost-total-amount">¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</span>
                </div>
                <a-alert message="发布后将自动锁定账户余额" type="warning" :show-icon="false"
                  style="margin-top:12px;font-size:12px" />
              </div>

              <div class="checklist-card">
                <div class="checklist-title">✅ 发布前检查</div>
                <div class="checklist-item" :class="form.title ? 'pass' : 'fail'">
                  <check-outlined v-if="form.title" /><close-outlined v-else /> 任务标题
                </div>
                <div class="checklist-item" :class="form.roles.length > 0 ? 'pass' : 'fail'">
                  <check-outlined v-if="form.roles.length > 0" /><close-outlined v-else /> 角色配置
                </div>
                <div class="checklist-item" :class="form.totalBudget > 0 ? 'pass' : 'fail'">
                  <check-outlined v-if="form.totalBudget > 0" /><close-outlined v-else /> 预算设置
                </div>
                <div class="checklist-item pass">
                  <check-outlined /> 检查点 {{ checkpoints.length > 0 ? `(${checkpoints.length}个)` : '(跳过)' }}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="step-footer">
      <div class="footer-left">
        <a-button v-if="currentStep > 0" @click="currentStep--" size="large">
          <left-outlined /> 上一步
        </a-button>
      </div>
      <div class="footer-right">
        <a-button v-if="currentStep < steps.length - 1"
          type="primary" @click="nextStep" size="large" class="next-btn">
          下一步 <right-outlined />
        </a-button>
        <template v-if="currentStep === steps.length - 1">
          <a-button @click="handleSaveDraft" :loading="saving" size="large">保存草稿</a-button>
          <a-button type="primary" :loading="publishing" @click="handlePublish" size="large" class="publish-btn">
            🚀 确认发布
          </a-button>
        </template>
      </div>
    </div>

    <!-- AI 任务顾问 Drawer -->
    <a-drawer
      v-model:open="aiDrawerOpen"
      title="🤖 AI 任务顾问"
      placement="right"
      :width="560"
      :body-style="{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }"
    >
      <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;gap:8px;align-items:center;flex-shrink:0">
        <span style="color:#666;font-size:13px;white-space:nowrap">智能体：</span>
        <a-select v-model:value="selectedAgentId" style="width:200px" size="small" :options="agentOptions" @change="onAgentChange" />
        <span style="color:#999;font-size:12px;margin-left:auto">{{ aiRoundCount }}/30轮</span>
      </div>
      <div ref="msgListRef" class="ai-msg-list">
        <div v-if="aiMessages.length === 0" class="ai-welcome">
          <div style="font-size:48px;margin-bottom:12px">🤖</div>
          <div style="font-size:15px;font-weight:600">你好！我是 AI 任务顾问</div>
          <div style="color:#999;font-size:13px;margin-top:8px;line-height:1.6">
            告诉我你想做什么任务，我来帮你规划角色、预算和工期<br/>
            对话结束后可一键将建议填充到表单
          </div>
        </div>
        <div v-for="(msg, i) in aiMessages" :key="i" :class="['ai-msg', msg.role]">
          <div class="ai-msg-bubble">
            <pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:14px;line-height:1.6">{{ msg.content }}</pre>
          </div>
        </div>
        <div v-if="aiLoading" class="ai-msg assistant">
          <div class="ai-msg-bubble"><a-spin size="small" style="margin-right:8px" /> AI 正在思考...</div>
        </div>
      </div>
      <div v-if="aiSuggestion" style="padding:10px 16px;border-top:1px solid #f0f0f0;background:#f6ffed;flex-shrink:0">
        <a-alert type="success" message="AI 已生成任务建议，点击填充到表单" style="margin-bottom:8px" />
        <a-button type="primary" block @click="fillFromAI">⚡ 一键填充到表单</a-button>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #f0f0f0;flex-shrink:0">
        <a-row :gutter="8">
          <a-col :flex="1">
            <a-textarea v-model:value="aiInput" :rows="3"
              placeholder="描述你的任务需求..."
              :disabled="aiLoading || aiRoundCount >= 30"
              @keydown.ctrl.enter="sendAiMessage" :maxlength="2000" />
          </a-col>
          <a-col>
            <a-button type="primary" :loading="aiLoading" :disabled="aiRoundCount >= 30"
              @click="sendAiMessage" style="height:100%;min-height:72px">发送</a-button>
          </a-col>
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
  PlusOutlined, DeleteOutlined, LeftOutlined, RightOutlined,
  CheckCircleOutlined, InboxOutlined, CheckCircleFilled,
  FlagOutlined, SafetyCertificateOutlined, ArrowUpOutlined, ArrowDownOutlined,
  TrophyOutlined, ClockCircleOutlined, TeamOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { taskApi } from '@/api/task'
import request from '@/api/request'

const router = useRouter()
const route = useRoute()
const currentStep = ref(0)
const publishing = ref(false)
const saving = ref(false)
const platformRoles = ref<any[]>([])
const skillTags = ref<any[]>([])
const startDate = ref<any>(null)
const endDate = ref<any>(null)
const addressCascade = ref<string[]>([])
const draftId = ref<number | null>(null)
const lastSavedAt = ref('')
const isEditMode = computed(() => !!draftId.value)

const steps = [
  { title: '基本信息', desc: '标题·描述·模式' },
  { title: '角色配置', desc: '岗位·预算·技能' },
  { title: '检查点', desc: '里程碑·交付物' },
  { title: '预算设定', desc: '总预算·费用核算' },
  { title: '时间地点', desc: '工期·工作地点' },
  { title: '确认发布', desc: '核对信息' },
]

interface RoleItem { roleName: string; headcount: number; budget: number; skillTagsArr: string[]; description: string }

const form = reactive({
  title: '', description: '', taskMode: 'task_package' as 'task_package' | 'daily_rate',
  totalBudget: 0, addressDetail: '', roles: [] as RoleItem[],
  projectId: null as number | null,
})

// ─── 检查点 ───
interface Checkpoint {
  name: string
  progress: number  // 5-95
  deliverableDesc: string
  allowedFormats: string[]
}
const checkpoints = ref<Checkpoint[]>([])

const deliverableFormatOptions = [
  { label: '📄 PDF', value: 'pdf' },
  { label: '📝 Word (docx)', value: 'docx' },
  { label: '📊 Excel (xlsx)', value: 'xlsx' },
  { label: '📑 PPT (pptx)', value: 'pptx' },
  { label: '🖼 图片 (jpg/png)', value: 'image' },
  { label: '🎨 设计源文件 (psd/ai/sketch)', value: 'design' },
  { label: '🎬 视频 (mp4)', value: 'mp4' },
  { label: '🗜 压缩包 (zip/rar)', value: 'zip' },
  { label: '📁 任意格式', value: '*' },
]

const progressMarks: Record<number, string> = { 20: '20%', 40: '40%', 60: '60%', 80: '80%' }

function cpColor(p: number) {
  if (p <= 30) return '#1677ff'
  if (p <= 60) return '#fa8c16'
  return '#52c41a'
}
function cpColorLight(p: number) {
  if (p <= 30) return '#e6f4ff'
  if (p <= 60) return '#fff7e6'
  return '#f6ffed'
}
function cpTagColor(p: number) {
  if (p <= 30) return 'blue'
  if (p <= 60) return 'orange'
  return 'green'
}

function addCheckpoint() {
  const usedProgress = checkpoints.value.map(c => c.progress)
  let progress = 20
  while (usedProgress.includes(progress) && progress < 95) progress += 10
  checkpoints.value.push({ name: '', progress, deliverableDesc: '', allowedFormats: [] })
}

function removeCheckpoint(idx: number) { checkpoints.value.splice(idx, 1) }

function moveCheckpoint(idx: number, dir: -1 | 1) {
  const arr = checkpoints.value
  const target = idx + dir
  if (target < 0 || target >= arr.length) return
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

const cpTemplates: Record<string, Checkpoint[]> = {
  data: [
    { name: '完成数据收集', progress: 20, deliverableDesc: '原始数据文件（Excel/CSV），注明数据来源和字段说明', allowedFormats: ['xlsx', 'zip'] },
    { name: '完成数据清洗', progress: 50, deliverableDesc: '清洗后的结构化数据文件 + 数据清洗报告（PDF）', allowedFormats: ['xlsx', 'pdf'] },
    { name: '完成分析报告', progress: 80, deliverableDesc: '数据分析报告初稿（含可视化图表），PPT或PDF格式', allowedFormats: ['pptx', 'pdf'] },
  ],
  design: [
    { name: '概念方案确认', progress: 25, deliverableDesc: '2-3个设计方向的草图或参考板，确认设计方向', allowedFormats: ['image', 'pdf'] },
    { name: '初稿交付', progress: 60, deliverableDesc: '设计初稿（高保真稿），含主要页面或设计物料', allowedFormats: ['image', 'design', 'pdf'] },
    { name: '修改稿确认', progress: 85, deliverableDesc: '根据反馈修改后的设计定稿，含标注规范', allowedFormats: ['design', 'pdf'] },
  ],
  photo: [
    { name: '拍摄完成', progress: 40, deliverableDesc: '原始RAW文件压缩包，按SKU编号整理归档', allowedFormats: ['zip'] },
    { name: '精修初稿', progress: 75, deliverableDesc: '精修后JPG文件（低分辨率预览），征求修改意见', allowedFormats: ['zip', 'image'] },
  ],
  dev: [
    { name: '需求评审通过', progress: 15, deliverableDesc: '需求分析文档 + 技术方案文档（含架构图）', allowedFormats: ['docx', 'pdf'] },
    { name: '前端/功能完成', progress: 55, deliverableDesc: '功能演示视频 + 代码仓库链接 + 部署说明', allowedFormats: ['mp4', 'zip'] },
    { name: '测试通过', progress: 85, deliverableDesc: '测试报告 + Bug修复清单 + 上线前检查清单', allowedFormats: ['pdf', 'docx'] },
  ],
  copy: [
    { name: '大纲确认', progress: 20, deliverableDesc: '内容大纲 / 脚本框架（Word格式），含关键词规划', allowedFormats: ['docx'] },
    { name: '初稿交付', progress: 60, deliverableDesc: '文案初稿（Word格式），含标题、正文、排版建议', allowedFormats: ['docx'] },
  ],
}

function applyCheckpointTemplate(type: string) {
  if (checkpoints.value.length > 0) {
    Modal.confirm({
      title: '替换现有检查点？',
      content: '当前已有检查点配置，确认用模板替换？',
      onOk: () => { checkpoints.value = cpTemplates[type].map(c => ({ ...c })) },
    })
  } else {
    checkpoints.value = cpTemplates[type].map(c => ({ ...c }))
  }
}

// ─── 附件 ───
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const attachments = ref<Array<{ fileName: string; fileUrl: string; fileSize: number; fileType: string; uploading?: boolean; error?: boolean }>>([])

function triggerFileInput() { fileInputRef.value?.click() }
function fileIcon(type: string) {
  const m: Record<string, string> = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📑', pptx:'📑', zip:'🗜', rar:'🗜', jpg:'🖼', jpeg:'🖼', png:'🖼', psd:'🎨', ai:'🎨', sketch:'🎨' }
  return m[type?.toLowerCase()] || '📁'
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
async function processFiles(files: FileList | File[]) {
  const arr = Array.from(files)
  if (attachments.value.length + arr.length > 10) { message.warning('附件最多10个'); return }
  for (const file of arr) {
    if (file.size > 50 * 1024 * 1024) { message.warning(`${file.name} 超过50MB`); continue }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const entry = { fileName: file.name, fileUrl: '', fileSize: file.size, fileType: ext, uploading: true, error: false }
    attachments.value.push(entry)
    const idx = attachments.value.length - 1
    try {
      attachments.value[idx].fileUrl = URL.createObjectURL(file)
      attachments.value[idx].uploading = false
    } catch {
      attachments.value[idx].uploading = false
      attachments.value[idx].error = true
    }
  }
}
function onFileSelect(e: Event) { const i = e.target as HTMLInputElement; if (i.files) processFiles(i.files); i.value = '' }
function onFileDrop(e: DragEvent) { isDragOver.value = false; if (e.dataTransfer?.files) processFiles(e.dataTransfer.files) }
function removeAttachment(idx: number) { attachments.value.splice(idx, 1) }

// ─── 关联项目 ───
const projectOptions = ref<{ value: number; label: string }[]>([])
let projectsLoaded = false
async function loadProjects() {
  if (projectsLoaded) return
  try {
    const res = await request.get('/projects', { params: { pageSize: 100 } })
    projectOptions.value = (res.data?.list || []).map((p: any) => ({ value: p.id, label: `${p.projectNo} · ${p.name}` }))
    projectsLoaded = true
  } catch {}
}
function filterProjectOption(input: string, option: any) {
  return (option.label as string).toLowerCase().includes(input.toLowerCase())
}

// ─── AI 顾问 ───
const aiDrawerOpen = ref(false)
const hasLlm = ref(false)
const agentOptions = ref<{ value: number; label: string }[]>([])
const selectedAgentId = ref<number | null>(null)
const aiMessages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const aiInput = ref('')
const aiLoading = ref(false)
const aiSuggestion = ref<any>(null)
const aiSessionUuid = ref<string | null>(null)
const aiRoundCount = ref(0)
const msgListRef = ref<HTMLElement | null>(null)

async function checkLlmConfig() {
  try {
    await request.get('/company/llm-config')
    hasLlm.value = true
    const agRes = await request.get('/company/agents')
    const agents = (agRes.data || []).filter((a: any) => a.isActive)
    agentOptions.value = agents.map((a: any) => ({ value: a.id, label: a.name }))
    if (agents.length > 0) selectedAgentId.value = agents[0].id
  } catch { hasLlm.value = false }
}
function onAgentChange() { aiSessionUuid.value = null; aiMessages.value = []; aiRoundCount.value = 0; aiSuggestion.value = null }

async function sendAiMessage() {
  const msg = aiInput.value.trim()
  if (!msg || aiLoading.value) return
  if (aiRoundCount.value >= 30) { message.warning('对话已达30轮上限'); return }
  if (!selectedAgentId.value) { message.warning('请先选择一个智能体'); return }
  aiMessages.value.push({ role: 'user', content: msg })
  aiInput.value = ''
  aiLoading.value = true
  aiRoundCount.value++
  await nextTick()
  msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' })
  try {
    const res = await request.post('/ai/chat', {
      agentId: selectedAgentId.value, message: msg,
      ...(aiSessionUuid.value && { sessionUuid: aiSessionUuid.value }),
      ...(draftId.value && { taskDraftId: draftId.value }),
    })
    const data = (res as any).data || res
    aiSessionUuid.value = data.sessionUuid
    aiMessages.value.push({ role: 'assistant', content: data.response })
    if (data.isComplete) { try { aiSuggestion.value = JSON.parse(data.response) } catch {} }
    if (!aiSuggestion.value) {
      const m = data.response.match(/```json\n?([\s\S]+?)\n?```/)
      if (m) { try { const p = JSON.parse(m[1]); if (p?.title) aiSuggestion.value = p } catch {} }
    }
  } catch (e: any) {
    const s = e?.response?.status
    const errMsg = s === 429 ? '调用过于频繁，请稍后重试' : s === 504 ? 'AI响应超时，请重新发送' : 'AI 暂时无法回复'
    aiMessages.value.push({ role: 'assistant', content: `⚠️ ${errMsg}` })
  } finally {
    aiLoading.value = false
    await nextTick()
    msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' })
  }
}

function fillFromAI() {
  if (!aiSuggestion.value) return
  const s = aiSuggestion.value
  const hasExisting = !!(form.title || form.description)
  const doFill = () => {
    if (s.title) form.title = s.title
    if (s.description) form.description = s.description
    if (s.taskMode && ['task_package', 'daily_rate'].includes(s.taskMode)) form.taskMode = s.taskMode
    if (s.startDate) startDate.value = dayjs(s.startDate)
    if (s.endDate) endDate.value = dayjs(s.endDate)
    if (Array.isArray(s.suggestedRoles) && s.suggestedRoles.length > 0) {
      form.roles = s.suggestedRoles.map((r: any) => ({
        roleName: r.roleName || '', headcount: r.headcount || 1, budget: r.budget || 0,
        skillTagsArr: r.skillTags ? r.skillTags.split(',').map((x: string) => x.trim()) : [],
        description: '',
      }))
    }
    aiDrawerOpen.value = false
    message.success('AI建议已填充到表单')
  }
  if (hasExisting) {
    Modal.confirm({ title: '覆盖已有内容？', content: '确认用AI建议覆盖当前表单？', onOk: doFill })
  } else { doFill() }
}

// ─── 计算属性 ───
const rolesBudgetSum = computed(() => form.roles.reduce((s, r) => s + (r.budget || 0) * (r.headcount || 1), 0))
const suggestedBudget = computed(() => rolesBudgetSum.value)
const skillTagOptions = computed(() => skillTags.value.map(t => ({ label: `${t.name}${t.hot ? ' 🔥' : ''}`, value: t.name })))
const fullAddress = computed(() => [...(addressCascade.value || []), form.addressDetail].filter(Boolean).join(' '))
const dateRange = computed(() => {
  if (!startDate.value && !endDate.value) return ''
  return `${startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : '?'} 至 ${endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : '?'}`
})
const taskDurationDays = computed(() => {
  if (!startDate.value || !endDate.value) return 0
  return dayjs(endDate.value).diff(dayjs(startDate.value), 'day') + 1
})

function filterOption(input: string, option: any) { return option.value?.toLowerCase().includes(input.toLowerCase()) }
function disabledEndDate(current: any) { return startDate.value ? current && current < dayjs(startDate.value).startOf('day') : false }
function addRole() { form.roles.push({ roleName: '', headcount: 1, budget: 0, skillTagsArr: [], description: '' }) }
function quickAddRole(r: any) {
  form.roles.push({ roleName: r.roleName, headcount: 1, budget: r.suggestedDaily || 800,
    skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' })
}
function onRoleSelect(idx: number, roleName: string) {
  const pr = platformRoles.value.find(r => r.roleName === roleName)
  if (pr) {
    const role = form.roles[idx]
    if (role.budget === 0 && pr.suggestedDaily) role.budget = pr.suggestedDaily
    if (role.skillTagsArr.length === 0 && pr.skillTags) role.skillTagsArr = pr.skillTags.split(',').map((s: string) => s.trim())
  }
}
function removeRole(idx: number) { form.roles.splice(idx, 1) }

function nextStep() {
  if (currentStep.value === 0 && !form.title.trim()) { message.warning('请填写任务标题'); return }
  if (currentStep.value === 1) {
    if (form.roles.length === 0) { message.warning('请至少添加一个角色'); return }
    for (const r of form.roles) {
      if (!r.roleName) { message.warning('请为所有角色选择名称'); return }
      if (r.budget <= 0) { message.warning(`角色「${r.roleName}」预算需大于0`); return }
    }
  }
  if (currentStep.value === 3) {
    if (form.totalBudget <= 0) { message.warning('总预算需大于0'); return }
    if (rolesBudgetSum.value > form.totalBudget) { message.warning('角色预算合计超过总预算'); return }
  }
  if (currentStep.value === 4 && startDate.value && endDate.value && dayjs(endDate.value).isBefore(dayjs(startDate.value))) {
    message.warning('结束日期不能早于开始日期'); return
  }
  currentStep.value++
}

function buildPayload() {
  return {
    title: form.title, description: form.description || undefined, taskMode: form.taskMode,
    totalBudget: form.totalBudget,
    startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
    endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined,
    address: fullAddress.value || undefined,
    ...(form.projectId && { projectId: form.projectId }),
    roles: form.roles.map(r => ({
      roleName: r.roleName, headcount: r.headcount, budget: r.budget,
      skillTags: r.skillTagsArr.length > 0 ? r.skillTagsArr.join(',') : undefined,
      description: r.description || undefined,
    })),
  }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave() { if (autoSaveTimer) clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(doAutoSave, 30000) }
async function doAutoSave() {
  if (!form.title.trim()) return
  try {
    if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else {
      await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0 && form.roles.every(r => r.roleName)) await taskApi.setRoles(draftId.value, buildPayload().roles)
    }
    lastSavedAt.value = `已自动保存 ${dayjs().format('HH:mm:ss')}`
  } catch { /* 静默 */ }
}
watch(() => [form.title, form.description, form.taskMode, form.totalBudget, form.roles.length], scheduleAutoSave, { deep: true })

async function handleSaveDraft() {
  saving.value = true
  try {
    if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else {
      await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(draftId.value, buildPayload().roles)
    }
    message.success('草稿已保存'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || err?.message || '保存失败') }
  finally { saving.value = false }
}

async function handlePublish() {
  publishing.value = true
  try {
    let taskId = draftId.value
    if (!taskId) { const res = await taskApi.create(buildPayload()); taskId = res.taskId }
    else {
      await taskApi.updateDraft(taskId, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(taskId, buildPayload().roles)
    }
    for (const att of attachments.value.filter(a => !a.error && a.fileUrl)) {
      try { await taskApi.addAttachment(taskId, { fileName: att.fileName, fileUrl: att.fileUrl, fileSize: att.fileSize, fileType: att.fileType }) } catch {}
    }
    await taskApi.publish(taskId); message.success('🎉 任务发布成功！'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || err?.message || '发布失败') }
  finally { publishing.value = false }
}

async function loadDraft(id: number) {
  try {
    const task = await taskApi.detail(id)
    form.title = task.title || ''; form.description = task.description || ''; form.taskMode = task.taskMode || 'task_package'; form.totalBudget = task.totalBudget || 0
    if (task.startDate) startDate.value = dayjs(task.startDate)
    if (task.endDate) endDate.value = dayjs(task.endDate)
    if (task.address) form.addressDetail = task.address
    if (task.projectId) form.projectId = task.projectId
    if (task.roles?.length > 0) {
      form.roles = task.roles.map((r: any) => ({
        roleName: r.roleName, headcount: r.headcount, budget: r.budget,
        skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' }))
    }
    draftId.value = id
  } catch { message.error('加载草稿失败'); router.push('/task/square') }
}

const regionOptions = [
  { value: '北京', label: '北京', children: [{ value: '北京市', label: '北京市' }] },
  { value: '上海', label: '上海', children: [{ value: '上海市', label: '上海市' }] },
  { value: '广东', label: '广东', children: [{ value: '广州市', label: '广州市' }, { value: '深圳市', label: '深圳市' }, { value: '东莞市', label: '东莞市' }, { value: '佛山市', label: '佛山市' }] },
  { value: '浙江', label: '浙江', children: [{ value: '杭州市', label: '杭州市' }, { value: '宁波市', label: '宁波市' }, { value: '温州市', label: '温州市' }] },
  { value: '江苏', label: '江苏', children: [{ value: '南京市', label: '南京市' }, { value: '苏州市', label: '苏州市' }] },
  { value: '四川', label: '四川', children: [{ value: '成都市', label: '成都市' }] },
  { value: '湖北', label: '湖北', children: [{ value: '武汉市', label: '武汉市' }] },
  { value: '湖南', label: '湖南', children: [{ value: '长沙市', label: '长沙市' }] },
  { value: '福建', label: '福建', children: [{ value: '福州市', label: '福州市' }, { value: '厦门市', label: '厦门市' }] },
  { value: '天津', label: '天津', children: [{ value: '天津市', label: '天津市' }] },
  { value: '重庆', label: '重庆', children: [{ value: '重庆市', label: '重庆市' }] },
  { value: '河南', label: '河南', children: [{ value: '郑州市', label: '郑州市' }] },
  { value: '陕西', label: '陕西', children: [{ value: '西安市', label: '西安市' }] },
  { value: '山东', label: '山东', children: [{ value: '济南市', label: '济南市' }, { value: '青岛市', label: '青岛市' }] },
  { value: '远程', label: '🌐 远程/不限地区', children: [{ value: '远程办公', label: '远程办公' }] },
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
/* ── 整体布局 ── */
.task-create-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 80px;
}

/* ── 顶部 Header ── */
.page-header {
  background: #fff;
  border-bottom: 1px solid #e8eaed;
  padding: 0 32px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.page-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.back-btn {
  color: #666;
  padding: 4px 8px;
}
.page-header-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}
.page-header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.auto-save-hint {
  font-size: 12px;
  color: #52c41a;
}
.ai-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  height: 36px;
  padding: 0 16px;
}
.ai-btn:hover { opacity: .9; color: #fff; }
.ai-btn-icon { margin-right: 4px; }

/* ── 主体双栏布局 ── */
.page-body {
  display: flex;
  gap: 24px;
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── 左侧步骤导航 ── */
.step-nav {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 88px;
  align-self: flex-start;
}
.step-nav-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 10px;
  margin-bottom: 4px;
  cursor: default;
  transition: background .2s;
  position: relative;
}
.step-nav-item::before {
  content: '';
  position: absolute;
  left: 26px;
  top: 48px;
  width: 2px;
  height: calc(100% - 24px + 4px);
  background: #e8eaed;
}
.step-nav-item:last-child::before { display: none; }
.step-nav-item.done::before { background: #1677ff; }
.step-nav-item.clickable { cursor: pointer; }
.step-nav-item.clickable:hover { background: #f0f4ff; }
.step-nav-item.active { background: #eff5ff; }
.step-nav-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e8eaed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #999;
  flex-shrink: 0;
  z-index: 1;
}
.step-nav-item.active .step-nav-icon {
  background: #1677ff;
  color: #fff;
  box-shadow: 0 2px 8px rgba(22,119,255,.35);
}
.step-nav-item.done .step-nav-icon {
  background: #52c41a;
  color: #fff;
}
.step-nav-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.3;
}
.step-nav-item.active .step-nav-title { color: #1677ff; }
.step-nav-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

/* ── 右侧步骤内容 ── */
.step-content { flex: 1; min-width: 0; }
.step-panel {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
  border: 1px solid #eef0f5;
}
.step-panel-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}
.step-panel-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #eff5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.step-panel-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}
.step-panel-subtitle {
  margin: 0;
  color: #8c8c8c;
  font-size: 14px;
}

/* ── 表单分区 ── */
.panel-form { max-width: 680px; }
.form-section {
  margin-bottom: 28px;
  padding: 20px 0 4px;
  border-top: 1px solid #f5f5f5;
}
.form-section:first-child { border-top: none; padding-top: 0; }
.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #595959;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.optional-label {
  font-size: 12px;
  font-weight: 400;
  color: #bbb;
}
.title-input :deep(.ant-input) {
  font-size: 16px;
  font-weight: 500;
}

/* ── 工作模式卡片 ── */
.task-mode-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.mode-card {
  border: 2px solid #e8eaed;
  border-radius: 12px;
  padding: 18px 16px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: all .2s;
  position: relative;
}
.mode-card:hover { border-color: #91b4ff; background: #fafcff; }
.mode-card.selected {
  border-color: #1677ff;
  background: #eff5ff;
  box-shadow: 0 0 0 3px rgba(22,119,255,.08);
}
.mode-card-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
.mode-card-name { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
.mode-card-desc { font-size: 13px; color: #8c8c8c; margin-bottom: 8px; }
.mode-card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.mode-check {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 18px;
  color: #1677ff;
}

/* ── 附件上传 ── */
.attachment-upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all .2s;
  background: #fafafa;
  cursor: pointer;
  min-height: 100px;
}
.attachment-upload-area.drag-over {
  border-color: #1677ff;
  background: #f0f7ff;
}
.attachment-upload-area:hover { border-color: #91b4ff; }
.upload-empty { padding: 8px 0; }
.upload-icon { font-size: 36px; color: #bbb; display: block; margin-bottom: 10px; }
.upload-text { margin: 0 0 6px; font-size: 14px; color: #595959; }
.upload-hint-text { margin: 0; font-size: 12px; color: #bbb; }
.attachment-list { text-align: left; }
.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}
.file-icon { font-size: 18px; flex-shrink: 0; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.file-size { color: #bbb; font-size: 12px; flex-shrink: 0; }
.del-btn { flex-shrink: 0; }
.attachment-add-more { margin-top: 10px; }

/* ── 角色配置 ── */
.quick-roles-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
}
.quick-label { font-size: 13px; color: #8c8c8c; white-space: nowrap; }
.role-chip {
  border-radius: 16px;
  font-size: 12px;
  height: 26px;
  padding: 0 12px;
  border-color: #d9d9d9;
}
.roles-empty {
  text-align: center;
  padding: 48px 0;
}
.role-card {
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 20px 20px 8px;
  margin-bottom: 12px;
  background: #fafcff;
  transition: box-shadow .2s;
}
.role-card:hover { box-shadow: 0 2px 10px rgba(22,119,255,.08); }
.role-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.role-card-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}
.role-badge-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.role-badge-text { font-size: 14px; font-weight: 600; color: #1a1a2e; }
.add-role-btn {
  height: 52px;
  border-radius: 12px;
  font-size: 15px;
  margin-top: 8px;
  border-style: dashed;
}

/* ── 检查点 ── */
.checkpoint-intro {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.cp-intro-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
}
.cp-intro-icon {
  font-size: 20px;
  color: #1677ff;
  flex-shrink: 0;
  margin-top: 2px;
}
.cp-intro-title { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
.cp-intro-desc { font-size: 12px; color: #8c8c8c; line-height: 1.5; }
.cp-templates {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 12px 14px;
  background: #fffbe6;
  border-radius: 8px;
  border: 1px solid #ffe58f;
}
.cp-tpl-label { font-size: 13px; color: #ad6800; font-weight: 500; white-space: nowrap; }

.checkpoint-list { position: relative; padding-left: 0; }
.checkpoints-empty {
  text-align: center;
  padding: 40px;
  border: 2px dashed #e8eaed;
  border-radius: 12px;
  margin-bottom: 16px;
}
.checkpoint-card {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  position: relative;
}
.cp-card-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px;
  margin-right: 16px;
  position: relative;
}
.cp-card-left::after {
  content: '';
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: calc(100% - 16px);
  background: linear-gradient(to bottom, #e8eaed 0%, transparent 100%);
}
.checkpoint-card:last-child .cp-card-left::after { display: none; }
.cp-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
  box-shadow: 0 2px 6px rgba(0,0,0,.12);
}
.cp-dot-num { color: #fff; font-size: 13px; font-weight: 700; }
.cp-card-body {
  flex: 1;
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 16px;
  transition: box-shadow .2s;
  overflow: hidden;
}
.cp-card-body:hover { box-shadow: 0 2px 10px rgba(0,0,0,.08); }
.cp-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.cp-name-input { font-size: 15px; font-weight: 600; }
.cp-progress-badge {
  flex-shrink: 0;
  padding: 3px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
}
.cp-card-fields { display: flex; flex-direction: column; gap: 12px; }
.cp-field label {
  display: block;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 6px;
  font-weight: 500;
}
.cp-progress-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.cp-slider { flex: 1; }
.cp-card-actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  padding-top: 12px;
  padding-left: 8px;
}

.final-delivery-node {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #f6ffed, #e6f7e6);
  border: 1px solid #b7eb8f;
  border-radius: 12px;
  margin: 16px 0 12px 52px;
}
.fd-dot {
  width: 36px;
  height: 36px;  border-radius: 50%;
  background: #52c41a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.fd-title { font-size: 15px; font-weight: 700; color: #389e0d; margin-bottom: 3px; }
.fd-desc { font-size: 12px; color: #52c41a; }
.add-cp-btn {
  height: 52px;
  border-radius: 12px;
  border-style: dashed;
  font-size: 15px;
  margin-top: 12px;
  margin-left: 52px;
}

/* ── 预算 ── */
.budget-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: flex-start; }
.budget-form { max-width: 100%; }
.budget-suggest { font-size: 13px; color: #8c8c8c; margin-top: 6px; }
.budget-breakdown {
  background: #fafafa;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 20px;
}
.breakdown-title { font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 14px; }
.breakdown-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 13px; }
.bi-label { color: #595959; display: flex; align-items: center; gap: 6px; }
.bi-value { font-weight: 500; color: #1a1a2e; }
.bi-value.over { color: #ff4d4f; font-weight: 700; }
.breakdown-empty { color: #bbb; font-size: 13px; padding: 8px 0; text-align: center; }
.breakdown-divider { border-top: 1px solid #e8eaed; margin: 10px 0; }
.breakdown-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 2px;
  border-top: 2px solid #1677ff;
  margin-top: 8px;
}
.bt-label { font-size: 14px; font-weight: 700; color: #1a1a2e; }
.bt-value { font-size: 20px; font-weight: 800; color: #1677ff; }

/* ── 时间地点 ── */
.date-duration-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e6f7ff;
  color: #1677ff;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid #91caff;
  margin-top: -8px;
  margin-bottom: 16px;
}

/* ── 确认发布 ── */
.confirm-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: flex-start; }
.confirm-main { display: flex; flex-direction: column; gap: 16px; }
.confirm-section {
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
}
.cs-title {
  font-size: 13px;
  font-weight: 700;
  color: #595959;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.cs-row { display: flex; gap: 12px; padding: 5px 0; font-size: 13px; align-items: flex-start; }
.cs-label { color: #8c8c8c; flex-shrink: 0; width: 72px; }
.cs-value { color: #1a1a2e; flex: 1; }
.cs-value.strong { font-weight: 700; font-size: 15px; color: #1a1a2e; }
.cs-value.desc { white-space: pre-wrap; line-height: 1.6; color: #595959; }
.role-confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed #f0f0f0;
}
.role-confirm-row:last-child { border-bottom: none; }
.role-confirm-desc { color: #8c8c8c; }
.sep { color: #d9d9d9; }
.cp-confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}
.cpc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cpc-name { font-weight: 500; color: #1a1a2e; }
.cpc-deliverable { color: #8c8c8c; font-size: 12px; }
.attachment-confirm-list { display: flex; flex-wrap: wrap; gap: 8px; }
.attach-confirm-tag { font-size: 12px; background: #f5f5f5; padding: 3px 10px; border-radius: 4px; color: #595959; }

/* 右侧边栏 */
.confirm-sidebar { display: flex; flex-direction: column; gap: 12px; }
.cost-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 18px;
}
.cost-card-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; color: #1a1a2e; }
.cost-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; color: #595959; }
.cost-divider { border-top: 1px solid #f0f0f0; margin: 10px 0; }
.cost-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
}
.cost-total-amount { font-size: 22px; font-weight: 800; color: #ff7b00; }
.checklist-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 16px;
}
.checklist-title { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 0;
}
.checklist-item.pass { color: #52c41a; }
.checklist-item.fail { color: #ff4d4f; }

/* ── 底部操作栏 ── */
.step-footer {
  position: fixed;
  bottom: 0;
  left: 220px;
  right: 0;
  height: 68px;
  background: #fff;
  border-top: 1px solid #e8eaed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  z-index: 20;
  box-shadow: 0 -2px 12px rgba(0,0,0,.06);
}
.footer-left { display: flex; gap: 12px; }
.footer-right { display: flex; gap: 12px; }
.next-btn { min-width: 120px; height: 44px; font-size: 15px; border-radius: 10px; }
.publish-btn {
  min-width: 140px;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  border: none;
  box-shadow: 0 3px 12px rgba(22,119,255,.35);
}
.publish-btn:hover { opacity: .92; }

/* ── AI 顾问 ── */
.ai-msg-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.ai-welcome { text-align: center; padding: 48px 24px; color: #666; }
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-msg.assistant { justify-content: flex-start; }
.ai-msg-bubble { max-width: 82%; padding: 10px 14px; border-radius: 12px; }
.ai-msg.user .ai-msg-bubble { background: #1677ff; color: #fff; border-radius: 12px 12px 2px 12px; }
.ai-msg.assistant .ai-msg-bubble { background: #f5f5f5; color: #333; border-radius: 12px 12px 12px 2px; }
</style>
