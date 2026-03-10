import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ description: '成员管理员 ID' })
  @Type(() => Number)
  @IsInt()
  adminId: number;
}
