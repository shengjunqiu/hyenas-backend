import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  AdminStatus,
  Project,
  ProjectMemberRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';

@Injectable()
export class ProjectPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProjectAccessible(projectId: number, user: CurrentUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        members: {
          where: { adminId: user.id },
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    if (user.role === AdminRole.SUPER) {
      return project;
    }

    const isProjectAdmin = project.projectAdminId === user.id;
    const isMember = project.members.length > 0;
    if (!isProjectAdmin && !isMember) {
      throw new ForbiddenException('无权访问该项目');
    }

    return project;
  }

  async ensureProjectAdmin(projectId: number, user: CurrentUser) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    if (user.role === AdminRole.SUPER) {
      return project;
    }

    if (project.projectAdminId !== user.id) {
      throw new ForbiddenException('无权管理该项目');
    }

    return project;
  }

  async ensureProjectMemberAssignable(
    projectId: number,
    operator: CurrentUser,
    memberId: number,
  ) {
    const project = await this.ensureProjectAdmin(projectId, operator);

    if (project.projectAdminId === memberId) {
      throw new ForbiddenException('项目管理员本人不能作为项目成员重复分配');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: memberId },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    if (admin.role !== AdminRole.NORMAL) {
      throw new ForbiddenException('只能分配普通管理员为项目成员');
    }

    if (admin.status !== AdminStatus.ENABLED) {
      throw new ForbiddenException('只能分配启用中的管理员');
    }

    if (admin.parentAdminId !== operator.id) {
      throw new ForbiddenException('只能分配自己名下的子管理员');
    }

    const adminRelation = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        adminId: operator.id,
        role: ProjectMemberRole.PROJECT_ADMIN,
      },
      select: { id: true },
    });

    if (!adminRelation) {
      throw new ForbiddenException('当前操作者不是该项目的项目管理员');
    }

    return { project, admin };
  }
}
