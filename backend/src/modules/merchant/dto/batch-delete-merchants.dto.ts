import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class BatchDeleteMerchantsDto {
  @ApiProperty({ type: [Number], description: '商家 ID 列表' })
  @IsArray()
  @ArrayNotEmpty({ message: 'merchantIds 不能为空' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'merchantIds 必须全部是数字' })
  merchantIds: number[];
}
