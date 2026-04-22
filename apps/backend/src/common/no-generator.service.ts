/**
 * TaskNoGeneratorService — V3.7 任务/项目编号生成器
 *
 * 格式:
 *   任务编号:  TSK-YYYYMMDD-NNN
 *   项目编号:  PRJ-YYYYMMDD-NNN
 *
 * 实现: Redis INCR 保证原子性 + 并发安全
 * Key TTL: 48h（防止跨日残留影响下一天的序号）
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

type Prefix = 'TSK' | 'PRJ';

@Injectable()
export class NoGeneratorService {
  private readonly logger = new Logger(NoGeneratorService.name);
  private static readonly TTL_SECONDS = 48 * 3600;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /** 获取今日日期字符串 YYYYMMDD */
  private today(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /** 内部：按前缀+日期递增 */
  private async nextSeq(prefix: Prefix, day: string): Promise<number> {
    const key = `${prefix.toLowerCase()}:seq:${day}`;
    const seq = await this.redis.incr(key);
    // 仅首次设 TTL
    if (seq === 1) {
      await this.redis.expire(key, NoGeneratorService.TTL_SECONDS);
    }
    return seq;
  }

  /** 生成任务编号 TSK-YYYYMMDD-NNN */
  async nextTaskNo(): Promise<string> {
    const day = this.today();
    const seq = await this.nextSeq('TSK', day);
    const padded = seq < 1000 ? String(seq).padStart(3, '0') : String(seq);
    return `TSK-${day}-${padded}`;
  }

  /** 生成项目编号 PRJ-YYYYMMDD-NNN */
  async nextProjectNo(): Promise<string> {
    const day = this.today();
    const seq = await this.nextSeq('PRJ', day);
    const padded = seq < 1000 ? String(seq).padStart(3, '0') : String(seq);
    return `PRJ-${day}-${padded}`;
  }
}
