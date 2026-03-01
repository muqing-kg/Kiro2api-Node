// 账号详情弹窗组件

// 简化订阅类型名称
function simplifySubType(type) {
    if (!type) return 'FREE';
    const t = type.toUpperCase();
    if (t.includes('Q_DEVELOPER_STANDALONE_FREE') || t.includes('FREE')) return 'FREE';
    if (t.includes('Q_DEVELOPER_STANDALONE_PRO') || t.includes('PRO_PLUS') || t.includes('PROPLUS')) return 'PRO+';
    if (t.includes('PRO')) return 'PRO';
    if (t.includes('POWER')) return 'POWER';
    return type;
}

// 格式化到期时间
function formatDetailExpiry(ts) {
    if (!ts) return '-';
    let date;
    if (typeof ts === 'string') {
        date = new Date(ts);
    } else if (typeof ts === 'number') {
        date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
    } else {
        return '-';
    }
    // 检查是否是无效时间（1970年附近）
    if (date.getFullYear() < 2000) return '-';
    const diff = date.getTime() - Date.now();
    if (diff <= 0) return '已过期';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟后';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时后';
    if (diff < 86400000 * 30) return Math.floor(diff / 86400000) + '天后';
    return date.toLocaleDateString('zh-CN');
}

window.AccountDetailModal = function() {
    const { useState, useEffect } = React;
    const [isOpen, setIsOpen] = useState(false);
    const [account, setAccount] = useState(null);
    const [generatingMachineId, setGeneratingMachineId] = useState(false);
    const [savingMachineId, setSavingMachineId] = useState(false);
    const [machineId, setMachineId] = useState('');

    useEffect(() => {
        const handleShow = (e) => {
            if (e.detail && e.detail.account) {
                setAccount(e.detail.account);
                setMachineId(e.detail.account.machineId || '');
                setIsOpen(true);
            }
        };

        window.addEventListener('showDetailModal', handleShow);
        return () => window.removeEventListener('showDetailModal', handleShow);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setAccount(null);
        setMachineId('');
    };

    const handleGenerateMachineId = () => {
        setGeneratingMachineId(true);
        const newMachineId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        setMachineId(newMachineId);
        setGeneratingMachineId(false);
    };

    const handleSaveMachineId = async () => {
        if (!account || !machineId) return;

        setSavingMachineId(true);
        try {
            await window.accountsService.updateAccount(account.id, { machineId });
            showToast('机器码已保存', 'success');
            account.machineId = machineId;
            // 触发账号列表刷新
            window.dispatchEvent(new CustomEvent('refreshAccounts'));
        } catch (error) {
            showToast(`保存失败: ${error.message}`, 'error');
        } finally {
            setSavingMachineId(false);
        }
    };

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* 头部 */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">账号详情</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* 内容 */}
                <div className="p-6 space-y-6">
                    {/* 基本信息 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">基本信息</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">邮箱：</span>
                                <span className="text-gray-900 font-medium">{account.email || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">用户ID：</span>
                                <span className="text-gray-900 font-mono text-xs">{account.id}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">认证方式：</span>
                                <span className="text-gray-900">{account.authMethod || 'social'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Region：</span>
                                <span className="text-gray-900">{account.region || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 机器码 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">机器码</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={machineId}
                                onChange={(e) => setMachineId(e.target.value)}
                                placeholder="机器码"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                onClick={handleGenerateMachineId}
                                disabled={generatingMachineId}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {generatingMachineId ? '生成中...' : '生成'}
                            </button>
                            <button
                                onClick={handleSaveMachineId}
                                disabled={savingMachineId || !machineId}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {savingMachineId ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>

                    {/* 订阅信息 */}
                    {account.usage && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">订阅信息</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">订阅类型：</span>
                                    <span className="text-gray-900 font-medium">{simplifySubType(account.usage.subscriptionType)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Token到期：</span>
                                    <span className="text-gray-900">{formatDetailExpiry(account.usage.nextReset)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">主配额：</span>
                                    <span className="text-gray-900">{account.usage.usageLimit || 0}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">已使用：</span>
                                    <span className="text-gray-900">{account.usage.currentUsage || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 统计信息 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">统计信息</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">请求数：</span>
                                <span className="text-gray-900 font-medium">{account.requestCount || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">错误数：</span>
                                <span className="text-gray-900 font-medium">{account.errorCount || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">总Tokens：</span>
                                <span className="text-gray-900">{account.usage?.currentUsage || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">总Credits：</span>
                                <span className="text-gray-900">-</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* 底部 */}
                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
