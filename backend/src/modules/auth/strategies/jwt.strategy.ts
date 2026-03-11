import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminRole, AdminStatus } from '@prisma/client';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', ''),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Token 类型无效');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        parentAdminId: true,
        parentAdmin: {
          select: {
            status: true,
          },
        },
      },
    });
    if (!admin || admin.status !== AdminStatus.ENABLED) {
      throw new UnauthorizedException('账号已被禁用');
    }
    if (
      admin.role === AdminRole.SUB_ADMIN &&
      (!admin.parentAdminId ||
        admin.parentAdmin?.status !== AdminStatus.ENABLED)
    ) {
      throw new UnauthorizedException('上级管理员不可用');
    }

    return {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      status: admin.status,
      parentAdminId: admin.parentAdminId,
    };
  }
}
