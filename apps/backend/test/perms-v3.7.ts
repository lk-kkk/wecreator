/**
 * V3.7 Phase 7.4 — 权限矩阵静态回归
 *
 * 策略: 用 Reflector.get(ROLES_KEY, ctrl.prototype.method) 静态读取 @Roles() 元数据,
 *       然后按 PRD §8 矩阵断言每个功能的角色是否在白名单里。
 *
 * 运行: cd apps/backend && npx ts-node -r tsconfig-paths/register test/perms-v3.7.ts
 */
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../src/modules/auth/decorators/roles.decorator';

import { ProjectController } from '../src/modules/project/project.controller';
import { CheckpointController, CommentController, IssueController } from '../src/modules/task/task-enhancement.controller';
import { CompanyNotificationController } from '../src/modules/notification/company-notification.controller';
import { AnalyticsController } from '../src/modules/analytics/analytics.controller';

interface Case {
  feature: string;
  target: any;      // Controller class
  method?: string;  // Method name; 若 undefined 则读 class 级元数据
  expectAllow: string[];  // PRD §8 期望允许角色
  expectDeny:  string[];  // PRD §8 期望拒绝角色
}

const ALL_ROLES = ['super_admin', 'task_admin', 'finance_admin', 'operator'];

const cases: Case[] = [
  // ── 项目看板 ──
  { feature: '项目看板 — 列表 (board)',     target: ProjectController, method: 'board',
    expectAllow: ['super_admin','task_admin','operator'], expectDeny: ['finance_admin'] },

  // ── 里程碑管理 ──
  { feature: '里程碑 — 创建',               target: ProjectController, method: 'createMilestone',
    expectAllow: ['super_admin','task_admin'], expectDeny: ['finance_admin','operator'] },
  { feature: '里程碑 — 完成',               target: ProjectController, method: 'completeMilestone',
    expectAllow: ['super_admin','task_admin'], expectDeny: ['finance_admin','operator'] },

  // ── 检查点管理 / 审核 ──
  { feature: '检查点 — 创建',               target: CheckpointController, method: 'create',
    expectAllow: ['super_admin','task_admin'], expectDeny: ['finance_admin','operator'] },
  { feature: '检查点 — 审核',               target: CheckpointController, method: 'review',
    expectAllow: ['super_admin','task_admin'], expectDeny: ['finance_admin','operator'] },

  // ── 任务评论 ──
  { feature: '任务评论 — 发表',             target: CommentController, method: 'create',
    expectAllow: ['super_admin','task_admin','operator'], expectDeny: ['finance_admin'] },

  // ── 问题回复 ──
  { feature: '问题 — 更新状态 (回复)',      target: IssueController, method: 'update',
    expectAllow: ['super_admin','task_admin','operator'], expectDeny: ['finance_admin'] },

  // ── 通知中心 (class-level) ──
  { feature: '通知中心 — 列表', target: CompanyNotificationController, method: 'list',
    expectAllow: ALL_ROLES, expectDeny: [] },

  // ── Analytics (聚合查询限 super_admin/task_admin/operator) ──
  { feature: 'Analytics — tasks 查询',   target: AnalyticsController, method: 'tasks',
    expectAllow: ['super_admin','task_admin','operator'], expectDeny: ['finance_admin'] },
];

function resolveRoles(target: any, method?: string): string[] {
  const reflector = new Reflector();
  if (method) {
    const mRoles = reflector.get<string[]>(ROLES_KEY, target.prototype[method]);
    if (mRoles && mRoles.length) return mRoles;
  }
  // 回退到 class 级
  const cRoles = reflector.get<string[]>(ROLES_KEY, target);
  return cRoles ?? [];
}

function main() {
  console.log('🔐 V3.7 Phase 7.4 权限矩阵回归\n');
  let pass = 0, fail = 0;

  for (const c of cases) {
    let attached: string[] = [];
    try {
      attached = resolveRoles(c.target, c.method);
    } catch (e: any) {
      console.log(`❌ [${c.feature}] 无法读取 @Roles 元数据: ${e?.message}`);
      fail++; continue;
    }
    // 判定
    const missingAllow = c.expectAllow.filter(r => !attached.includes(r));
    const wrongAllow   = c.expectDeny.filter(r => attached.includes(r));
    const ok = missingAllow.length === 0 && wrongAllow.length === 0;

    const label = `${c.feature} ${c.method ? '['+c.method+']' : ''}`.padEnd(48);
    if (ok) {
      console.log(`✅ ${label} roles=[${attached.join(',')}]`);
      pass++;
    } else {
      console.log(`❌ ${label} roles=[${attached.join(',')}]`);
      if (missingAllow.length) console.log(`     缺失: ${missingAllow.join(',')}`);
      if (wrongAllow.length)   console.log(`     多余: ${wrongAllow.join(',')}`);
      fail++;
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`${pass}/${cases.length} 通过` + (fail ? `  ❌ ${fail} 失败` : ''));
  if (fail) process.exit(1);
}

main();
