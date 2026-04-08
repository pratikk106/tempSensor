import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  create(@Body() payload: CreateRuleDto) {
    return this.rulesService.create(payload);
  }

  @Get()
  findAll() {
    return this.rulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateRuleDto) {
    return this.rulesService.update(id, payload);
  }

  @Post(':id/update')
  updateViaPost(@Param('id') id: string, @Body() payload: UpdateRuleDto) {
    return this.rulesService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}
