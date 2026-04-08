import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { StreamService } from '../stream/stream.service';
import { RedisService } from '../redis/redis.service';
import { IngestEvent } from '../stream/stream.service';
import { StateService } from '../state/state.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { ActionsService } from '../actions/actions.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly consumerName = `consumer-${process.pid}`;
  private readonly maxOutOfOrderDelaySeconds = 120;
  private running = true;
  private consumerGroupReady = false;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly streamService: StreamService,
    private readonly redisService: RedisService,
    private readonly stateService: StateService,
    private readonly rulesService: RulesService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly actionsService: ActionsService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async onModuleInit() {
    this.processLoop();
    this.heartbeatTimer = setInterval(() => {
      this.evaluateHeartbeatRules().catch((error: unknown) => {
        this.logger.error(
          `Heartbeat evaluation failed: ${(error as Error).message}`,
        );
      });
    }, 5000);
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  private async tryEnsureConsumerGroup() {
    if (this.consumerGroupReady) {
      return;
    }
    const redis = this.redisService.getClient();
    const stream = this.streamService.getStreamName();
    const group = this.streamService.getGroupName();

    try {
      await redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
      this.consumerGroupReady = true;
      this.logger.log('Redis stream consumer group ready');
    } catch (error: unknown) {
      const message = (error as Error).message;
      if (message.includes('BUSYGROUP')) {
        this.consumerGroupReady = true;
      } else {
        this.logger.debug(`Consumer group not ready: ${message}`);
      }
    }
  }

  private async processLoop() {
    const redis = this.redisService.getClient();
    const stream = this.streamService.getStreamName();
    const group = this.streamService.getGroupName();

    while (this.running) {
      try {
        await this.tryEnsureConsumerGroup();
        if (!this.consumerGroupReady) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        const rows = (await redis.xreadgroup(
          'GROUP',
          group,
          this.consumerName,
          'COUNT',
          50,
          'BLOCK',
          1000,
          'STREAMS',
          stream,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!rows) {
          continue;
        }

        for (const [, entries] of rows) {
          for (const [streamId, fields] of entries) {
            const event = this.mapEvent(fields);
            if (!event) {
              await redis.xack(stream, group, streamId);
              continue;
            }

            const isUniqueEvent = await this.registerEventDedupe(event);
            if (!isUniqueEvent) {
              await redis.xack(stream, group, streamId);
              continue;
            }

            const lastTs = await this.stateService.getLastEventTimestamp(
              event.deviceId,
              event.type,
            );
            if (lastTs !== null && event.timestamp < lastTs) {
              const delaySeconds = lastTs - event.timestamp;
              if (delaySeconds > this.maxOutOfOrderDelaySeconds) {
                this.realtimeService.emitEventDropped(
                  event,
                  `stale_event_delay_${delaySeconds}s`,
                );
                await redis.xack(stream, group, streamId);
                continue;
              }
            }

            await this.prisma.eventLog.create({
              data: {
                deviceId: event.deviceId,
                eventType: event.type,
                value: event.value,
                timestamp: BigInt(event.timestamp),
                streamId,
              },
            });

            await this.stateService.addReading(event);
            await this.stateService.trimByTime(
              event.deviceId,
              event.type,
              event.timestamp - 24 * 60 * 60,
            );
            await this.stateService.setLastSeen(event.deviceId, event.timestamp);
            await this.stateService.updateAggregates(event);
            if (lastTs === null || event.timestamp >= lastTs) {
              await this.stateService.setLastEventTimestamp(
                event.deviceId,
                event.type,
                event.timestamp,
              );
            }
            this.realtimeService.emitDeviceStatus(
              event.deviceId,
              'online',
              event.timestamp,
            );

            const rules = (await this.rulesService.findAll()).filter(
              (rule) => rule.isActive && rule.eventType === event.type,
            );
            const matches = await this.ruleEngineService.evaluateEventRules(event, rules);
            for (const match of matches) {
              const rule = rules.find((r) => r.id === match.ruleId);
              if (!rule) {
                continue;
              }
              await this.actionsService.triggerAlertFromEvent(rule, event, match.message);
            }

            this.realtimeService.emitEventProcessed(event, streamId);

            await redis.xack(stream, group, streamId);
          }
        }
      } catch (error: unknown) {
        this.logger.error(`Process loop error: ${(error as Error).message}`);
      }
    }
  }

  private mapEvent(fields: string[]): IngestEvent | null {
    const map = new Map<string, string>();
    for (let idx = 0; idx < fields.length; idx += 2) {
      map.set(fields[idx], fields[idx + 1]);
    }

    const deviceId = map.get('deviceId');
    const type = map.get('type');
    const value = Number(map.get('value'));
    const timestamp = Number(map.get('timestamp'));

    if (!deviceId || !type || Number.isNaN(value) || Number.isNaN(timestamp)) {
      return null;
    }

    return { deviceId, type, value, timestamp };
  }

  private async registerEventDedupe(event: IngestEvent) {
    const redis = this.redisService.getClient();
    const key = `dedupe:event:${event.deviceId}:${event.type}:${event.timestamp}:${event.value}`;
    const result = await redis.set(key, '1', 'EX', 300, 'NX');
    return result === 'OK';
  }

  private async evaluateHeartbeatRules() {
    const now = Math.floor(Date.now() / 1000);
    const allRules = await this.rulesService.findAll();
    const heartbeatRules = allRules.filter(
      (rule) => rule.isActive && this.ruleEngineService.isHeartbeatRule(rule),
    );
    if (heartbeatRules.length === 0) {
      return;
    }

    const devices = await this.stateService.getAllLastSeen();
    for (const device of devices) {
      for (const rule of heartbeatRules) {
        const windowSeconds = this.ruleEngineService.getHeartbeatWindowSeconds(rule);
        if (windowSeconds <= 0) {
          continue;
        }

        if (now - device.lastSeen >= windowSeconds) {
          const bucketTs = Math.floor(now / windowSeconds) * windowSeconds;
          await this.actionsService.triggerHeartbeatAlert(
            rule,
            device.deviceId,
            bucketTs,
            `${rule.name} matched: no heartbeat for ${windowSeconds}s`,
          );
          this.realtimeService.emitDeviceStatus(device.deviceId, 'offline', now);
        }
      }
    }
  }
}
