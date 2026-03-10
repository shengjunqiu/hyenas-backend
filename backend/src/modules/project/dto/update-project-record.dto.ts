import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateProjectRecordDto {
  @ApiPropertyOptional({ description: '项目数据内容 JSON', type: Object })
  @IsOptional()
  @IsObject()
  dataJson?: Record<string, unknown>;
}
