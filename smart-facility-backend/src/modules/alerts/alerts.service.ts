import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateAlertDto) {
    const dedupeKey =
      payload.dedupeKey ??
      `${payload.deviceId}:${payload.ruleId}:${Math.floor(Date.now() / 1000)}`;

    return this.prisma.alert.create({
      data: {
        deviceId: payload.deviceId,
        ruleId: payload.ruleId,
        message: payload.message,
        eventPayload: payload.eventPayload as Prisma.InputJsonValue,
        dedupeKey,
      },
    });
  }

  findAll() {
    return this.prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.alert.delete({ where: { id } });
    return { deleted: true, id };
  }
}
