import { IsNumber, IsString } from 'class-validator';

export class IngestEventDto {
  @IsString()
  deviceId: string;

  @IsString()
  type: string;

  @IsNumber()
  value: number;

  @IsNumber()
  timestamp: number;
}
