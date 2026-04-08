import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  create(payload: CreateRuleDto) {
    return this.prisma.rule.create({
      data: {
        name: payload.name,
        eventType: payload.eventType,
        definition: payload.definition as Prisma.InputJsonValue,
        isActive: payload.isActive ?? true,
      },
    });
  }

  findAll() {
    return this.prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule;
  }

  async update(id: string, payload: UpdateRuleDto) {
    await this.findOne(id);
    return this.prisma.rule.update({
      where: { id },
      data: {
        name: payload.name,
        eventType: payload.eventType,
        definition: payload.definition as Prisma.InputJsonValue,
        isActive: payload.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.rule.delete({ where: { id } });
    return { deleted: true, id };
  }
}
