import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [StreamModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
