/**
 * Phase 2 Smoke Test — V3.7 业务逻辑端到端验证（不走 HTTP, 直接调 Service）
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TaskService } from '../src/modules/task/task.service';
import { ProjectService } from '../src/modules/project/project.service';
import { CheckpointService } from '../src/modules/task/checkpoint.service';
import { CommentService } from '../src/modules/task/comment.service';
import { IssueService } from '../src/modules/task/issue.service';
import { CompanyNotificationService } from '../src/modules/notification/company-notification.service';
import { PrismaService } from '../src/prisma';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const taskSvc = app.get(TaskService);
  const projSvc = app.get(ProjectService);
  const cpSvc = app.get(CheckpointService);
  const cmtSvc = app.get(CommentService);
  const issueSvc = app.get(IssueService);
  const notifySvc = app.get(CompanyNotificationService);

  let company: any, user: any, worker: any;

  try {
    console.log('\n🚀 V3.7 Smoke Test\n');

    // ── 准备数据 ──
    company = await prisma.company.create({
      data: { name: 'Test Co', creditCode: '91310000TEST' + Date.now().toString().slice(-6), status: 'active' },
    });
    user = await prisma.companyUser.create({
      data: {
        companyId: company.id, name: 'PM', phone: 'encrypted',
        phoneHash: 'hash' + Date.now(), passwordHash: 'x', role: 'task_admin',
      },
    });
    console.log(`✅ 准备测试数据: company=${company.id}, user=${user.id}`);

    // ── 1. 创建项目 ──
    const proj = await projSvc.createProject(Number(company.id), Number(user.id), {
      name: 'V3.7测试项目',
      description: '冒烟测试',
    });
    console.log(`✅ [1] 创建项目: ${JSON.stringify(proj)}`);

    if (!proj.projectNo.match(/^PRJ-\d{8}-\d{3}$/)) throw new Error('项目编号格式错误');

    // ── 2. 创建里程碑 ──
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const ms = await projSvc.createMilestone(Number(company.id), proj.projectId, Number(user.id), {
      name: '需求评审',
      plannedDate: futureDate,
    });
    console.log(`✅ [2] 创建里程碑: ${JSON.stringify(ms)}`);

    // ── 2b. 里程碑过往日期校验 ──
    try {
      await projSvc.createMilestone(Number(company.id), proj.projectId, Number(user.id), {
        name: '过期里程碑',
        plannedDate: '2020-01-01',
      });
      throw new Error('应当拒绝过期日期但未拒绝');
    } catch (e: any) {
      if (e.message.includes('不能早于今日')) console.log('✅ [2b] 过往日期校验生效');
      else throw e;
    }

    // ── 3. 创建任务(验证 task_no + priority) ──
    const task = await taskSvc.createTask(Number(company.id), Number(user.id), {
      title: 'V3.7测试任务',
      taskMode: 'task_package',
      totalBudget: 10000,
      priority: 'p0',
      acceptanceCriteria: '设计稿必须适配移动端',
      projectId: proj.projectId,
    } as any);
    console.log(`✅ [3] 创建任务: ${JSON.stringify(task)}`);
    if (!task.taskNo?.match(/^TSK-\d{8}-\d{3,}$/)) throw new Error('任务编号格式错误: ' + task.taskNo);

    // ── 4. 验证 DB 字段 ──
    const taskRow = await prisma.task.findUnique({ where: { id: BigInt(task.taskId) } });
    console.log(`✅ [4] DB字段: priority=${taskRow?.priority}, riskLevel=${taskRow?.riskLevel}, task_no=${taskRow?.taskNo}`);

    // ── 5. 检查点创建 + 审核人校验 ──
    const cp = await cpSvc.create(task.taskId, {
      name: '中期检查',
      type: 'progress_check',
      plannedDate: futureDate,
      reviewerId: Number(user.id),
    });
    console.log(`✅ [5] 创建检查点: ${JSON.stringify(cp)}`);

    // 提交
    await cpSvc.submit(cp.checkpointId, {
      submitContent: '完成了80%',
      submitAttachments: ['file1.pdf'],
    });
    console.log(`✅ [5a] 检查点提交`);

    // 非reviewer审核 → 应拒绝
    try {
      await cpSvc.review(cp.checkpointId, 99999, { result: 'passed' });
      throw new Error('非reviewer应被拒绝');
    } catch (e: any) {
      if (e.message.includes('仅指定审核人')) console.log('✅ [5b] 非reviewer审核校验生效');
      else throw e;
    }

    // reviewer审核通过
    await cpSvc.review(cp.checkpointId, Number(user.id), { result: 'passed' });
    console.log('✅ [5c] reviewer审核通过');

    // ── 6. 评论系统 + 参与者权限 ──
    const c1 = await cmtSvc.create(task.taskId, 'company_user', Number(user.id), {
      content: '请关注进度',
    });
    console.log(`✅ [6] 创建评论: ${JSON.stringify(c1)}`);

    // 二级回复
    const c2 = await cmtSvc.create(task.taskId, 'company_user', Number(user.id), {
      content: '好的',
      parentId: c1.commentId,
    });
    console.log(`✅ [6a] 二级回复: ${JSON.stringify(c2)}`);

    // 三级回复 → 应拒绝
    try {
      await cmtSvc.create(task.taskId, 'company_user', Number(user.id), {
        content: '三级',
        parentId: c2.commentId,
      });
      throw new Error('三级回复应被拒绝');
    } catch (e: any) {
      if (e.message.includes('最多 2 层')) console.log('✅ [6b] 嵌套层级校验生效');
      else throw e;
    }

    // ── 7. @提及 + 通知 ──
    const c3 = await cmtSvc.create(task.taskId, 'company_user', Number(user.id), {
      content: `请看 @[PM](${user.id}) 这个有问题`,
    });
    console.log(`✅ [7] @提及解析: mentionedUserIds=${JSON.stringify(c3.mentionedUserIds)}`);

    // 验证通知已创建
    const notifs = await notifySvc.list(Number(user.id), Number(company.id), {});
    console.log(`✅ [7a] 企业端通知数: total=${notifs.total}, unread=${notifs.unread}`);
    const mentionNotif = notifs.list.find((n: any) => n.type === 'comment_mention');
    if (!mentionNotif) throw new Error('未找到 comment_mention 通知');
    console.log(`✅ [7b] 找到 @提及通知: ${mentionNotif.title}`);

    // ── 8. 问题上报 + 通知 ──
    const issue = await issueSvc.create(task.taskId, 'company_user', Number(user.id), {
      title: '需求不清晰',
      type: 'requirement_unclear',
      description: '客户未提供品牌色规范',
    });
    console.log(`✅ [8] 上报问题: ${JSON.stringify(issue)}`);

    const notifs2 = await notifySvc.list(Number(user.id), Number(company.id), {});
    const issueNotif = notifs2.list.find((n: any) => n.type === 'issue_report');
    if (!issueNotif) throw new Error('未找到 issue_report 通知');
    console.log(`✅ [8a] 问题通知已发送: ${issueNotif.title}`);

    // ── 9. SLA检查(无超时数据,应返回0) ──
    const slaCount = await issueSvc.checkSla();
    console.log(`✅ [9] SLA检查: ${slaCount} 条超时`);

    // ── 10. 里程碑完成 + 通知 ──
    await projSvc.completeMilestone(Number(company.id), proj.projectId, ms.milestoneId);
    const notifs3 = await notifySvc.list(Number(user.id), Number(company.id), {});
    const msNotif = notifs3.list.find((n: any) => n.type === 'milestone_remind');
    if (!msNotif) throw new Error('未找到 milestone_remind 通知');
    console.log(`✅ [10] 里程碑完成通知: ${msNotif.title}`);

    // ── 11. 通知标记已读 ──
    const readRes = await notifySvc.markRead(Number(user.id), Number(company.id), { all: true });
    console.log(`✅ [11] 标记已读: updated=${readRes.updated}`);
    const unreadAfter = await notifySvc.unreadCount(Number(user.id), Number(company.id));
    if (unreadAfter.count !== 0) throw new Error('未读数应为0');
    console.log(`✅ [11a] 未读数: ${unreadAfter.count}`);

    // ── 12. 任务列表筛选 (priority) ──
    const list = await taskSvc.getTaskList(Number(company.id), { priority: 'p0' } as any);
    if (list.list.length === 0) throw new Error('priority=p0 应能查到任务');
    console.log(`✅ [12] 按 priority=p0 筛选: ${list.list.length} 个任务`);

    // ── 13. V3.7 日报字段写入 ──
    // 直接写 progress_updates 表验证 schema + taskSvc.updateProgress 新参数
    const taskRole = await prisma.taskRole.create({
      data: {
        taskId: BigInt(task.taskId), platformRoleId: BigInt(1), roleName: 'dummy',
        level: 'mid' as any, headcount: 1, billingType: 'fixed', rate: 100,
        estimatedDays: 1, budget: 100, description: '-',
      } as any,
    });
    worker = await prisma.worker.create({
      data: {
        openid: 'openid_' + Date.now(),
        nickname: 'W',
      } as any,
    });
    const assignment = await prisma.roleAssignment.create({
      data: {
        taskRoleId: taskRole.id, workerId: worker.id,
        slotIndex: 1,
        status: 'accepted', progress: 10,
      } as any,
    });
    const progRes = await taskSvc.updateProgress(
      Number(assignment.id), Number(worker.id), 30, '今日推进 20%',
      { dailySummary: '今日完成首页 UI 设计', tomorrowPlan: '明日开始内页', issues: '暂无' },
    );
    if (!progRes.progressUpdateId) throw new Error('progress_updates 未写入');
    if (progRes.dailySummary !== '今日完成首页 UI 设计') throw new Error('dailySummary 丢失');
    if (progRes.tomorrowPlan !== '明日开始内页') throw new Error('tomorrowPlan 丢失');
    console.log(`✅ [13] 日报字段写入: id=${progRes.progressUpdateId} progress=${progRes.progress}`);

    // ── 14. RolesGuard 验证 (只检查装饰器元数据这里不好做，改为静态断言) ──
    const { ROLES_KEY } = require('../src/modules/auth/decorators/roles.decorator');
    const { Reflector } = require('@nestjs/core');
    const reflector = new Reflector();
    const { ProjectController } = require('../src/modules/project/project.controller');
    const createRoles = reflector.get(ROLES_KEY, ProjectController.prototype.create);
    if (!createRoles || !createRoles.includes('task_admin')) {
      throw new Error('ProjectController.create 缺 @Roles(task_admin)');
    }
    const { CheckpointController, CommentController, IssueController } = require('../src/modules/task/task-enhancement.controller');
    const cpReview = reflector.get(ROLES_KEY, CheckpointController.prototype.review);
    if (!cpReview?.includes('task_admin')) throw new Error('CheckpointController.review 缺 @Roles');
    const cpSubmit = reflector.get(ROLES_KEY, CheckpointController.prototype.submit);
    if (!cpSubmit?.includes('worker')) throw new Error('CheckpointController.submit 应允许 worker');
    const cmtCreate = reflector.get(ROLES_KEY, CommentController.prototype.create);
    if (!cmtCreate?.includes('worker') || !cmtCreate?.includes('task_admin')) {
      throw new Error('CommentController.create 缺角色');
    }
    const issueCreate = reflector.get(ROLES_KEY, IssueController.prototype.create);
    if (!issueCreate?.includes('worker')) throw new Error('IssueController.create 应允许 worker');
    const { CompanyNotificationController } = require('../src/modules/notification/company-notification.controller');
    const notifRoles = reflector.get(ROLES_KEY, CompanyNotificationController);
    if (!notifRoles?.includes('operator')) throw new Error('CompanyNotification 缺 class-level @Roles');
    console.log('✅ [14] RolesGuard 装饰器已正确挂载到 13 个路由');

    // ── 15. V3.7 Phase 5 Scheduler 测试 ──
    const { RiskLevelCron } = require('../src/modules/scheduler/risk-level.cron');
    const { CheckpointOverdueCron } = require('../src/modules/scheduler/checkpoint-overdue.cron');
    const { MilestoneRemindCron } = require('../src/modules/scheduler/milestone-remind.cron');
    const { NotificationCleanupCron } = require('../src/modules/scheduler/notification-cleanup.cron');
    const { SlaMonitorCron } = require('../src/modules/scheduler/sla-monitor.cron');
    const { DailyMissingCron } = require('../src/modules/scheduler/daily-missing.cron');

    // [15] 风险等级 cron：把测试任务 endDate 改为今天+1 天，触发 red
    const riskCron = app.get(RiskLevelCron);
    const tomorrow = new Date(Date.now() + 86400_000);
    await prisma.task.update({
      where: { id: BigInt(task.taskId) },
      data: { status: 'in_progress' as any, endDate: tomorrow, riskLevel: 'green' as any },
    });
    const riskResult = await riskCron.runOnce();
    const updated = await prisma.task.findUnique({ where: { id: BigInt(task.taskId) }, select: { riskLevel: true } });
    if (!updated || updated.riskLevel !== 'red') {
      throw new Error(`[15] 期望风险等级为 red，实际: ${updated?.riskLevel} (stats=${JSON.stringify(riskResult)})`);
    }
    console.log(`✅ [15] RiskLevelCron: 任务风险 green→red stats=${JSON.stringify(riskResult)}`);

    // [16] 检查点逾期 cron：新建 pending + 昨天 plannedDate 的 checkpoint → overdue
    const yesterday = new Date(Date.now() - 86400_000);
    const cp2 = await prisma.taskCheckpoint.create({
      data: {
        taskId: BigInt(task.taskId), name: '逾期检查点', type: 'progress_check' as any,
        plannedDate: yesterday, status: 'pending' as any, reviewerId: BigInt(user.id),
        sortOrder: 99,
      },
    });
    const cpOverdueCron = app.get(CheckpointOverdueCron);
    const overdueResult = await cpOverdueCron.runOnce();
    const cp2After = await prisma.taskCheckpoint.findUnique({ where: { id: cp2.id }, select: { status: true } });
    if (cp2After?.status !== 'overdue') {
      throw new Error(`[16] 期望状态为 overdue，实际: ${cp2After?.status}`);
    }
    console.log(`✅ [16] CheckpointOverdueCron: overdue=${overdueResult.overdue}`);

    // [17] 里程碑到期 cron：新建明天到期的里程碑 → 触发 T-3 提醒
    const t3Date = new Date(Date.now() + 2 * 86400_000);
    const ms2 = await prisma.milestone.create({
      data: {
        projectId: BigInt(proj.projectId), name: 'T-3 提醒测试',
        plannedDate: t3Date, status: 'pending' as any, createdBy: BigInt(user.id),
        sortOrder: 99,
      },
    });
    const msCron = app.get(MilestoneRemindCron);
    const remindResult = await msCron.runOnce();
    const remindNotif = await prisma.companyNotification.findFirst({
      where: { userId: BigInt(user.id), type: 'milestone_remind' as any, refType: 'milestone', refId: ms2.id },
    });
    if (!remindNotif) {
      throw new Error(`[17] 未找到 T-3 提醒通知 (result=${JSON.stringify(remindResult)})`);
    }
    console.log(`✅ [17] MilestoneRemindCron: ${JSON.stringify(remindResult)}`);

    // [18] SLA + DailyMissing + Cleanup 静态 runOnce 不报错即可
    const slaCron = app.get(SlaMonitorCron);
    const dmCron = app.get(DailyMissingCron);
    const cleanCron = app.get(NotificationCleanupCron);
    const sla = await slaCron.runOnce();
    const dm = await dmCron.runOnce();
    const cleaned = await cleanCron.runOnce();
    console.log(`✅ [18] SlaMonitor/DailyMissing/Cleanup: sla=${JSON.stringify(sla)} dm=${JSON.stringify(dm)} cleanup=${JSON.stringify(cleaned)}`);

    console.log('\n🎉 All V3.7 Phase 2+5 smoke tests passed!\n');

  } catch (e: any) {
    console.error('\n❌ Smoke test failed:', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    // 清理测试数据
    if (company) {
      try {
        await prisma.companyNotification.deleteMany({ where: { companyId: company.id } });
        await prisma.taskComment.deleteMany({ where: { task: { companyId: company.id } } });
        await prisma.taskCheckpoint.deleteMany({ where: { task: { companyId: company.id } } });
        await prisma.taskIssue.deleteMany({ where: { task: { companyId: company.id } } });
        // V3.7 日报/分配测试数据清理
        await prisma.progressUpdate.deleteMany({ where: { task: { companyId: company.id } } });
        await prisma.roleAssignment.deleteMany({ where: { taskRole: { task: { companyId: company.id } } } });
        await prisma.taskRole.deleteMany({ where: { task: { companyId: company.id } } });
        if (worker) await prisma.worker.delete({ where: { id: worker.id } }).catch(() => {});
        await prisma.task.deleteMany({ where: { companyId: company.id } });
        await prisma.milestone.deleteMany({ where: { project: { companyId: company.id } } });
        await prisma.project.deleteMany({ where: { companyId: company.id } });
        await prisma.companyUser.deleteMany({ where: { companyId: company.id } });
        await prisma.company.delete({ where: { id: company.id } });
        console.log('🧹 测试数据已清理');
      } catch (e: any) {
        console.error('清理失败:', e.message);
      }
    }
    await app.close();
  }
}

main();
