import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Admin, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import type { CurrentUser } from './interfaces/current-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, ip?: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username: loginDto.username },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status === AdminStatus.DISABLED) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      admin.passwordHash,
    );
    if (!isValidPassword) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this.generateTokens(admin);
    await this.writeLoginLog(admin, ip);

    return {
      ...tokens,
      user: this.mapUserInfo(admin),
    };
  }

  logout() {
    return null;
  }

  async profile(userId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    return this.mapUserInfo(admin);
  }

  async changePassword(user: CurrentUser, dto: ChangePasswordDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: user.id },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    const isValidOldPassword = await bcrypt.compare(
      dto.oldPassword,
      admin.passwordHash,
    );
    if (!isValidOldPassword) {
      throw new UnauthorizedException('旧密码不正确');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.admin.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await this.prisma.operationLog.create({
      data: {
        module: 'AUTH',
        action: 'CHANGE_PASSWORD',
        targetType: 'ADMIN',
        targetId: admin.id,
        targetName: admin.username,
        operatorId: admin.id,
        operatorName: admin.name,
      },
    });

    return null;
  }

  async refresh(refreshToken: string) {
    const secret = this.configService.get<string>('JWT_SECRET', '');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('refreshToken 类型无效');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException('用户不存在');
    }
    if (admin.status === AdminStatus.DISABLED) {
      throw new UnauthorizedException('账号已被禁用');
    }

    return this.generateTokens(admin);
  }

  private async generateTokens(admin: Admin) {
    const basePayload = {
      sub: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      status: admin.status,
    };

    const accessExpiresIn = this.resolveExpiresIn(
      'JWT_EXPIRES_IN',
      2 * 60 * 60,
    );
    const refreshExpiresIn = this.resolveExpiresIn(
      'JWT_REFRESH_EXPIRES_IN',
      7 * 24 * 60 * 60,
    );

    const accessToken = await this.jwtService.signAsync(
      {
        ...basePayload,
        tokenType: 'access',
      } satisfies JwtPayload,
      {
        expiresIn: accessExpiresIn,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        ...basePayload,
        tokenType: 'refresh',
      } satisfies JwtPayload,
      {
        expiresIn: refreshExpiresIn,
      },
    );

    return { accessToken, refreshToken };
  }

  private mapUserInfo(admin: Admin) {
    return {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      status: admin.status,
    };
  }

  private async writeLoginLog(admin: Admin, ip?: string) {
    await this.prisma.operationLog.create({
      data: {
        module: 'AUTH',
        action: 'LOGIN',
        targetType: 'ADMIN',
        targetId: admin.id,
        targetName: admin.username,
        operatorId: admin.id,
        operatorName: admin.name,
        ip,
      },
    });
  }

  private resolveExpiresIn(key: string, fallbackSeconds: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallbackSeconds;
    }

    if (/^\d+$/.test(raw)) {
      return Number(raw);
    }

    const match = raw.match(/^(\d+)([smhd])$/i);
    if (!match) {
      return fallbackSeconds;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') {
      return amount;
    }
    if (unit === 'm') {
      return amount * 60;
    }
    if (unit === 'h') {
      return amount * 60 * 60;
    }
    if (unit === 'd') {
      return amount * 24 * 60 * 60;
    }
    return fallbackSeconds;
  }
}
