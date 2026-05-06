# 设计风格对比：Apple Design vs Material Design 3

## 视觉对比

| 设计元素 | Apple Design (旧) | Material Design 3 (新) |
|---------|------------------|----------------------|
| **主色调** | `#3D7EFF` 蓝色渐变 | `#1B6EF3` 纯色蓝 |
| **背景** | 纯白 `#FFFFFF` | 微带紫调 `#FDFBFF` |
| **圆角** | 中等圆角 (10-14px) | 全圆角按钮 (100px) + 中等卡片 (12px) |
| **阴影** | 轻柔阴影 | M3 Elevation (更明显的层次) |
| **字体** | SF Pro / PingFang SC | Roboto / PingFang SC |
| **按钮** | 渐变填充 + 轻阴影 | 纯色填充 + State Layer |
| **输入框** | 白底 + 细边框 | 灰底 (Filled) + 粗边框 |
| **导航** | 方角菜单项 | 全圆角菜单项 (pill) |
| **特效** | 毛玻璃 (backdrop-filter) | State Layers (hover/focus) |

## 色彩系统对比

### Apple Design
```css
Primary:   #3D7EFF → #2B6BE5 (渐变)
Success:   #12B76A
Warning:   #F79009
Error:     #F04438
Background: #FFFFFF (纯白)
```

### Material Design 3
```css
Primary:           #1B6EF3
Primary Container: #D8E2FF
Secondary:         #565E71
Tertiary:          #705575
Error:             #BA1A1A
Surface:           #FDFBFF (微紫调)
Surface Container: #F0EDF1 (5级层次)
```

## 组件对比

### 按钮

**Apple Design:**
- 主按钮: 蓝色渐变 + 轻阴影
- 次按钮: 白底 + 灰边框
- 圆角: 10px
- 悬停: 渐变加深 + 阴影增强

**Material Design 3:**
- Filled: 纯色填充 + State Layer
- Outlined: 透明底 + 灰边框
- Text: 纯文字
- Tonal: 容器色填充
- 圆角: 100px (pill shape)
- 悬停: State Layer (8% opacity)

### 卡片

**Apple Design:**
- 白底 + 轻阴影
- 圆角: 14px
- 悬停: 阴影加深 + 轻微上移

**Material Design 3:**
- Elevated: 浅灰底 + M3 阴影
- Filled: 深灰底 + 无阴影
- Outlined: 白底 + 边框
- 圆角: 12px
- 悬停: 阴影层级提升

### 输入框

**Apple Design:**
- 白底
- 细边框 (#EAECF0)
- Focus: 蓝边框 + 外发光 (4px)
- 圆角: 10px

**Material Design 3:**
- 灰底 (#E4E1E6)
- 粗边框 (#74777F)
- Focus: 蓝边框加粗至 2px
- 圆角: 4px (更方)

## 交互对比

| 交互状态 | Apple Design | Material Design 3 |
|---------|-------------|------------------|
| **Hover** | 背景色变化 + 阴影 | State Layer (8% opacity) |
| **Focus** | 外发光 (box-shadow) | 边框加粗 + outline |
| **Pressed** | scale(0.97) | State Layer (12% opacity) |
| **Disabled** | opacity: 0.45 | opacity: 0.38 |
| **Ripple** | ❌ 无 | ✅ 涟漪效果 |

## 布局对比

| 布局元素 | Apple Design | Material Design 3 |
|---------|-------------|------------------|
| **Header 高度** | 56px | 64px |
| **Sidebar 宽度** | 220px | 256px |
| **菜单项高度** | 40px | 48px |
| **按钮高度** | 36px / 44px | 40px / 48px |
| **间距单位** | 4px 基准 | 8px 基准 |

## 动效对比

**Apple Design:**
- 快速: 0.15s
- 中等: 0.25s
- 缓慢: 0.35s
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

**Material Design 3:**
- Short: 50ms - 200ms
- Medium: 250ms - 400ms
- Long: 450ms - 500ms
- Standard: cubic-bezier(0.2, 0, 0, 1)
- Emphasized: cubic-bezier(0.05, 0.7, 0.1, 1)

## 优势对比

### Apple Design 优势
- ✅ 简洁优雅
- ✅ 轻柔阴影
- ✅ 毛玻璃效果
- ✅ 渐变按钮更有质感

### Material Design 3 优势
- ✅ 标准化设计系统
- ✅ 更好的层次感 (Surface tones)
- ✅ State Layers 交互反馈
- ✅ 更完善的无障碍支持
- ✅ 更丰富的组件变体
- ✅ 更好的跨平台一致性

## 迁移影响

### 视觉变化
- 🔵 整体色调从纯白变为微紫调
- 🔵 按钮从渐变变为纯色
- 🔵 圆角从中等变为极端 (pill shape)
- 🔵 阴影从轻柔变为明显

### 用户体验
- ✅ 更清晰的层次结构
- ✅ 更明确的交互反馈
- ✅ 更一致的视觉语言
- ⚠️ 需要适应新的视觉风格

### 开发体验
- ✅ 更标准化的设计 tokens
- ✅ 更丰富的 utility classes
- ✅ 更好的文档支持
- ✅ 更容易扩展主题

---

**结论**: Material Design 3 提供了更系统化、标准化的设计语言，虽然失去了 Apple Design 的优雅简约，但获得了更好的可维护性和扩展性。
