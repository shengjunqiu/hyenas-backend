import { Module } from '@nestjs/common';
import { MerchantAccessService } from '../merchant/merchant-access.service';
import { MerchantAssignController } from './merchant-assign.controller';
import { MerchantAssignService } from './merchant-assign.service';

@Module({
  controllers: [MerchantAssignController],
  providers: [MerchantAssignService, MerchantAccessService],
})
export class MerchantAssignModule {}
