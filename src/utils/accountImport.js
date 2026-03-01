/**
 * 账号导入工具：格式检测、归一化、校验
 */
import crypto from 'crypto';
import { TokenManager } from '../token.js';

// 生成 token 指纹（完整 SHA256）
function generateFingerprint(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 检测导入格式
export function detectFormat(payload) {
  // standard_v2: { version, accounts: [...] }
  if (payload.version && Array.isArray(payload.accounts)) {
    return 'standard_v2';
  }

  // 数组格式（批量导入）
  if (Array.isArray(payload)) {
    if (payload.length === 0) return 'unknown';
    const first = payload[0];

    // kiro_go_snake: refresh_token, client_id, client_secret
    if (first.refresh_token || first.client_id || first.auth_method || first.machine_id) {
      return 'kiro_go_snake';
    }

    // legacy_camel: refreshToken, clientId, clientSecret
    if (first.refreshToken || first.clientId || first.machineId) {
      return 'legacy_camel';
    }

    return 'unknown';
  }

  // 单个对象
  if (typeof payload === 'object' && payload !== null) {
    // kiro_go_snake
    if (payload.refresh_token || payload.client_id || payload.auth_method || payload.machine_id) {
      return 'kiro_go_snake';
    }

    // legacy_camel
    if (payload.refreshToken || payload.clientId || payload.machineId) {
      return 'legacy_camel';
    }
  }

  return 'unknown';
}

// 归一化单个账号记录
export function normalizeRecord(raw, format) {
  const normalized = {
    name: null,
    providerSource: 'unknown',
    credentials: {},
    email: null,
    subscriptionLevel: null
  };

  switch (format) {
    case 'legacy_camel':
      normalized.name = raw.label || raw.name || raw.email || null;
      normalized.credentials = {
        refreshToken: raw.refreshToken || raw.accessToken,
        authMethod: raw.authMethod || (raw.clientId && raw.clientSecret ? 'idc' : 'social'),
        clientId: raw.clientId || null,
        clientSecret: raw.clientSecret || null,
        region: raw.region || null,
        machineId: raw.machineId || null
      };
      normalized.email = raw.email || null;
      normalized.providerSource = raw.provider || (normalized.credentials.authMethod === 'idc' ? 'builder-id' : 'social');
      break;

    case 'kiro_go_snake':
      normalized.name = raw.label || raw.name || raw.email || null;
      normalized.credentials = {
        refreshToken: raw.refresh_token || raw.access_token,
        authMethod: raw.auth_method || (raw.client_id && raw.client_secret ? 'idc' : 'social'),
        clientId: raw.client_id || null,
        clientSecret: raw.client_secret || null,
        region: raw.region || null,
        machineId: raw.machine_id || null
      };
      normalized.email = raw.email || null;
      normalized.providerSource = raw.provider || (normalized.credentials.authMethod === 'idc' ? 'builder-id' : 'social');
      break;

    case 'standard_v2': {
      // Kiro-Go 实际导出格式：credentials 在顶层 credentials 对象中
      const creds = raw.credentials || {};
      const hasKiroGoFormat = !!raw.credentials;

      if (hasKiroGoFormat) {
        // Kiro-Go 导出格式
        normalized.name = raw.name || raw.email || null;

        // 记录哪些字段是原始数据提供的
        const hasAuthMethod = !!(creds.authMethod || creds.auth_method);
        const hasProviderSource = !!(creds.provider || raw.idp);

        normalized.credentials = {
          refreshToken: creds.refreshToken || creds.refresh_token,
          authMethod: hasAuthMethod ? ((creds.authMethod || creds.auth_method).toLowerCase() === 'idc' ? 'idc' : 'social') : undefined,
          clientId: creds.clientId || creds.client_id || null,
          clientSecret: creds.clientSecret || creds.client_secret || null,
          region: creds.region || raw.region || null,
          machineId: creds.machineId || creds.machine_id || raw.machineId || raw.machine_id || null
        };
        normalized.email = raw.email || null;
        normalized.providerSource = hasProviderSource ? (creds.provider || raw.idp) : undefined;

        // 映射 provider 名称
        if (normalized.providerSource === 'BuilderId') normalized.providerSource = 'builder-id';
        normalized.subscriptionLevel = raw.subscription?.type || raw.subscription?.title || null;
        // 映射订阅等级
        const subMap = { 'Free': 'FREE', 'Pro': 'PRO', 'Pro+': 'PRO_PLUS', 'Power': 'POWER' };
        if (subMap[normalized.subscriptionLevel]) normalized.subscriptionLevel = subMap[normalized.subscriptionLevel];
      } else {
        // 原始 standard_v2 格式（auth/meta 结构）
        const hasAuthMethod = !!(raw.auth?.authMethod || raw.auth?.auth_method);
        const hasProviderSource = !!(raw.meta?.provider || raw.meta?.providerSource);

        normalized.name = raw.name || raw.meta?.name || raw.auth?.email || null;
        normalized.credentials = {
          refreshToken: raw.auth?.refreshToken || raw.auth?.refresh_token,
          authMethod: hasAuthMethod ? (raw.auth.authMethod || raw.auth.auth_method) : undefined,
          clientId: raw.auth?.clientId || raw.auth?.client_id || null,
          clientSecret: raw.auth?.clientSecret || raw.auth?.client_secret || null,
          region: raw.meta?.region || null,
          machineId: raw.meta?.machineId || raw.meta?.machine_id || null
        };
        normalized.email = raw.meta?.email || raw.auth?.email || null;
        normalized.providerSource = hasProviderSource ? (raw.meta.provider || raw.meta.providerSource) : undefined;
        normalized.subscriptionLevel = raw.meta?.subscriptionLevel || null;
      }
      break;
    }

    default:
      throw new Error(`不支持的格式: ${format}`);
  }

  return normalized;
}

// 校验归一化后的记录
export function validateRecord(record) {
  const errors = [];

  if (!record.credentials.refreshToken) {
    errors.push('缺少 refreshToken');
  }

  if (record.credentials.authMethod === 'idc') {
    if (!record.credentials.clientId) {
      errors.push('IdC 认证方式需要 clientId');
    }
    if (!record.credentials.clientSecret) {
      errors.push('IdC 认证方式需要 clientSecret');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 批量导入处理
export async function processImport(payload, format, options, accountPool, db) {
  const detectedFormat = format === 'auto' ? detectFormat(payload) : format;

  if (detectedFormat === 'unknown') {
    throw new Error('无法识别导入格式，请指定 format 参数');
  }

  // 校验 onDuplicate 枚举值
  const validOnDuplicateValues = ['skip', 'replace', 'update'];
  if (options.onDuplicate && !validOnDuplicateValues.includes(options.onDuplicate)) {
    throw new Error(`onDuplicate 必须是以下值之一: ${validOnDuplicateValues.join(', ')}`);
  }

  // 提取账号数组
  let rawAccounts = [];
  if (detectedFormat === 'standard_v2') {
    rawAccounts = payload.accounts;
  } else if (Array.isArray(payload)) {
    rawAccounts = payload;
  } else {
    rawAccounts = [payload];
  }

  const batchId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const results = {
    batchId,
    detectedFormat,
    summary: {
      total: rawAccounts.length,
      created: 0,
      replaced: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    },
    items: []
  };

  for (let i = 0; i < rawAccounts.length; i++) {
    const raw = rawAccounts[i];
    const item = {
      index: i,
      status: 'pending',
      id: null,
      name: null,
      warnings: []
    };

    // 提升 fingerprint 到循环级作用域，供 catch 块使用
    let fingerprint = null;

    try {
      // 归一化
      const normalized = normalizeRecord(raw, detectedFormat);

      // 校验
      const validation = validateRecord(normalized);
      if (!validation.valid) {
        item.status = 'failed';
        item.errors = validation.errors;
        results.summary.failed++;
        results.items.push(item);
        continue;
      }

      // 去重检查（通过 token_fingerprint）
      fingerprint = generateFingerprint(normalized.credentials.refreshToken);

      // 检查数据库是否可用
      const existing = db ? db.getAccountByFingerprint(fingerprint) : null;

      if (existing) {
        if (options.onDuplicate === 'skip') {
          item.status = 'skipped';
          item.reason = '重复账号（已存在相同 token）';
          item.existingId = existing.id;
          results.summary.skipped++;
          results.items.push(item);
          continue;
        } else if (options.onDuplicate === 'replace') {
          // 替换模式：使用 DB 原子事务完成替换，避免中间态
          if (!options.dryRun) {
            // 为 undefined 字段补充默认值
            if (normalized.credentials.authMethod === undefined) {
              normalized.credentials.authMethod = 'social';
            }
            if (normalized.providerSource === undefined) {
              normalized.providerSource = normalized.credentials.authMethod === 'idc' ? 'builder-id' : 'social';
            }

            // 自动生成机器码（如果未提供）
            if (!normalized.credentials.machineId) {
              normalized.credentials.machineId = TokenManager.generateMachineId();
            }

            // 构建新账号数据（内存对象）
            const newId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const newAccount = {
              id: newId,
              name: normalized.name || normalized.email || '未命名',
              credentials: normalized.credentials,
              status: 'active',
              requestCount: 0,
              errorCount: 0,
              createdAt: new Date().toISOString(),
              lastUsedAt: null,
              usage: null,
              providerSource: normalized.providerSource,
              authMethod: normalized.credentials.authMethod,
              region: normalized.credentials.region,
              machineId: normalized.credentials.machineId,
              email: normalized.email,
              subscriptionLevel: normalized.subscriptionLevel,
              importFormat: detectedFormat,
              importBatchId: batchId,
              tokenFingerprint: fingerprint,
              credentialsVersion: 1,
              credentialsUpdatedAt: null
            };

            // 验证凭证（如果需要）
            if (options.validateToken) {
              const tm = new TokenManager(accountPool.config, newAccount.credentials, (changes) => {
                if (changes.refreshToken) {
                  newAccount.credentials.refreshToken = changes.refreshToken;
                  newAccount.credentialsUpdatedAt = changes.credentialsUpdatedAt;
                  newAccount.tokenFingerprint = generateFingerprint(changes.refreshToken);
                }
              });
              await tm.ensureValidToken();
            }

            // DB 原子事务：置空旧指纹 → 插入新账号 → 删除旧账号（全部在一个事务中）
            if (db) {
              db.replaceAccountAtomic(existing.id, newAccount);
            }

            // DB 事务成功后，更新内存
            accountPool.accounts.delete(existing.id);
            accountPool.tokenManagers.delete(existing.id);
            accountPool.accounts.set(newId, newAccount);
            // 重建 TokenManager（带凭证变更回调）
            accountPool.tokenManagers.set(newId, new TokenManager(accountPool.config, newAccount.credentials, (changes) => {
              accountPool._onCredentialsChanged(newId, changes);
            }));

            item.status = 'replaced';
            item.existingId = existing.id;
            item.id = newId;
            item.name = newAccount.name;
            results.summary.replaced++;
            results.items.push(item);
          } else {
            item.status = 'dry_run';
            item.name = normalized.name || normalized.email || '未命名';
            results.items.push(item);
          }
          continue;
        } else if (options.onDuplicate === 'update') {
          // 更新模式：只更新原始数据提供的字段（undefined 表示未提供）
          if (!options.dryRun) {
            const updates = {
              name: normalized.name || existing.name
            };

            // 只更新原始数据提供的凭证字段（非 undefined）
            if (normalized.credentials.refreshToken) {
              updates.refreshToken = normalized.credentials.refreshToken;
            }
            if (normalized.credentials.clientId !== null && normalized.credentials.clientId !== undefined) {
              updates.clientId = normalized.credentials.clientId;
            }
            if (normalized.credentials.clientSecret !== null && normalized.credentials.clientSecret !== undefined) {
              updates.clientSecret = normalized.credentials.clientSecret;
            }
            if (normalized.credentials.authMethod !== undefined) {
              updates.authMethod = normalized.credentials.authMethod;
            }
            if (normalized.credentials.region !== null && normalized.credentials.region !== undefined) {
              updates.region = normalized.credentials.region;
            }
            if (normalized.credentials.machineId !== null && normalized.credentials.machineId !== undefined) {
              updates.machineId = normalized.credentials.machineId;
            }
            if (normalized.providerSource !== undefined) {
              updates.providerSource = normalized.providerSource;
            }

            // 如果更新了凭证字段且启用了 validateToken，需要验证完整凭证
            if (options.validateToken && updates.refreshToken) {
              // 从内存池获取完整凭证，合并所有更新字段
              const existingAccount = accountPool.accounts.get(existing.id);
              const tempCredentials = {
                ...(existingAccount?.credentials || {}),
                refreshToken: updates.refreshToken,
                clientId: updates.clientId !== undefined ? updates.clientId : existingAccount?.credentials?.clientId,
                clientSecret: updates.clientSecret !== undefined ? updates.clientSecret : existingAccount?.credentials?.clientSecret,
                authMethod: updates.authMethod !== undefined ? updates.authMethod : existingAccount?.credentials?.authMethod,
                region: updates.region !== undefined ? updates.region : existingAccount?.credentials?.region,
                machineId: updates.machineId !== undefined ? updates.machineId : existingAccount?.credentials?.machineId
              };
              const tm = new TokenManager(accountPool.config, tempCredentials, (changes) => {
                if (changes.refreshToken) {
                  updates.refreshToken = changes.refreshToken;
                  updates.credentialsUpdatedAt = changes.credentialsUpdatedAt;
                }
              });
              await tm.ensureValidToken();
            }

            const success = await accountPool.updateAccount(existing.id, updates);
            if (!success) {
              item.status = 'failed';
              item.errors = ['账号不存在或更新失败'];
              results.summary.failed++;
              results.items.push(item);
              continue;
            }
          }
          item.status = 'updated';
          item.id = existing.id;
          item.name = normalized.name || existing.name;
          results.summary.updated++;
          results.items.push(item);
          continue;
        }
      }

      // Dry run 模式
      if (options.dryRun) {
        item.status = 'dry_run';
        item.name = normalized.name || normalized.email || '未命名';
        results.items.push(item);
        continue;
      }

      // 添加账号（创建模式：为 undefined 字段补充默认值）
      const accountData = {
        ...normalized,
        importFormat: detectedFormat,
        importBatchId: batchId
      };

      // 为创建模式补充默认值
      if (accountData.credentials.authMethod === undefined) {
        accountData.credentials.authMethod = 'social';
      }
      if (accountData.providerSource === undefined) {
        accountData.providerSource = accountData.credentials.authMethod === 'idc' ? 'builder-id' : 'social';
      }

      const id = await accountPool.addAccount(accountData, !options.validateToken);

      // 更新 item.id，供 catch 块清理使用
      item.id = id;

      // 更新 item 状态（此处只有 create 模式，replace 已在上方 continue）
      item.status = 'created';
      results.summary.created++;
      item.name = normalized.name || normalized.email || '未命名';
      results.items.push(item);

    } catch (error) {
      item.status = 'failed';
      item.errors = [error.message];
      results.summary.failed++;
      results.items.push(item);
    }
  }

  return results;
}
