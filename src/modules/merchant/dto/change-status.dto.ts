import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChangeStatusDto {
  @ApiProperty({ description: '新状态 ID' })
  @Type(() => Number)
  @IsInt()
  statusId: number;

  @ApiPropertyOptional({ description: '变更备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
