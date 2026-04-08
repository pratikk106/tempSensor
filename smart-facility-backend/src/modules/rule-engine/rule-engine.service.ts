import { Injectable } from '@nestjs/common';
import { Rule } from '@prisma/client';
import { IngestEvent } from '../stream/stream.service';
import { StateService } from '../state/state.service';

type WindowDefinition = {
  type: 'count' | 'time';
  value: number;
};

type RuleDefinition = {
  type?: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'missing';
  threshold?: number;
  window?: WindowDefinition;
  minMatches?: number;
  action?: string;
};

export type RuleMatch = {
  ruleId: string;
  message: string;
};

@Injectable()
export class RuleEngineService {
  constructor(private readonly stateService: StateService) {}

  async evaluateEventRules(event: IngestEvent, rules: Rule[]): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = [];

    for (const rule of rules) {
      const definition = rule.definition as RuleDefinition;
      if (!definition || definition.operator === 'missing') {
        continue;
      }

      if (!definition.window) {
        if (this.compare(event.value, definition.operator, definition.threshold)) {
          matches.push({
            ruleId: rule.id,
            message: `${rule.name} matched for ${event.deviceId}`,
          });
        }
        continue;
      }

      if (definition.window.type === 'count') {
        const needed = definition.window.value;
        const readings = await this.stateService.getLastNReadings(
          event.deviceId,
          event.type,
          needed,
        );
        if (readings.length >= needed) {
          const allMatch = readings.every((item) =>
            this.compare(item.value, definition.operator, definition.threshold),
          );
          if (allMatch) {
            matches.push({
              ruleId: rule.id,
              message: `${rule.name} matched with ${needed} consecutive readings`,
            });
          }
        }
        continue;
      }

      if (definition.window.type === 'time') {
        const fromTs = event.timestamp - definition.window.value;
        const readings = await this.stateService.getReadingsInTimeWindow(
          event.deviceId,
          event.type,
          fromTs,
          event.timestamp,
        );
        const minMatches = Math.max(1, definition.minMatches ?? 1);
        const matchCount = readings.filter((item) =>
          this.compare(item.value, definition.operator, definition.threshold),
        ).length;

        if (matchCount >= minMatches) {
          matches.push({
            ruleId: rule.id,
            message: `${rule.name} matched ${matchCount} times in ${definition.window.value}s`,
          });
        }
      }
    }

    return matches;
  }

  isHeartbeatRule(rule: Rule) {
    const definition = rule.definition as RuleDefinition;
    return definition?.operator === 'missing' && definition?.window?.type === 'time';
  }

  getHeartbeatWindowSeconds(rule: Rule) {
    const definition = rule.definition as RuleDefinition;
    return definition.window?.value ?? 0;
  }

  private compare(
    value: number,
    operator: RuleDefinition['operator'],
    threshold?: number,
  ) {
    if (operator === 'missing' || threshold === undefined) {
      return false;
    }
    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }
}
