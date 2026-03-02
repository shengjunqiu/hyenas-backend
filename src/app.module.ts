import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantFieldModule } from './modules/merchant-field/merchant-field.module';
import { MerchantStatusModule } from './modules/merchant-status/merchant-status.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    MerchantStatusModule,
    MerchantFieldModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
