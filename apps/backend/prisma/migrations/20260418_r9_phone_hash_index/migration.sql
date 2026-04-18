-- R9 安全审计修复 P1-02: 企业用户手机号 hash 索引
-- 解决登录时 O(n) 全表遍历解密的性能/安全问题

-- AlterTable
ALTER TABLE `company_users` ADD COLUMN `phone_hash` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `company_users_phone_hash_idx` ON `company_users`(`phone_hash`);
