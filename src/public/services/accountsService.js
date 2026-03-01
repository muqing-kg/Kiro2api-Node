// 账号管理服务层
window.accountsService = {
    // 获取所有账号
    async fetchAccounts() {
        return await fetchApi('/api/accounts');
    },

    // 创建账号（保留兼容）
    async createAccount(payload) {
        return await fetchApi('/api/accounts', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    // 删除账号
    async deleteAccount(id) {
        return await fetchApi(`/api/accounts/${id}`, {
            method: 'DELETE'
        });
    },

    // 启用账号
    async enableAccount(id) {
        return await fetchApi(`/api/accounts/${id}/enable`, {
            method: 'POST'
        });
    },

    // 禁用账号
    async disableAccount(id) {
        return await fetchApi(`/api/accounts/${id}/disable`, {
            method: 'POST'
        });
    },

    // 刷新单个账号额度
    async refreshAccountUsage(id) {
        return await fetchApi(`/api/accounts/${id}/refresh-usage`, {
            method: 'POST'
        });
    },

    // 刷新所有账号额度
    async refreshAllAccountUsage() {
        return await fetchApi('/api/accounts/refresh-all-usage', {
            method: 'POST'
        });
    },

    // 批量删除账号
    async batchDeleteAccounts(ids) {
        return await fetchApi('/api/accounts/batch', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        });
    },

    // 导入账号（增强版，支持 3 格式）
    async importAccounts(payload, format = 'auto', options = {}) {
        return await fetchApi('/api/accounts/import', {
            method: 'POST',
            body: JSON.stringify({
                payload,
                format,
                options: {
                    dryRun: options.dryRun || false,
                    validateToken: options.validateToken || false,
                    onDuplicate: options.onDuplicate || 'skip'
                }
            })
        });
    },

    // 导出账号
    async exportAccounts(format = 'standard_v2', sensitive = 'masked', filters = {}) {
        const params = new URLSearchParams({ format, sensitive });
        if (filters.ids) params.set('ids', filters.ids.join(','));
        if (filters.status) params.set('status', filters.status);
        if (filters.provider) params.set('provider', filters.provider);
        if (sensitive === 'full') params.set('confirm', 'true');

        return await fetchApi(`/api/accounts/export?${params.toString()}`);
    },

    // 下载导出文件
    async downloadExport(format = 'standard_v2', sensitive = 'masked', filters = {}) {
        const data = await this.exportAccounts(format, sensitive, filters);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kiro-accounts-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // 编辑账号
    async updateAccount(id, updates) {
        return await fetchApi(`/api/accounts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    },

    // 获取策略
    async getStrategy() {
        return await fetchApi('/api/strategy');
    },

    // 设置策略
    async setStrategy(strategy) {
        return await fetchApi('/api/strategy', {
            method: 'POST',
            body: JSON.stringify({ strategy })
        });
    },

    // 批量启用账号
    async batchEnable(ids) {
        return await fetchApi('/api/accounts/batch/enable', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
    },

    // 批量禁用账号
    async batchDisable(ids) {
        return await fetchApi('/api/accounts/batch/disable', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
    },

    // 批量刷新账号
    async batchRefresh(ids) {
        return await fetchApi('/api/accounts/batch/refresh', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
    },

    // 批量删除账号（重命名以保持一致性）
    async batchDelete(ids) {
        return await fetchApi('/api/accounts/batch', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        });
    }
};
