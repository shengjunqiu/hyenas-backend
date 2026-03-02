import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {
      name: '超级管理员',
      role: AdminRole.SUPER,
      status: AdminStatus.ENABLED,
    },
    create: {
      username: 'admin',
      passwordHash: defaultPasswordHash,
      name: '超级管理员',
      role: AdminRole.SUPER,
      status: AdminStatus.ENABLED,
    },
  });

  await prisma.merchantStatus.createMany({
    data: [
      { name: '待审核', code: 'PENDING_REVIEW', color: '#faad14', sort: 1 },
      { name: '正常经营', code: 'NORMAL', color: '#52c41a', sort: 2 },
      { name: '暂停经营', code: 'SUSPENDED', color: '#d9d9d9', sort: 3 },
      { name: '整改中', code: 'RECTIFICATION', color: '#fa8c16', sort: 4 },
      { name: '已停业', code: 'CLOSED', color: '#ff4d4f', sort: 5 },
      { name: '已注销', code: 'CANCELLED', color: '#595959', sort: 6 },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
