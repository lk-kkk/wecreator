import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * 获取分布式锁
   * @param key   锁名称（如 withdraw:lock:workerId）
   * @param ttlMs 持有时长毫秒（默认 30s）
   * @returns token 若获取成功返回随机 token，否则返回 null
   */
  async acquire(key: string, ttlMs = 30_000): Promise<string | null> {
    const token = randomBytes(16).toString('hex');
    // SET key token NX PX ttl
    const result = await this.redis.set(key, token, 'EX', Math.ceil(ttlMs / 1000), 'NX');
    if (result === 'OK') {
      this.logger.debug(`Lock acquired: ${key}`);
      return token;
    }
    return null;
  }

  /**
   * 释放分布式锁（Lua 脚本保证原子性）
   */
  async release(key: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, token);
    this.logger.debug(`Lock released: ${key}`);
  }

  /**
   * 带锁执行 fn，自动获取/释放
   * @throws 若获取锁失败抛出错误
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs = 30_000,
  ): Promise<T> {
    const token = await this.acquire(key, ttlMs);
    if (!token) {
      throw new Error(`获取分布式锁失败: ${key}`);
    }
    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}
