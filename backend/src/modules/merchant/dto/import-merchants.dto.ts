import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return value;
};

export class ImportMerchantsDto {
  @ApiPropertyOptional({
    description: '是否使用 Excel 中的非空字段覆盖同名商家的已有信息',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  overwriteExisting?: boolean;

  @ApiPropertyOptional({
    description: '是否返回导入调试信息',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  debug?: boolean;
}
