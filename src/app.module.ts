import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantAssignModule } from './modules/merchant-assign/merchant-assign.module';
import { MerchantFieldModule } from './modules/merchant-field/merchant-field.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { MerchantStatusModule } from './modules/merchant-status/merchant-status.module';
import { OperationLogModule } from './modules/operation-log/operation-log.module';
import { PrismaModule } from './prisma/prisma.module';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    MerchantStatusModule,
    MerchantFieldModule,
    MerchantModule,
    MerchantAssignModule,
    OperationLogModule,
  ],
  controllers: [AppController],
  providers: [AppService, OperationLogInterceptor],
})
export class AppModule {}
