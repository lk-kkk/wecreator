# P0-09 · 阿里云 OSS 配置指南

> **状态**：代码集成完成 ✅ · 需要运维填写真实 AK/SK
>
> **相关文件**：
> - 后端服务：`apps/backend/src/modules/file/oss.service.ts`
> - 文件控制器：`apps/backend/src/modules/file/file.controller.ts`
> - PC端工具：`apps/pc-admin/src/api/oss.ts`
> - 小程序工具：`apps/worker-mp/src/api/oss.ts`
> - 组件：`apps/pc-admin/src/components/OssUploader.vue`

---

## 一、阿里云控制台操作步骤

### 1. 创建 OSS Bucket

```
控制台 → 对象存储 OSS → Bucket列表 → 创建Bucket

参数：
  Bucket 名称：  wecreator-dev（开发）/ wecreator-prod（生产）
  地域：          华东1（杭州）- oss-cn-hangzhou
  存储类型：      标准存储
  读写权限：      私有（推荐）  [注①]
  版本控制：      暂不开启
```

> ① 私有 Bucket + 预签名 URL 是最安全的方案，所有访问均需签名。

### 2. 创建 RAM 子账号（最小权限）

```
控制台 → 访问控制 RAM → 用户 → 创建用户

名称：wecreator-oss-svc
访问方式：☑ Open API 调用访问（生成 AccessKeyId + AccessKeySecret）

授权策略（自定义）：
```

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:HeadObject"
      ],
      "Resource": [
        "acs:oss:*:*:wecreator-prod/*"
      ]
    }
  ]
}
```

### 3. 配置 Bucket CORS（允许浏览器直传）

```
OSS Bucket → 权限管理 → 跨域设置 → 创建规则

来源：*（开发）/ https://admin.wecreator.com（生产）
允许 Methods：PUT, GET, HEAD
允许 Headers：*
暴露 Headers：ETag, x-oss-request-id
缓存时间（秒）：3600
```

### 4. 配置 CDN 加速（可选，但推荐）

```
控制台 → CDN → 域名管理 → 添加域名

加速域名：cdn.wecreator.com
源站类型：OSS域名
源站地址：wecreator-prod.oss-cn-hangzhou.aliyuncs.com
加速区域：中国大陆

HTTPS配置：
  开启强制跳转 HTTP→HTTPS
  上传证书（Let's Encrypt 或购买）
```

---

## 二、后端 .env 配置

编辑 `apps/backend/.env`：

```env
# 生产环境填写真实值
OSS_BUCKET="wecreator-prod"
OSS_REGION="oss-cn-hangzhou"
OSS_ACCESS_KEY="<RAM子账号 AccessKeyId>"
OSS_SECRET="<RAM子账号 AccessKeySecret>"
OSS_CDN_DOMAIN="cdn.wecreator.com"   # 可选，配置后直传URL使用CDN域名
```

> ⚠️ **安全提醒**：AK/SK 不得提交到 Git！`.env` 已在 `.gitignore` 中。

---

## 三、开发 MOCK 模式

当 `OSS_ACCESS_KEY=test_key` 时，`OssService` 自动进入 MOCK 模式：
- 预签名 URL 返回 `https://oss.mock.wecreator.local/...` 占位符
- 业务逻辑正常运行，前端可存储 key/fileUrl
- 真实文件不会上传，适合开发联调

验证 MOCK 状态：
```
GET /api/v1/common/upload/oss-status
```
响应：
```json
{
  "configured": false,
  "note": "开发 MOCK 模式：预签名 URL 为占位符，实际不可直传"
}
```

---

## 四、文件目录结构

所有文件按类别 + 日期存储：

```
wecreator-prod/
├── avatar/          20260417/  {userId}_{random}.jpg
├── portfolio/       20260417/  {userId}_{random}.pdf
├── deliverable/     20260417/  {userId}_{random}.zip
├── id_card/         20260417/  {userId}_{random}.jpg   （访问需签名）
├── license/         20260417/  {userId}_{random}.pdf   （访问需签名）
├── im_image/        20260417/  {userId}_{random}.jpg
└── im_file/         20260417/  {userId}_{random}.pdf
```

---

## 五、文件类别与限制

| 类别 | 允许格式 | 最大大小 | 用途 |
|------|----------|---------|------|
| `avatar` | jpg/jpeg/png/webp | 5MB | 头像 |
| `portfolio` | jpg/jpeg/png/pdf/mp4 | 50MB | 作品集 |
| `deliverable` | jpg/jpeg/png/pdf/psd/ai/zip/mp4/docx/xlsx/pptx | 200MB | 任务交付物 |
| `id_card` | jpg/jpeg/png | 10MB | 身份证 |
| `license` | jpg/jpeg/png/pdf | 10MB | 营业执照 |
| `im_image` | jpg/jpeg/png/gif/webp | 20MB | IM图片（W8）|
| `im_file` | pdf/docx/xlsx/pptx/zip/txt/mp4/mp3 | 100MB | IM文件（W8）|

---

## 六、前端直传流程

```
前端
  │
  ├── POST /api/v1/common/upload/presign   ← 1. 获取预签名URL
  │     body: { category, originalName, fileSize }
  │     响应: { uploadUrl, fileUrl, cdnUrl, key, headers }
  │
  ├── PUT {uploadUrl}                       ← 2. 直传到OSS（携带headers）
  │     header: { Content-Type: "image/jpeg" }
  │     body: <file binary>
  │
  └── POST /api/v1/...业务接口             ← 3. 提交业务数据（携带 key/fileUrl）
        body: { fileUrl, key, ... }
```

---

## 七、验收标准（P0-09）

- [ ] 阿里云控制台 Bucket 创建成功
- [ ] RAM 子账号 AK/SK 已生成并填入 `.env`
- [ ] CORS 规则配置完成（前端直传不报 CORS 错误）
- [ ] `GET /api/v1/common/upload/oss-status` 返回 `configured: true`
- [ ] 实际上传一张图片，能通过返回的 `fileUrl` 访问
- [ ] CDN 加速域名配置完成（如配置了 `OSS_CDN_DOMAIN`）
