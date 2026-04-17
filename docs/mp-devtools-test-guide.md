# 微信开发者工具 — WeCreator 零工小程序功能测试指南

## 一、环境准备

### 1.1 启动后端服务

```bash
cd /Users/dukeling/wecreator/apps/backend
pnpm run start:dev
```

确认运行在 `http://localhost:3000`，可以访问：
- API: http://localhost:3000/api/v1 → `{"code":0,"message":"success","data":"Hello World!"}`
- Swagger: http://localhost:3000/api/docs

> **开发环境自动 Mock**：`NODE_ENV=development` 时，微信登录、实名认证均为 mock 模式，不需要真实微信凭证。

### 1.2 确保 Docker 服务运行

```bash
cd /Users/dukeling/wecreator
docker compose up -d   # MySQL + Redis + MongoDB
```

### 1.3 构建小程序

```bash
cd /Users/dukeling/wecreator/apps/worker-mp
pnpm run build:weapp
```

编译产物位于 `dist/weapp/`。

---

## 二、微信开发者工具配置

### 2.1 导入项目

1. 打开 **微信开发者工具**
2. 点击 **「+」导入项目**
3. **项目目录**选择：`/Users/dukeling/wecreator/apps/worker-mp`
   - 工具会自动识别 `project.config.json` 中的 `miniprogramRoot: "dist/weapp/"`
4. **AppID**：保持 `wx_test_appid`（测试号）或替换为你的真实 AppID

### 2.2 必须勾选的设置

在开发者工具右上角 **「详情」→「本地设置」** 中：

| 设置项 | 状态 | 原因 |
|--------|------|------|
| ✅ 不校验合法域名、web-view（业务域名）、TLS | **必须勾选** | 开发环境请求 localhost |
| ✅ 不校验 HTTPS 证书 | **必须勾选** | 开发环境无 SSL |
| ❌ ES6 转 ES5 | 不勾选 | Taro 已编译 |
| ❌ 上传代码时自动压缩 | 不勾选 | Taro 已处理 |
| ❌ 增强编译 | 不勾选 | 可能与 Taro 冲突 |

### 2.3 模拟器设备

推荐选择 **iPhone 12** 或 **iPhone 14 Pro**（375×812）。

---

## 三、功能测试清单

### 3.1 首页 — 登录流程 ⭐

**页面路径**: `pages/index/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 首次打开 | 显示登录页：WeCreator 品牌 + 三个特性图标 + "微信一键登录" 按钮 |
| 2 | 点击"微信一键登录" | 按钮变为"登录中..."，开发者工具模拟 `wx.login` 返回 code |
| 3 | 等待 1-2 秒 | Toast "登录成功"，自动跳转到 `/subpackages/auth/pages/profile-edit/index`（新用户）|
| 4 | 返回首页 | 显示任务列表视图：三个 Tab（待响应/进行中/已完成）+ "暂无任务" |

> **Mock 机制**：后端收到任意 code 都会创建/返回零工用户（`openid = mock_${code}`）

**Console 检查**：
- 无红色错误
- Network 面板可看到 `POST /api/v1/worker/login` 返回 200，body 包含 `accessToken`

---

### 3.2 编辑资料 + 实名认证

**页面路径**: `subpackages/auth/pages/profile-edit/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 登录后自动跳转 | 显示编辑资料表单 |
| 2 | 填写城市、简介 | 输入框正常 |
| 3 | 点击保存 | 调用 `PUT /worker/profile`，Toast 成功 |

**页面路径**: `subpackages/auth/pages/verify/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 输入真实姓名 + 身份证号 | 18 位身份证格式校验 |
| 2 | 提交认证 | 调用 `POST /worker/verify`，开发环境自动 mock 通过 |

---

### 3.3 TabBar 导航

| Tab | 页面 | 要验证的内容 |
|-----|------|-------------|
| **任务** | `pages/index/index` | 登录后显示任务 Tab 切换 |
| **消息** | `pages/message/index` | 显示"暂无会话"空状态 |
| **主页** | `pages/profile/index` | 个人主页：头像/姓名/等级/技能/作品集 |
| **我的** | `pages/my/index` | 显示"我的"页面 |

---

### 3.4 消息页面

**页面路径**: `pages/message/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入消息 Tab | 加载会话列表 `GET /conversations` |
| 2 | 空列表 | 显示"暂无会话" |
| 3 | (有会话时) 点击会话 | 进入聊天界面，加载历史消息 |
| 4 | 发送消息 | WebSocket 发送，乐观更新气泡 |

> **注意**：WebSocket 在开发者工具模拟器中可能行为与真机不同，重点测试 HTTP 请求部分。

---

### 3.5 个人主页 (Tab3)

