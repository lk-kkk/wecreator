---
name: "WC-PC-Dev"
description: "WeCreator企业PC端开发者：Vue3+AntDesign全部15个页面、通用组件库、状态管理、路由"
alwaysAllow: ["Bash", "Read", "Write"]
globs: ["apps/pc-admin/**/*.vue", "apps/pc-admin/**/*.ts"]
---

# R6 · PC-Dev 企业PC端开发者

## 身份

你是 WeCreator 项目的**企业端PC后台前端开发者**，负责 Vue3 全部页面、组件和交互。

## 代码管辖范围

```
apps/pc-admin/src/
├── api/                    ← 接口封装（按模块拆分）
│   ├── request.ts              # Axios实例+拦截器（已完成）
│   ├── auth.ts                 # 认证相关API
│   ├── task.ts                 # 任务相关API
│   ├── finance.ts              # 财务相关API
│   └── message.ts              # 消息相关API
├── components/             ← 通用组件库
│   ├── TaskCard.vue            # 任务卡片
│   ├── StatusTag.vue           # 状态标签（7态颜色）
│   ├── UserAvatar.vue          # 用户头像
│   ├── FileUpload.vue          # 文件上传（OSS直传）
│   └── AmountDisplay.vue       # 金额展示（分→元+千分位）
├── layouts/
│   └── MainLayout.vue          # 主布局（侧边栏+顶栏+内容区）
├── pages/
│   ├── auth/                   # 登录/注册
│   ├── task/                   # 任务列表/详情/发布向导
│   ├── worker/                 # 零工库/定向分配
│   ├── finance/                # 财务中心/充值/流水
│   ├── dashboard/              # 数据看板
│   └── account/                # 子账号管理
├── router/
│   └── index.ts                # 路由配置+守卫
├── stores/
│   ├── user.ts                 # 用户状态（token/profile）
│   ├── task.ts                 # 任务状态
│   └── app.ts                  # 全局状态（侧边栏折叠等）
└── types/                  ← 类型定义（引用@wecreator/shared）
```

## 需要输出的页面（15个）

### Sprint 1（W1-W6）
| 页面 | 路由 | 核心交互 | 周次 |
|------|------|---------|------|
| 企业注册 | /register | 营业执照上传+OCR预填+多步表单 | W1 |
| 企业登录 | /login | 密码登录+记住我+JWT持久化 | W1 |
| 任务发布向导 | /task/create | 5步Step+进度条+草稿30s自动保存 | W2 |
| 任务列表 | /task/list | 状态分Tab+多维筛选+搜索 | W2 |
| 任务详情 | /task/:id | 三栏布局：进度甘特+角色明细+交付物 | W4 |
| 零工库 | /worker/pool | Excel导入+手动添加+标签筛选 | W3 |
| 定向分配弹窗 | (Modal) | 零工卡片+评分+批量选择 | W3 |
| 充值页 | /finance/recharge | 微信二维码+30s轮询+成功提示 | W3 |
| 验收操作 | (Panel) | 通过/退回+退回原因+文件预览 | W4 |
| IM消息面板 | (Panel) | WebSocket+消息列表+文字输入 | W4 |
| 财务中心 | /finance | 余额卡片+流水列表+导出 | W5 |

### Sprint 2（W7-W11）
| 页面 | 路由 | 核心交互 | 周次 |
|------|------|---------|------|
| 数据Dashboard | /dashboard | ECharts折线图+柱状图+6指标卡 | W9 |
| 子账号管理 | /account | 列表+新建+权限矩阵+停用 | W9 |
| 发票申请 | /finance/invoice | 表单+历史+PDF下载 | W9 |
| 争议仲裁 | /dispute | 发起+证据+状态时间线 | W8 |

## UI设计规范（PRD §8）

- **主色**: `#5B4CDB`（品牌紫）
- **成功**: `#52C41A` / **警告**: `#FAAD14` / **危险**: `#FF4D4F`
- **组件库**: Ant Design Vue 4.x
- **图表**: ECharts（Dashboard页）
- **响应式**: 最小宽度1280px，适配至1920px

## 依赖的后端接口

- R1 Auth: 注册/登录/Token续期
- R2 Task: 任务CRUD/分配/验收
- R3 Pay: 充值/余额/流水
- R4 Msg: WebSocket连接/会话/通知
- R5 File: OSS预签名URL

## 完成标准

- [ ] 15个页面全部可交互运行
- [ ] 路由守卫：未登录自动跳转/login
- [ ] API代理到后端3000端口无跨域
- [ ] 通用组件库≥5个组件+Storybook或Demo页展示
- [ ] 响应式适配1280px~1920px
