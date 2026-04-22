-- 补齐 schema 已声明但 DB 缺失的字段
-- llm_configs.allow_insecure_https (V3.6 历史遗漏的迁移)
ALTER TABLE `llm_configs`
  ADD COLUMN `allow_insecure_https` TINYINT(1) NOT NULL DEFAULT 0 AFTER `custom_stream`;
