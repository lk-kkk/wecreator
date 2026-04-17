# 灰度发布配置

## 灰度阶段

| 阶段 | 比例 | 持续时间 | 回滚条件 |
|------|------|---------|---------|
| 内部测试 | 仅团队 | 24h | 任何 P0 Bug |
| 灰度 10% | 10% 流量 | 24h | 5xx > 0.5% or P95 > 500ms |
| 灰度 50% | 50% 流量 | 24h | 5xx > 0.3% or P95 > 300ms |
| 全量 100% | 100% | — | — |

## Nginx 灰度配置

```nginx
# /etc/nginx/conf.d/canary.conf

upstream backend_stable {
    server 127.0.0.1:3000;
}

upstream backend_canary {
    server 127.0.0.1:3001;
}

# 灰度分流 — 基于 cookie 或百分比
split_clients "${remote_addr}AAA" $backend_pool {
    10%   backend_canary;     # 调整百分比: 10% → 50% → 100%
    *     backend_stable;
}

server {
    listen 80;
    server_name api.wecreator.com;

    location / {
        proxy_pass http://$backend_pool;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Canary-Version $backend_pool;
    }
}
```

## Docker Compose 灰度

```yaml
# docker-compose.canary.yml
services:
  backend-stable:
    image: wecreator/backend:v1.0.0
    ports: ["3000:3000"]
    env_file: .env.production

  backend-canary:
    image: wecreator/backend:v1.1.0-rc1
    ports: ["3001:3000"]
    env_file: .env.production
    environment:
      - CANARY=true
      - SENTRY_ENV=canary
```

## 回滚命令

```bash
# 快速回滚: 切回 stable
docker-compose -f docker-compose.canary.yml stop backend-canary
# 修改 Nginx split_clients 为 0% canary
nginx -s reload
```

## 监控检查清单

每阶段升级前确认:
- [ ] Sentry 错误数 < 上一版本
- [ ] P95 延迟 < 阈值
- [ ] 5xx 率 < 阈值
- [ ] 关键业务链路（注册→发任务→接单→结算）成功率 100%
- [ ] 数据库 CPU/Memory 正常
- [ ] Redis 连接数正常
