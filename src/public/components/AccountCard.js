// Kiro-Go 风格账号卡片组件

// 状态指示点
function getStatusIndicator(status) {
    let dotColor, statusText;

    // 根据不同状态显示不同颜色
    if (status === 'invalid' || status === 'banned') {
        dotColor = '#ef4444'; // 红色：封禁
        statusText = '封禁';
    } else if (status === 'disabled') {
        dotColor = '#f59e0b'; // 橙色：已禁用
        statusText = '已禁用';
    } else if (status === 'cooldown') {
        dotColor = '#eab308'; // 黄色：冷却中
        statusText = '冷却中';
    } else {
        dotColor = '#10b981'; // 绿色：活跃
        statusText = '活跃';
    }

    return React.createElement('span', {
        className: 'status-indicator',
        title: statusText,
        style: {
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            marginRight: '6px',
            flexShrink: 0
        }
    });
}

// 订阅徽章 - 简化显示
function getSubBadge(type) {
    const subType = (type || '').toUpperCase();

    // 简化长名称
    if (subType.includes('Q_DEVELOPER_STANDALONE_FREE')) return React.createElement('span', { className: 'badge badge-free' }, 'FREE');
    if (subType.includes('Q_DEVELOPER_STANDALONE_PRO')) return React.createElement('span', { className: 'badge badge-pro' }, 'PRO');
    if (subType.includes('POWER')) return React.createElement('span', { className: 'badge badge-power' }, 'POWER');
    if (subType.includes('PRO_PLUS') || subType.includes('PROPLUS')) return React.createElement('span', { className: 'badge badge-proplus' }, 'PRO+');
    if (subType.includes('PRO')) return React.createElement('span', { className: 'badge badge-pro' }, 'PRO');
    return React.createElement('span', { className: 'badge badge-free' }, 'FREE');
}

// 试用徽章
function getTrialBadge(account) {
    if (account.trialStatus === 'ACTIVE' || account.isTrial) {
        return React.createElement('span', { className: 'badge badge-trial' }, '试用中');
    }
    return null;
}

// 状态徽章 - 可点击
function getStatusBadge(status, enabled, onClick, isToggling) {
    const isDisabled = enabled === false || status === 'disabled';
    const isBanned = status === 'invalid' || status === 'banned';

    let className = 'badge ';
    let text = '';

    if (isBanned) {
        className += 'badge-status-banned';
        text = '已封禁';
    } else if (isDisabled) {
        className += 'badge-status-disabled';
        text = '已禁用';
    } else {
        className += 'badge-status-enabled';
        text = '已启用';
    }

    // 封禁状态不可点击
    if (isBanned) {
        return React.createElement('span', { className }, text);
    }

    // 可点击的状态徽章
    return React.createElement('span', {
        className: className + ' cursor-pointer hover:opacity-80 transition-opacity',
        onClick: onClick,
        title: isDisabled ? '点击启用' : '点击禁用',
        style: { cursor: isToggling ? 'wait' : 'pointer' }
    }, isToggling ? '切换中...' : text);
}

