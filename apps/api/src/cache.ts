import { Redis } from 'ioredis';

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export class RedisCache implements Cache {
  private readonly redis: Redis;
  constructor(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
    this.redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 300,
      commandTimeout: 250,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });
  }
  private async ready() {
    if (this.redis.status === 'wait') await this.redis.connect();
  }
  async get<T>(key: string) {
    await this.ready();
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : undefined;
  }
  async set<T>(key: string, value: T, ttlSeconds: number) {
    await this.ready();
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
  async ping() {
    try {
      await this.ready();
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
  async close() {
    if (this.redis.status !== 'end') this.redis.disconnect();
  }
}

export class MemoryCache implements Cache {
  private values = new Map<string, unknown>();
  async get<T>(key: string) {
    return this.values.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    this.values.set(key, value);
  }
  async ping() {
    return true;
  }
  async close() {
    this.values.clear();
  }
}
