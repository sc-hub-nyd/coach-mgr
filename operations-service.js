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

function isSecureCloud(state) {
    return Boolean(state?.teamInfo?.gasApiUrl) && state?.teamInfo?.gasSyncProtocol === 'secure-v2';
}

function actionFor(check) {
    return {
        backup: { label: 'バックアップを作成', action: 'backup' },
        sync: { label: '同期を確認', action: 'sync' },
        cloudRecovery: { label: '復旧世代を確認', action: 'recoveries' },
        recovery: { label: '復旧用データを保存', action: 'local-recovery' },
        team: { label: 'チーム設定へ', action: 'settings' },
        outbox: { label: '同期待機を再試行', action: 'sync' }
    }[check.key] || null;
}

export function markBackupCreated(now = new Date()) {
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, now.toISOString());
    return now.toISOString();
}

export function getLastBackupAt() {
    return localStorage.getItem(BACKUP_TIMESTAMP_KEY) || null;
}

export function buildPreflightChecklist(state, diagnostics = buildOperationalDiagnostics(state)) {
    const syncMeta = state?.syncMeta || {};
    const hasCloud = diagnostics.hasCloud;
    const items = [
        {
            key: 'backup',
            label: '端末バックアップ',
            detail: diagnostics.backupIsStale || !diagnostics.lastBackupAt
                ? '試合前の状態を端末へ保存してください'
                : `保存済み：${formatDateTime(diagnostics.lastBackupAt)}`,
            status: diagnostics.backupIsStale || !diagnostics.lastBackupAt ? 'attention' : 'ready'
        },
        {
            key: 'sync',
            label: 'クラウド同期',
            detail: !hasCloud ? '未設定（端末保存で運用できます）'
                : diagnostics.lastSyncError ? `要確認：${diagnostics.lastSyncError.kind}`
                    : diagnostics.hasUnsyncedChanges ? '端末の変更を送信してください'
                        : `同期済み：${formatDateTime(diagnostics.lastSyncAt)}`,
            status: !hasCloud ? 'neutral' : diagnostics.lastSyncError || diagnostics.hasUnsyncedChanges ? 'attention' : 'ready'
        },
        {
            key: 'cloudRecovery',
            label: 'クラウド復旧',
            detail: !hasCloud ? 'クラウド未設定'
                : !isSecureCloud(state) ? '安全モードに切替えると世代復旧を利用できます'
                    : syncMeta.cloudRecoveryAvailable ? `世代 ${Number(syncMeta.cloudRevision || 0)} ・復旧ポイントあり`
                        : '次回のクラウド送信後に復旧世代を作成します',
            status: !hasCloud || !isSecureCloud(state) ? 'neutral' : syncMeta.cloudRecoveryAvailable ? 'ready' : 'attention'
        },
        {
            key: 'recovery',
            label: '端末の自動復旧',
            detail: diagnostics.lastRecoveryAt ? `直前状態：${formatDateTime(diagnostics.lastRecoveryAt)}` : '最初の保存後に利用可能になります',
            status: diagnostics.lastRecoveryAt ? 'ready' : 'neutral'
        }
    ].map(item => ({ ...item, action: actionFor(item) }));

    const attentionItems = items.filter(item => item.status === 'attention');
    return {
        items,
        readyCount: items.filter(item => item.status === 'ready').length,
        attentionCount: attentionItems.length,
        status: attentionItems.length ? 'attention' : 'ready',
        headline: attentionItems.length
            ? `試合前に ${attentionItems.length} 件の確認があります`
            : '試合前の保存・同期チェックは完了しています',
        nextAction: attentionItems[0]?.action || { label: '運用状態を確認', action: 'settings' }
    };
}

