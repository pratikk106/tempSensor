import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestEventDto } from './dto/ingest-event.dto';
import { StreamService } from '../stream/stream.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class IngestionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly streamService: StreamService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private ensureApiKey(apiKey: string | undefined) {
    const expectedApiKey = this.configService.get<string>('API_KEY');
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async ingest(event: IngestEventDto, apiKey: string | undefined) {
    this.ensureApiKey(apiKey);

    const streamId = await this.streamService.publishEvent(event);
    this.realtimeService.emitEventReceived(event);
    return { accepted: true, streamId };
  }

  async ingestBatch(events: IngestEventDto[], apiKey: string | undefined) {
    this.ensureApiKey(apiKey);

    const results: Array<{
      accepted: true;
      streamId: string | null;
      deviceId: string;
    }> = [];
    for (const event of events) {
      const streamId = await this.streamService.publishEvent(event);
      this.realtimeService.emitEventReceived(event);
      results.push({
        accepted: true,
        streamId,
        deviceId: event.deviceId,
      });
    }
    return { count: results.length, results };
  }
}
