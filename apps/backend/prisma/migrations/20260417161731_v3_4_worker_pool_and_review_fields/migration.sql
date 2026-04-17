-- AlterTable
ALTER TABLE `task_applications` ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `reviewed_by` BIGINT NULL;

-- CreateTable
CREATE TABLE `company_worker_pool` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `worker_id` BIGINT NULL,
    `pre_name` VARCHAR(20) NOT NULL,
    `pre_phone` VARCHAR(11) NOT NULL,
    `custom_tags` JSON NULL,
    `internal_note` VARCHAR(200) NULL,
    `invite_status` ENUM('pending', 'registered', 'verified') NOT NULL DEFAULT 'pending',
    `invited_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `company_worker_pool_worker_id_invite_status_idx`(`worker_id`, `invite_status`),
    UNIQUE INDEX `company_worker_pool_company_id_pre_phone_key`(`company_id`, `pre_phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_worker_pool` ADD CONSTRAINT `company_worker_pool_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_worker_pool` ADD CONSTRAINT `company_worker_pool_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
