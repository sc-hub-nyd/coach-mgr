import { getLastRecoveryAt } from './repository.js';

const BACKUP_TIMESTAMP_KEY = 'coachMgrLastBackupAt';
const BACKUP_STALE_MS = 7 * 24 * 60 * 60 * 1000;

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

export function buildOperationalDiagnostics(state, { now = new Date() } = {}) {
    const lastBackupAt = getLastBackupAt();
    const lastRecoveryAt = getLastRecoveryAt();
    const syncMeta = state?.syncMeta || {};
    const hasCloud = Boolean(state?.teamInfo?.gasApiUrl);
    const hasUnsyncedChanges = toTime(syncMeta.updatedAt) > toTime(syncMeta.lastSyncedAt);
    const hasRecentSyncError = toTime(syncMeta.lastErrorAt) > toTime(syncMeta.lastSyncedAt);
    const backupIsStale = Boolean(lastBackupAt && toTime(now) - toTime(lastBackupAt) > BACKUP_STALE_MS);
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
            detail: !lastBackupAt ? 'まだバックアップを作成していません' : backupIsStale ? `最終作成：${formatDateTime(lastBackupAt)}（7日以上経過）` : `最終作成：${formatDateTime(lastBackupAt)}`,
            status: !lastBackupAt || backupIsStale ? 'attention' : 'ready'
        },
        {
            key: 'sync',
            label: 'クラウド同期',
            detail: !hasCloud ? '未設定（端末保存は継続します）' : hasRecentSyncError ? `直近の同期失敗：${formatDateTime(syncMeta.lastErrorAt)}（${syncMeta.lastErrorKind || 'unknown'}）` : hasUnsyncedChanges ? '端末に未同期の変更があります' : `最終同期：${formatDateTime(syncMeta.lastSyncedAt)}`,
            status: !hasCloud ? 'neutral' : hasRecentSyncError || hasUnsyncedChanges ? 'attention' : 'ready'
        },
        {
            key: 'recovery',
            label: '自動復旧ポイント',
            detail: lastRecoveryAt ? `直前の端末状態：${formatDateTime(lastRecoveryAt)}` : '最初の保存後に自動作成されます',
            status: lastRecoveryAt ? 'ready' : 'neutral'
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
        lastRecoveryAt,
        lastSyncAt: syncMeta.lastSyncedAt || null,
        lastSyncError: hasRecentSyncError ? {
            at: syncMeta.lastErrorAt,
            kind: syncMeta.lastErrorKind || 'unknown',
            message: syncMeta.lastErrorMessage || '同期に失敗しました'
        } : null,
        checks,
        readyCount: checks.filter(check => check.status === 'ready').length
    };
}

export function buildOperationsShareText(teamName, diagnostics) {
    const lines = [
        `【${teamName || 'チーム'} 運用チェック】`,
        `端末バックアップ：${diagnostics.lastBackupAt ? formatDateTime(diagnostics.lastBackupAt) : '未作成'}`,
        `自動復旧ポイント：${diagnostics.lastRecoveryAt ? formatDateTime(diagnostics.lastRecoveryAt) : '未作成'}`,
        `クラウド同期：${diagnostics.hasCloud ? (diagnostics.lastSyncError ? `直近の失敗：${diagnostics.lastSyncError.kind}` : diagnostics.hasUnsyncedChanges ? '未同期の変更あり' : `同期済み（${formatDateTime(diagnostics.lastSyncAt)}）`) : '未設定'}`,
        `データ：選手 ${diagnostics.records.players}名 / 試合 ${diagnostics.records.matches}件 / 練習 ${diagnostics.records.practices}件`,
        `端末保存：約 ${diagnostics.records.snapshotKb} KB`
    ];
    return lines.join('\n');
}

export { formatDateTime };
