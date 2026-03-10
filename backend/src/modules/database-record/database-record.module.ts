import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DatabaseRecordController } from './database-record.controller';
import { DatabaseRecordService } from './database-record.service';
import { DatabaseRecordTemplateValidatorService } from './database-record-template-validator.service';

@Module({
  controllers: [DatabaseRecordController],
  providers: [
    DatabaseRecordService,
    DatabaseRecordTemplateValidatorService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class DatabaseRecordModule {}
