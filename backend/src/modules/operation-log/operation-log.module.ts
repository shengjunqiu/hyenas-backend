import { Module } from '@nestjs/common';
import { OperationLogController } from './operation-log.controller';
import { OperationLogService } from './operation-log.service';

@Module({
  controllers: [OperationLogController],
  providers: [OperationLogService],
})
export class OperationLogModule {}
