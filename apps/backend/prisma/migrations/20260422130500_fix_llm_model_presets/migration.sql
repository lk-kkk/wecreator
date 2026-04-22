-- 补齐 schema 已声明但 DB 缺失的表和字段
-- (V3.6 历史遗漏的迁移)

-- 1. 新表: llm_model_presets
CREATE TABLE IF NOT EXISTS `llm_model_presets` (
  `id`                        BIGINT       NOT NULL AUTO_INCREMENT,
  `company_id`                BIGINT       NOT NULL,
  `display_name`              VARCHAR(60)  NOT NULL,
  `provider`                  ENUM('openai','qwen','deepseek','azure_openai','custom') NOT NULL,
  `api_key_encrypted`         VARCHAR(512) NOT NULL,
  `base_url`                  VARCHAR(500) NULL,
  `model_name`                VARCHAR(100) NOT NULL,
  `temperature`               DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  `max_tokens`                INT          NOT NULL DEFAULT 4096,
  `custom_protocol`           ENUM('http_json','http_sse','ollama','openai_compat') NULL,
  `custom_method`             VARCHAR(10)  NOT NULL DEFAULT 'POST',
  `custom_chat_url`           VARCHAR(500) NULL,
  `custom_auth_type`          ENUM('none','bearer','api_key','basic','custom') NULL,
  `custom_auth_header`        VARCHAR(100) NULL,
  `custom_request_template`   TEXT         NULL,
  `custom_response_path`      VARCHAR(200) NULL,
  `custom_headers`            JSON         NULL,
  `allow_insecure_https`      TINYINT(1)   NOT NULL DEFAULT 0,
  `is_active`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`                DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_preset_company_name` (`company_id`, `display_name`),
  KEY `idx_preset_company_active` (`company_id`, `is_active`),
  CONSTRAINT `fk_preset_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 新列: ai_agents.preset_id
ALTER TABLE `ai_agents`
  ADD COLUMN `preset_id` BIGINT NULL AFTER `is_preset`,
  ADD KEY `idx_agent_preset` (`preset_id`),
  ADD CONSTRAINT `fk_agent_preset` FOREIGN KEY (`preset_id`) REFERENCES `llm_model_presets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
