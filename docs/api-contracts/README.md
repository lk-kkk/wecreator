# API 接口契约目录

> 本目录存放各模块间的接口契约文档，由对应角色在开发时填充。

## 目录结构（开发时逐步添加）

```
api-contracts/
├── auth.md          # R1: 认证模块接口（W1）
├── task.md          # R2: 任务模块接口（W2）
├── finance.md       # R3: 财务模块接口（W3）
├── message.md       # R4: 消息模块接口（W4）
├── file.md          # R5: 文件模块接口（W4）
└── events.md        # 事件总线：跨模块事件定义
```

## 契约规范

每个接口文档包含：
1. **路由**：`POST /api/v1/xxx`
2. **请求体**：TypeScript interface + 示例 JSON
3. **响应体**：TypeScript interface + 示例 JSON
4. **错误码**：业务错误码及含义
5. **认证**：是否需要JWT / 角色要求

## 维护责任

- 后端角色（R1~R5）在开发接口时编写契约
- 前端角色（R6/R7）根据契约进行联调
- R0 Orchestrator 仲裁契约冲突