export function buildOperationalDiagnostics(state, { now = new Date() } = {}) {
    const lastBackupAt = getLastBackupAt();
    const lastRecoveryAt = getLastRecoveryAt();
    const syncMeta = state?.syncMeta || {};
    const hasCloud = Boolean(state?.teamInfo?.gasApiUrl);
    const hasUnsyncedChanges = toTime(syncMeta.updatedAt) > toTime(syncMeta.lastSyncedAt);
    const outboxItems = Array.isArray(state?.syncOutbox?.items) ? state.syncOutbox.items : [];
    const outboxPending = outboxItems.filter(item => item.status !== 'sending');
    const outboxLatest = Array.isArray(state?.syncAudit) ? state.syncAudit[0] || null : null;
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
            key: 'cloudRecovery',
            label: 'クラウド復旧世代',
            detail: !hasCloud ? 'クラウド未設定' : !isSecureCloud(state) ? '安全モードで利用できます' : syncMeta.cloudRecoveryAvailable ? `世代 ${Number(syncMeta.cloudRevision || 0)} ・復旧ポイントあり` : '次回のクラウド送信後に利用可能になります',
            status: !hasCloud || !isSecureCloud(state) ? 'neutral' : syncMeta.cloudRecoveryAvailable ? 'ready' : 'attention'
        },
        {
            key: 'recovery',
            label: '自動復旧ポイント',
            detail: lastRecoveryAt ? `直前の端末状態：${formatDateTime(lastRecoveryAt)}` : '最初の保存後に自動作成されます',
            status: lastRecoveryAt ? 'ready' : 'neutral'
        },
        {
            key: 'outbox',
            label: '同期待機・監査ログ',
            detail: !hasCloud ? 'クラウド未設定' : outboxPending.length ? `送信待ち ${outboxPending.length}件${outboxPending[0]?.lastError ? ` ・ ${outboxPending[0].lastError.kind}` : ''}` : outboxLatest ? `直近：${outboxLatest.type === 'acknowledged' ? 'クラウド受領済み' : outboxLatest.type}` : '送信待ちはありません',
            status: !hasCloud ? 'neutral' : outboxPending.length ? 'attention' : 'ready'
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
    ].map(check => ({ ...check, action: actionFor(check) }));
    const diagnostics = {
        records,
        hasCloud,
        isSecureCloud: isSecureCloud(state),
        hasUnsyncedChanges,
        outbox: { pendingCount: outboxPending.length, latest: outboxLatest, lastError: outboxPending.find(item => item.lastError)?.lastError || null },
        backupIsStale,
        lastBackupAt,
        lastRecoveryAt,
        lastSyncAt: syncMeta.lastSyncedAt || null,
        cloudRevision: Number(syncMeta.cloudRevision || 0),
        cloudRecoveryAvailable: Boolean(syncMeta.cloudRecoveryAvailable),
        lastSyncError: hasRecentSyncError ? {
            at: syncMeta.lastErrorAt,
            kind: syncMeta.lastErrorKind || 'unknown',
            message: syncMeta.lastErrorMessage || '同期に失敗しました'
        } : null,
        checks,
        readyCount: checks.filter(check => check.status === 'ready').length
    };
    diagnostics.preflight = buildPreflightChecklist(state, diagnostics);
    return diagnostics;
}

export function buildOperationsShareText(teamName, diagnostics) {
    const lines = [
        `【${teamName || 'チーム'} 運用チェック】`,
        `試合前チェック：${diagnostics.preflight?.headline || '未確認'}`,
        `端末バックアップ：${diagnostics.lastBackupAt ? formatDateTime(diagnostics.lastBackupAt) : '未作成'}`,
        `自動復旧ポイント：${diagnostics.lastRecoveryAt ? formatDateTime(diagnostics.lastRecoveryAt) : '未作成'}`,
        `クラウド同期：${diagnostics.hasCloud ? (diagnostics.lastSyncError ? `直近の失敗：${diagnostics.lastSyncError.kind}` : diagnostics.hasUnsyncedChanges ? '未同期の変更あり' : `同期済み（${formatDateTime(diagnostics.lastSyncAt)}）`) : '未設定'}`,
        `クラウド世代：${diagnostics.isSecureCloud ? `世代 ${diagnostics.cloudRevision}${diagnostics.cloudRecoveryAvailable ? '（復旧可）' : ''}` : '安全モード未設定'}`,
        `同期待機：${diagnostics.outbox?.pendingCount ? `${diagnostics.outbox.pendingCount}件` : 'なし'}`,
        `データ：選手 ${diagnostics.records.players}名 / 試合 ${diagnostics.records.matches}件 / 練習 ${diagnostics.records.practices}件`,
        `端末保存：約 ${diagnostics.records.snapshotKb} KB`
    ];
    return lines.join('\n');
}

export { formatDateTime, BACKUP_STALE_MS };
