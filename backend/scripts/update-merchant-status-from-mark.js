const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient, AdminRole, AdminStatus } = require('@prisma/client');

loadEnvFile(path.resolve(__dirname, '../.env'));

const prisma = new PrismaClient();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function printHelp() {
  console.log(`
用法:
  node scripts/update-merchant-status-from-mark.js [options]

选项:
  --file=PATH                JSON 文件路径，默认 ../res/mark.json
  --status-name=NAME         目标状态名称
  --status-code=CODE         目标状态编码
  --operator-id=ID           操作人管理员 ID
  --operator-username=NAME   操作人用户名
  --remark=TEXT              状态变更备注
  --dry-run                  仅预览，不写入数据库
  --help                     查看帮助

示例:
  node scripts/update-merchant-status-from-mark.js --dry-run --status-code=push
  node scripts/update-merchant-status-from-mark.js --status-code=push --operator-username=admin
  node scripts/update-merchant-status-from-mark.js --file=../res/mark.json --status-name=推流
`.trim());
}

function parseArgs(argv) {
  const options = {
    file: path.resolve(__dirname, '../../res/mark.json'),
    statusName: undefined,
    statusCode: undefined,
    operatorId: undefined,
    operatorUsername: undefined,
    remark: '根据 mark.json 批量更新状态',
    dryRun: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`不支持的参数: ${arg}`);
    }

    const separatorIndex = arg.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`参数格式错误: ${arg}，请使用 --key=value`);
    }

    const key = arg.slice(2, separatorIndex);
    const value = arg.slice(separatorIndex + 1).trim();

    switch (key) {
      case 'file':
        if (!value) {
          throw new Error('--file 不能为空');
        }
        options.file = path.resolve(process.cwd(), value);
        break;
      case 'status-name':
        if (!value) {
          throw new Error('--status-name 不能为空');
        }
        options.statusName = value;
        break;
      case 'status-code':
        if (!value) {
          throw new Error('--status-code 不能为空');
        }
        options.statusCode = value;
        break;
      case 'operator-id': {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error('--operator-id 必须是正整数');
        }
        options.operatorId = parsed;
        break;
      }
      case 'operator-username':
        if (!value) {
          throw new Error('--operator-username 不能为空');
        }
        options.operatorUsername = value;
        break;
      case 'remark':
        options.remark = value || options.remark;
        break;
      default:
        throw new Error(`不支持的参数: --${key}`);
    }
  }

  if (!options.help && !options.statusCode && !options.statusName) {
    throw new Error('请通过 --status-code 或 --status-name 指定目标状态');
  }

  return options;
}

function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

function unique(values) {
  return [...new Set(values)];
}

function readLicenseCodes(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON 文件不存在: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是数组');
  }

  const licenseCodes = parsed
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return { index, licenseCode: '' };
      }
      const value = item['许可证编码'];
      return {
        index,
        licenseCode: typeof value === 'string' ? value.trim() : '',
      };
    })
    .filter((item) => item.licenseCode.length > 0);

  return {
    totalRows: parsed.length,
    validRows: licenseCodes.length,
    uniqueLicenseCodes: unique(licenseCodes.map((item) => item.licenseCode)),
  };
}

