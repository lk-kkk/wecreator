-- AlterTable
ALTER TABLE `workers` ADD COLUMN `cover_image` VARCHAR(500) NULL,
    ADD COLUMN `cover_template` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `task_applications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_role_id` BIGINT NOT NULL,
    `worker_id` BIGINT NOT NULL,
    `intro` VARCHAR(200) NOT NULL,
    `expect_pay` DECIMAL(10, 2) NULL,
    `available_at` DATETIME(3) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `reject_reason` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_applications_worker_id_status_idx`(`worker_id`, `status`),
    INDEX `task_applications_task_role_id_status_idx`(`task_role_id`, `status`),
    UNIQUE INDEX `task_applications_task_role_id_worker_id_key`(`task_role_id`, `worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `task_applications` ADD CONSTRAINT `task_applications_task_role_id_fkey` FOREIGN KEY (`task_role_id`) REFERENCES `task_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_applications` ADD CONSTRAINT `task_applications_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
