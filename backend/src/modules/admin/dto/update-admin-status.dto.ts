import { ApiProperty } from '@nestjs/swagger';
import { AdminStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAdminStatusDto {
  @ApiProperty({ enum: AdminStatus, description: '账号状态' })
  @IsEnum(AdminStatus)
  status: AdminStatus;
}
