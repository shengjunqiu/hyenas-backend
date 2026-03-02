import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateMerchantCustomFieldsDto {
  @ApiProperty({ description: '自定义字段值（key: fieldKey）' })
  @IsObject()
  values: Record<string, unknown>;
}
