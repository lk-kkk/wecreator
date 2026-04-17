-- CreateTable
CREATE TABLE `companies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `credit_code` VARCHAR(18) NOT NULL,
    `status` ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'pending',
    `logo_url` VARCHAR(500) NULL,
    `description` VARCHAR(500) NULL,
    `contact_email` VARCHAR(100) NULL,
    `industry_tag` VARCHAR(50) NULL,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `locked_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_credit_code_key`(`credit_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `phone` VARCHAR(200) NOT NULL,
    `password_hash` VARCHAR(128) NOT NULL,
    `role` ENUM('super_admin', 'task_admin', 'finance_admin', 'operator') NOT NULL DEFAULT 'operator',
    `status` ENUM('active', 'disabled', 'deleted') NOT NULL DEFAULT 'active',
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `company_users_company_id_role_idx`(`company_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_custom_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `role_name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NULL,
    `skill_tags` VARCHAR(500) NULL,
    `daily_rate` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `company_custom_roles_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `unionid` VARCHAR(64) NULL,
    `phone` VARCHAR(200) NULL,
    `real_name` VARCHAR(100) NULL,
    `id_card_encrypted` VARCHAR(500) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `city` VARCHAR(50) NULL,
    `bio` VARCHAR(300) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `completion_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `completed_count` INTEGER NOT NULL DEFAULT 0,
    `level` ENUM('unverified', 'verified', 'premium') NOT NULL DEFAULT 'unverified',
    `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workers_openid_key`(`openid`),
    INDEX `workers_city_is_verified_idx`(`city`, `is_verified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worker_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `worker_id` BIGINT NOT NULL,
    `role_name` VARCHAR(50) NOT NULL,
    `years_exp` INTEGER NULL,
    `skill_tags` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `worker_roles_worker_id_idx`(`worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portfolios` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `worker_id` BIGINT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(20) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `portfolios_worker_id_idx`(`worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `created_by` BIGINT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `task_mode` ENUM('task_package', 'daily_rate') NOT NULL,
    `status` ENUM('draft', 'pending_review', 'published', 'in_progress', 'reviewing', 'completed', 'closed', 'cancelled') NOT NULL DEFAULT 'draft',
    `total_budget` DECIMAL(12, 2) NOT NULL,
    `locked_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `address` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tasks_company_id_status_idx`(`company_id`, `status`),
    INDEX `tasks_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `role_name` VARCHAR(50) NOT NULL,
    `headcount` INTEGER NOT NULL DEFAULT 1,
    `budget` DECIMAL(10, 2) NOT NULL,
    `skill_tags` VARCHAR(500) NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_roles_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_assignments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_role_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `slot_index` INTEGER NOT NULL,
    `status` ENUM('invited', 'accepted', 'rejected', 'expired', 'withdrawn', 'completed') NOT NULL DEFAULT 'invited',
    `invited_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accepted_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `role_assignments_worker_id_status_idx`(`worker_id`, `status`),
    UNIQUE INDEX `role_assignments_task_role_id_slot_index_key`(`task_role_id`, `slot_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverables` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `assignment_id` BIGINT NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(200) NOT NULL,
    `file_size` BIGINT NULL,
    `file_type` VARCHAR(20) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('submitted', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
    `review_note` VARCHAR(500) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    INDEX `deliverables_task_id_assignment_id_idx`(`task_id`, `assignment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `worker_id` BIGINT NOT NULL,
    `available_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `frozen_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_earned` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallets_worker_id_key`(`worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `transaction_no` VARCHAR(32) NOT NULL,
    `type` ENUM('recharge', 'lock', 'unlock', 'settlement', 'withdraw', 'refund') NOT NULL,
    `direction` ENUM('in', 'out') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `company_id` BIGINT NULL,
    `worker_id` BIGINT NULL,
    `task_id` BIGINT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `channel_order_no` VARCHAR(64) NULL,
    `remark` VARCHAR(200) NULL,
    `idempotency_key` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `transactions_transaction_no_key`(`transaction_no`),
    UNIQUE INDEX `transactions_idempotency_key_key`(`idempotency_key`),
    INDEX `transactions_company_id_type_created_at_idx`(`company_id`, `type`, `created_at`),
    INDEX `transactions_worker_id_type_created_at_idx`(`worker_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `invoice_no` VARCHAR(32) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `tax_rate` DECIMAL(4, 2) NOT NULL DEFAULT 0.06,
    `invoice_type` VARCHAR(10) NOT NULL DEFAULT '专票',
    `status` ENUM('pending', 'processing', 'issued', 'rejected') NOT NULL DEFAULT 'pending',
    `pdf_url` VARCHAR(500) NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issued_at` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_invoice_no_key`(`invoice_no`),
    INDEX `invoices_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `assignment_id` BIGINT NOT NULL,
    `reviewer_type` ENUM('company', 'worker') NOT NULL,
    `reviewer_id` BIGINT NOT NULL,
    `target_id` BIGINT NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reviews_assignment_id_reviewer_type_key`(`assignment_id`, `reviewer_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `company_user_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `last_msg_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversations_task_id_company_user_id_worker_id_key`(`task_id`, `company_user_id`, `worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `user_type` ENUM('company', 'worker') NOT NULL,
    `type` ENUM('task_invite', 'task_accepted', 'task_rejected', 'deliverable_submitted', 'review_result', 'settlement_completed', 'withdraw_completed', 'system') NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `related_id` BIGINT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_user_type_is_read_idx`(`user_id`, `user_type`, `is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `company_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `contract_hash` VARCHAR(64) NOT NULL,
    `pdf_url` VARCHAR(500) NULL,
    `signed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contracts_worker_id_idx`(`worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_tags` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `category` VARCHAR(50) NULL,
    `hot` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `skill_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(50) NOT NULL,
    `category` VARCHAR(50) NULL,
    `description` VARCHAR(200) NULL,
    `suggested_daily` DECIMAL(10, 2) NULL,
    `skill_tags` VARCHAR(500) NULL,

    UNIQUE INDEX `platform_roles_role_name_key`(`role_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `user_type` ENUM('company', 'worker') NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_logs_user_id_user_type_idx`(`user_id`, `user_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_checkins` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `checkin_date` DATE NOT NULL,
    `checkin_time` DATETIME(3) NULL,
    `checkout_time` DATETIME(3) NULL,
    `gps_lat` DECIMAL(10, 7) NULL,
    `gps_lng` DECIMAL(10, 7) NULL,
    `screenshot_url` VARCHAR(500) NULL,
    `work_log` TEXT NULL,
    `status` ENUM('pending', 'confirmed', 'auto_confirmed', 'rejected') NOT NULL DEFAULT 'pending',
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `daily_checkins_worker_id_checkin_date_idx`(`worker_id`, `checkin_date`),
    UNIQUE INDEX `daily_checkins_assignment_id_checkin_date_key`(`assignment_id`, `checkin_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_settlements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `week_start` DATE NOT NULL,
    `week_end` DATE NOT NULL,
    `total_days` DECIMAL(4, 1) NOT NULL,
    `daily_rate` DECIMAL(10, 2) NOT NULL,
    `gross_amount` DECIMAL(12, 2) NOT NULL,
    `net_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `settled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `weekly_settlements_assignment_id_week_start_idx`(`assignment_id`, `week_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disputes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `assignment_id` BIGINT NOT NULL,
    `initiator_type` ENUM('company', 'worker') NOT NULL,
    `initiator_id` BIGINT NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `evidence_urls` TEXT NULL,
    `status` ENUM('pending', 'investigating', 'resolved_company', 'resolved_worker', 'resolved_split', 'cancelled') NOT NULL DEFAULT 'pending',
    `resolution` VARCHAR(500) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `disputes_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_users` ADD CONSTRAINT `company_users_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_custom_roles` ADD CONSTRAINT `company_custom_roles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worker_roles` ADD CONSTRAINT `worker_roles_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_roles` ADD CONSTRAINT `task_roles_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_task_role_id_fkey` FOREIGN KEY (`task_role_id`) REFERENCES `task_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
