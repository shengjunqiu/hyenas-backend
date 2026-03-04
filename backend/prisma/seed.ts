import {
  PrismaClient,
  Prisma,
  AdminRole,
  AdminStatus,
  MerchantFieldType,
} from '@prisma/client';
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

  await prisma.admin.upsert({
    where: { username: 'zhangsan' },
    update: {
      name: '张三',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000001',
    },
    create: {
      username: 'zhangsan',
      passwordHash: defaultPasswordHash,
      name: '张三',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000001',
    },
  });

  await prisma.admin.upsert({
    where: { username: 'lisi' },
    update: {
      name: '李四',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000002',
    },
    create: {
      username: 'lisi',
      passwordHash: defaultPasswordHash,
      name: '李四',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000002',
    },
  });

  await prisma.admin.upsert({
    where: { username: 'wangwu' },
    update: {
      name: '王五',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000003',
    },
    create: {
      username: 'wangwu',
      passwordHash: defaultPasswordHash,
      name: '王五',
      role: AdminRole.NORMAL,
      status: AdminStatus.ENABLED,
      phone: '13800000003',
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

  await prisma.merchantFieldDef.createMany({
    data: [
      {
        fieldKey: 'riskLevel',
        fieldName: '风险等级',
        fieldType: MerchantFieldType.SELECT,
        isRequired: false,
        isEnabled: true,
        isSearchable: true,
        optionsJson: ['低风险', '中风险', '高风险'],
        sort: 1,
      },
      {
        fieldKey: 'dailyFlow',
        fieldName: '日均客流',
        fieldType: MerchantFieldType.NUMBER,
        isRequired: false,
        isEnabled: true,
        isSearchable: true,
        sort: 2,
      },
      {
        fieldKey: 'inspectionTags',
        fieldName: '巡检标签',
        fieldType: MerchantFieldType.MULTI_SELECT,
        isRequired: false,
        isEnabled: true,
        isSearchable: false,
        optionsJson: ['冷链', '散装食品', '网络经营', '校园周边'],
        sort: 3,
      },
    ],
    skipDuplicates: true,
  });

  const statuses = await prisma.merchantStatus.findMany({
    where: {
      code: {
        in: [
          'PENDING_REVIEW',
          'NORMAL',
          'SUSPENDED',
          'RECTIFICATION',
          'CLOSED',
          'CANCELLED',
        ],
      },
    },
  });
  const statusMap = new Map(statuses.map((item) => [item.code, item.id]));

  const admins = await prisma.admin.findMany({
    where: { username: { in: ['admin', 'zhangsan', 'lisi', 'wangwu'] } },
    select: { id: true, username: true },
  });
  const adminMap = new Map(admins.map((item) => [item.username, item.id]));

  const merchantFieldDefs = await prisma.merchantFieldDef.findMany({
    where: { fieldKey: { in: ['riskLevel', 'dailyFlow', 'inspectionTags'] } },
    select: { id: true, fieldKey: true },
  });
  const fieldDefMap = new Map(merchantFieldDefs.map((item) => [item.fieldKey, item.id]));

  const merchantSeeds: Array<{
    name: string;
    creditCode: string;
    contactName: string;
    contactPhone: string;
    address: string;
    supervisionAgency?: string;
    licenseNo: string;
    businessType: string;
    statusCode: string;
    remark: string;
  }> = [
    {
      name: '海淀安心超市',
      creditCode: '91110108MA00000001',
      contactName: '赵敏',
      contactPhone: '13900000001',
      address: '北京市海淀区中关村南大街1号',
      supervisionAgency: '海淀区市场监督管理局中关村所',
      licenseNo: 'JY11101080000001',
      businessType: '商超',
      statusCode: 'NORMAL',
      remark: '重点保供商超',
    },
    {
      name: '朝阳鲜食便利店',
      creditCode: '91110105MA00000002',
      contactName: '钱磊',
      contactPhone: '13900000002',
      address: '北京市朝阳区三里屯路88号',
      supervisionAgency: '朝阳区市场监督管理局三里屯所',
      licenseNo: 'JY11101050000002',
      businessType: '便利店',
      statusCode: 'PENDING_REVIEW',
      remark: '新开业待审核',
    },
    {
      name: '丰台老味道餐馆',
      creditCode: '91110106MA00000003',
      contactName: '孙悦',
      contactPhone: '13900000003',
      address: '北京市丰台区马家堡西路10号',
      supervisionAgency: '丰台区市场监督管理局马家堡所',
      licenseNo: 'JY21101060000003',
      businessType: '餐饮',
      statusCode: 'RECTIFICATION',
      remark: '后厨整改中',
    },
    {
      name: '西城果蔬批发点',
      creditCode: '91110102MA00000004',
      contactName: '李梅',
      contactPhone: '13900000004',
      address: '北京市西城区新街口外大街19号',
      supervisionAgency: '西城区市场监督管理局新街口所',
      licenseNo: 'JY31101020000004',
      businessType: '批发',
      statusCode: 'NORMAL',
      remark: '',
    },
    {
      name: '东城校园食堂档口A',
      creditCode: '91110101MA00000005',
      contactName: '郑杰',
      contactPhone: '13900000005',
      address: '北京市东城区景山前街4号',
      supervisionAgency: '东城区市场监督管理局景山所',
      licenseNo: 'JY21101010000005',
      businessType: '食堂',
      statusCode: 'SUSPENDED',
      remark: '暂时停业',
    },
    {
      name: '通州冷链仓配中心',
      creditCode: '91110112MA00000006',
      contactName: '周航',
      contactPhone: '13900000006',
      address: '北京市通州区台湖镇物流园路6号',
      supervisionAgency: '通州区市场监督管理局台湖所',
      licenseNo: 'JY41101120000006',
      businessType: '冷链仓储',
      statusCode: 'NORMAL',
      remark: '冷链重点企业',
    },
    {
      name: '顺义烘焙工坊',
      creditCode: '91110113MA00000007',
      contactName: '吴迪',
      contactPhone: '13900000007',
      address: '北京市顺义区后沙峪镇裕民大街7号',
      supervisionAgency: '顺义区市场监督管理局后沙峪所',
      licenseNo: 'JY21101130000007',
      businessType: '烘焙',
      statusCode: 'NORMAL',
      remark: '',
    },
    {
      name: '昌平清真餐厅',
      creditCode: '91110114MA00000008',
      contactName: '马军',
      contactPhone: '13900000008',
      address: '北京市昌平区回龙观西大街18号',
      supervisionAgency: '昌平区市场监督管理局回龙观所',
      licenseNo: 'JY21101140000008',
      businessType: '餐饮',
      statusCode: 'NORMAL',
      remark: '民族特色餐饮',
    },
    {
      name: '大兴农贸市场12号档',
      creditCode: '91110115MA00000009',
      contactName: '何超',
      contactPhone: '13900000009',
      address: '北京市大兴区黄村镇市场路12号',
      supervisionAgency: '大兴区市场监督管理局黄村所',
      licenseNo: 'JY51101150000009',
      businessType: '农贸市场摊位',
      statusCode: 'PENDING_REVIEW',
      remark: '首次备案',
    },
    {
      name: '门头沟山货特产店',
      creditCode: '91110109MA00000010',
      contactName: '高峰',
      contactPhone: '13900000010',
      address: '北京市门头沟区永定镇滨河路10号',
      supervisionAgency: '门头沟区市场监督管理局永定所',
      licenseNo: 'JY11101090000010',
      businessType: '特产零售',
      statusCode: 'CLOSED',
      remark: '季节性停业',
    },
    {
      name: '石景山社区配餐点',
      creditCode: '91110107MA00000011',
      contactName: '韩雪',
      contactPhone: '13900000011',
      address: '北京市石景山区鲁谷路11号',
      supervisionAgency: '石景山区市场监督管理局鲁谷所',
      licenseNo: 'JY21101070000011',
      businessType: '配餐',
      statusCode: 'NORMAL',
      remark: '',
    },
    {
      name: '怀柔山泉水站',
      creditCode: '91110116MA00000012',
      contactName: '曹阳',
      contactPhone: '13900000012',
      address: '北京市怀柔区雁栖镇京加路12号',
      supervisionAgency: '怀柔区市场监督管理局雁栖所',
      licenseNo: 'JY61101160000012',
      businessType: '饮用水销售',
      statusCode: 'CANCELLED',
      remark: '已注销留档',
    },
  ];

  const seedOperatorId = adminMap.get('admin');
  if (!seedOperatorId) {
    throw new Error('Seed failed: admin user not found.');
  }

  const createdMerchants: Array<{ id: number; creditCode: string | null }> = [];
  for (const item of merchantSeeds) {
    const statusId = statusMap.get(item.statusCode);
    if (!statusId) {
      throw new Error(`Seed failed: merchant status ${item.statusCode} not found.`);
    }
    const exists = await prisma.merchant.findFirst({
      where: { creditCode: item.creditCode, deletedAt: null },
      select: { id: true },
    });
    const merchant = exists
      ? await prisma.merchant.update({
          where: { id: exists.id },
          data: {
            name: item.name,
            contactName: item.contactName,
            contactPhone: item.contactPhone,
            address: item.address,
            supervisionAgency: item.supervisionAgency ?? '属地市场监督管理所',
            licenseNo: item.licenseNo,
            businessType: item.businessType,
            statusId,
            remark: item.remark,
            createdBy: seedOperatorId,
            deletedAt: null,
          },
          select: { id: true, creditCode: true },
        })
      : await prisma.merchant.create({
          data: {
            name: item.name,
            creditCode: item.creditCode,
            contactName: item.contactName,
            contactPhone: item.contactPhone,
            address: item.address,
            supervisionAgency: item.supervisionAgency ?? '属地市场监督管理所',
            licenseNo: item.licenseNo,
            businessType: item.businessType,
            statusId,
            remark: item.remark,
            createdBy: seedOperatorId,
          },
          select: { id: true, creditCode: true },
        });
    createdMerchants.push(merchant);
  }

  const assignmentPlan: Record<string, string[]> = {
    zhangsan: ['91110108MA00000001', '91110106MA00000003', '91110112MA00000006'],
    lisi: ['91110105MA00000002', '91110114MA00000008', '91110115MA00000009'],
    wangwu: ['91110113MA00000007', '91110107MA00000011', '91110116MA00000012'],
  };

  for (const [username, creditCodes] of Object.entries(assignmentPlan)) {
    const adminId = adminMap.get(username);
    if (!adminId) {
      continue;
    }
    const merchantIds = createdMerchants
      .filter((item) => creditCodes.includes(item.creditCode ?? ''))
      .map((item) => item.id);
    if (!merchantIds.length) {
      continue;
    }
    await prisma.merchantAdmin.createMany({
      data: merchantIds.map((merchantId) => ({
        merchantId,
        adminId,
        assignedBy: seedOperatorId,
      })),
      skipDuplicates: true,
    });
  }

  const riskFieldId = fieldDefMap.get('riskLevel');
  const flowFieldId = fieldDefMap.get('dailyFlow');
  const tagFieldId = fieldDefMap.get('inspectionTags');
  if (!riskFieldId || !flowFieldId || !tagFieldId) {
    throw new Error('Seed failed: merchant custom field definitions not found.');
  }

  const fieldValuePlan: Record<
    string,
    { riskLevel: string; dailyFlow: string; inspectionTags: string[] }
  > = {
    '91110108MA00000001': {
      riskLevel: '低风险',
      dailyFlow: '1800',
      inspectionTags: ['散装食品', '校园周边'],
    },
    '91110106MA00000003': {
      riskLevel: '高风险',
      dailyFlow: '320',
      inspectionTags: ['网络经营'],
    },
    '91110112MA00000006': {
      riskLevel: '中风险',
      dailyFlow: '90',
      inspectionTags: ['冷链'],
    },
    '91110114MA00000008': {
      riskLevel: '中风险',
      dailyFlow: '650',
      inspectionTags: ['校园周边'],
    },
    '91110115MA00000009': {
      riskLevel: '高风险',
      dailyFlow: '420',
      inspectionTags: ['散装食品'],
    },
  };

  for (const merchant of createdMerchants) {
    if (!merchant.creditCode) {
      continue;
    }
    const value = fieldValuePlan[merchant.creditCode];
    if (!value) {
      continue;
    }
    await prisma.merchantFieldValue.upsert({
      where: {
        merchantId_fieldDefId: { merchantId: merchant.id, fieldDefId: riskFieldId },
      },
      update: { valueText: value.riskLevel, valueJson: Prisma.JsonNull },
      create: {
        merchantId: merchant.id,
        fieldDefId: riskFieldId,
        valueText: value.riskLevel,
      },
    });
    await prisma.merchantFieldValue.upsert({
      where: {
        merchantId_fieldDefId: { merchantId: merchant.id, fieldDefId: flowFieldId },
      },
      update: { valueText: value.dailyFlow, valueJson: Prisma.JsonNull },
      create: {
        merchantId: merchant.id,
        fieldDefId: flowFieldId,
        valueText: value.dailyFlow,
      },
    });
    await prisma.merchantFieldValue.upsert({
      where: {
        merchantId_fieldDefId: { merchantId: merchant.id, fieldDefId: tagFieldId },
      },
      update: { valueText: null, valueJson: value.inspectionTags as Prisma.JsonArray },
      create: {
        merchantId: merchant.id,
        fieldDefId: tagFieldId,
        valueJson: value.inspectionTags as Prisma.JsonArray,
      },
    });
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
