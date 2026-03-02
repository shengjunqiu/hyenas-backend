import { AdminRole, AdminStatus } from '@prisma/client';

export interface CurrentUser {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
}
