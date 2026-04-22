-- ============================================================
-- V3.7 — Phase 1 / Step 1.1 补强：新增筛选用索引
-- ============================================================
-- 需求来源: PRD V3.7 §7.2 "扩展现有接口"
--   · GET /api/v1/tasks 新增 priority / risk_level 筛选
--   · GET /api/v1/projects 新增 phase / risk_level 筛选
--   · Cron 需要按 expected_delivery_date 扫描项目预警
-- ============================================================

-- tasks 表新增 2 个索引
CREATE INDEX `tasks_company_id_priority_idx` ON `tasks`(`company_id`, `priority`);
CREATE INDEX `tasks_company_id_risk_level_idx` ON `tasks`(`company_id`, `risk_level`);

-- projects 表新增 3 个索引
CREATE INDEX `projects_company_id_phase_idx` ON `projects`(`company_id`, `phase`);
CREATE INDEX `projects_company_id_risk_level_idx` ON `projects`(`company_id`, `risk_level`);
CREATE INDEX `projects_expected_delivery_date_idx` ON `projects`(`expected_delivery_date`);
