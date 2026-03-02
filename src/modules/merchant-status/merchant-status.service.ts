import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MerchantStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { CreateMerchantStatusDto } from './dto/create-merchant-status.dto';
import { ToggleMerchantStatusDto } from './dto/toggle-merchant-status.dto';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';

@Injectable()
export class MerchantStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.merchantStatus.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateMerchantStatusDto, operator: CurrentUser) {
    const exists = await this.prisma.merchantStatus.findUnique({
      where: { code: dto.code },
    });
    if (exists) {
      throw new BadRequestException('状态编码已存在');
    }

    const created = await this.prisma.merchantStatus.create({
      data: {
        name: dto.name,
        code: dto.code,
        color: dto.color,
        sort: dto.sort ?? 0,
        remark: dto.remark,
        isEnabled: true,
      },
    });

    await this.writeOperationLog({
      action: 'CREATE_MERCHANT_STATUS',
      operator,
      target: created,
      afterData: this.statusToPlainObject(created),
    });

    return created;
  }

  async update(
    id: number,
    dto: UpdateMerchantStatusDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findByIdOrThrow(id);
    const updated = await this.prisma.merchantStatus.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
        sort: dto.sort,
        remark: dto.remark,
      },
    });

    await this.writeOperationLog({
      action: 'UPDATE_MERCHANT_STATUS',
      operator,
      target: updated,
      beforeData: this.statusToPlainObject(existing),
      afterData: this.statusToPlainObject(updated),
    });

    return updated;
  }

  async toggle(
    id: number,
    dto: ToggleMerchantStatusDto,
    operator: CurrentUser,
  ) {
    const existing = await this.findByIdOrThrow(id);
    const updated = await this.prisma.merchantStatus.update({
      where: { id },
      data: { isEnabled: dto.isEnabled },
    });

    await this.writeOperationLog({
      action: 'TOGGLE_MERCHANT_STATUS',
      operator,
      target: updated,
      beforeData: this.statusToPlainObject(existing),
      afterData: this.statusToPlainObject(updated),
    });

    return updated;
  }

  private async findByIdOrThrow(id: number): Promise<MerchantStatus> {
    const status = await this.prisma.merchantStatus.findUnique({
      where: { id },
    });
    if (!status) {
      throw new NotFoundException('状态模板不存在');
    }
    return status;
  }

  private statusToPlainObject(status: MerchantStatus) {
    return {
      id: status.id,
      name: status.name,
      code: status.code,
      color: status.color,
      sort: status.sort,
      isEnabled: status.isEnabled,
      remark: status.remark,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    };
  }

  private async writeOperationLog(params: {
    action: string;
    operator: CurrentUser;
    target: MerchantStatus;
    beforeData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    afterData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { action, operator, target, beforeData, afterData } = params;
    await this.prisma.operationLog.create({
      data: {
        module: 'MERCHANT_STATUS',
        action,
        targetType: 'MERCHANT_STATUS',
        targetId: target.id,
        targetName: target.name,
        operatorId: operator.id,
        operatorName: operator.name,
        beforeData,
        afterData,
      },
    });
  }
}
