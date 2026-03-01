// Kiro-Go 风格统计卡片组件
function StatCard({ value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-value">{value || '-'}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

// 统计卡片容器 - 3列6个卡片
function StatsGrid() {
    const [stats, setStats] = React.useState({
        total: '-',
        requests: '-',
        success: '-',
        failed: '-',
        tokens: '-',
        credits: '-'
    });

    const loadStatsData = async () => {
        try {
            const data = await fetchApi('/api/status');
            const logStats = await fetchApi('/api/logs/stats');

            serverStartTime = Date.now() - (data.uptimeSecs * 1000);

            const totalAccounts = (data.pool.active || 0) + (data.pool.cooldown || 0) + (data.pool.invalid || 0);
            const totalRequests = data.pool.totalRequests || 0;
            const successCount = logStats.successCount || totalRequests;
            const failedCount = logStats.failedCount || 0;
            const totalTokens = (logStats.totalInputTokens || 0) + (logStats.totalOutputTokens || 0);

            setStats({
                total: totalAccounts,
                requests: formatNumber(totalRequests),
                success: formatNumber(successCount),
                failed: formatNumber(failedCount),
                tokens: formatNumber(totalTokens),
                credits: formatNumber(logStats.totalCredits || 0)
            });
        } catch (e) {
            console.error(e);
        }
    };

    // 每5秒刷新数据
    React.useEffect(() => {
        loadStatsData();
        const interval = setInterval(loadStatsData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="stats-grid">
            <StatCard value={stats.total} label="账号" />
            <StatCard value={stats.requests} label="请求" />
            <StatCard value={stats.success} label="成功" />
            <StatCard value={stats.failed} label="失败" />
            <StatCard value={stats.tokens} label="Tokens" />
            <StatCard value={stats.credits} label="Credits" />
        </div>
    );
}
