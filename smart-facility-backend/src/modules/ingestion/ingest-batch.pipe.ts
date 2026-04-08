import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { IngestBatchDto } from './dto/ingest-batch.dto';

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const out: string[] = [];
  for (const e of errors) {
    if (e.constraints) {
      out.push(...Object.values(e.constraints));
    }
    if (e.children?.length) {
      out.push(...flattenValidationErrors(e.children));
    }
  }
  return out;
}

/**
 * Accepts either a JSON array of events or { "events": [ ... ] }.
 * Uses `object` in the controller so global ValidationPipe skips this param
 * (it cannot validate a raw array as IngestBatchDto).
 */
@Injectable()
export class IngestBatchPipe implements PipeTransform<unknown, IngestBatchDto> {
  transform(value: unknown): IngestBatchDto {
    let events: unknown;
    if (Array.isArray(value)) {
      events = value;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      Array.isArray((value as Record<string, unknown>).events)
    ) {
      events = (value as { events: unknown[] }).events;
    } else {
      throw new BadRequestException(
        'Send a JSON array of events, or an object { "events": [ ... ] }. Use Body → raw → JSON and Content-Type: application/json.',
      );
    }

    const dto = plainToInstance(IngestBatchDto, { events });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const messages = flattenValidationErrors(errors);
      throw new BadRequestException(
        messages.length > 0 ? messages : 'Batch validation failed',
      );
    }
    return dto;
  }
}
