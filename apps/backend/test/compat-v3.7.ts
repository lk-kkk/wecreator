/**
 * V3.7 Phase 7.3 — V3.6.1 兼容性回归
 *
 * 策略:
 *   1. 模拟一条 V3.6.1 风格的遗留项目 (status='active', phase 默认, riskLevel 默认)
 *   2. 模拟一条 V3.6.1 风格的遗留任务 (无 taskNo, 无 priority, 无 riskLevel)
 *   3. 运行 V3.7 代码路径 (projectService.getBoard / taskService.list)
 *   4. 验证字段正确映射、V3.7 cron 不报错、查询不失败
 *
 * 运行: cd apps/backend && npx ts-node -r tsconfig-paths/register test/compat-v3.7.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectService } from '../src/modules/project/project.service';
import { RiskLevelCron } from '../src/modules/scheduler/risk-level.cron';

async function main() {
  console.log('🔄 V3.7 Phase 7.3 兼容性回归\n');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const projSvc = app.get(ProjectService);
  const riskCron = app.get(RiskLevelCron);

  const company = await prisma.company.findFirst();
  const user = await prisma.companyUser.findFirst({ where: { companyId: company?.id } });
  if (!company || !user) throw new Error('需要 company + companyUser seed');

  const cleanup: Array<() => Promise<void>> = [];
  let failed = 0;

  try {
    // ── [1] V3.6.1 项目 status='active' 仍合法 ────────────
    const legacyProj = await prisma.project.create({
      data: {
        companyId: company.id,
        projectNo: `PRJ-LGCY${Date.now().toString(36).slice(-4)}`,
        name: 'V3.6.1 遗留项目',
        managerId: user.id,
        status: 'active',             // V3.6.1 枚举值
        // phase / expectedDeliveryDate / riskLevel 不填，走默认
      },
    });
    cleanup.push(async () => { await prisma.project.delete({ where: { id: legacyProj.id } }).catch(() => {}); });
    console.log(`✅ [1] status='active' 可写入, id=${Number(legacyProj.id)} phase=${legacyProj.phase} riskLevel=${legacyProj.riskLevel}`);
    if (legacyProj.phase !== 'requirement') { console.log('  ⚠️ 默认 phase 非 requirement:', legacyProj.phase); failed++; }
    if (legacyProj.riskLevel !== 'green') { console.log('  ⚠️ 默认 riskLevel 非 green:', legacyProj.riskLevel); failed++; }

    // ── [2] 无 taskNo 任务 (V3.6.1 模拟) ──────────────────
    const legacyTask = await prisma.task.create({
      data: {
        companyId: company.id,
        createdBy: user.id,
        title: 'V3.6.1 遗留任务',
        description: '无 taskNo',
        taskMode: 'task_package',
        totalBudget: 100,
        status: 'draft',
        // 不填 taskNo / priority / riskLevel / acceptanceStatus
      },
    });
    cleanup.push(async () => { await prisma.task.delete({ where: { id: legacyTask.id } }).catch(() => {}); });
    console.log(`✅ [2] taskNo 可空 任务写入成功, id=${Number(legacyTask.id)} priority=${legacyTask.priority} riskLevel=${legacyTask.riskLevel} acceptance=${legacyTask.acceptanceStatus}`);
    if (legacyTask.priority !== 'p2') { console.log('  ⚠️ 默认 priority 非 p2:', legacyTask.priority); failed++; }
    if (legacyTask.riskLevel !== 'green') { console.log('  ⚠️ 默认 riskLevel 非 green:', legacyTask.riskLevel); failed++; }
    if (legacyTask.acceptanceStatus !== null) { console.log('  ⚠️ 默认 acceptanceStatus 非 null:', legacyTask.acceptanceStatus); failed++; }

    // ── [3] V3.7 getBoard 可读老项目 ──────────────────────
    const board = await projSvc.getBoard(Number(company.id));
    const found = Array.isArray(board) && board.some((b: any) => Number(b.id) === Number(legacyProj.id));
    if (found) console.log(`✅ [3] getBoard 兼容遗留项目 (看板含 id=${Number(legacyProj.id)}, 返回 ${board.length} 项)`);
    else { console.log(`❌ [3] getBoard 未返回遗留项目`); failed++; }

    // ── [4] RiskLevelCron 对无 expectedDeliveryDate 不崩 ──
    const stats = await riskCron.runOnce();
    console.log(`✅ [4] RiskLevelCron 在遗留数据上运行正常: ${JSON.stringify(stats)}`);

    // ── [5] 项目阶段流转单调语义 ─────────────────────────
    //        手工 syncPhaseFromTasks: 无任务 / 任务未完成时不推进
    const phaseBefore = legacyProj.phase;
    await (projSvc as any).syncPhaseFromTasks(Number(legacyProj.id));
    const phaseAfter = (await prisma.project.findUnique({ where: { id: legacyProj.id } }))?.phase;
    if (phaseBefore === phaseAfter) console.log(`✅ [5] syncPhaseFromTasks 单调: 无任务时 phase 不退 (${phaseBefore})`);
    else { console.log(`❌ [5] phase 意外变化 ${phaseBefore} → ${phaseAfter}`); failed++; }

    // ── [6] phase 单调前进: execution → requirement 应被拒 ──
    await prisma.project.update({ where: { id: legacyProj.id }, data: { phase: 'execution' } });
    await (projSvc as any).syncPhaseFromTasks(Number(legacyProj.id));
    const phaseAfter2 = (await prisma.project.findUnique({ where: { id: legacyProj.id } }))?.phase;
    if (phaseAfter2 === 'execution') console.log(`✅ [6] phase 单调前进: execution 不回退 (still=${phaseAfter2})`);
    else { console.log(`❌ [6] 单调语义失败, phase=${phaseAfter2}`); failed++; }

    console.log(failed === 0 ? '\n🎉 V3.6.1 兼容性回归全部通过\n' : `\n❌ ${failed} 项失败\n`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    console.log('🧹 清理…');
    for (const fn of cleanup.reverse()) { await fn().catch(() => {}); }
    await app.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
