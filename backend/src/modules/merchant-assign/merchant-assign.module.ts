import { Module } from '@nestjs/common';
import { MerchantAssignController } from './merchant-assign.controller';
import { MerchantAssignService } from './merchant-assign.service';

@Module({
  controllers: [MerchantAssignController],
  providers: [MerchantAssignService],
})
export class MerchantAssignModule {}
