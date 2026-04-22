-- V3.7.002 埋点事件表
CREATE TABLE `analytics_events` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `event`      VARCHAR(50) NOT NULL,
  `actor_type` VARCHAR(20) NOT NULL,
  `actor_id`   BIGINT      NULL,
  `company_id` BIGINT      NULL,
  `ref_type`   VARCHAR(20) NULL,
  `ref_id`     BIGINT      NULL,
  `props`      JSON        NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `analytics_events_event_createdAt_idx`              (`event`, `created_at`),
  INDEX `analytics_events_companyId_event_createdAt_idx`    (`company_id`, `event`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
