import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProjectController } from './project.controller';
import { ProjectPermissionService } from './project-permission.service';
import { ProjectService } from './project.service';

@Module({
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectPermissionService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [ProjectPermissionService, ProjectService],
})
export class ProjectModule {}
