import { AdminRole, AdminStatus } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  username: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  tokenType: 'access' | 'refresh';
}
