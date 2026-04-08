import { Module } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';
import { StateModule } from '../state/state.module';

@Module({
  imports: [StateModule],
  providers: [RuleEngineService],
  exports: [RuleEngineService],
})
export class RuleEngineModule {}
