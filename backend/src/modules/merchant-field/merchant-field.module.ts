import { Module } from '@nestjs/common';
import { MerchantFieldController } from './merchant-field.controller';
import { MerchantFieldService } from './merchant-field.service';

@Module({
  controllers: [MerchantFieldController],
  providers: [MerchantFieldService],
})
export class MerchantFieldModule {}
