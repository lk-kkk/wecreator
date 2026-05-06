-- V3.8: 任务关联里程碑
-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `milestone_id` BIGINT NULL;

-- CreateIndex
CREATE INDEX `tasks_milestone_id_idx` ON `tasks`(`milestone_id`);

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_milestone_id_fkey` FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
