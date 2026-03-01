// Kiro-Go 风格工具栏组件
window.AccountsToolbar = function(props) {
    const { useState, useEffect, useRef } = React;
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const debounceTimerRef = useRef(null);

    // 处理搜索变化（带防抖）
    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // 清除之前的定时器
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // 设置新的定时器（300ms 延迟）
        debounceTimerRef.current = setTimeout(() => {
            props.onFilterChange({ search: query, status: statusFilter });
        }, 300);
    };

    // 清理定时器
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // 处理状态筛选变化
    const handleStatusFilterChange = (e) => {
        const status = e.target.value;
        setStatusFilter(status);
        props.onFilterChange({ search: searchQuery, status });
    };

    const selectedCount = props.selectedCount || 0;
    const allSelected = props.allSelected || false;

    return (
        <div className="toolbar-container">
            {/* 左侧：全选 + 批量操作 */}
            <div className="toolbar-left">
                <label className="select-all-label">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={props.onToggleSelectAll}
                        className="select-all-checkbox"
                    />
                    <span>全选</span>
                </label>

                <div className="toolbar-divider"></div>

                {/* 批量操作栏 */}
                {selectedCount > 0 && (
                    <div className="batch-operations">
                        <span className="batch-count">已选 {selectedCount} 个</span>
                        <button className="batch-btn enable" onClick={props.onBatchEnable} aria-label="批量启用选中的账号">批量启用</button>
                        <button className="batch-btn disable" onClick={props.onBatchDisable} aria-label="批量禁用选中的账号">批量禁用</button>
                        <button className="batch-btn refresh" onClick={props.onBatchRefresh} aria-label="批量刷新选中的账号">批量刷新</button>
                        <button className="batch-btn delete" onClick={props.onBatchDelete} aria-label="批量删除选中的账号">批量删除</button>
                    </div>
                )}
            </div>

            {/* 右侧：策略 + 搜索 + 筛选 */}
            <div className="toolbar-right">
                <select
                    value={props.strategy}
                    onChange={(e) => props.onStrategyChange(e.target.value)}
                    className="filter-select"
                >
                    <option value="round-robin">轮询</option>
                    <option value="random">随机</option>
                    <option value="least-used">最少使用</option>
                </select>
                <input
                    type="text"
                    placeholder="搜索邮箱/昵称..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="search-input"
                />
                <select
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                    className="filter-select"
                >
                    <option value="all">全部状态</option>
                    <option value="active">活跃</option>
                    <option value="disabled">已禁用</option>
                    <option value="cooldown">冷却中</option>
                    <option value="invalid">无效</option>
                </select>
            </div>
        </div>
    );
};
