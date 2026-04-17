import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma';
import { CheckinDto, CheckoutDto, ConfirmCheckinDto } from './checkin.dto';

// GPS 围栏半径（单位：米）— 开发环境不限制，生产环境可配
const GPS_FENCE_RADIUS_M = process.env.NODE_ENV === 'production' ? 500 : Infinity;

/** 计算两点距离（Haversine，单位：米）*/
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // S2-001: 零工每日打卡（上班）
  // ================================================================
  async checkin(assignmentId: number, workerId: number, dto: CheckinDto) {
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: BigInt(assignmentId) },
      include: { taskRole: { include: { task: true } } },
    });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (assignment.workerId !== BigInt(workerId))
      throw new BadRequestException('无权操作此任务');
    if (assignment.status !== 'accepted')
      throw new BadRequestException('任务未在执行中');

    const task = (assignment as any).taskRole.task;
    if (task.taskMode !== 'daily_rate')
      throw new BadRequestException('仅人天模式支持打卡');

    // GPS 围栏校验（有坐标时）
    if (dto.gpsLat != null && dto.gpsLng != null && task.gpsLat && task.gpsLng) {
      const dist = haversine(
        dto.gpsLat, dto.gpsLng,
        Number(task.gpsLat), Number(task.gpsLng),
      );
      if (dist > GPS_FENCE_RADIUS_M) {
        throw new BadRequestException(`超出工作区围栏（距离 ${Math.round(dist)}m）`);
      }
    }

    const checkinDate = new Date(dto.checkinDate);

    // 检查当天是否已打卡
    const existing = await this.prisma.dailyCheckin.findUnique({
      where: {
        assignmentId_checkinDate: {
          assignmentId: BigInt(assignmentId),
          checkinDate,
        },
      },
    });
    if (existing) throw new BadRequestException('今日已打卡，请勿重复提交');

    const record = await this.prisma.dailyCheckin.create({
      data: {
        assignmentId: BigInt(assignmentId),
        workerId:     BigInt(workerId),
        checkinDate,
        checkinTime:  new Date(),
        gpsLat:       dto.gpsLat ?? null,
        gpsLng:       dto.gpsLng ?? null,
        screenshotUrl: dto.screenshotUrl ?? null,
        workLog:      dto.workLog ?? null,
        status:       'pending',
      },
    });

    this.logger.log(`打卡成功: worker=${workerId}, assignment=${assignmentId}, date=${dto.checkinDate}`);
    return {
      checkinId:  Number(record.id),
      checkinDate: dto.checkinDate,
      checkinTime: record.checkinTime,
      status:     record.status,
    };
  }

  // ================================================================
  // 零工签退（下班打卡）
  // ================================================================
  async checkout(assignmentId: number, workerId: number, dto: CheckoutDto) {
    const checkinDate = new Date(dto.checkinDate);
    const record = await this.prisma.dailyCheckin.findUnique({
      where: {
        assignmentId_checkinDate: {
          assignmentId: BigInt(assignmentId),
          checkinDate,
        },
      },
    });
    if (!record) throw new NotFoundException('当日打卡记录不存在');
    if (record.workerId !== BigInt(workerId)) throw new BadRequestException('无权操作');
    if (record.checkoutTime) throw new BadRequestException('已签退');

    const updated = await this.prisma.dailyCheckin.update({
      where: { id: record.id },
      data: {
        checkoutTime: new Date(),
        screenshotUrl: dto.screenshotUrl ?? record.screenshotUrl,
        workLog:      dto.workLog      ?? record.workLog,
      },
    });

    return {
      checkinId:    Number(updated.id),
      checkinTime:  updated.checkinTime,
      checkoutTime: updated.checkoutTime,
      status:       updated.status,
    };
  }

  // ================================================================
  // S2-002: 企业确认/驳回工时
  // ================================================================
  async confirmCheckin(
    checkinId: number,
    companyId: number,
    action: 'confirm' | 'reject',
    dto: ConfirmCheckinDto,
  ) {
    const record = await this.prisma.dailyCheckin.findUnique({
      where: { id: BigInt(checkinId) },
    });
    if (!record) throw new NotFoundException('打卡记录不存在');

    // 通过 assignmentId 查任务归属验证权限
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: record.assignmentId },
      include: { taskRole: { include: { task: true } } },
    });
    const task = (assignment as any)?.taskRole?.task;
    if (!task || task.companyId !== BigInt(companyId)) throw new BadRequestException('无权操作');
    if (record.status !== 'pending') throw new BadRequestException('已处理，无法修改');

    if (action === 'reject' && !dto.reason) {
      throw new BadRequestException('驳回时必须填写原因');
    }

    const updated = await this.prisma.dailyCheckin.update({
      where: { id: BigInt(checkinId) },
      data: {
        status:      action === 'confirm' ? 'confirmed' : 'rejected',
        confirmedAt: action === 'confirm' ? new Date() : null,
        workLog:     action === 'reject'
          ? `[驳回原因] ${dto.reason}\n${record.workLog ?? ''}`
          : record.workLog,
      },
    });

    this.logger.log(`工时${action}: checkinId=${checkinId}, by company=${companyId}`);
    return { checkinId, status: updated.status, confirmedAt: updated.confirmedAt };
  }

  // ================================================================
  // 获取某 Assignment 的打卡列表
  // ================================================================
  async listCheckins(assignmentId: number, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.dailyCheckin.findMany({
        where: { assignmentId: BigInt(assignmentId) },
        orderBy: { checkinDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.dailyCheckin.count({
        where: { assignmentId: BigInt(assignmentId) },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list: list.map((r) => ({
        checkinId:    Number(r.id),
        checkinDate:  r.checkinDate,
        checkinTime:  r.checkinTime,
        checkoutTime: r.checkoutTime,
        gpsLat:       r.gpsLat ? Number(r.gpsLat) : null,
        gpsLng:       r.gpsLng ? Number(r.gpsLng) : null,
        screenshotUrl: r.screenshotUrl,
        workLog:      r.workLog,
        status:       r.status,
        confirmedAt:  r.confirmedAt,
      })),
    };
  }

  // ================================================================
  // S2-002: T+1 自动确认工时（每天凌晨 02:30）
  // ================================================================
  @Cron('30 2 * * *', { name: 'auto_confirm_checkins' })
  async autoConfirmCheckins() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(yesterday.toISOString().slice(0, 10));

    const pending = await this.prisma.dailyCheckin.findMany({
      where: { checkinDate: dateOnly, status: 'pending' },
    });

    if (pending.length === 0) return;

    await this.prisma.dailyCheckin.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data: { status: 'auto_confirmed', confirmedAt: new Date() },
    });

    this.logger.log(`T+1自动确认工时: ${pending.length}条，日期=${dateOnly.toISOString().slice(0, 10)}`);
  }
}
