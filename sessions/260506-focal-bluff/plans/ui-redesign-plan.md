# WeCreator UI 亮色简约主题改造方案

## 📋 改造目标

将企业端(`pc-admin`)和运营端(`platform-admin`)统一改造为**现代简约亮色主题**，并移除一键换肤功能。

---

## 🎨 设计规范（参照 uipic.png）

### 核心特征

- **主题**：纯白亮色，现代简约
- **侧边栏**：白色（与背景融合，靠细边线分隔）
- **按钮**：蓝色渐变点缀（白底为主 + 渐变主按钮）
- **登录页**：同样亮色
- **整体**：扁平 + 轻柔阴影 + 大圆角

### 配色方案

```css
/* ===== 背景色系 ===== */
--bg-page:        #FFFFFF;    /* 主背景：纯白 */
--bg-container:   #FFFFFF;    /* 容器背景 */
--bg-sidebar:     #FFFFFF;    /* 侧边栏：白色 */
--bg-header:      #FFFFFF;    /* 顶栏：白色 */
--bg-card:        #FFFFFF;    /* 卡片：白色 */
--bg-hover:       #F5F7FA;    /* 悬停态：浅灰蓝 */
--bg-active:      #EEF2F8;    /* 激活态：更浅蓝 */
--bg-subtle:      #FAFBFC;    /* 弱化背景区 */

/* ===== 主色渐变（按钮/高亮） ===== */
--primary-start:  #4E8CFF;    /* 渐变起点：明亮蓝 */
--primary-end:    #2B6BE5;    /* 渐变终点：深蓝 */
--primary-solid:  #3D7EFF;    /* 纯色替代 */
--primary-hover:  #2B6BE5;    /* 悬停 */
--primary-light:  #E8EFFE;    /* 浅色背景 */
--primary-border: #C5D7FD;    /* 浅色边框 */

/* 按钮渐变 */
--gradient-primary: linear-gradient(135deg, #4E8CFF 0%, #2B6BE5 100%);
--gradient-primary-hover: linear-gradient(135deg, #5B97FF 0%, #3578EF 100%);

/* ===== 文字色系 ===== */
--text-primary:   #1D2939;    /* 主文字：深灰黑 */
--text-secondary: #475467;    /* 次文字：中灰 */
--text-tertiary:  #667085;    /* 辅助文字 */
--text-disabled:  #98A2B3;    /* 禁用 */
--text-inverse:   #FFFFFF;    /* 反色（按钮上文字） */

/* ===== 边框 ===== */
--border-color:      #EAECF0; /* 默认边框：浅灰 */
--border-light:      #F2F4F7; /* 更浅 */
--border-strong:     #D0D5DD; /* 较强 */
--border-primary:    #4E8CFF; /* 主色边框（focus） */

/* ===== 功能色 ===== */
--success:    #12B76A;
--success-bg: #ECFDF3;
--warning:    #F79009;
--warning-bg: #FFFAEB;
--error:      #F04438;
--error-bg:   #FEF3F2;
--info:       #4E8CFF;
--info-bg:    #E8EFFE;

/* ===== 阴影（轻柔） ===== */
--shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
--shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04);
--shadow-md: 0 4px 8px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.04);
--shadow-lg: 0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.04);
--shadow-focus: 0 0 0 4px rgba(78, 140, 255, 0.18);

/* ===== 圆角 ===== */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 20px;
```

### 组件规范

**按钮（核心亮点）：**
- 主按钮：`linear-gradient(135deg, #4E8CFF 0%, #2B6BE5 100%)`，白字，轻微阴影
- 次按钮：白底 + `#EAECF0` 边框 + 深灰文字
- 文字按钮：透明 + 蓝色文字
- 高度：`36px`（默认）/ `44px`（大）/ `28px`（小）
- 圆角：`10px`

**卡片：**
- 白色背景
- 边框：`1px solid #EAECF0`
- 圆角：`14px`
- 阴影：`--shadow-xs`（非常轻）
- 内边距：`24px`

**输入框：**
- 白底 + `#EAECF0` 边框
- 聚焦：蓝色边框 + 4px 蓝色光晕
- 圆角：`10px`
- 高度：`36px`

**侧边栏菜单：**
- 白色背景
- 选中项：浅蓝背景 `#EEF2F8` + 蓝色文字 `#2B6BE5`
- 悬停：`#F5F7FA`
- 圆角菜单项：`10px`
- 高度：`40px`

**表格：**
- 表头：`#FAFBFC` 背景 + 中灰文字
- 行分隔：`1px solid #F2F4F7`
- 悬停行：`#FAFBFC`
- 圆角：外层容器 `12px`

---

## 📦 改造清单

### 第一步：移除一键换肤（两端同步）

**企业端 (`apps/pc-admin/`)：**
- ❌ 删除 `src/components/layout/ThemeSwitcher.vue`
- ✏️ 简化 `src/composables/useTheme.ts` → 强制 `'light'`，保留 API 兼容
- ✏️ 简化 `src/App.vue` → 移除 light/dark 两套 tokens，只保留亮色 tokens
- 🔍 移除顶栏中 `<ThemeSwitcher />` 引用（如有）

