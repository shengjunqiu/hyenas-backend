import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateDatabaseRecordDto {
  @ApiPropertyOptional({ description: '数据内容 JSON', type: Object })
  @IsOptional()
  @IsObject()
  dataJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '来源名称' })
  @IsOptional()
  @IsString()
  sourceName?: string;
}
