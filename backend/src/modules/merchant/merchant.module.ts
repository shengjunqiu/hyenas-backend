import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantAccessService } from './merchant-access.service';
import { MerchantService } from './merchant.service';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, MerchantAccessService],
  exports: [MerchantAccessService],
})
export class MerchantModule {}
