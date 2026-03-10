import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  AdminStatus,
  DataTemplate,
  DataTemplateField,
  Prisma,
  Project,
  ProjectMemberRole,
  ProjectStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { DatabaseRecordTemplateValidatorService } from '../database-record/database-record-template-validator.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { AssignProjectAdminDto } from './dto/assign-project-admin.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ImportProjectRecordsDto } from './dto/import-project-records.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { QueryProjectRecordDto } from './dto/query-project-record.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectRecordDto } from './dto/update-project-record.dto';
import { ProjectPermissionService } from './project-permission.service';

type TemplateWithFields = DataTemplate & { fields: DataTemplateField[] };

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectPermissionService: ProjectPermissionService,
    private readonly templateValidator: DatabaseRecordTemplateValidatorService,
  ) {}

  async query(query: QueryProjectDto, operator: CurrentUser) {
    const where = this.buildProjectWhere(query, operator);
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, code: true },
          },
          projectAdmin: {
            select: { id: true, username: true, name: true },
          },
          creator: {
            select: { id: true, username: true, name: true },
          },
          _count: {
            select: {
              members: true,
              records: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        description: item.description,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        template: item.template,
        projectAdmin: item.projectAdmin,
        creator: item.creator,
        memberCount: item._count.members,
        recordCount: item._count.records,
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async detail(id: number, operator: CurrentUser) {
    await this.projectPermissionService.ensureProjectAccessible(id, operator);

    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            code: true,
            isEnabled: true,
            status: true,
          },
        },
        projectAdmin: {
          select: { id: true, username: true, name: true, phone: true },
        },
        creator: {
          select: { id: true, username: true, name: true },
        },
        members: {
          include: {
            admin: {
              select: {
                id: true,
                username: true,
                name: true,
                phone: true,
                status: true,
              },
            },
            assigner: {
              select: { id: true, username: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            records: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return {
      ...project,
      recordCount: project._count.records,
    };
  }

  async create(dto: CreateProjectDto, operator: CurrentUser) {
    this.ensureSuper(operator);
    await this.ensureProjectCodeUnique(dto.code);
    const template = await this.findTemplateForProject(dto.templateId);
    this.ensureDateRange(dto.startDate, dto.endDate);

    const created = await this.prisma.project.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        templateId: template.id,
        status: dto.status ?? ProjectStatus.DRAFT,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdBy: operator.id,
      },
      include: {
        template: true,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_PROJECT',
      operator,
      targetId: created.id,
      targetName: created.name,
      afterData: this.projectToPlainObject(created),
    });

    return created;
  }

  async update(id: number, dto: UpdateProjectDto, operator: CurrentUser) {
    const existing =
      operator.role === AdminRole.SUPER
        ? await this.findProjectOrThrow(id)
        : await this.projectPermissionService.ensureProjectAdmin(id, operator);

    if (dto.code && dto.code !== existing.code) {
      await this.ensureProjectCodeUnique(dto.code);
    }

    this.ensureDateRange(
      dto.startDate === undefined
        ? existing.startDate?.toISOString()
        : dto.startDate,
      dto.endDate === undefined ? existing.endDate?.toISOString() : dto.endDate,
    );

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        status: dto.status,
        startDate:
          dto.startDate === undefined
            ? undefined
            : dto.startDate === null
              ? null
              : new Date(dto.startDate),
        endDate:
          dto.endDate === undefined
            ? undefined
            : dto.endDate === null
              ? null
              : new Date(dto.endDate),
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_PROJECT',
      operator,
      targetId: updated.id,
      targetName: updated.name,
      beforeData: this.projectToPlainObject(existing),
      afterData: this.projectToPlainObject(updated),
    });

    return updated;
  }

  async remove(id: number, operator: CurrentUser) {
    this.ensureSuper(operator);
    const existing = await this.findProjectOrThrow(id);

    await this.prisma.project.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.writeOperationLog({
      action: 'DELETE_PROJECT',
      operator,
      targetId: existing.id,
      targetName: existing.name,
      beforeData: this.projectToPlainObject(existing),
    });

    return null;
  }

  async assignAdmin(
    id: number,
    dto: AssignProjectAdminDto,
    operator: CurrentUser,
  ) {
    this.ensureSuper(operator);
    const project = await this.findProjectOrThrow(id);
    const admin = await this.prisma.admin.findUnique({
      where: { id: dto.adminId },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    if (admin.role !== AdminRole.NORMAL) {
      throw new BadRequestException('项目管理员只能分配给普通管理员');
    }

    if (admin.status !== AdminStatus.ENABLED) {
      throw new BadRequestException('只能分配启用中的普通管理员');
    }

    const beforeData = {
      projectAdminId: project.projectAdminId,
    } as Prisma.InputJsonValue;

    await this.prisma.$transaction(async (tx) => {
      if (project.projectAdminId && project.projectAdminId !== dto.adminId) {
        await tx.projectMember.deleteMany({
          where: {
            projectId: id,
            adminId: project.projectAdminId,
            role: ProjectMemberRole.PROJECT_ADMIN,
          },
        });
      }

      await tx.project.update({
        where: { id },
        data: {
          projectAdminId: dto.adminId,
        },
      });

      const existingRelation = await tx.projectMember.findFirst({
        where: {
          projectId: id,
          adminId: dto.adminId,
        },
      });

      if (existingRelation) {
        await tx.projectMember.update({
          where: { id: existingRelation.id },
          data: {
            role: ProjectMemberRole.PROJECT_ADMIN,
            assignedBy: operator.id,
          },
        });
      } else {
        await tx.projectMember.create({
          data: {
            projectId: id,
            adminId: dto.adminId,
            role: ProjectMemberRole.PROJECT_ADMIN,
            assignedBy: operator.id,
          },
        });
      }
    });

    const updated = await this.prisma.project.findUnique({
      where: { id },
      include: {
        projectAdmin: {
          select: { id: true, username: true, name: true, phone: true },
        },
      },
    });

    await this.writeOperationLog({
      action: 'ASSIGN_PROJECT_ADMIN',
      operator,
      targetId: project.id,
      targetName: project.name,
      beforeData,
      afterData: {
        projectAdminId: dto.adminId,
      } as Prisma.InputJsonValue,
      module: 'PROJECT_MEMBER',
      targetType: 'PROJECT',
    });

    return updated;
  }

  async getMembers(projectId: number, operator: CurrentUser) {
    if (operator.role === AdminRole.SUPER) {
      await this.findProjectOrThrow(projectId);
    } else {
      await this.projectPermissionService.ensureProjectAdmin(
        projectId,
        operator,
      );
    }

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            role: true,
            status: true,
            parentAdminId: true,
          },
        },
        assigner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addMember(
    projectId: number,
    dto: AddProjectMemberDto,
    operator: CurrentUser,
  ) {
    const { admin } =
      await this.projectPermissionService.ensureProjectMemberAssignable(
        projectId,
        operator,
        dto.adminId,
      );

    const existing = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        adminId: dto.adminId,
      },
    });

    if (existing) {
      throw new BadRequestException('该管理员已在项目成员中');
    }

    const created = await this.prisma.projectMember.create({
      data: {
        projectId,
        adminId: dto.adminId,
        role: ProjectMemberRole.PROJECT_MEMBER,
        assignedBy: operator.id,
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            role: true,
            status: true,
          },
        },
        assigner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    await this.writeOperationLog({
      action: 'ADD_PROJECT_MEMBER',
      operator,
      targetId: created.id,
      targetName: admin.name,
      afterData: {
        projectId,
        adminId: dto.adminId,
        role: ProjectMemberRole.PROJECT_MEMBER,
      } as Prisma.InputJsonValue,
      module: 'PROJECT_MEMBER',
      targetType: 'PROJECT_MEMBER',
    });

    return created;
  }

  async removeMember(
    projectId: number,
    memberId: number,
    operator: CurrentUser,
  ) {
    await this.projectPermissionService.ensureProjectAdmin(projectId, operator);

    const relation = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
      },
      include: {
        admin: true,
      },
    });

    if (!relation) {
      throw new NotFoundException('项目成员不存在');
    }

    if (relation.role === ProjectMemberRole.PROJECT_ADMIN) {
      throw new BadRequestException('项目管理员不能通过成员移除接口删除');
    }

    if (relation.admin.parentAdminId !== operator.id) {
      throw new ForbiddenException('只能移除自己名下的子管理员');
    }

    await this.prisma.projectMember.delete({
      where: { id: relation.id },
    });

    await this.writeOperationLog({
      action: 'REMOVE_PROJECT_MEMBER',
      operator,
      targetId: relation.id,
      targetName: relation.admin.name,
      beforeData: {
        projectId,
        adminId: relation.adminId,
        role: relation.role,
      } as Prisma.InputJsonValue,
      module: 'PROJECT_MEMBER',
      targetType: 'PROJECT_MEMBER',
    });

    return null;
  }

  async queryRecords(
    projectId: number,
    query: QueryProjectRecordDto,
    operator: CurrentUser,
  ) {
    const project = await this.findProjectWithTemplateOrThrow(
      projectId,
      operator,
    );
    const where: Prisma.ProjectRecordWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (query.sourcePrimaryKeyValue?.trim()) {
      where.sourcePrimaryKeyValue = {
        contains: query.sourcePrimaryKeyValue.trim(),
        mode: 'insensitive',
      };
    }

    if (query.keyword?.trim()) {
      where.OR = [
        {
          sourcePrimaryKeyValue: {
            contains: query.keyword.trim(),
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.createdAtStart || query.createdAtEnd) {
      where.createdAt = {};
      if (query.createdAtStart) {
        where.createdAt.gte = new Date(query.createdAtStart);
      }
      if (query.createdAtEnd) {
        where.createdAt.lte = new Date(query.createdAtEnd);
      }
    }

    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const [total, list] = await this.prisma.$transaction([
      this.prisma.projectRecord.count({ where }),
      this.prisma.projectRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          importer: {
            select: { id: true, username: true, name: true },
          },
          creator: {
            select: { id: true, username: true, name: true },
          },
          updater: {
            select: { id: true, username: true, name: true },
          },
          sourceRecord: {
            select: {
              id: true,
              primaryKeyValue: true,
              sourceType: true,
              sourceName: true,
              deletedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      list,
      template: {
        id: project.template.id,
        name: project.template.name,
        code: project.template.code,
        fields: project.template.fields,
      },
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async detailRecord(
    projectId: number,
    recordId: number,
    operator: CurrentUser,
  ) {
    await this.projectPermissionService.ensureProjectAccessible(
      projectId,
      operator,
    );

    const record = await this.prisma.projectRecord.findFirst({
      where: {
        id: recordId,
        projectId,
        deletedAt: null,
      },
      include: {
        template: {
          include: {
            fields: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        importer: {
          select: { id: true, username: true, name: true },
        },
        creator: {
          select: { id: true, username: true, name: true },
        },
        updater: {
          select: { id: true, username: true, name: true },
        },
        sourceRecord: {
          select: {
            id: true,
            primaryKeyValue: true,
            sourceType: true,
            sourceName: true,
            dataJson: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('项目数据不存在');
    }

    return record;
  }

  async updateRecord(
    projectId: number,
    recordId: number,
    dto: UpdateProjectRecordDto,
    operator: CurrentUser,
  ) {
    await this.projectPermissionService.ensureProjectAccessible(
      projectId,
      operator,
    );
    const existing = await this.findProjectRecordWithTemplateOrThrow(
      recordId,
      projectId,
    );

    const nextData =
      dto.dataJson ?? (existing.dataJson as Record<string, unknown>);
    const normalized = this.templateValidator.validateAgainstTemplate(
      existing.template,
      nextData,
    );

    const updated = await this.prisma.projectRecord.update({
      where: { id: recordId },
      data: {
        dataJson: normalized.dataJson,
        updatedBy: operator.id,
      },
    });

    await this.writeOperationLog({
      module: 'PROJECT_RECORD',
      targetType: 'PROJECT_RECORD',
      action: 'UPDATE_PROJECT_RECORD',
      operator,
      targetId: updated.id,
      targetName: updated.sourcePrimaryKeyValue,
      beforeData: this.projectRecordToPlainObject(existing),
      afterData: this.projectRecordToPlainObject(updated),
    });

    return updated;
  }

  async removeRecord(
    projectId: number,
    recordId: number,
    operator: CurrentUser,
  ) {
    await this.projectPermissionService.ensureProjectAccessible(
      projectId,
      operator,
    );
    const existing = await this.findProjectRecordWithTemplateOrThrow(
      recordId,
      projectId,
    );

    await this.prisma.projectRecord.update({
      where: { id: recordId },
      data: {
        deletedAt: new Date(),
        updatedBy: operator.id,
      },
    });

    await this.writeOperationLog({
      module: 'PROJECT_RECORD',
      targetType: 'PROJECT_RECORD',
      action: 'DELETE_PROJECT_RECORD',
      operator,
      targetId: existing.id,
      targetName: existing.sourcePrimaryKeyValue,
      beforeData: this.projectRecordToPlainObject(existing),
    });

    return null;
  }

  async importRecords(
    projectId: number,
    dto: ImportProjectRecordsDto,
    operator: CurrentUser,
  ) {
    const project = await this.findProjectWithTemplateOrThrow(
      projectId,
      operator,
      true,
    );
    const sourceRecords = await this.prisma.databaseRecord.findMany({
      where: {
        id: { in: dto.recordIds },
      },
      orderBy: { id: 'asc' },
    });

    const sourceRecordMap = new Map(
      sourceRecords.map((item) => [item.id, item]),
    );
    const missingIds = dto.recordIds.filter((id) => !sourceRecordMap.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `数据库记录不存在: ${missingIds.join(', ')}`,
      );
    }

    const mismatchedIds = sourceRecords
      .filter((item) => item.templateId !== project.templateId)
      .map((item) => item.id);
    if (mismatchedIds.length > 0) {
      throw new BadRequestException(
        `存在与项目模板不一致的数据库记录: ${mismatchedIds.join(', ')}`,
      );
    }

    const existingRelations = await this.prisma.projectRecord.findMany({
      where: {
        projectId,
        sourceRecordId: { in: dto.recordIds },
      },
    });
    const existingRelationMap = new Map(
      existingRelations.map((item) => [item.sourceRecordId, item]),
    );

    let createdCount = 0;
    let skippedCount = 0;

    let importLogId: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      for (const recordId of dto.recordIds) {
        const sourceRecord = sourceRecordMap.get(recordId)!;
        const existingRelation = existingRelationMap.get(recordId);

        if (existingRelation && !existingRelation.deletedAt) {
          skippedCount += 1;
          continue;
        }

        if (existingRelation?.deletedAt) {
          await tx.projectRecord.update({
            where: { id: existingRelation.id },
            data: {
              dataJson: sourceRecord.dataJson as Prisma.InputJsonValue,
              sourcePrimaryKeyValue: sourceRecord.primaryKeyValue,
              importedBy: operator.id,
              updatedBy: operator.id,
              deletedAt: null,
            },
          });
          createdCount += 1;
          continue;
        }

        await tx.projectRecord.create({
          data: {
            projectId,
            templateId: project.templateId,
            sourceRecordId: sourceRecord.id,
            sourcePrimaryKeyValue: sourceRecord.primaryKeyValue,
            dataJson: sourceRecord.dataJson as Prisma.InputJsonValue,
            importedBy: operator.id,
            createdBy: operator.id,
          },
        });
        createdCount += 1;
      }

      const importLog = await tx.projectImportLog.create({
        data: {
          projectId,
          templateId: project.templateId,
          recordIdsJson: dto.recordIds as unknown as Prisma.InputJsonValue,
          totalCount: dto.recordIds.length,
          createdCount,
          skippedCount,
          operatorId: operator.id,
        },
      });
      importLogId = importLog.id;
    });

    await this.writeOperationLog({
      module: 'PROJECT_IMPORT',
      targetType: 'PROJECT_IMPORT_LOG',
      action: 'IMPORT_PROJECT_RECORDS',
      operator,
      targetId: importLogId ?? project.id,
      targetName: project.name,
      afterData: {
        recordIds: dto.recordIds,
        totalCount: dto.recordIds.length,
        createdCount,
        skippedCount,
      } as Prisma.InputJsonValue,
    });

    return {
      totalCount: dto.recordIds.length,
      createdCount,
      skippedCount,
    };
  }

  private buildProjectWhere(
    query: QueryProjectDto,
    operator: CurrentUser,
  ): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
    };

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (query.templateId) {
      where.templateId = query.templateId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDateStart || query.startDateEnd) {
      where.startDate = {};
      if (query.startDateStart) {
        where.startDate.gte = new Date(query.startDateStart);
      }
      if (query.startDateEnd) {
        where.startDate.lte = new Date(query.startDateEnd);
      }
    }

    if (operator.role !== AdminRole.SUPER) {
      where.AND = [
        {
          OR: [
            { projectAdminId: operator.id },
            { members: { some: { adminId: operator.id } } },
          ],
        },
      ];
    }

    return where;
  }

  private async ensureProjectCodeUnique(code: string) {
    const existing = await this.prisma.project.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('项目编码已存在');
    }
  }

  private async findTemplateForProject(templateId: number) {
    const template = await this.prisma.dataTemplate.findFirst({
      where: {
        id: templateId,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    if (!template) {
      throw new BadRequestException('模板不存在或未启用');
    }

    return template;
  }

  private async findProjectWithTemplateOrThrow(
    id: number,
    operator: CurrentUser,
    requireAdmin = false,
  ) {
    if (requireAdmin) {
      if (operator.role === AdminRole.SUPER) {
        await this.findProjectOrThrow(id);
      } else {
        await this.projectPermissionService.ensureProjectAdmin(id, operator);
      }
    } else {
      await this.projectPermissionService.ensureProjectAccessible(id, operator);
    }

    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        template: {
          include: {
            fields: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project as typeof project & { template: TemplateWithFields };
  }

  private async findProjectOrThrow(id: number) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  private async findProjectRecordWithTemplateOrThrow(
    recordId: number,
    projectId: number,
  ) {
    const record = await this.prisma.projectRecord.findFirst({
      where: {
        id: recordId,
        projectId,
        deletedAt: null,
      },
      include: {
        template: {
          include: {
            fields: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('项目数据不存在');
    }

    return record as typeof record & { template: TemplateWithFields };
  }

  private ensureDateRange(startDate?: string | null, endDate?: string | null) {
    if (!startDate || !endDate) {
      return;
    }

    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }
  }

  private ensureSuper(operator: CurrentUser) {
    if (operator.role !== AdminRole.SUPER) {
      throw new ForbiddenException('仅超级管理员可执行该操作');
    }
  }

  private projectToPlainObject(project: {
    id: number;
    name: string;
    code: string;
    templateId: number;
    description: string | null;
    status: ProjectStatus;
    projectAdminId: number | null;
    startDate: Date | null;
    endDate: Date | null;
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: project.id,
      name: project.name,
      code: project.code,
      templateId: project.templateId,
      description: project.description,
      status: project.status,
      projectAdminId: project.projectAdminId,
      startDate: project.startDate,
      endDate: project.endDate,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
    };
  }

  private projectRecordToPlainObject(record: {
    id: number;
    projectId: number;
    templateId: number;
    sourceRecordId: number;
    sourcePrimaryKeyValue: string;
    dataJson: Prisma.JsonValue;
    importedBy: number;
    createdBy: number;
    updatedBy: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: record.id,
      projectId: record.projectId,
      templateId: record.templateId,
      sourceRecordId: record.sourceRecordId,
      sourcePrimaryKeyValue: record.sourcePrimaryKeyValue,
      dataJson: record.dataJson,
      importedBy: record.importedBy,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  private async writeOperationLog(params: {
    action: string;
    operator: CurrentUser;
    targetId: number;
    targetName: string;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    module?: string;
    targetType?: string;
  }) {
    const {
      action,
      operator,
      targetId,
      targetName,
      beforeData,
      afterData,
      module,
      targetType,
    } = params;

    await this.prisma.operationLog.create({
      data: {
        module: module ?? 'PROJECT',
        action,
        targetType: targetType ?? 'PROJECT',
        targetId,
        targetName,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