// 格式化数字（K/M）
function formatNum(n) {
    if (n === undefined || n === null) return '-';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

// 格式化到期时间 - 修复时间显示
function formatExpiry(ts) {
    if (!ts) return '-';

    let timestamp;

    // 如果是 Date 对象
    if (ts instanceof Date) {
        timestamp = ts.getTime() / 1000;
    }
    // 如果是 ISO 字符串
    else if (typeof ts === 'string') {
        timestamp = new Date(ts).getTime() / 1000;
    }
    // 如果是数字（可能是秒或毫秒）
    else if (typeof ts === 'number') {
        // 如果是毫秒级时间戳（大于 10000000000）
        timestamp = ts > 10000000000 ? ts / 1000 : ts;
    }
    else {
        return '-';
    }

    // 检查是否是无效时间（1970年附近或 NaN）
    if (!timestamp || isNaN(timestamp) || timestamp < 86400 * 365) return '-';

    const diff = timestamp - Date.now() / 1000;
    if (diff <= 0) return '已过期';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + '天';
    return Math.floor(diff / 86400 / 30) + '个月';
}

const AccountCard = ({ account, onEdit, onRefresh, onDelete, onToggleSelect, isSelected, onShowDetail, onToggleEnabled }) => {
    const { useState } = React;
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    // 计算使用百分比
    const usageLimit = account.usage?.usageLimit || 0;
    const currentUsage = account.usage?.currentUsage || 0;
    const usagePercent = usageLimit > 0 ? Math.round((currentUsage / usageLimit) * 100) : 0;

    // 进度条颜色类
    const usageClass = usagePercent > 80 ? 'critical' : usagePercent > 50 ? 'high' : '';

    // 处理刷新
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh(account.id);
        } finally {
            setIsRefreshing(false);
        }
    };

    // 处理状态切换
    const handleToggleEnabled = async (e) => {
        e.stopPropagation();
        if (!onToggleEnabled) return;

        setIsToggling(true);
        try {
            await onToggleEnabled(account.id, account.enabled);
        } finally {
            setIsToggling(false);
        }
    };

    const displayEmail = account.email || account.name;

    return React.createElement('div', {
        className: 'account-card' + (isSelected ? ' selected' : ''),
        role: 'listitem'
    },
        // 第一行：复选框 + email
        React.createElement('div', { className: 'account-header-top' },
            React.createElement('input', {
                type: 'checkbox',
                checked: isSelected,
                onChange: () => onToggleSelect(account.id),
                'aria-label': '选择账号 ' + displayEmail,
                style: { width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }
            }),
            React.createElement('div', {
                className: 'account-email',
                title: displayEmail
            }, displayEmail)
        ),

        // 第二行：标签（左） + 操作按钮（右）
        React.createElement('div', { className: 'account-header-bottom' },
            React.createElement('div', { className: 'account-meta' },
                getStatusIndicator(account.status),
                getSubBadge(account.subscriptionLevel),
                getTrialBadge(account),
                getStatusBadge(account.status, account.enabled, handleToggleEnabled, isToggling)
            ),
            React.createElement('div', { className: 'account-actions' },
                React.createElement('button', {
                    onClick: () => onShowDetail(account),
                    title: '详情',
                    'aria-label': '查看账号详情',
                    style: { fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }
                },
                    React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
                        React.createElement('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
                        React.createElement('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
                    ),
                    '详情'
                ),
                React.createElement('button', {
                    onClick: handleRefresh,
                    disabled: isRefreshing,
                    title: '刷新',
                    'aria-label': '刷新账号信息',
                    'aria-disabled': isRefreshing,
                    style: isRefreshing ? { opacity: 0.5, fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' } : { fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }
                },
                    React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('path', { d: 'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2' })
                    ),
                    isRefreshing ? '刷新中' : '刷新'
                ),
                React.createElement('button', {
                    onClick: () => onDelete(account.id),
                    title: '删除',
                    'aria-label': '删除账号',
                    style: { fontSize: '12px', padding: '4px 8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }
                },
                    React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('polyline', { points: '3 6 5 6 21 6' }),
                        React.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
                    ),
                    '删除'
                )
            )
        ),

        // 主配额进度条
        usageLimit > 0 && React.createElement('div', { className: 'account-usage' },
            React.createElement('div', { className: 'usage-label' }, '主配额'),
            React.createElement('div', { className: 'usage-bar' },
                React.createElement('div', {
                    className: 'usage-fill ' + usageClass,
                    style: { width: Math.min(usagePercent, 100) + '%' }
                })
            ),
            React.createElement('div', { className: 'usage-text' },
                React.createElement('span', null, currentUsage + ' / ' + usageLimit),
                React.createElement('span', null, usagePercent + '%')
            )
        ),

        // 试用配额进度条（如果有）
        account.trialUsage && account.trialUsage.usageLimit > 0 && React.createElement('div', { className: 'account-usage' },
            React.createElement('div', { className: 'usage-label' },
                '试用配额' + (account.trialExpiresAt ? ' (' + formatExpiry(account.trialExpiresAt) + '后到期)' : '')
            ),
            React.createElement('div', { className: 'usage-bar' },
                React.createElement('div', {
                    className: 'usage-fill ' + (
                        (account.trialUsage.currentUsage / account.trialUsage.usageLimit * 100) > 80 ? 'critical' :
                        (account.trialUsage.currentUsage / account.trialUsage.usageLimit * 100) > 50 ? 'high' : ''
                    ),
                    style: { width: Math.min(account.trialUsage.currentUsage / account.trialUsage.usageLimit * 100, 100) + '%' }
                })
            ),
            React.createElement('div', { className: 'usage-text' },
                React.createElement('span', null, account.trialUsage.currentUsage + ' / ' + account.trialUsage.usageLimit),
                React.createElement('span', null, Math.round(account.trialUsage.currentUsage / account.trialUsage.usageLimit * 100) + '%')
            )
        ),

        // 底部统计：4列（请求、错误、Tokens、Credits）
        React.createElement('div', {
            className: 'account-stats',
            style: { gridTemplateColumns: 'repeat(4, 1fr)' }
        },
            // 请求数
            React.createElement('div', { className: 'account-stat' },
                React.createElement('div', { className: 'account-stat-value' }, account.requestCount || 0),
                React.createElement('div', { className: 'account-stat-label' }, '请求')
            ),
            // 错误数
            React.createElement('div', { className: 'account-stat' },
                React.createElement('div', { className: 'account-stat-value' }, account.errorCount || 0),
                React.createElement('div', { className: 'account-stat-label' }, '错误')
            ),
            // Tokens
            React.createElement('div', { className: 'account-stat' },
                React.createElement('div', { className: 'account-stat-value' }, formatNum(currentUsage)),
                React.createElement('div', { className: 'account-stat-label' }, 'Tokens')
            ),
            // Credits
            React.createElement('div', { className: 'account-stat' },
                React.createElement('div', { className: 'account-stat-value' },
                    account.credits ? account.credits.toFixed(1) : '-'
                ),
                React.createElement('div', { className: 'account-stat-label' }, 'Credits')
            )
        )
    );
};

// 使用 React.memo 优化性能
const MemoizedAccountCard = React.memo(AccountCard, (prevProps, nextProps) => {
    // 自定义比较函数，只在必要时重新渲染
    return prevProps.account.id === nextProps.account.id &&
           prevProps.isSelected === nextProps.isSelected &&
           prevProps.account.status === nextProps.account.status &&
           prevProps.account.enabled === nextProps.account.enabled &&
           prevProps.account.usage === nextProps.account.usage &&
           prevProps.account.requestCount === nextProps.account.requestCount &&
           prevProps.account.errorCount === nextProps.account.errorCount;
});

window.AccountCard = MemoizedAccountCard;
