import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SubAdminController } from './sub-admin.controller';

@Module({
  controllers: [AdminController, SubAdminController],
  providers: [AdminService, JwtAuthGuard, RolesGuard],
})
export class AdminModule {}