async function resolveTargetStatus(options) {
  const where = options.statusCode
    ? { code: options.statusCode }
    : { name: options.statusName };

  const statuses = await prisma.merchantStatus.findMany({
    where,
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  if (statuses.length === 0) {
    const label = options.statusCode
      ? `状态编码 "${options.statusCode}"`
      : `状态名称 "${options.statusName}"`;
    throw new Error(`${label} 不存在`);
  }

  const enabledStatus = statuses.find((item) => item.isEnabled);
  if (!enabledStatus) {
    throw new Error(`目标状态已存在，但全部处于禁用状态`);
  }

  if (!options.statusCode && statuses.length > 1) {
    console.warn(
      `警告: 找到多个名称为 "${options.statusName}" 的状态，已使用第一个启用状态 ID=${enabledStatus.id}`,
    );
  }

  return enabledStatus;
}

async function resolveOperator(options) {
  if (options.operatorId) {
    const admin = await prisma.admin.findUnique({
      where: { id: options.operatorId },
      select: { id: true, username: true, name: true, role: true, status: true },
    });
    if (!admin) {
      throw new Error(`操作人不存在: id=${options.operatorId}`);
    }
    if (admin.status !== AdminStatus.ENABLED) {
      throw new Error(`操作人已禁用: id=${options.operatorId}`);
    }
    return admin;
  }

  if (options.operatorUsername) {
    const admin = await prisma.admin.findUnique({
      where: { username: options.operatorUsername },
      select: { id: true, username: true, name: true, role: true, status: true },
    });
    if (!admin) {
      throw new Error(`操作人不存在: username=${options.operatorUsername}`);
    }
    if (admin.status !== AdminStatus.ENABLED) {
      throw new Error(`操作人已禁用: username=${options.operatorUsername}`);
    }
    return admin;
  }

  const fallback = await prisma.admin.findFirst({
    where: {
      role: AdminRole.SUPER,
      status: AdminStatus.ENABLED,
    },
    orderBy: { id: 'asc' },
    select: { id: true, username: true, name: true, role: true, status: true },
  });

  if (!fallback) {
    throw new Error(
      '未找到可用的超级管理员，请通过 --operator-id 或 --operator-username 指定操作人',
    );
  }

  return fallback;
}

async function loadMerchantsByLicense(licenseCodes) {
  const merchants = [];
  const batches = chunk(licenseCodes, 500);

  for (const batch of batches) {
    const rows = await prisma.merchant.findMany({
      where: {
        deletedAt: null,
        licenseNo: { in: batch },
      },
      select: {
        id: true,
        name: true,
        licenseNo: true,
        statusId: true,
      },
      orderBy: { id: 'asc' },
    });
    merchants.push(...rows);
  }

  return merchants;
}

async function updateMerchantStatuses({
  merchantsToUpdate,
  targetStatus,
  operator,
  remark,
}) {
  const nowRemark = remark || '根据 mark.json 批量更新状态';
  const batches = chunk(merchantsToUpdate, 100);

  for (const batch of batches) {
    await prisma.$transaction(
      batch.flatMap((merchant) => [
        prisma.merchant.update({
          where: { id: merchant.id },
          data: { statusId: targetStatus.id },
        }),
        prisma.merchantStatusLog.create({
          data: {
            merchantId: merchant.id,
            fromStatusId: merchant.statusId,
            toStatusId: targetStatus.id,
            changedBy: operator.id,
            remark: nowRemark,
          },
        }),
        prisma.operationLog.create({
          data: {
            module: 'MERCHANT',
            action: 'CHANGE_STATUS',
            targetType: 'MERCHANT',
            targetId: merchant.id,
            targetName: merchant.name,
            operatorId: operator.id,
            operatorName: operator.name,
            beforeData: { statusId: merchant.statusId },
            afterData: {
              statusId: targetStatus.id,
              remark: nowRemark,
              source: 'scripts/update-merchant-status-from-mark.js',
            },
          },
        }),
      ]),
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const { totalRows, validRows, uniqueLicenseCodes } = readLicenseCodes(options.file);
  if (uniqueLicenseCodes.length === 0) {
    throw new Error('JSON 中没有可用的许可证编码');
  }

  const [targetStatus, operator, merchants] = await Promise.all([
    resolveTargetStatus(options),
    resolveOperator(options),
    loadMerchantsByLicense(uniqueLicenseCodes),
  ]);

  const merchantByLicense = new Map();
  for (const merchant of merchants) {
    if (!merchant.licenseNo) {
      continue;
    }
    const list = merchantByLicense.get(merchant.licenseNo) || [];
    list.push(merchant);
    merchantByLicense.set(merchant.licenseNo, list);
  }

  const matchedLicenseCodes = [];
  const missingLicenseCodes = [];
  const duplicateMerchantLicenses = [];

  for (const licenseCode of uniqueLicenseCodes) {
    const matched = merchantByLicense.get(licenseCode) || [];
    if (matched.length === 0) {
      missingLicenseCodes.push(licenseCode);
      continue;
    }
    matchedLicenseCodes.push(licenseCode);
    if (matched.length > 1) {
      duplicateMerchantLicenses.push(licenseCode);
    }
  }

  const matchedMerchants = unique(
    matchedLicenseCodes.flatMap((licenseCode) =>
      (merchantByLicense.get(licenseCode) || []).map((merchant) => merchant.id),
    ),
  ).map((merchantId) =>
    merchants.find((merchant) => merchant.id === merchantId),
  ).filter(Boolean);

  const alreadyTargetMerchants = matchedMerchants.filter(
    (merchant) => merchant.statusId === targetStatus.id,
  );
  const merchantsToUpdate = matchedMerchants.filter(
    (merchant) => merchant.statusId !== targetStatus.id,
  );

  console.log('任务信息');
  console.log(`- JSON 文件: ${options.file}`);
  console.log(`- JSON 总行数: ${totalRows}`);
  console.log(`- 有效许可证编码行数: ${validRows}`);
  console.log(`- 唯一许可证编码数: ${uniqueLicenseCodes.length}`);
  console.log(`- 目标状态: ${targetStatus.name} (ID=${targetStatus.id}, code=${targetStatus.code})`);
  console.log(`- 操作人: ${operator.name} [${operator.username}] (ID=${operator.id})`);
  console.log(`- Dry Run: ${options.dryRun ? '是' : '否'}`);
  console.log(`- 匹配到的许可证编码数: ${matchedLicenseCodes.length}`);
  console.log(`- 未匹配许可证编码数: ${missingLicenseCodes.length}`);
  console.log(`- 匹配到的商家数: ${matchedMerchants.length}`);
  console.log(`- 已经是目标状态的商家数: ${alreadyTargetMerchants.length}`);
  console.log(`- 需要更新的商家数: ${merchantsToUpdate.length}`);
  console.log(`- 对应多商家的许可证编码数: ${duplicateMerchantLicenses.length}`);

  if (duplicateMerchantLicenses.length > 0) {
    console.log(`- 多商家许可证编码示例: ${duplicateMerchantLicenses.slice(0, 20).join(', ')}`);
  }

  if (missingLicenseCodes.length > 0) {
    console.log(`- 未匹配许可证编码示例: ${missingLicenseCodes.slice(0, 20).join(', ')}`);
  }

  if (options.dryRun || merchantsToUpdate.length === 0) {
    return;
  }

  await updateMerchantStatuses({
    merchantsToUpdate,
    targetStatus,
    operator,
    remark: options.remark,
  });

  console.log(`执行完成，已更新 ${merchantsToUpdate.length} 个商家状态`);
}

main()
  .catch((error) => {
    console.error(`执行失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
