import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type IngestEvent = {
  deviceId: string;
  type: string;
  value: number;
  timestamp: number;
};

@Injectable()
export class StreamService {
  private readonly streamName = 'events:ingest';
  private readonly groupName = 'event-processors';

  constructor(private readonly redisService: RedisService) {}

  async publishEvent(event: IngestEvent) {
    const redis = this.redisService.getClient();

    return redis.xadd(
      this.streamName,
      '*',
      'deviceId',
      event.deviceId,
      'type',
      event.type,
      'value',
      String(event.value),
      'timestamp',
      String(event.timestamp),
    );
  }

  getStreamName() {
    return this.streamName;
  }

  getGroupName() {
    return this.groupName;
  }
}
