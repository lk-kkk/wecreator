# Material Design 3 迁移说明

## 概述

企业端 PC Admin 已从 Apple Design 风格迁移至 **Material Design 3 (Material You)** 设计系统。

## 主要变更

### 1. 设计系统

- **色彩系统**: 采用 M3 色彩角色系统
  - Primary: `#1B6EF3` (蓝色)
  - Secondary: `#565E71` (灰蓝)
  - Tertiary: `#705575` (紫色)
  - Error: `#BA1A1A` (红色)
  - Surface 层级: 5级表面色调

- **圆角规范**: M3 Shape Scale
  - Extra Small: 4px
  - Small: 8px
  - Medium: 12px
  - Large: 16px
  - Extra Large: 28px
  - Full: 9999px (pill shape)

- **高程系统**: M3 Elevation (0-5级)
  - 使用阴影 + surface tint 组合
  - 更柔和的阴影效果

- **动效**: M3 Motion
  - Standard easing: `cubic-bezier(0.2, 0, 0, 1)`
  - Emphasized easing: 加速/减速曲线
  - 时长: 50ms - 500ms

### 2. 组件变更

#### 按钮
- **Filled Button** (Primary): 实心主色按钮
- **Outlined Button** (Default): 线框按钮
- **Text Button**: 纯文字按钮
- **Tonal Button**: 次要色容器按钮
- **Elevated Button**: 带阴影的浮起按钮
- 所有按钮采用 pill shape (全圆角)

#### 卡片
- **Elevated Card**: 默认带阴影
- **Filled Card**: 实心背景无阴影
- **Outlined Card**: 线框无阴影

#### 输入框
- 采用 M3 Filled TextField 风格
- 背景色: Surface Container Highest
- 边框: Outline color
- Focus 时边框加粗至 2px

#### 导航
- **Navigation Rail**: 侧边栏导航
- 选中项使用 Secondary Container 背景
- 菜单项采用 pill shape

#### 其他
- **State Layers**: 所有交互元素支持 hover/focus/pressed 状态层
- **Ripple Effect**: 点击涟漪效果（简化版）
- **FAB**: 浮动操作按钮（可选）

### 3. 文件结构

```
src/styles/
├── theme-material.css          # M3 色彩系统 + tokens
├── material-components.css     # M3 组件样式
└── material-overrides.css      # 全局覆盖 + utility classes
```

### 4. 字体

- **主字体**: Roboto (M3 标准字体)
- **等宽字体**: Roboto Mono
- 回退至系统字体: PingFang SC / Microsoft YaHei

### 5. 兼容性

保留了旧变量映射以确保现有代码兼容:
- `--color-primary` → `--md-sys-color-primary`
- `--radius-md` → `--md-sys-shape-medium`
- `--shadow-sm` → `--md-sys-elevation-1`

### 6. 移除的特性

- ❌ 毛玻璃效果 (vibrancy/backdrop-filter)
- ❌ Apple 风格渐变按钮
- ❌ 暗色主题 (暂时移除，可后续添加)

## 使用指南

### Utility Classes

```html
<!-- Surface 色彩 -->
<div class="md-surface">Surface</div>
<div class="md-primary">Primary</div>
<div class="md-secondary">Secondary</div>

<!-- Elevation -->
<div class="md-elevation-1">Elevation 1</div>
<div class="md-elevation-3">Elevation 3</div>

<!-- 按钮变体 -->
<a-button type="primary">Filled</a-button>
<a-button>Outlined</a-button>
<a-button type="text">Text</a-button>
<a-button class="md-tonal">Tonal</a-button>
<a-button class="md-elevated">Elevated</a-button>

<!-- 卡片变体 -->
<a-card>Elevated Card</a-card>
<a-card class="md-filled">Filled Card</a-card>
<a-card class="md-outlined">Outlined Card</a-card>

<!-- FAB -->
<a-button class="md-fab">
  <PlusOutlined />
</a-button>
<a-button class="md-fab md-fab-extended">
  <PlusOutlined /> Add
</a-button>
```

### CSS Variables

```css
/* 色彩 */
var(--md-sys-color-primary)
var(--md-sys-color-on-primary)
var(--md-sys-color-surface)
var(--md-sys-color-on-surface)

/* 圆角 */
var(--md-sys-shape-small)
var(--md-sys-shape-medium)
var(--md-sys-shape-large)

/* 高程 */
var(--md-sys-elevation-1)
var(--md-sys-elevation-2)

/* 动效 */
var(--md-sys-motion-duration-short2)
var(--md-sys-motion-easing-standard)
```

## 参考资源

- [Material Design 3 官方文档](https://m3.material.io/)
- [M3 色彩系统](https://m3.material.io/styles/color/system/overview)
- [M3 组件规范](https://m3.material.io/components)
- [M3 动效指南](https://m3.material.io/styles/motion/overview)

## 迁移检查清单

- [x] 色彩系统迁移
- [x] 圆角规范更新
- [x] 高程系统实现
- [x] 按钮组件适配
- [x] 卡片组件适配
- [x] 输入框组件适配
- [x] 导航组件适配
- [x] 表格组件适配
- [x] 模态框组件适配
- [x] 下拉菜单组件适配
- [x] 标签组件适配
- [x] 构建验证通过
- [ ] 视觉回归测试
- [ ] 响应式适配验证
- [ ] 无障碍测试

## 后续计划

1. **暗色主题**: 实现 M3 暗色主题
2. **动态色彩**: 支持用户自定义主题色
3. **完整 Ripple**: 实现完整的涟漪效果
4. **组件库扩展**: 添加更多 M3 原生组件
5. **动效优化**: 完善过渡动画

---

**迁移日期**: 2026-05-06  
**版本**: v2.0.0-material
