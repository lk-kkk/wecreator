import {
  Controller, Get, Param, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RecommendationService } from './recommendation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class RecommendationController {
  constructor(private readonly svc: RecommendationService) {}

  /**
   * S2-010 企业侧：为任务角色推荐零工
   * GET /recommendations/roles/:roleId/workers
   */
  @Get('roles/:roleId/workers')
  @ApiOperation({ summary: '为任务角色推荐零工（含评分维度）' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量（默认20）' })
  recommendWorkers(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.recommendWorkersForRole(roleId, limit ? Number(limit) : 20);
  }

  /**
   * S2-016 零工侧：为零工推荐任务
   * GET /recommendations/tasks
   */
  @Get('tasks')
  @ApiOperation({ summary: '为当前零工推荐任务（含匹配度维度）' })
  @ApiQuery({ name: 'page',  required: false })
  @ApiQuery({ name: 'limit', required: false })
  recommendTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page')  page  = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.recommendTasksForWorker(user.userId, Number(limit), Number(page));
  }

  /**
   * 零工搜索（企业侧：关键词 + 城市 + 技能 + 评分过滤）
   * GET /recommendations/workers/search
   */
  @Get('workers/search')
  @ApiOperation({ summary: '零工搜索（企业侧）' })
  @ApiQuery({ name: 'keyword',   required: false })
  @ApiQuery({ name: 'city',      required: false })
  @ApiQuery({ name: 'skillTag',  required: false })
  @ApiQuery({ name: 'minRating', required: false })
  @ApiQuery({ name: 'page',      required: false })
  @ApiQuery({ name: 'pageSize',  required: false })
  searchWorkers(
    @Query('keyword')   keyword?: string,
    @Query('city')      city?: string,
    @Query('skillTag')  skillTag?: string,
    @Query('minRating') minRating?: number,
    @Query('page')      page = 1,
    @Query('pageSize')  pageSize = 20,
  ) {
    return this.svc.searchWorkers({
      keyword, city, skillTag,
      minRating: minRating ? Number(minRating) : 0,
      page:      Number(page),
      pageSize:  Number(pageSize),
    });
  }
}
