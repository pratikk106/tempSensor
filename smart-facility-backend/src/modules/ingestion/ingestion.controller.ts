import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IngestEventDto } from './dto/ingest-event.dto';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { IngestBatchPipe } from './ingest-batch.pipe';
import { IngestionService } from './ingestion.service';

@Controller('events')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('batch')
  async ingestBatch(
    @Body(new IngestBatchPipe()) batch: object,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const payload = batch as IngestBatchDto;
    return this.ingestionService.ingestBatch(payload.events, apiKey);
  }

  @Post()
  async ingest(
    @Body() payload: IngestEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.ingestionService.ingest(payload, apiKey);
  }
}
