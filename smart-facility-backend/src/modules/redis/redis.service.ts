import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    this.redis.on('error', (err) => {
      this.logger.warn(
        `Redis: ${err.message} — start Redis (e.g. docker compose up -d redis) for streams and processing.`,
      );
    });
  }

  async onModuleInit() {
    try {
      await this.redis.ping();
      this.logger.log('Redis connected');
    } catch {
      this.logger.warn(
        'Redis ping failed — API may start but /events stream and processor need Redis. Run: docker compose up -d redis',
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  getClient() {
    return this.redis;
  }
}
