/**
 * V3.7 Phase 1 / Step 1.3 — 生产环境数据回填脚本
 *
 * 用途：将 V3.6.1 历史数据（projects/tasks）回填 V3.7 新增字段。
 *
 * 使用方式：
 *   cd apps/backend
 *   pnpm ts-node --transpile-only prisma/backfill-v3.7.ts
 *
 * 策略：
 *   1. 分批 UPDATE（每批 500 条），避免锁表
 *   2. 幂等：已有值的字段不覆盖
 *   3. task_no 按 created_at 所在日期 + 日内序号分配
 *   4. 项目阶段按 task 进度推断（所有 task 完成→acceptance / 有 in_progress→execution / 否则 requirement）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function backfillTaskNo(): Promise<number> {
  console.log('\n📋 [1/3] 回填 tasks.task_no ...');
  const total = await prisma.task.count({ where: { taskNo: null } });
  if (total === 0) {
    console.log('   ✅ 无需回填');
    return 0;
  }
  console.log(`   待回填: ${total} 条`);

  // 按日期分组，每日一个序号计数器
  const tasksByDay: Map<string, bigint[]> = new Map();
  let cursor: bigint | undefined = undefined;
  let processed = 0;

  while (true) {
    const batch: Array<{ id: bigint; createdAt: Date }> = await prisma.task.findMany({
      where: { taskNo: null, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, createdAt: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    for (const t of batch) {
      const day = fmtDate(t.createdAt);
      if (!tasksByDay.has(day)) tasksByDay.set(day, []);
      tasksByDay.get(day)!.push(t.id);
    }

    cursor = batch[batch.length - 1].id;
    processed += batch.length;
    if (processed % 5000 === 0) console.log(`   已扫描 ${processed}/${total} ...`);
  }

  // 分配编号
  let updated = 0;
  for (const [day, ids] of tasksByDay) {
    for (let i = 0; i < ids.length; i++) {
      const seq = String(i + 1).padStart(3, '0');
      const taskNo = `TSK-${day}-${seq}`;
      await prisma.task.update({ where: { id: ids[i] }, data: { taskNo } });
      updated++;
      if (updated % 500 === 0) console.log(`   已回填 ${updated}/${total} ...`);
    }
  }
  console.log(`   ✅ 回填完成: ${updated} 条`);
  return updated;
}

async function backfillProjectPhase(): Promise<number> {
  console.log('\n📋 [2/3] 回填 projects.phase（基于关联任务推断）...');
  const projects = await prisma.project.findMany({
    where: { phase: 'requirement' }, // 只处理默认值
    select: { id: true },
  });
  if (projects.length === 0) {
    console.log('   ✅ 无需回填');
    return 0;
  }
  console.log(`   待回填: ${projects.length} 个项目`);

  let updated = 0;
  for (const p of projects) {
    const tasks = await prisma.task.findMany({
      where: { projectId: p.id },
      select: { status: true },
    });
    if (tasks.length === 0) continue; // 保持 requirement

    const allCompleted = tasks.every((t) => t.status === 'completed' || t.status === 'closed');
    const anyInProgress = tasks.some(
      (t) => t.status === 'in_progress' || t.status === 'reviewing' || t.status === 'published',
    );

    let phase: 'requirement' | 'execution' | 'acceptance' = 'requirement';
    if (allCompleted) phase = 'acceptance';
    else if (anyInProgress) phase = 'execution';

    if (phase !== 'requirement') {
      await prisma.project.update({ where: { id: p.id }, data: { phase } });
      updated++;
    }
  }
  console.log(`   ✅ 更新 ${updated} 个项目阶段`);
  return updated;
}

async function backfillRiskLevel(): Promise<number> {
  console.log('\n📋 [3/3] 验证 risk_level 默认值（无需动作，schema 已设 default=green）...');
  const tasksGreen = await prisma.task.count({ where: { riskLevel: 'green' } });
  const projectsGreen = await prisma.project.count({ where: { riskLevel: 'green' } });
  console.log(`   tasks.riskLevel=green: ${tasksGreen}`);
  console.log(`   projects.riskLevel=green: ${projectsGreen}`);
  console.log('   ✅ 首次 cron 执行时会重新计算真实风险等级');
  return 0;
}

async function main() {
  console.log('🌱 V3.7 数据回填开始...');
  const t0 = Date.now();

  try {
    const n1 = await backfillTaskNo();
    const n2 = await backfillProjectPhase();
    const n3 = await backfillRiskLevel();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ 回填完成，耗时 ${elapsed}s`);
    console.log(`   · tasks.task_no: ${n1} 条`);
    console.log(`   · projects.phase: ${n2} 个`);
    console.log(`   · risk_level: 由 cron 接管`);
  } catch (e) {
    console.error('❌ 回填失败:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
