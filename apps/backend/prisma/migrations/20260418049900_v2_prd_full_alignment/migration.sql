-- DropIndex
DROP INDEX `login_logs_user_id_user_type_idx` ON `login_logs`;

-- DropIndex
DROP INDEX `notifications_user_id_user_type_is_read_idx` ON `notifications`;

-- AlterTable
ALTER TABLE `company_custom_roles` DROP COLUMN `daily_rate`,
    DROP COLUMN `role_name`,
    DROP COLUMN `skill_tags`,
    ADD COLUMN `category` VARCHAR(30) NULL,
    ADD COLUMN `common_skills` JSON NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `name` VARCHAR(20) NOT NULL DEFAULT '',
    MODIFY `description` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `contracts` ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `contract_no` VARCHAR(32) NULL,
    ADD COLUMN `contract_type` ENUM('task_package', 'daily_rate') NULL,
    ADD COLUMN `status` ENUM('active', 'completed', 'terminated') NOT NULL DEFAULT 'active',
    ADD COLUMN `task_role_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `daily_checkins` ADD COLUMN `checkin_type` ENUM('gps', 'screenshot') NULL,
    ADD COLUMN `screenshots` JSON NULL,
    ADD COLUMN `todo_items` JSON NULL,
    ADD COLUMN `tomorrow_plan` TEXT NULL,
    ADD COLUMN `work_summary` TEXT NULL;

-- AlterTable
ALTER TABLE `deliverables` ADD COLUMN `acceptance_criteria` TEXT NULL,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `current_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deadline` DATE NULL,
    ADD COLUMN `name` VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN `task_role_id` BIGINT NOT NULL DEFAULT 0,
    MODIFY `file_url` VARCHAR(500) NULL,
    MODIFY `file_name` VARCHAR(200) NULL,
    MODIFY `status` ENUM('pending', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    MODIFY `submitted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `email` VARCHAR(100) NULL,
    ADD COLUMN `related_period` VARCHAR(20) NULL,
    ADD COLUMN `tax_no` VARCHAR(20) NULL,
    ADD COLUMN `title` VARCHAR(100) NULL,
    MODIFY `invoice_type` VARCHAR(30) NOT NULL DEFAULT 'electronic_normal',
    MODIFY `status` ENUM('pending', 'processing', 'issued', 'rejected', 'failed') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `login_logs` ADD COLUMN `login_method` ENUM('password', 'sms_code', 'wechat') NOT NULL DEFAULT 'password',
    ADD COLUMN `result` ENUM('success', 'wrong_password', 'account_locked', 'account_disabled') NOT NULL DEFAULT 'success',
    MODIFY `user_agent` TEXT NULL;

-- AlterTable
ALTER TABLE `notifications` DROP COLUMN `related_id`,
    DROP COLUMN `user_id`,
    DROP COLUMN `user_type`,
    ADD COLUMN `channel` ENUM('in_app', 'wechat_subscribe', 'sms') NOT NULL DEFAULT 'in_app',
    ADD COLUMN `recipient_id` BIGINT NOT NULL,
    ADD COLUMN `recipient_type` ENUM('company', 'worker') NOT NULL,
    ADD COLUMN `related_task_id` BIGINT NULL,
    ADD COLUMN `sent_at` DATETIME(3) NULL,
    ADD COLUMN `sent_status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    ADD COLUMN `template_code` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `portfolios` ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `visibility` ENUM('public_visible', 'private_visible') NOT NULL DEFAULT 'public_visible',
    MODIFY `file_type` ENUM('image', 'document') NOT NULL;

-- AlterTable
ALTER TABLE `reviews` DROP COLUMN `target_id`,
    ADD COLUMN `dimension_scores` JSON NULL,
    ADD COLUMN `is_visible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `overall_score` DECIMAL(3, 2) NULL,
    ADD COLUMN `positive_tags` JSON NULL,
    ADD COLUMN `reviewee_id` BIGINT NOT NULL,
    ADD COLUMN `task_role_id` BIGINT NOT NULL,
    MODIFY `rating` INTEGER NULL;

