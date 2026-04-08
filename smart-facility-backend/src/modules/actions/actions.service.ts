import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Rule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngestEvent } from '../stream/stream.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async triggerAlertFromEvent(rule: Rule, event: IngestEvent, message: string) {
    const dedupeKey = `${event.deviceId}:${rule.id}:${event.timestamp}`;
    return this.createAlertWithRetry(rule, event.deviceId, message, dedupeKey, event);
  }

  async triggerHeartbeatAlert(
    rule: Rule,
    deviceId: string,
    timestamp: number,
    message: string,
  ) {
    const dedupeKey = `${deviceId}:${rule.id}:${timestamp}`;
    const payload = {
      deviceId,
      type: 'heartbeat',
      value: 0,
      timestamp,
    };
    return this.createAlertWithRetry(rule, deviceId, message, dedupeKey, payload);
  }

  private async createAlertWithRetry(
    rule: Rule,
    deviceId: string,
    message: string,
    dedupeKey: string,
    eventPayload: unknown,
  ) {
    try {
      const alert = await this.prisma.alert.create({
        data: {
          deviceId,
          ruleId: rule.id,
          message,
          dedupeKey,
          eventPayload: eventPayload as Prisma.InputJsonValue,
        },
      });
      this.realtimeService.emitAlertCreated(alert);

      await this.callWebhookWithRetry({
        deviceId,
        ruleId: rule.id,
        message,
        timestamp: Math.floor(Date.now() / 1000),
      });

      return alert;
    } catch (error: unknown) {
      if (this.isUniqueDedupeError(error)) {
        return null;
      }
      throw error;
    }
  }

  private isUniqueDedupeError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private async callWebhookWithRetry(payload: {
    deviceId: string;
    ruleId: string;
    message: string;
    timestamp: number;
  }) {
    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    if (!webhookUrl) {
      return;
    }

    const delaysMs = [1000, 2000, 4000];
    for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          return;
        }
      } catch (error) {
        this.logger.warn(
          `Webhook attempt ${attempt + 1} failed: ${(error as Error).message}`,
        );
      }

      await new Promise((resolve) => {
        setTimeout(resolve, delaysMs[attempt]);
      });
    }
  }
}
