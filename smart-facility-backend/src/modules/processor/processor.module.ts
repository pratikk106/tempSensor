import { Module } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { StreamModule } from '../stream/stream.module';
import { RulesModule } from '../rules/rules.module';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';
import { StateModule } from '../state/state.module';
import { ActionsModule } from '../actions/actions.module';

@Module({
  imports: [StreamModule, RulesModule, RuleEngineModule, StateModule, ActionsModule],
  providers: [ProcessorService],
})
export class ProcessorModule {}