**页面路径**: `pages/profile/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入主页 Tab | 调用 `GET /worker/profile` |
| 2 | 显示内容 | 头像/姓名/等级徽章/城市/简介/完成任务数/评分/完成率 |
| 3 | 点击"编辑资料" | 跳转到 profile-edit 页 |
| 4 | 点击"作品集" | 跳转到 portfolio 页 |

**页面路径**: `pages/profile/card` （通过导航进入）

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入名片页 | 显示 3 种名片风格（简约/温暖/商务）|
| 2 | 切换风格 | 卡片实时切换渐变背景 |

**页面路径**: `pages/profile/level`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入等级页 | 显示当前等级 + 升级进度 + 各等级说明 |

---

### 3.6 钱包

**页面路径**: `subpackages/wallet/pages/index/index`

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入钱包 | 调用 `GET /worker/wallet` 获取余额 |
| 2 | 查看交易记录 | 调用 `GET /worker/wallet/transactions` |
| 3 | 点击提现 | 跳转到 withdraw 页 |
| 4 | 输入提现金额 | 调用 `POST /worker/wallet/withdraw` |

---

### 3.7 任务子包

通过企业端创建任务并邀请后，以下页面可测：

| 页面 | 路径 | 功能 |
|------|------|------|
| 任务详情 | `subpackages/task/pages/detail/index` | 查看任务描述、预算、角色需求 |
| 任务执行 | `subpackages/task/pages/execute/index` | 上传交付物、进度更新 |
| 签到 | `subpackages/task/pages/checkin/index` | 人天模式每日签到 |
| 工时 | `subpackages/task/pages/workhour/index` | 人天模式工时记录 |
| 评价 | `subpackages/task/pages/review/index` | 任务完成后评价 |
| 争议 | `subpackages/task/pages/dispute/index` | 发起争议/查看争议 |

> 这些页面需要先有任务数据。可通过 Swagger 或 PC 端创建任务 → 邀请零工 → 零工接受。

---

## 四、快速创建测试数据（通过 curl）

### 4.1 企业注册 + 登录

```bash
# 注册企业
curl -X POST http://localhost:3000/api/v1/enterprise/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试企业",
    "creditCode": "91110000MA01XXXXX2",
    "adminName": "张三",
    "adminPhone": "13800138000",
    "password": "Test@123456"
  }'

# 企业登录
curl -X POST http://localhost:3000/api/v1/enterprise/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "password": "Test@123456"}'
# → 保存返回的 accessToken 为 $ENTERPRISE_TOKEN
```

### 4.2 创建任务

```bash
ENTERPRISE_TOKEN="<上一步返回的token>"

# 创建任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ENTERPRISE_TOKEN" \
  -d '{
    "title": "品牌摄影项目",
    "description": "拍摄产品宣传照片",
    "budgetTotal": 5000,
    "deliveryMode": "project",
    "startDate": "2026-04-20",
    "endDate": "2026-05-20"
  }'
# → 保存返回的 taskId

# 给任务添加角色
curl -X POST http://localhost:3000/api/v1/tasks/<taskId>/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ENTERPRISE_TOKEN" \
  -d '{
    "roleName": "摄影师",
    "headcount": 1,
    "budgetPerPerson": 5000,
    "skillTags": "摄影,产品拍摄,后期修图"
  }'

# 发布任务
curl -X POST http://localhost:3000/api/v1/tasks/<taskId>/publish \
  -H "Authorization: Bearer $ENTERPRISE_TOKEN"
```

### 4.3 邀请零工

```bash
# 获取零工列表
curl http://localhost:3000/api/v1/workers \
  -H "Authorization: Bearer $ENTERPRISE_TOKEN"

# 邀请零工（使用小程序登录后创建的 workerId）
curl -X POST http://localhost:3000/api/v1/assignments/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ENTERPRISE_TOKEN" \
  -d '{
    "taskId": <taskId>,
    "roleAssignmentId": <roleAssignmentId>,
    "workerId": <workerId>
  }'
```

---

## 五、调试技巧

### 5.1 Console 面板

- **红色错误**：重点关注 `TypeError`、`Cannot read property`，通常是数据格式问题
- **Network 请求**：确认每个 API 返回 `{"code": 0, ...}`
- **Storage**：在「存储」标签可以查看 `wc_token`、`wc_user` 是否正确存储

### 5.2 常见问题排查

| 症状 | 可能原因 | 解决 |
|------|---------|------|
| 页面空白 | 未勾选"不校验合法域名" | 「详情」→「本地设置」→ 勾选 |
| 登录失败 | 后端未运行 | 确认 `curl http://localhost:3000/api/v1` 可用 |
| 接口 401 | Token 过期/未登录 | 清除模拟器缓存，重新登录 |
| 样式异常 | 缓存问题 | 工具栏 → 「清缓存」→ 「全部清除」→ 重新编译 |
| TabBar 无图标 | 未配置 iconPath | 预期行为，仅显示文字（后续配置图标） |

### 5.3 清除缓存重新测试

1. 菜单栏 → 「工具」→ 「清除缓存」→ 「清除全部」
2. 或点击模拟器上方的 「↻」刷新

### 5.4 查看编译日志

如果修改了源码需要重新编译：

```bash
cd /Users/dukeling/wecreator/apps/worker-mp
pnpm run build:weapp
```

开发者工具会自动检测 `dist/weapp/` 变化并热刷新。

---

## 六、测试验收检查项

| # | 检查项 | 通过标准 |
|---|--------|---------|
| 1 | 小程序启动 | 无空白页，正常显示登录界面 |
| 2 | 微信登录 | 点击登录 → 成功获取 token → 跳转 |
| 3 | TabBar 切换 | 4 个 Tab 全部可点击且正常渲染 |
| 4 | 编辑资料 | 表单输入、保存正常 |
| 5 | 实名认证 | 提交后 mock 通过 |
| 6 | 个人主页 | 头像/信息/技能/统计数据正常显示 |
| 7 | 消息列表 | 空状态正常显示 |
| 8 | 钱包 | 余额和交易记录正常加载 |
| 9 | Console 无致命错误 | 无红色 TypeError/ReferenceError |
| 10 | Network 请求正常 | 所有 API 返回 200，body 中 code=0 |