**运营端 (`apps/platform-admin/`)：**
- ❌ 删除 `src/components/layout/ThemeSwitcher.vue`
- ✏️ 简化 `src/composables/useTheme.ts` → 强制 `'light'`
- ✏️ 简化 `src/App.vue`
- ✏️ 修改 `src/layouts/MainLayout.vue` → 移除 `<ThemeSwitcher />`、移除 `theme="dark"` 属性

---

### 第二步：重写主题配色（两端共用规范）

**1. `src/styles/theme-apple.css`（两端）**
- 清空原有 light/dark 双套定义
- 重写为单一亮色 token 集，采用上述配色

**2. `src/App.vue`（两端）**
- 删除 `lightToken` 和 `darkToken` 区分
- 使用新的 Ant Design token：
  ```ts
  colorPrimary: '#3D7EFF',
  colorBgLayout: '#FFFFFF',
  colorBgContainer: '#FFFFFF',
  borderRadius: 10,
  // ...
  ```
- 移除 `isAuthPage` 强制亮色逻辑（因为全局就是亮色）

**3. 新增 `src/styles/gradient-enhancements.css`（两端）**
- 主按钮渐变覆盖
- 登录页背景渐变增强
- 卡片悬停微交互

---

### 第三步：调整布局组件

**运营端 `MainLayout.vue`：**
- 侧边栏改为 `theme="light"`（原为 `theme="dark"`）
- Logo 区改为蓝色渐变背景 + 白字
- 顶栏白底 + 底部细边线

**企业端 `MainLayout.vue`（如有）：**
- 同样调整为白色侧边栏

**两端登录/注册页：**
- 确保 `.auth-bg` 或登录容器背景为白色或浅色渐变
- 登录按钮使用主色渐变

---

### 第四步：渐变按钮样式

**`dark-theme-enhancements.css` → 重命名为 `ui-enhancements.css`：**

```css
/* ========== 主按钮：蓝色渐变 ========== */
.ant-btn-primary:not(.ant-btn-dangerous):not(:disabled) {
  background: linear-gradient(135deg, #4E8CFF 0%, #2B6BE5 100%) !important;
  border: none !important;
  box-shadow: 0 2px 4px rgba(43, 107, 229, 0.20);
  transition: all 0.2s ease;
}
.ant-btn-primary:not(.ant-btn-dangerous):not(:disabled):hover {
  background: linear-gradient(135deg, #5B97FF 0%, #3578EF 100%) !important;
  box-shadow: 0 4px 12px rgba(43, 107, 229, 0.28);
  transform: translateY(-1px);
}

/* ========== 卡片轻阴影 + 柔和边框 ========== */
.ant-card {
  border: 1px solid #EAECF0 !important;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05) !important;
}

/* ========== 菜单现代化 ========== */
.ant-menu-light .ant-menu-item-selected {
  background: #EEF2F8 !important;
  color: #2B6BE5 !important;
  font-weight: 500;
}
```

---

## 🚀 实施顺序

### 阶段一：清理换肤（约 15 分钟）
1. 删除两端 `ThemeSwitcher.vue`
2. 简化两端 `useTheme.ts`
3. 清理 `MainLayout.vue` 中引用

### 阶段二：重构主题（约 30 分钟）
1. 重写两端 `theme-apple.css`
2. 重写两端 `App.vue` 的 token 定义
3. 新增/替换增强样式文件

### 阶段三：调整布局（约 20 分钟）
1. 运营端侧边栏改亮色
2. Logo 改渐变
3. 验证登录页

### 阶段四：验证（约 10 分钟）
1. 两端应用分别启动
2. 检查登录页、首页、表单页
3. 修复视觉不一致

---

## ✅ 验收标准

- [ ] 两端启动后默认且仅有亮色主题
- [ ] 登录页/注册页白色背景，按钮为蓝色渐变
- [ ] 顶栏无换肤按钮
- [ ] 侧边栏白色背景，选中项浅蓝
- [ ] 主按钮为蓝色渐变 (`#4E8CFF → #2B6BE5`)
- [ ] 卡片白底 + 浅边框 + 轻阴影
- [ ] 输入框白底 + 浅灰边框，聚焦时蓝色光晕
- [ ] 表格表头浅灰背景，行悬停浅灰
- [ ] 所有文字对比度 ≥ 4.5:1
- [ ] localStorage 旧值不会触发暗色模式

---

## 📝 关键注意点

1. **localStorage 清理**：原 `wc_theme` 键可能存有 `'dark'`，新 `useTheme` 会忽略旧值强制返回 `'light'`
2. **Ant Design 组件**：使用 `defaultAlgorithm`，不再需要 `darkAlgorithm`
3. **Auth 页面**：原有 `isAuthPage` 判断强制亮色，现在全局亮色可简化逻辑
4. **渐变兼容**：使用 `linear-gradient` 在所有主流浏览器原生支持，无需前缀
5. **向后兼容**：保留 `useTheme` 导出 API（`mode`, `resolved`, `setMode`），避免调用方报错

---

## 🎯 预期效果

改造后的界面：
- ✨ **纯白简约**：背景与侧边栏同为白色，靠细边线和轻阴影分层
- 💎 **渐变点缀**：主按钮和 Logo 使用蓝色渐变，视觉焦点明确
- 🎨 **统一规范**：企业端和运营端风格一致
- 🖱 **微交互**：按钮悬停微浮起 + 阴影加深
- 📱 **现代感**：大圆角 + 柔和阴影 + 扁平配色