-- AlterTable
ALTER TABLE `role_assignments` ADD COLUMN `contract_hash` VARCHAR(64) NULL,
    ADD COLUMN `reject_reason` VARCHAR(200) NULL,
    ADD COLUMN `responded_at` DATETIME(3) NULL,
    ADD COLUMN `signed_at` DATETIME(3) NULL,
    ADD COLUMN `signed_ip` VARCHAR(45) NULL,
    ADD COLUMN `signed_ua` TEXT NULL;

-- AlterTable
ALTER TABLE `skill_tags` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `usage_count` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `task_roles` ADD COLUMN `billing_type` ENUM('fixed', 'daily') NOT NULL DEFAULT 'fixed',
    ADD COLUMN `bonus_skills` JSON NULL,
    ADD COLUMN `estimated_days` INTEGER NULL,
    ADD COLUMN `level` ENUM('junior', 'mid', 'senior', 'expert') NULL,
    ADD COLUMN `platform_role_id` BIGINT NULL,
    ADD COLUMN `progress` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `rate` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `required_skills` JSON NULL,
    ADD COLUMN `special_requirements` TEXT NULL,
    ADD COLUMN `status` ENUM('pending', 'assigned', 'in_progress', 'reviewing', 'completed') NOT NULL DEFAULT 'pending',
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `acceptance_criteria` TEXT NULL,
    ADD COLUMN `acceptance_status` ENUM('pending', 'partial', 'all_passed') NULL,
    ADD COLUMN `background` TEXT NULL,
    ADD COLUMN `communication` JSON NULL,
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `is_confidential` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `objective` TEXT NULL,
    ADD COLUMN `onsite_address` VARCHAR(100) NULL,
    ADD COLUMN `onsite_city` VARCHAR(20) NULL,
    ADD COLUMN `overall_progress` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `priority` ENUM('p0', 'p1', 'p2') NOT NULL DEFAULT 'p2',
    ADD COLUMN `project_id` BIGINT NULL,
    ADD COLUMN `risk_level` ENUM('green', 'yellow', 'red') NOT NULL DEFAULT 'green',
    ADD COLUMN `task_no` VARCHAR(20) NULL,
    ADD COLUMN `work_mode` ENUM('remote', 'onsite', 'hybrid') NULL;

-- AlterTable
ALTER TABLE `worker_roles` ADD COLUMN `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `completed_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `experience_desc` VARCHAR(300) NULL,
    ADD COLUMN `is_accepting` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `level` ENUM('junior', 'mid', 'senior', 'expert') NULL,
    ADD COLUMN `max_daily_rate` DECIMAL(10, 2) NULL,
    ADD COLUMN `min_daily_rate` DECIMAL(10, 2) NULL,
    ADD COLUMN `platform_role_id` BIGINT NULL,
    MODIFY `skill_tags` JSON NULL;

-- AlterTable
ALTER TABLE `workers` ADD COLUMN `avg_response_hours` DECIMAL(5, 2) NULL,
    ADD COLUMN `id_card_hash` VARCHAR(64) NULL,
    ADD COLUMN `nickname` VARCHAR(50) NULL,
    ADD COLUMN `skill_tags` JSON NULL;

