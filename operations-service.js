const BACKUP_TIMESTAMP_KEY = 'coachMgrLastBackupAt';

function toTime(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDateTime(value) {
    const timestamp = toTime(value);
    if (!timestamp) return '未実施';
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
}

export function markBackupCreated(now = new Date()) {
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
    return now.toISOString();
}

export function getLastBackupAt() {
    return localStorage.getItem(BACKUP_TIMESTAMP_KEY) || null;
}

export function buildOperationalDiagnostics(state) {
    const lastBackupAt = getLastBackupAt();
    const syncMeta = state?.syncMeta || {};
    const hasCloud = Boolean(state?.teamInfo?.gasApiUrl);
    const hasUnsyncedChanges = toTime(syncMeta.updatedAt) > toTime(syncMeta.lastSyncedAt);
    const snapshotBytes = new Blob([JSON.stringify({
        matches: state?.matches || [], practices: state?.practices || [], players: state?.players || [],
        menuLibrary: state?.menuLibrary || [], tactics: state?.tactics || [], practiceTemplates: state?.practiceTemplates || []
    })]).size;
    const records = {
        players: (state?.players || []).length,
        matches: (state?.matches || []).length,
        practices: (state?.practices || []).length,
        templates: (state?.practiceTemplates || []).length,
        snapshotKb: Math.max(1, Math.round(snapshotBytes / 1024))
    };
    const checks = [
        {
            key: 'backup',
            label: '端末バックアップ',
            detail: lastBackupAt ? `最終作成：${formatDateTime(lastBackupAt)}` : 'まだバックアップを作成していません',
            status: lastBackupAt ? 'ready' : 'attention'
        },
        {
            key: 'sync',
            label: 'クラウド同期',
            detail: !hasCloud ? '未設定（端末保存は継続します）' : hasUnsyncedChanges ? '端末に未同期の変更があります' : `最終同期：${formatDateTime(syncMeta.lastSyncedAt)}`,
            status: !hasCloud ? 'neutral' : hasUnsyncedChanges ? 'attention' : 'ready'
        },
        {
            key: 'team',
            label: 'チームデータ',
            detail: `選手 ${records.players}名 ・ 試合 ${records.matches}件 ・ 練習 ${records.practices}件`,
            status: records.players ? 'ready' : 'attention'
        },
        {
            key: 'storage',
            label: '端末保存',
            detail: `現在のデータ量：約 ${records.snapshotKb} KB`,
            status: 'ready'
        }
    ];
    return {
        records,
        hasCloud,
        hasUnsyncedChanges,
        lastBackupAt,
        lastSyncAt: syncMeta.lastSyncedAt || null,
        checks,
        readyCount: checks.filter(check => check.status === 'ready').length
    };
}

export function buildOperationsShareText(teamName, diagnostics) {
    const lines = [
        `【${teamName || 'チーム'} 運用チェック】`,
        `端末バックアップ：${diagnostics.lastBackupAt ? formatDateTime(diagnostics.lastBackupAt) : '未作成'}`,
        `クラウド同期：${diagnostics.hasCloud ? (diagnostics.hasUnsyncedChanges ? '未同期の変更あり' : `同期済み（${formatDateTime(diagnostics.lastSyncAt)}）`) : '未設定'}`,
        `データ：選手 ${diagnostics.records.players}名 / 試合 ${diagnostics.records.matches}件 / 練習 ${diagnostics.records.practices}件`,
        `端末保存：約 ${diagnostics.records.snapshotKb} KB`
    ];
    return lines.join('\n');
}

export { formatDateTime };
