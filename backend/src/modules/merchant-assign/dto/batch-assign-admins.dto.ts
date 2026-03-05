import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class BatchAssignAdminsDto {
  @ApiProperty({ type: [Number], description: '商户 ID 列表' })
  @IsArray()
  @ArrayNotEmpty({ message: 'merchantIds 不能为空' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'merchantIds 必须全部是数字' })
  merchantIds: number[];

  @ApiProperty({ type: [Number], description: '管理员 ID 列表' })
  @IsArray()
  @ArrayNotEmpty({ message: 'adminIds 不能为空' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'adminIds 必须全部是数字' })
  adminIds: number[];
}
