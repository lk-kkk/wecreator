/**
 * ProjectModule — R2-a 项目管理（Sprint 3+4）
 *
 * API 清单（~12个）:
 *   GET    /projects                    — 项目列表(分页+筛选)
 *   POST   /projects                    — 创建项目
 *   GET    /projects/:id                — 项目详情
 *   PUT    /projects/:id                — 更新项目
 *   PATCH  /projects/:id/status         — 更新项目状态/阶段
 *   GET    /projects/board              — 看板数据(含进度+预警)
 *   GET    /projects/:id/milestones     — 里程碑列表
 *   POST   /projects/:id/milestones     — 创建里程碑
 *   PUT    /projects/:id/milestones/:mid — 更新里程碑
 *   DELETE /projects/:id/milestones/:mid — 删除里程碑
 *   POST   /projects/:id/milestones/:mid/complete — 完成里程碑
 *   GET    /projects/stats              — 项目统计(Dashboard用)
 */
import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
