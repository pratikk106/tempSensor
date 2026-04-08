import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { IngestEvent } from '../stream/stream.service';

type StoredReading = {
  value: number;
  timestamp: number;
};

@Injectable()
export class StateService {
  constructor(private readonly redisService: RedisService) {}

  private readingsKey(deviceId: string, eventType: string) {
    return `state:readings:${deviceId}:${eventType}`;
  }

  private lastSeenKey(deviceId: string) {
    return `state:lastSeen:${deviceId}`;
  }

  private lastEventTsKey(deviceId: string, eventType: string) {
    return `state:lastEventTs:${deviceId}:${eventType}`;
  }

  private aggregateKey(deviceId: string, eventType: string) {
    return `state:aggregate:${deviceId}:${eventType}`;
  }

  async addReading(event: IngestEvent) {
    const redis = this.redisService.getClient();
    const key = this.readingsKey(event.deviceId, event.type);
    const reading = JSON.stringify({
      value: event.value,
      timestamp: event.timestamp,
    });

    await redis.zadd(key, String(event.timestamp), reading);
    await redis.expire(key, 24 * 60 * 60);
  }

  async trimByTime(
    deviceId: string,
    eventType: string,
    keepFromTimestamp: number,
  ) {
    const redis = this.redisService.getClient();
    const key = this.readingsKey(deviceId, eventType);
    await redis.zremrangebyscore(key, '-inf', `(${keepFromTimestamp}`);
  }

  async getLastNReadings(deviceId: string, eventType: string, count: number) {
    const redis = this.redisService.getClient();
    const key = this.readingsKey(deviceId, eventType);
    const rows = await redis.zrevrange(key, 0, Math.max(0, count - 1));
    return this.parseReadings(rows).reverse();
  }

  async getReadingsInTimeWindow(
    deviceId: string,
    eventType: string,
    fromTimestamp: number,
    toTimestamp: number,
  ) {
    const redis = this.redisService.getClient();
    const key = this.readingsKey(deviceId, eventType);
    const rows = await redis.zrangebyscore(
      key,
      String(fromTimestamp),
      String(toTimestamp),
    );
    return this.parseReadings(rows);
  }

  async setLastSeen(deviceId: string, timestamp: number) {
    const redis = this.redisService.getClient();
    const key = this.lastSeenKey(deviceId);
    await redis.set(key, String(timestamp), 'EX', 7 * 24 * 60 * 60);
  }

  async getLastEventTimestamp(deviceId: string, eventType: string) {
    const redis = this.redisService.getClient();
    const key = this.lastEventTsKey(deviceId, eventType);
    const value = await redis.get(key);
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async setLastEventTimestamp(deviceId: string, eventType: string, timestamp: number) {
    const redis = this.redisService.getClient();
    const key = this.lastEventTsKey(deviceId, eventType);
    await redis.set(key, String(timestamp), 'EX', 7 * 24 * 60 * 60);
  }

  async updateAggregates(event: IngestEvent, spikeThreshold = 10) {
    const redis = this.redisService.getClient();
    const key = this.aggregateKey(event.deviceId, event.type);
    const prevMaxRaw = await redis.hget(key, 'max');
    const prevCountRaw = await redis.hget(key, 'count');
    const prevSumRaw = await redis.hget(key, 'sum');
    const prevValueRaw = await redis.hget(key, 'lastValue');
    const prevSpikesRaw = await redis.hget(key, 'spikes');

    const prevMax = Number(prevMaxRaw ?? Number.NEGATIVE_INFINITY);
    const prevCount = Number(prevCountRaw ?? 0);
    const prevSum = Number(prevSumRaw ?? 0);
    const prevValue = Number(prevValueRaw ?? event.value);
    const prevSpikes = Number(prevSpikesRaw ?? 0);

    const count = prevCount + 1;
    const sum = prevSum + event.value;
    const max = Math.max(prevMax, event.value);
    const spikes = Math.abs(event.value - prevValue) >= spikeThreshold ? prevSpikes + 1 : prevSpikes;
    const avg = count > 0 ? sum / count : event.value;

    await redis.hset(
      key,
      'count',
      String(count),
      'sum',
      String(sum),
      'avg',
      String(avg),
      'max',
      String(max),
      'spikes',
      String(spikes),
      'lastValue',
      String(event.value),
      'lastTimestamp',
      String(event.timestamp),
    );
    await redis.expire(key, 7 * 24 * 60 * 60);
  }

  async getAllLastSeen(): Promise<Array<{ deviceId: string; lastSeen: number }>> {
    const redis = this.redisService.getClient();
    const out: Array<{ deviceId: string; lastSeen: number }> = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'state:lastSeen:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await redis.mget(keys);
        keys.forEach((key, idx) => {
          const lastSeen = Number(values[idx] ?? 0);
          if (Number.isFinite(lastSeen) && lastSeen > 0) {
            out.push({
              deviceId: key.replace('state:lastSeen:', ''),
              lastSeen,
            });
          }
        });
      }
    } while (cursor !== '0');

    return out;
  }

  private parseReadings(rows: string[]): StoredReading[] {
    return rows
      .map((row) => {
        try {
          return JSON.parse(row) as StoredReading;
        } catch {
          return null;
        }
      })
      .filter((item): item is StoredReading => item !== null);
  }
}
