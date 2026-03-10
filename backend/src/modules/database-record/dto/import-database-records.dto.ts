import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class ImportDatabaseRecordsDto {
  @ApiProperty({ description: '模板 ID' })
  @Type(() => Number)
  @IsInt()
  templateId: number;
}
