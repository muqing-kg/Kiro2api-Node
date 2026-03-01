window.AccountsTable = function(props) {
    if (!props.accounts || props.accounts.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div>暂无账号，点击上方"添加账号"按钮添加</div>
            </div>
        );
    }

    return (
        <div className="accounts-grid" role="list" aria-label="账号列表">
            {props.accounts.map(a => (
                <AccountCard
                    key={a.id}
                    account={a}
                    onEdit={props.onEdit}
                    onRefresh={props.onRefreshUsage}
                    onDelete={props.onRemove}
                    onToggleSelect={props.onToggleSelect}
                    isSelected={props.selectedAccounts && props.selectedAccounts.has(a.id)}
                    onShowDetail={props.onShowDetail}
                    onToggleEnabled={props.onToggleEnabled}
                />
            ))}
        </div>
    );
};
