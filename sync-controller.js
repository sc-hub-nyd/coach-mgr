const SYNC_FIELDS = [
    'matches', 'practices', 'players', 'menuLibrary', 'tactics', 'practiceTemplates',
    'matchTypes', 'menuCategories', 'tacticsCategories', 'analysisTags',
    'skillMetrics', 'positions', 'positionsCat2', 'customFormations', 'teamFocus',
    'teams', 'workspaces', 'activeTeamId', 'activeSeasonId'
];

function createDeviceId() {
    return (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function toRevision(value) {
    const revision = Number(value);
    return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

export function ensureSyncMeta(state) {
    const existing = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : {};
    state.syncMeta = {
        deviceId: existing.deviceId || createDeviceId(),
        revision: toRevision(existing.revision),
        // この端末が最後に観測したクラウド確定世代。送信時の楽観ロック条件になる。
        cloudRevision: toRevision(existing.cloudRevision),
        lastKnownCloudRevision: toRevision(existing.lastKnownCloudRevision ?? existing.cloudRevision),
        cloudUpdatedAt: existing.cloudUpdatedAt || null,
        cloudRecoveryAvailable: Boolean(existing.cloudRecoveryAvailable),
        updatedAt: existing.updatedAt || null,
        lastSyncedAt: existing.lastSyncedAt || null,
        lastAttemptAt: existing.lastAttemptAt || null,
        lastErrorAt: existing.lastErrorAt || null,
        lastErrorKind: existing.lastErrorKind || null,
        lastErrorMessage: existing.lastErrorMessage || null,
        lastConflictAt: existing.lastConflictAt || null,
        lastConflictKind: existing.lastConflictKind || null,
        tombstones: existing.tombstones && typeof existing.tombstones === 'object' ? existing.tombstones : {},
        recordFingerprints: existing.recordFingerprints && typeof existing.recordFingerprints === 'object' ? existing.recordFingerprints : {}
    };
    return state.syncMeta;
}

export function markLocalChange(state, now = new Date()) {
    const meta = ensureSyncMeta(state);
    meta.revision += 1;
    meta.updatedAt = now.toISOString();
    return meta;
}

export function markSyncAttempt(state, now = new Date()) {
    const meta = ensureSyncMeta(state);
    meta.lastAttemptAt = now.toISOString();
    return meta;
}

export function getExpectedCloudRevision(state) {
    return ensureSyncMeta(state).cloudRevision;
}

export function buildSyncSummary(snapshot) {
    const data = snapshot || {};
    return {
        players: Array.isArray(data.players) ? data.players.length : 0,
        matches: Array.isArray(data.matches) ? data.matches.length : 0,
        practices: Array.isArray(data.practices) ? data.practices.length : 0,
        templates: Array.isArray(data.practiceTemplates) ? data.practiceTemplates.length : 0,
        updatedAt: data.syncMeta?.updatedAt || null,
        cloudRevision: toRevision(data.syncMeta?.cloudRevision)
    };
}

export function markSyncAcknowledged(state, now = new Date(), cloudMeta = {}) {
    const meta = ensureSyncMeta(state);
    const timestamp = now.toISOString();
    const observedRevision = cloudMeta.cloudRevision ?? cloudMeta.revision;
    if (observedRevision !== undefined) {
        meta.cloudRevision = toRevision(observedRevision);
        meta.lastKnownCloudRevision = meta.cloudRevision;
    }
    if (cloudMeta.updatedAt) meta.cloudUpdatedAt = cloudMeta.updatedAt;
    if (cloudMeta.recoveryAvailable !== undefined) meta.cloudRecoveryAvailable = Boolean(cloudMeta.recoveryAvailable);
    meta.lastAttemptAt = timestamp;
    meta.lastSyncedAt = timestamp;
    meta.lastErrorAt = null;
    meta.lastErrorKind = null;
    meta.lastErrorMessage = null;
    return meta;
}

export function markSyncFailure(state, error, now = new Date()) {
    const meta = ensureSyncMeta(state);
    const timestamp = now.toISOString();
    const rawMessage = String(error?.message || '同期に失敗しました');
    const kind = String(error?.kind || error?.code || 'unknown').slice(0, 40);
    meta.lastAttemptAt = timestamp;
    meta.lastErrorAt = timestamp;
    meta.lastErrorKind = kind;
    // 同期設定やトークンをエラー詳細として残さないよう、短い一般メッセージだけを保持する。
    meta.lastErrorMessage = rawMessage.replace(/https?:\/\/\S+/g, '[URL非表示]').slice(0, 160);
    if (kind === 'conflict') {
        meta.lastConflictAt = timestamp;
        meta.lastConflictKind = error?.code || 'revision_conflict';
    }
    return meta;
}

export function hasUnsyncedChanges(state) {
    const meta = ensureSyncMeta(state);
    return toTimestamp(meta.updatedAt) > toTimestamp(meta.lastSyncedAt);
}

export function hasSyncConflict(localState, remoteData) {
    const local = ensureSyncMeta(localState);
    const remote = remoteData?.syncMeta || {};
    const localChanged = hasUnsyncedChanges(localState);
    const remoteChangedAfterLastSync = toTimestamp(remote.updatedAt || remote.cloudUpdatedAt) > toTimestamp(local.lastSyncedAt);
    const remoteRevisionIsNewer = toRevision(remote.cloudRevision) > toRevision(local.cloudRevision);
    const isDifferentDevice = remote.deviceId && remote.deviceId !== local.deviceId;
    return Boolean(localChanged && isDifferentDevice && (remoteChangedAfterLastSync || remoteRevisionIsNewer));
}

export function applyRemoteSnapshot(state, remoteData) {
    const localMeta = ensureSyncMeta(state);
    SYNC_FIELDS.forEach(key => {
        if (remoteData[key] === undefined) return;
        if (key === 'workspaces' && remoteData.workspaces && typeof remoteData.workspaces === 'object') {
            const localWorkspaces = state.workspaces || {};
            state.workspaces = Object.fromEntries(Object.entries(remoteData.workspaces).map(([workspaceId, workspace]) => {
                const localToken = localWorkspaces[workspaceId]?.teamInfo?.gasAuthToken;
                const safeWorkspace = { ...workspace, teamInfo: { ...(workspace?.teamInfo || {}) } };
                if (localToken) safeWorkspace.teamInfo.gasAuthToken = localToken;
                return [workspaceId, safeWorkspace];
            }));
            return;
        }
        state[key] = remoteData[key];
    });
    if (remoteData.teamInfo && typeof remoteData.teamInfo === 'object') {
        const { gasAuthToken: _ignoredAuthToken, ...sharedTeamInfo } = remoteData.teamInfo;
        state.teamInfo = { ...state.teamInfo, ...sharedTeamInfo };
    }
    if (remoteData.syncMeta && typeof remoteData.syncMeta === 'object') {
        const remoteMeta = remoteData.syncMeta;
        // pullでクラウド側のdeviceIdをコピーせず、このブラウザ固有の識別子を保持する。
        state.syncMeta = {
            ...localMeta,
            revision: Math.max(toRevision(localMeta.revision), toRevision(remoteMeta.revision)),
            cloudRevision: toRevision(remoteMeta.cloudRevision),
            lastKnownCloudRevision: toRevision(remoteMeta.cloudRevision),
            cloudUpdatedAt: remoteMeta.cloudUpdatedAt || remoteMeta.updatedAt || null,
            cloudRecoveryAvailable: Boolean(remoteMeta.cloudRecoveryAvailable),
            updatedAt: remoteMeta.updatedAt || null,
            lastSyncedAt: new Date().toISOString(),
            lastErrorAt: null,
            lastErrorKind: null,
            lastErrorMessage: null,
            tombstones: remoteMeta.tombstones && typeof remoteMeta.tombstones === 'object' ? remoteMeta.tombstones : localMeta.tombstones,
            recordFingerprints: localMeta.recordFingerprints
        };
    } else {
        markSyncAcknowledged(state);
    }
    return state;
}

export function getSyncStatusLabel(status) {
    return {
        local: '端末に保存済み',
        syncing: 'クラウド同期中…',
        success: 'クラウド同期済み',
        offline: 'オフライン：端末に保存',
        conflict: '同期の確認が必要です',
        error: '同期に失敗しました'
    }[status] || '同期状態を確認中';
}

export { toRevision };
