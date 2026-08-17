const SYNC_FIELDS = [
    'matches', 'practices', 'players', 'menuLibrary', 'tactics', 'practiceTemplates',
    'matchTypes', 'menuCategories', 'tacticsCategories', 'analysisTags',
    'skillMetrics', 'positions', 'positionsCat2', 'customFormations', 'teamFocus'
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

export function ensureSyncMeta(state) {
    const existing = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : {};
    state.syncMeta = {
        deviceId: existing.deviceId || createDeviceId(),
        revision: Number(existing.revision || 0),
        updatedAt: existing.updatedAt || null,
        lastSyncedAt: existing.lastSyncedAt || null
    };
    return state.syncMeta;
}

export function markLocalChange(state, now = new Date()) {
    const meta = ensureSyncMeta(state);
    meta.revision += 1;
    meta.updatedAt = now.toISOString();
    return meta;
}

export function markSyncAcknowledged(state, now = new Date()) {
    const meta = ensureSyncMeta(state);
    meta.lastSyncedAt = now.toISOString();
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
    const remoteChangedAfterLastSync = toTimestamp(remote.updatedAt) > toTimestamp(local.lastSyncedAt);
    const isDifferentDevice = remote.deviceId && remote.deviceId !== local.deviceId;
    return Boolean(localChanged && remoteChangedAfterLastSync && isDifferentDevice);
}

export function applyRemoteSnapshot(state, remoteData) {
    SYNC_FIELDS.forEach(key => {
        if (remoteData[key] !== undefined) state[key] = remoteData[key];
    });
    if (remoteData.teamInfo && typeof remoteData.teamInfo === 'object') {
        const { gasAuthToken: _ignoredAuthToken, ...sharedTeamInfo } = remoteData.teamInfo;
        state.teamInfo = { ...state.teamInfo, ...sharedTeamInfo };
    }
    if (remoteData.syncMeta && typeof remoteData.syncMeta === 'object') {
        state.syncMeta = { ...ensureSyncMeta(state), ...remoteData.syncMeta, lastSyncedAt: new Date().toISOString() };
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