-- CreateTable
CREATE TABLE `deliverable_files` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `deliverable_id` BIGINT NOT NULL,
    `version` INTEGER NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_size` BIGINT NULL,
    `description` VARCHAR(300) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `deliverable_files_deliverable_id_version_idx`(`deliverable_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `progress_updates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `task_role_id` BIGINT NOT NULL,
    `assignment_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `progress_pct` INTEGER NOT NULL,
    `content` TEXT NULL,
    `issues` TEXT NULL,
    `screenshots` JSON NULL,
    `daily_summary` VARCHAR(500) NULL,
    `tomorrow_plan` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `progress_updates_task_role_id_created_at_idx`(`task_role_id`, `created_at` DESC),
    INDEX `progress_updates_task_id_worker_id_idx`(`task_id`, `worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `withdraw_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `worker_id` BIGINT NOT NULL,
    `wallet_id` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
    `failure_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `withdraw_records_worker_id_status_idx`(`worker_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `type` ENUM('issue_report', 'risk_alert', 'milestone_remind', 'acceptance', 'checkpoint', 'comment_mention', 'daily_missing', 'status_change') NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `ref_type` VARCHAR(20) NULL,
    `ref_id` BIGINT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `company_notifications_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at` DESC),
    INDEX `company_notifications_company_id_created_at_idx`(`company_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `project_no` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `client_location` VARCHAR(50) NULL,
    `manager_id` BIGINT NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` ENUM('planning', 'active', 'suspended', 'completed', 'archived') NOT NULL DEFAULT 'planning',
    `phase` ENUM('requirement', 'execution', 'acceptance') NOT NULL DEFAULT 'requirement',
    `expected_delivery_date` DATE NULL,
    `risk_level` ENUM('green', 'yellow', 'red') NOT NULL DEFAULT 'green',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projects_project_no_key`(`project_no`),
    INDEX `projects_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `milestones` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NULL,
    `planned_date` DATE NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `status` ENUM('pending', 'completed', 'overdue') NOT NULL DEFAULT 'pending',
    `sort_order` INTEGER NOT NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `milestones_project_id_sort_order_idx`(`project_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `milestone_attachments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `milestone_id` BIGINT NOT NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `file_type` VARCHAR(20) NOT NULL,
    `uploaded_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `milestone_attachments_milestone_id_idx`(`milestone_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `llm_configs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `provider` ENUM('openai', 'azure_openai', 'claude', 'qwen', 'zhipu', 'deepseek', 'custom') NOT NULL,
    `api_key_encrypted` VARCHAR(512) NOT NULL,
    `base_url` VARCHAR(500) NULL,
    `default_model` VARCHAR(100) NOT NULL,
    `custom_protocol` ENUM('openai_compatible', 'custom_http') NULL,
    `custom_method` VARCHAR(10) NOT NULL DEFAULT 'POST',
    `custom_chat_url` VARCHAR(500) NULL,
    `custom_auth_type` ENUM('bearer', 'header', 'query', 'none') NULL,
    `custom_auth_header` VARCHAR(100) NULL,
    `custom_auth_credential_encrypted` VARCHAR(512) NULL,
    `custom_request_template` TEXT NULL,
    `custom_response_path` VARCHAR(200) NULL,
    `custom_headers` JSON NULL,
    `custom_stream` BOOLEAN NOT NULL DEFAULT false,
    `temperature` DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
    `max_tokens` INTEGER NOT NULL DEFAULT 4096,
    `top_p` DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
    `frequency_penalty` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `monthly_call_count` INTEGER NOT NULL DEFAULT 0,
    `monthly_token_count` BIGINT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `llm_configs_company_id_key`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_agents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `description` VARCHAR(200) NOT NULL,
    `system_prompt` TEXT NOT NULL,
    `model_name` VARCHAR(100) NULL,
    `temperature` DECIMAL(3, 2) NULL,
    `tools` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_preset` BOOLEAN NOT NULL DEFAULT false,
    `created_by` BIGINT NOT NULL,
    `monthly_call_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_agents_company_id_name_key`(`company_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(36) NOT NULL,
    `company_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `agent_id` BIGINT NOT NULL,
    `task_draft_id` BIGINT NULL,
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `total_tokens` BIGINT NOT NULL DEFAULT 0,
    `status` ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_chat_sessions_session_uuid_key`(`session_uuid`),
    INDEX `ai_chat_sessions_company_id_user_id_created_at_idx`(`company_id`, `user_id`, `created_at` DESC),
    INDEX `ai_chat_sessions_agent_id_created_at_idx`(`agent_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_attachments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `file_type` VARCHAR(20) NOT NULL,
    `uploaded_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_attachments_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_checkpoints` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `type` ENUM('progress_check', 'quality_gate') NOT NULL,
    `planned_date` DATE NOT NULL,
    `reviewer_id` BIGINT NOT NULL,
    `description` VARCHAR(200) NULL,
    `status` ENUM('pending', 'submitted', 'passed', 'rejected', 'overdue') NOT NULL DEFAULT 'pending',
    `submit_content` TEXT NULL,
    `submit_attachments` JSON NULL,
    `submitted_at` DATETIME(3) NULL,
    `review_comment` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `revision_count` INTEGER NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_checkpoints_task_id_sort_order_idx`(`task_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_comments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `parent_id` BIGINT NULL,
    `author_type` ENUM('company_user', 'worker') NOT NULL,
    `author_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `attachments` JSON NULL,
    `is_important` BOOLEAN NOT NULL DEFAULT false,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_comments_task_id_created_at_idx`(`task_id`, `created_at` DESC),
    INDEX `task_comments_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_issues` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `reporter_type` ENUM('company_user', 'worker') NOT NULL,
    `reporter_id` BIGINT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `type` ENUM('requirement_unclear', 'technical_block', 'resource_missing', 'other') NOT NULL,
    `description` TEXT NOT NULL,
    `attachments` JSON NULL,
    `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `first_response_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `sla_breached` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_issues_task_id_status_idx`(`task_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `company_custom_roles_company_id_name_key` ON `company_custom_roles`(`company_id`, `name`);

-- CreateIndex
CREATE UNIQUE INDEX `contracts_contract_no_key` ON `contracts`(`contract_no`);

-- CreateIndex
CREATE INDEX `contracts_task_role_id_idx` ON `contracts`(`task_role_id`);

-- CreateIndex
CREATE INDEX `deliverables_task_role_id_idx` ON `deliverables`(`task_role_id`);

-- CreateIndex
CREATE INDEX `login_logs_user_type_user_id_created_at_idx` ON `login_logs`(`user_type`, `user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `notifications_recipient_type_recipient_id_is_read_idx` ON `notifications`(`recipient_type`, `recipient_id`, `is_read`);

-- CreateIndex
CREATE INDEX `reviews_reviewee_id_reviewer_type_idx` ON `reviews`(`reviewee_id`, `reviewer_type`);

-- CreateIndex
CREATE UNIQUE INDEX `tasks_task_no_key` ON `tasks`(`task_no`);

-- CreateIndex
CREATE INDEX `tasks_project_id_idx` ON `tasks`(`project_id`);

-- CreateIndex
CREATE INDEX `workers_level_avg_rating_idx` ON `workers`(`level`, `avg_rating` DESC);

-- AddForeignKey
ALTER TABLE `worker_roles` ADD CONSTRAINT `worker_roles_platform_role_id_fkey` FOREIGN KEY (`platform_role_id`) REFERENCES `platform_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_roles` ADD CONSTRAINT `task_roles_platform_role_id_fkey` FOREIGN KEY (`platform_role_id`) REFERENCES `platform_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_files` ADD CONSTRAINT `deliverable_files_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_updates` ADD CONSTRAINT `progress_updates_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `withdraw_records` ADD CONSTRAINT `withdraw_records_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_notifications` ADD CONSTRAINT `company_notifications_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `milestones` ADD CONSTRAINT `milestones_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `milestone_attachments` ADD CONSTRAINT `milestone_attachments_milestone_id_fkey` FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `llm_configs` ADD CONSTRAINT `llm_configs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_agents` ADD CONSTRAINT `ai_agents_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `ai_agents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attachments` ADD CONSTRAINT `task_attachments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_checkpoints` ADD CONSTRAINT `task_checkpoints_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_issues` ADD CONSTRAINT `task_issues_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

