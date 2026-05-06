-- V3.9: 任务全生命周期增强 (MySQL)

-- 1. TaskStatus 枚举新增 pending_payment
ALTER TABLE `tasks` MODIFY COLUMN `status` ENUM('draft','pending_review','published','in_progress','reviewing','pending_payment','completed','closed','cancelled') NOT NULL DEFAULT 'draft';

-- 2. CompanyNotificationType 枚举新增 acceptance_request
ALTER TABLE `company_notifications` MODIFY COLUMN `type` ENUM('issue_report','risk_alert','milestone_remind','acceptance','checkpoint','comment_mention','daily_missing','status_change','acceptance_request') NOT NULL;
