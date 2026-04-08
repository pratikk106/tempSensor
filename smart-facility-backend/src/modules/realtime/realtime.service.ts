import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { IngestEvent } from '../stream/stream.service';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitEventReceived(event: IngestEvent) {
    this.gateway.server?.emit('event.received', event);
  }

  emitEventProcessed(event: IngestEvent, streamId: string) {
    this.gateway.server?.emit('event.processed', {
      ...event,
      streamId,
    });
  }

  emitEventDropped(event: IngestEvent, reason: string) {
    this.gateway.server?.emit('event.dropped', {
      ...event,
      reason,
    });
  }

  emitAlertCreated(alert: unknown) {
    this.gateway.server?.emit('alert.created', alert);
  }

  emitDeviceStatus(deviceId: string, status: 'online' | 'offline', timestamp: number) {
    this.gateway.server?.emit('device.status', {
      deviceId,
      status,
      timestamp,
    });
  }
}
