import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AssignProjectAdminDto {
  @ApiProperty({ description: '项目管理员 ID' })
  @Type(() => Number)
  @IsInt()
  adminId: number;
}
