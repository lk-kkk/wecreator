/**
 * V3.7 Phase 7.2 — 非功能性性能基准
 *
 * 验收标准:
 *   a) 项目看板 100 个项目加载 < 2s
 *   b) 评论 500 条加载 < 1s
 *   c) 风险 cron 执行 < 30s
 *   d) 通知 WebSocket 推送延迟 < 2s (降级轮询 30s)
 *      — 本项目未实现 WS，通知列表拉取延迟 < 500ms 替代
 *
 * 运行: cd apps/backend && npx ts-node -r tsconfig-paths/register test/perf-v3.7.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectService } from '../src/modules/project/project.service';
import { CommentService } from '../src/modules/task/comment.service';
import { RiskLevelCron } from '../src/modules/scheduler/risk-level.cron';
import { CompanyNotificationService } from '../src/modules/notification/company-notification.service';

interface Result { name: string; threshold: number; actual: number; unit: string; pass: boolean; }

async function main() {
  console.log('🚀 V3.7 Phase 7.2 性能基准\n');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const projSvc = app.get(ProjectService);
  const cmtSvc = app.get(CommentService);
  const riskCron = app.get(RiskLevelCron);
  const notifySvc = app.get(CompanyNotificationService);

  const results: Result[] = [];
  // 复用任意已有企业
  const company = await prisma.company.findFirst();
  const user = await prisma.companyUser.findFirst({ where: { companyId: company?.id } });
  if (!company || !user) throw new Error('需要至少一家企业和一个用户(seed 数据)');

  const cleanup: Array<() => Promise<void>> = [];

  try {
    // ── a) 项目看板 100 个项目加载 ───────────────────────────
    console.log('[a] 预置 100 个项目 (仅含空 tasks)…');
    const createdProjectIds: bigint[] = [];
    for (let i = 0; i < 100; i++) {
      const p = await prisma.project.create({
        data: {
          companyId: company.id,
          projectNo: `PRJ-P${Date.now().toString(36).slice(-5)}-${String(i).padStart(3,'0')}`,
          name: `性能测试项目 ${i}`,
          managerId: user.id,
          status: 'active',
          phase: 'execution',
          riskLevel: i % 3 === 0 ? 'red' : i % 3 === 1 ? 'yellow' : 'green',
        },
      });
      createdProjectIds.push(p.id);
    }
    cleanup.push(async () => {
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
    });

    const ta = Date.now();
    const board = await projSvc.getBoard(Number(company.id));
    const ms_a = Date.now() - ta;
    results.push({ name: '项目看板加载 (100 项目)', threshold: 2000, actual: ms_a, unit: 'ms', pass: ms_a < 2000 });
    console.log(`  ✔ 看板返回 ${Array.isArray(board) ? board.length : 0} 项目, 耗时 ${ms_a}ms`);

    // ── b) 评论 500 条加载 ───────────────────────────────────
    console.log('\n[b] 预置 500 条评论…');
    // 复用一个任意 task；若没有则新建
    let anyTask = await prisma.task.findFirst({ where: { companyId: company.id } });
    let createdTaskId: bigint | null = null;
    if (!anyTask) {
      anyTask = await prisma.task.create({
        data: {
          companyId: company.id,
          taskNo: `TSK-P${Date.now().toString(36).slice(-8)}`,
          title: 'PERF TEST',
          description: '_',
          taskMode: 'task_package',
          totalBudget: 1,
          status: 'draft',
          createdBy: user.id,
        },
      });
      createdTaskId = anyTask.id;
      cleanup.push(async () => {
        await prisma.task.delete({ where: { id: createdTaskId! } }).catch(() => {});
      });
    }
    const cmtRecords = Array.from({ length: 500 }, (_, i) => ({
      taskId: anyTask!.id,
      authorType: 'company_user' as any,
      authorId: user.id,
      content: `perf comment ${i}`,
    }));
    await prisma.taskComment.createMany({ data: cmtRecords });
    cleanup.push(async () => {
      await prisma.taskComment.deleteMany({
        where: { taskId: anyTask!.id, content: { startsWith: 'perf comment' } },
      });
    });

    const tb = Date.now();
    const listResult = await cmtSvc.list(Number(anyTask.id), 1, 500);
    const ms_b = Date.now() - tb;
    results.push({ name: '评论列表加载 (500 条)', threshold: 1000, actual: ms_b, unit: 'ms', pass: ms_b < 1000 });
    console.log(`  ✔ 评论返回 ${listResult?.total ?? (listResult as any)?.length ?? '?'} 条, 耗时 ${ms_b}ms`);

    // ── c) 风险 cron 执行时间 ────────────────────────────────
    console.log('\n[c] RiskLevelCron.runOnce…');
    const tc = Date.now();
    const riskStats = await riskCron.runOnce();
    const ms_c = Date.now() - tc;
    results.push({ name: 'RiskLevelCron 执行', threshold: 30000, actual: ms_c, unit: 'ms', pass: ms_c < 30000 });
    console.log(`  ✔ stats=${JSON.stringify(riskStats)} 耗时 ${ms_c}ms`);

    // ── d) 通知列表拉取延迟 (替代 WS) ────────────────────────
    console.log('\n[d] 通知列表拉取 (100 条)…');
    const notifRecords = Array.from({ length: 100 }, (_, i) => ({
      userId: user.id,
      companyId: company.id,
      type: 'risk_alert' as any,
      title: `perf-notif ${i}`,
      content: `_`,
      refType: 'task',
      refId: 0n,
    }));
    await prisma.companyNotification.createMany({ data: notifRecords });
    cleanup.push(async () => {
      await prisma.companyNotification.deleteMany({
        where: { userId: user.id, title: { startsWith: 'perf-notif' } },
      });
    });

    const td = Date.now();
    const notifs = await notifySvc.list(Number(user.id), Number(company.id), { page: 1, pageSize: 100 } as any);
    const ms_d = Date.now() - td;
    results.push({ name: '通知列表拉取 (100 条)', threshold: 500, actual: ms_d, unit: 'ms', pass: ms_d < 500 });
    console.log(`  ✔ 通知返回 total=${notifs.total} 耗时 ${ms_d}ms`);

    // ── 汇总 ──
    console.log('\n📊 汇总:');
    console.log('─'.repeat(70));
    for (const r of results) {
      const icon = r.pass ? '✅' : '❌';
      console.log(`${icon} ${r.name.padEnd(32)} ${String(r.actual).padStart(6)} ${r.unit}  (阈值 <${r.threshold} ${r.unit})`);
    }
    console.log('─'.repeat(70));
    const passed = results.filter(r => r.pass).length;
    console.log(`${passed}/${results.length} 通过\n`);

    if (passed < results.length) {
      process.exitCode = 1;
    }
  } finally {
    console.log('🧹 清理测试数据…');
    for (const fn of cleanup.reverse()) {
      await fn().catch(e => console.warn('  清理失败:', e?.message));
    }
    await app.close();
  }
}

main().catch(e => {
  console.error('❌ 性能基准失败:', e);
  process.exit(1);
});
