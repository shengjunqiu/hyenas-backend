import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateMerchantStatusDto {
  @ApiProperty({ description: '状态名称', example: '待审核' })
  @IsString()
  @IsNotEmpty({ message: '状态名称不能为空' })
  name: string;

  @ApiProperty({ description: '状态编码（唯一）', example: 'PENDING_REVIEW' })
  @IsString()
  @IsNotEmpty({ message: '状态编码不能为空' })
  code: string;

  @ApiPropertyOptional({ description: '状态颜色', example: '#faad14' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
