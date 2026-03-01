window.EditAccountModal = function EditAccountModal() {
    const { useState, useEffect } = React;
    const [formData, setFormData] = useState({
        name: '',
        providerSource: 'unknown',
        authMethod: 'social',
        refreshToken: '',
        clientId: '',
        clientSecret: '',
        region: '',
        machineId: '',
        status: 'active'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 监听 editingAccount 变化
    useEffect(() => {
        const checkAccount = () => {
            if (window.editingAccount) {
                setFormData({
                    name: window.editingAccount.name || '',
                    providerSource: window.editingAccount.providerSource || 'unknown',
                    authMethod: window.editingAccount.authMethod || 'social',
                    refreshToken: '',
                    clientId: '',
                    clientSecret: '',
                    region: window.editingAccount.region || '',
                    machineId: '',
                    status: window.editingAccount.status || 'active'
                });
            }
        };

        // 使用 MutationObserver 监听模态框显示
        const modal = document.getElementById('editModal');
        if (modal) {
            const observer = new MutationObserver(() => {
                if (!modal.classList.contains('hidden')) {
                    checkAccount();
                }
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
            return () => observer.disconnect();
        }
    }, []);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!window.editingAccount) return;

        setIsSubmitting(true);
        try {
            const updates = {};

            // 只发送有变化的字段
            if (formData.name) updates.name = formData.name;
            if (formData.providerSource !== 'unknown') updates.providerSource = formData.providerSource;
            if (formData.authMethod) updates.authMethod = formData.authMethod;
            if (formData.refreshToken) updates.refreshToken = formData.refreshToken;
            if (formData.clientId) updates.clientId = formData.clientId;
            if (formData.clientSecret) updates.clientSecret = formData.clientSecret;
            if (formData.region) updates.region = formData.region;
            if (formData.machineId) updates.machineId = formData.machineId;
            if (formData.status) updates.status = formData.status;

            await accountsService.updateAccount(window.editingAccount.id, updates);
            showToast('账号更新成功', 'success');
            hideModal('editModal');
            window.editingAccount = null;

            // 刷新列表
            window.location.reload();
        } catch (error) {
            showToast(`更新失败: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div id="editModal" className="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-scaleIn max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">编辑账号</h3>
                    <button onClick={() => { hideModal('editModal'); window.editingAccount = null; }} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {/* 名称 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* 状态 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="active">活跃</option>
                            <option value="disabled">禁用</option>
                        </select>
                    </div>

                    {/* Provider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider 来源</label>
                        <select
                            value={formData.providerSource}
                            onChange={(e) => handleChange('providerSource', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="unknown">未知</option>
                            <option value="builder-id">Builder ID</option>
                            <option value="social">Social</option>
                        </select>
                    </div>

                    {/* Auth Method */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">认证方式</label>
                        <select
                            value={formData.authMethod}
                            onChange={(e) => handleChange('authMethod', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="social">Social</option>
                            <option value="idc">IdC (IAM Identity Center)</option>
                        </select>
                    </div>

                    {/* 凭证更新区域 */}
                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500 mb-3">凭证更新（留空表示不修改）</p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Token</label>
                                <input
                                    type="password"
                                    value={formData.refreshToken}
                                    onChange={(e) => handleChange('refreshToken', e.target.value)}
                                    placeholder="留空不修改"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {formData.authMethod === 'idc' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                        <input
                                            type="text"
                                            value={formData.clientId}
                                            onChange={(e) => handleChange('clientId', e.target.value)}
                                            placeholder="留空不修改"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                                        <input
                                            type="password"
                                            value={formData.clientSecret}
                                            onChange={(e) => handleChange('clientSecret', e.target.value)}
                                            placeholder="留空不修改"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                                        <input
                                            type="text"
                                            value={formData.region}
                                            onChange={(e) => handleChange('region', e.target.value)}
                                            placeholder="us-east-1"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                    <button
                        onClick={() => { hideModal('editModal'); window.editingAccount = null; }}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? '保存中...' : '保存修改'}
                    </button>
                </div>
            </div>
        </div>
    );
};
