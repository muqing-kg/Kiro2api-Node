/**
 * 账号导出工具：格式转换、敏感信息脱敏
 */

// 脱敏 token（保留前4位和后4位）
function maskToken(token) {
  if (!token || token.length < 12) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

// 导出单个账号
export function exportAccount(account, format, sensitive) {
  const credentials = typeof account.credentials === 'string'
    ? JSON.parse(account.credentials)
    : account.credentials;

  // 根据 sensitive 级别处理敏感信息
  let exportedCredentials = {};

  switch (sensitive) {
    case 'full':
      // 完整导出（包含所有敏感信息）
      exportedCredentials = {
        refreshToken: credentials.refreshToken,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        authMethod: credentials.authMethod,
        region: credentials.region,
        machineId: credentials.machineId
      };
      break;

    case 'none':
      // 不导出任何凭证
      exportedCredentials = null;
      break;

    case 'masked':
    default:
      // 脱敏导出
      exportedCredentials = {
        refreshToken: maskToken(credentials.refreshToken),
        clientId: credentials.clientId ? maskToken(credentials.clientId) : null,
        clientSecret: credentials.clientSecret ? '***' : null,
        authMethod: credentials.authMethod,
        region: credentials.region,
        machineId: credentials.machineId
      };
      break;
  }

  // 根据格式转换
  switch (format) {
    case 'legacy_camel':
      return {
        label: account.name,
        email: account.email,
        refreshToken: exportedCredentials?.refreshToken,
        clientId: exportedCredentials?.clientId,
        clientSecret: exportedCredentials?.clientSecret,
        authMethod: exportedCredentials?.authMethod,
        region: exportedCredentials?.region,
        machineId: exportedCredentials?.machineId,
        provider: account.providerSource
      };

    case 'kiro_go_snake':
      return {
        label: account.name,
        email: account.email,
        refresh_token: exportedCredentials?.refreshToken,
        client_id: exportedCredentials?.clientId,
        client_secret: exportedCredentials?.clientSecret,
        auth_method: exportedCredentials?.authMethod,
        region: exportedCredentials?.region,
        machine_id: exportedCredentials?.machineId,
        provider: account.providerSource
      };

    case 'standard_v2':
    default:
      return {
        name: account.name,
        auth: exportedCredentials ? {
          refreshToken: exportedCredentials.refreshToken,
          authMethod: exportedCredentials.authMethod,
          clientId: exportedCredentials.clientId,
          clientSecret: exportedCredentials.clientSecret
        } : null,
        meta: {
          email: account.email,
          provider: account.providerSource,
          subscriptionLevel: account.subscriptionLevel,
          region: exportedCredentials?.region,
          machineId: exportedCredentials?.machineId,
          status: account.status,
          createdAt: account.createdAt
        }
      };
  }
}

// 批量导出
export function exportAccounts(accounts, format, sensitive) {
  const exportedAccounts = accounts.map(acc => exportAccount(acc, format, sensitive));

  // standard_v2 格式需要包装
  if (format === 'standard_v2') {
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      sensitive,
      accounts: exportedAccounts
    };
  }

  return exportedAccounts;
}
