import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDatabaseRecordDto {
  @ApiProperty({ description: '模板 ID' })
  @Type(() => Number)
  @IsInt()
  templateId: number;

  @ApiProperty({ description: '数据内容 JSON', type: Object })
  @IsObject()
  dataJson: Record<string, unknown>;

  @ApiPropertyOptional({ description: '来源名称' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceName?: string;
}
