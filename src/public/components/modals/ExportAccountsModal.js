window.ExportAccountsModal = function ExportAccountsModal() {
    const { useState } = React;
    const [sensitive, setSensitive] = useState('masked');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // 始终使用 standard_v2 格式
            await accountsService.downloadExport('standard_v2', sensitive);
            showToast('导出成功', 'success');
            hideModal('exportModal');
        } catch (error) {
            showToast(`导出失败: ${error.message}`, 'error');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div id="exportModal" className="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-scaleIn">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">导出账号</h3>
                    <button onClick={() => hideModal('exportModal')} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500">导出格式：Standard V2（凭证 JSON）</p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">敏感信息处理</label>
                        <select
                            value={sensitive}
                            onChange={(e) => setSensitive(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="masked">脱敏导出（推荐）</option>
                            <option value="full">完整导出（含明文凭证）</option>
                            <option value="none">不含凭证</option>
                        </select>
                    </div>

                    {sensitive === 'full' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700 font-medium">⚠️ 警告</p>
                            <p className="text-xs text-red-600 mt-1">
                                完整导出将包含 refreshToken、clientSecret 等敏感信息，请妥善保管导出文件。
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                    <button
                        onClick={() => hideModal('exportModal')}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? '导出中...' : '下载导出文件'}
                    </button>
                </div>
            </div>
        </div>
    );
};
