import { Module } from '@nestjs/common';
import { MerchantStatusController } from './merchant-status.controller';
import { MerchantStatusService } from './merchant-status.service';

@Module({
  controllers: [MerchantStatusController],
  providers: [MerchantStatusService],
})
export class MerchantStatusModule {}
