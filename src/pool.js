import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TokenManager } from './token.js';
import { checkUsageLimits } from './usage.js';

const ACCOUNTS_FILE = 'accounts.json';

// 生成 token 指纹（完整 SHA256）
function generateTokenFingerprint(refreshToken) {
  if (!refreshToken) return null;
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

export class AccountPool {
  constructor(config, db = null) {
    this.config = config;
    this.accounts = new Map();
    this.tokenManagers = new Map();
    this.strategy = 'round-robin';
    this.roundRobinIndex = 0;
    this.db = db; // 数据库管理器（可选）
  }

  async load() {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });

      // 从数据库加载账号
      if (this.db) {
        const accounts = this.db.getAllAccounts();
        for (const acc of accounts) {
          // 解析 JSON 字段
          const credentials = typeof acc.credentials === 'string'
            ? JSON.parse(acc.credentials)
            : acc.credentials;
          const usage = acc.usage && typeof acc.usage === 'string'
            ? JSON.parse(acc.usage)
            : acc.usage;

          // 自动生成机器码（如果缺失）
          let machineId = acc.machineId || credentials.machineId || credentials.machine_id;
          let needsUpdate = false;

          if (!machineId) {
            machineId = TokenManager.generateMachineId();
            credentials.machineId = machineId;
            needsUpdate = true;
          }

          const account = {
            id: acc.id,
            name: acc.name,
            credentials,
            status: acc.status,
            requestCount: acc.requestCount,
            errorCount: acc.errorCount,
            createdAt: acc.createdAt,
            lastUsedAt: acc.lastUsedAt,
            usage,
            providerSource: acc.providerSource || 'unknown',
            authMethod: acc.authMethod || 'social',
            region: acc.region || null,
            machineId: machineId,
            email: acc.email || null,
            subscriptionLevel: acc.subscriptionLevel || null,
            importFormat: acc.importFormat || null,
            importBatchId: acc.importBatchId || null,
            tokenFingerprint: acc.tokenFingerprint || null,
            credentialsVersion: acc.credentialsVersion || 1,
            credentialsUpdatedAt: acc.credentialsUpdatedAt || null,
            lastValidatedAt: acc.lastValidatedAt || null
          };

          // 如果生成了新机器码，立即更新到数据库
          if (needsUpdate) {
            try {
              this.db.updateAccount(acc.id, {
                machineId: machineId,
                credentials: credentials
              });
            } catch (e) {
              console.error(`✗ 账号 ${acc.id} 机器码更新失败: ${e.message}`);
            }
          }

          this.accounts.set(acc.id, account);
          this.tokenManagers.set(acc.id, new TokenManager(this.config, credentials, (changes) => {
            this._onCredentialsChanged(acc.id, changes);
          }));
        }
        console.log(`✓ 从数据库加载了 ${accounts.length} 个账号`);
      }
    } catch (e) {
      console.error('加载账号池失败:', e);
    }
  }

  async save() {
    // 保留空实现以向后兼容，实际数据操作直接写入数据库
  }

  async addAccount(account, skipValidation = false) {
    const id = account.id || uuidv4();

    // 提取凭证信息
    const credentials = account.credentials;
    const authMethod = credentials.authMethod || (credentials.clientId && credentials.clientSecret ? 'idc' : 'social');
    const providerSource = account.providerSource || (authMethod === 'idc' ? 'builder-id' : 'social');

    // 自动生成机器码（如果未提供）
    const machineId = credentials.machineId || credentials.machine_id || TokenManager.generateMachineId();

    // 确保机器码写入 credentials
    credentials.machineId = machineId;

    const newAccount = {
      id,
      name: account.name || account.email || '未命名账号',
      credentials,
      status: 'active',
      requestCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      providerSource,
      authMethod,
      region: credentials.region || null,
      machineId,
      email: account.email || null,
      subscriptionLevel: account.subscriptionLevel || null,
      importFormat: account.importFormat || null,
      importBatchId: account.importBatchId || null,
      tokenFingerprint: generateTokenFingerprint(credentials.refreshToken),
      credentialsVersion: 1,
      credentialsUpdatedAt: new Date().toISOString()
    };

    // 验证凭证（可跳过）
    if (!skipValidation) {
      const tm = new TokenManager(this.config, newAccount.credentials, (changes) => {
        // 验证阶段的 token 轮转：直接更新 newAccount.credentials
        if (changes.refreshToken) {
          newAccount.credentials.refreshToken = changes.refreshToken;
          newAccount.credentialsUpdatedAt = changes.credentialsUpdatedAt;
          newAccount.tokenFingerprint = generateTokenFingerprint(changes.refreshToken);
        }
      });
      await tm.ensureValidToken(); // 会抛出错误如果无效
    }

    // 写入数据库
    if (this.db) {
      this.db.insertAccount(newAccount);
    }

    this.accounts.set(id, newAccount);
    this.tokenManagers.set(id, new TokenManager(this.config, newAccount.credentials, (changes) => {
      this._onCredentialsChanged(id, changes);
    }));
    return id;
  }

  async removeAccount(id) {
    const memoryRemoved = this.accounts.delete(id);
    this.tokenManagers.delete(id);
    let dbRemoved = true;
    if (this.db) {
      dbRemoved = this.db.deleteAccount(id);
    }
    return { memoryRemoved, dbRemoved, success: memoryRemoved || dbRemoved };
  }

  listAccounts() {
    return Array.from(this.accounts.values()).map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      enabled: a.status !== 'disabled' && a.status !== 'invalid',
      requestCount: a.requestCount,
      errorCount: a.errorCount,
      createdAt: a.createdAt,
      lastUsedAt: a.lastUsedAt,
      usage: a.usage || null,
      providerSource: a.providerSource || 'unknown',
      authMethod: a.authMethod || 'social',
      email: a.email || a.usage?.userEmail || null,
      subscriptionLevel: a.subscriptionLevel || a.usage?.subscriptionType || null,
      region: a.region || null,
      machineId: a.machineId || null
    }));
  }

  async refreshAccountUsage(id) {
    const account = this.accounts.get(id);
    if (!account) return null;

    try {
      const tm = this.tokenManagers.get(id);
      const token = await tm.ensureValidToken();
      const usage = await checkUsageLimits(token, this.config);

      account.usage = {
        usageLimit: usage.usageLimit,
        currentUsage: usage.currentUsage,
        available: usage.available,
        userEmail: usage.userEmail,
        subscriptionType: usage.subscriptionType,
        nextReset: usage.nextReset,
        updatedAt: new Date().toISOString()
      };

      // 同步 email 和 subscriptionLevel 到结构化字段
      account.email = usage.userEmail || account.email;
      account.subscriptionLevel = usage.subscriptionType || account.subscriptionLevel;

      // 写入数据库
      if (this.db) {
        this.db.updateAccount(id, {
          usage: account.usage,
          email: account.email,
          subscriptionLevel: account.subscriptionLevel
        });
      }

      return account.usage;
    } catch (e) {
      console.error(`刷新账号 ${id} 额度失败:`, e.message);

      // 检测 401/403 错误，标记账号为 invalid
      const isAuthError = e.status === 401 || e.status === 403;
      if (isAuthError) {
        await this.recordError(id, false, true);
        console.error(`✗ 账号 ${id} 认证失败 (${e.status})，已标记为 invalid`);
      }

      return { error: e.message };
    }
  }

  async refreshAllUsage() {
    const results = [];
    for (const [id, account] of this.accounts) {
      if (account.status !== 'invalid') {
        const usage = await this.refreshAccountUsage(id);
        results.push({ id, name: account.name, usage });
      }
    }
    return results;
  }

  async selectAccount() {
    const available = Array.from(this.accounts.values())
      .filter(a => a.status === 'active');

    if (available.length === 0) return null;

    let selected;
    switch (this.strategy) {
      case 'random':
        selected = available[Math.floor(Math.random() * available.length)];
        break;
      case 'least-used':
        selected = available.reduce((a, b) => a.requestCount < b.requestCount ? a : b);
        break;
      default: // round-robin
        selected = available[this.roundRobinIndex % available.length];
        this.roundRobinIndex++;
    }

    selected.requestCount++;
    selected.lastUsedAt = new Date().toISOString();

    // 异步写入数据库，不阻塞请求
    if (this.db) {
      setImmediate(() => {
        this.db.updateAccount(selected.id, {
          requestCount: selected.requestCount,
          lastUsedAt: selected.lastUsedAt
        });
      });
    }

    return {
      id: selected.id,
      name: selected.name,
      tokenManager: this.tokenManagers.get(selected.id)
    };
  }

  async recordError(id, isRateLimit, isAuthError = false) {
    const account = this.accounts.get(id);
    if (!account) return;

    account.errorCount++;

    // 检测封禁/认证失败（401/403）
    if (isAuthError) {
      account.status = 'invalid';
      if (this.db) {
        this.db.updateAccount(id, {
          status: 'invalid',
          errorCount: account.errorCount
        });
      }
      return;
    }

    // 检测限流（429）
    if (isRateLimit) {
      account.status = 'cooldown';
      setTimeout(() => {
        if (account.status === 'cooldown') {
          account.status = 'active';
          if (this.db) {
            this.db.updateAccount(id, { status: 'active' });
          }
        }
      }, 5 * 60 * 1000); // 5分钟冷却
    }

    // 写入数据库
    if (this.db) {
      this.db.updateAccount(id, {
        errorCount: account.errorCount,
        status: account.status
      });
    }
  }

  async markInvalid(id) {
    const account = this.accounts.get(id);
    if (account) {
      account.status = 'invalid';
      if (this.db) {
        this.db.updateAccount(id, { status: 'invalid' });
      }
    }
  }

  async enableAccount(id) {
    const account = this.accounts.get(id);
    if (account) {
      account.status = 'active';
      account.enabled = true;
      if (this.db) {
        this.db.updateAccount(id, { status: 'active' });
      }
      return true;
    }
    return false;
  }

  async disableAccount(id) {
    const account = this.accounts.get(id);
    if (account) {
      account.status = 'disabled';
      account.enabled = false;
      if (this.db) {
        this.db.updateAccount(id, { status: 'disabled' });
      }
      return true;
    }
    return false;
  }

  async updateAccount(id, updates) {
    const account = this.accounts.get(id);
    if (!account) return false;

    // 如果更新了凭证或元数据字段，需要重新创建 TokenManager
    if (updates.refreshToken !== undefined || updates.clientId !== undefined || updates.clientSecret !== undefined ||
        updates.authMethod !== undefined || updates.region !== undefined || updates.machineId !== undefined) {
      const newCredentials = {
        ...account.credentials,
        refreshToken: updates.refreshToken !== undefined ? updates.refreshToken : account.credentials.refreshToken,
        clientId: updates.clientId !== undefined ? updates.clientId : account.credentials.clientId,
        clientSecret: updates.clientSecret !== undefined ? updates.clientSecret : account.credentials.clientSecret,
        authMethod: updates.authMethod !== undefined ? updates.authMethod : account.authMethod,
        region: updates.region !== undefined ? updates.region : account.region,
        machineId: updates.machineId !== undefined ? updates.machineId : account.machineId
      };

      const newTokenFingerprint = generateTokenFingerprint(newCredentials.refreshToken);
      const newCredentialsUpdatedAt = new Date().toISOString();
      const newCredentialsVersion = (account.credentialsVersion || 1) + 1;

      // 先更新数据库（预检冲突）
      if (this.db) {
        try {
          this.db.updateAccount(id, {
            name: updates.name !== undefined ? updates.name : account.name,
            credentials: newCredentials,
            providerSource: updates.providerSource !== undefined ? updates.providerSource : account.providerSource,
            authMethod: updates.authMethod !== undefined ? updates.authMethod : account.authMethod,
            region: updates.region !== undefined ? updates.region : account.region,
            machineId: updates.machineId !== undefined ? updates.machineId : account.machineId,
            status: updates.status !== undefined ? updates.status : account.status,
            tokenFingerprint: newTokenFingerprint,
            credentialsVersion: newCredentialsVersion,
            credentialsUpdatedAt: newCredentialsUpdatedAt
          });
        } catch (e) {
          // 数据库更新失败（如唯一索引冲突），不修改内存状态
          console.error(`✗ 账号 ${id} 数据库更新失败: ${e.message}`);
          throw e;
        }
      }

      // 数据库成功后才更新内存
      if (updates.name !== undefined) account.name = updates.name;
      if (updates.providerSource !== undefined) account.providerSource = updates.providerSource;
      if (updates.authMethod !== undefined) account.authMethod = updates.authMethod;
      if (updates.region !== undefined) account.region = updates.region;
      if (updates.machineId !== undefined) account.machineId = updates.machineId;
      if (updates.status !== undefined) account.status = updates.status;

      account.credentials = newCredentials;
      account.credentialsUpdatedAt = newCredentialsUpdatedAt;
      account.credentialsVersion = newCredentialsVersion;
      account.tokenFingerprint = newTokenFingerprint;

      // 重新创建 TokenManager
      this.tokenManagers.set(id, new TokenManager(this.config, newCredentials, (changes) => {
        this._onCredentialsChanged(id, changes);
      }));
    } else {
      // 只更新元数据
      if (this.db) {
        try {
          this.db.updateAccount(id, {
            name: updates.name !== undefined ? updates.name : account.name,
            providerSource: updates.providerSource !== undefined ? updates.providerSource : account.providerSource,
            authMethod: updates.authMethod !== undefined ? updates.authMethod : account.authMethod,
            region: updates.region !== undefined ? updates.region : account.region,
            machineId: updates.machineId !== undefined ? updates.machineId : account.machineId,
            status: updates.status !== undefined ? updates.status : account.status
          });
        } catch (e) {
          console.error(`✗ 账号 ${id} 元数据更新失败: ${e.message}`);
          throw e;
        }
      }

      // 数据库成功后才更新内存
      if (updates.name !== undefined) account.name = updates.name;
      if (updates.providerSource !== undefined) account.providerSource = updates.providerSource;
      if (updates.authMethod !== undefined) account.authMethod = updates.authMethod;
      if (updates.region !== undefined) account.region = updates.region;
      if (updates.machineId !== undefined) account.machineId = updates.machineId;
      if (updates.status !== undefined) account.status = updates.status;
    }

    return true;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  getStrategy() {
    return this.strategy;
  }

  getStats() {
    const accounts = Array.from(this.accounts.values());
    return {
      total: accounts.length,
      active: accounts.filter(a => a.status === 'active').length,
      cooldown: accounts.filter(a => a.status === 'cooldown').length,
      invalid: accounts.filter(a => a.status === 'invalid').length,
      disabled: accounts.filter(a => a.status === 'disabled').length,
      totalRequests: accounts.reduce((sum, a) => sum + a.requestCount, 0),
      totalErrors: accounts.reduce((sum, a) => sum + a.errorCount, 0)
    };
  }

  addLog(log) {
    if (this.db) {
      this.db.insertLog({
        timestamp: log.timestamp || new Date().toISOString(),
        accountId: log.accountId,
        accountName: log.accountName,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        durationMs: log.durationMs,
        success: log.success,
        errorMessage: log.errorMessage,
        apiKey: log.apiKey,
        stream: log.stream,
        upstreamModel: log.upstreamModel
      });
    }
  }

  getRecentLogs(limit = 100, offset = 0) {
    if (this.db) {
      return this.db.getRecentLogs(limit, offset);
    }
    return [];
  }

  async removeAccounts(ids) {
    let removed = 0;
    for (const id of ids) {
      if (this.accounts.delete(id)) {
        this.tokenManagers.delete(id);
        removed++;
      }
    }
    if (removed > 0 && this.db) {
      this.db.deleteAccounts(ids);
    }
    return { total: ids.length, removed };
  }

  getLogStats() {
    if (this.db) {
      return this.db.getLogStats();
    }
    return {
      totalLogs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      successCount: 0,
      failureCount: 0
    };
  }

  async enableAccounts(ids) {
    let enabled = 0;

    // 使用数据库事务批量更新
    if (this.db) {
      enabled = this.db.updateAccountStatusBatch(ids, 'active');
      // 更新内存状态
      for (const id of ids) {
        const account = this.accounts.get(id);
        if (account) {
          account.status = 'active';
          account.enabled = true;
        }
      }
    } else {
      // 无数据库时回退到逐个更新
      for (const id of ids) {
        if (await this.enableAccount(id)) enabled++;
      }
    }

    return { total: ids.length, enabled };
  }

  async disableAccounts(ids) {
    let disabled = 0;

    // 使用数据库事务批量更新
    if (this.db) {
      disabled = this.db.updateAccountStatusBatch(ids, 'disabled');
      // 更新内存状态
      for (const id of ids) {
        const account = this.accounts.get(id);
        if (account) {
          account.status = 'disabled';
          account.enabled = false;
        }
      }
    } else {
      // 无数据库时回退到逐个更新
      for (const id of ids) {
        if (await this.disableAccount(id)) disabled++;
      }
    }

    return { total: ids.length, disabled };
  }

  async refreshAccounts(ids) {
    // 使用并发池限制并发数（避免瞬时并发过高）
    const CONCURRENCY_LIMIT = 5;
    const results = [];

    for (let i = 0; i < ids.length; i += CONCURRENCY_LIMIT) {
      const batch = ids.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(async id => {
          try {
            const usage = await this.refreshAccountUsage(id);
            // 检测 usage.error 字段，失败时标记为 false
            if (usage && usage.error) {
              return { id, success: false, error: usage.error };
            }
            return { id, success: true, usage };
          } catch (error) {
            return { id, success: false, error: error.message };
          }
        })
      );
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;

    return {
      total: ids.length,
      refreshed: successCount,
      results
    };
  }

  // 凭证变更回调（Token 轮转持久化）
  _onCredentialsChanged(accountId, changes) {
    const account = this.accounts.get(accountId);
    if (!account) return;

    if (!changes.refreshToken) return;

    const newFingerprint = generateTokenFingerprint(changes.refreshToken);
    const newVersion = (account.credentialsVersion || 1) + 1;
    const newCredentials = {
      ...account.credentials,
      refreshToken: changes.refreshToken
    };

    // 如果有数据库，先持久化到数据库
    if (this.db) {
      try {
        this.db.updateAccount(accountId, {
          credentials: newCredentials,
          credentialsUpdatedAt: changes.credentialsUpdatedAt,
          credentialsVersion: newVersion,
          tokenFingerprint: newFingerprint
        });

        console.log(`✓ 账号 ${accountId} 凭证已更新并持久化`);
      } catch (e) {
        // 数据库写入失败，标记账号为 invalid，避免静默丢失新 token 导致后续刷新雪崩
        console.error(`✗ 账号 ${accountId} 凭证持久化失败: ${e.message}`);
        console.error(`⚠️  账号 ${accountId} 已标记为 invalid，需要手动重新导入凭证`);

        account.status = 'invalid';
        try {
          this.db.updateAccount(accountId, { status: 'invalid' });
        } catch (dbErr) {
          console.error(`✗ 账号 ${accountId} 状态更新失败: ${dbErr.message}`);
        }
        return; // 持久化失败，不更新内存
      }
    }

    // 数据库写入成功（或无数据库模式），更新内存
    account.credentials.refreshToken = changes.refreshToken;
    account.credentialsUpdatedAt = changes.credentialsUpdatedAt;
    account.credentialsVersion = newVersion;
    account.tokenFingerprint = newFingerprint;
  }
}
