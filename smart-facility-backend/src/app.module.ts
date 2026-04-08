import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { StreamModule } from './modules/stream/stream.module';
import { RulesModule } from './modules/rules/rules.module';
import { StateModule } from './modules/state/state.module';
import { RuleEngineModule } from './modules/rule-engine/rule-engine.module';
import { ActionsModule } from './modules/actions/actions.module';
import { ProcessorModule } from './modules/processor/processor.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    StreamModule,
    IngestionModule,
    RulesModule,
    StateModule,
    RuleEngineModule,
    ActionsModule,
    ProcessorModule,
    SupabaseModule,
    AlertsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
