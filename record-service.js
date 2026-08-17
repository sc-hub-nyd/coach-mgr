import { workspaceKey } from './workspace-service.js';

export const RECORD_COLLECTIONS = ['matches', 'practices', 'players', 'menuLibrary', 'tactics', 'practiceTemplates', 'customFormations'];

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createRecordId(collection, record) {
    const legacy = record?.id !== undefined && record?.id !== null ? String(record.id) : '';
    if (globalThis.crypto?.randomUUID) return `${collection}-${legacy || globalThis.crypto.randomUUID()}`;
    return `${collection}-${legacy || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function timestamp(value) {
    const valueAsNumber = new Date(value || 0).getTime();
    return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
}

function scopeFor(state) {
    return workspaceKey(state.activeTeamId || 'legacy-team', state.activeSeasonId || 'legacy-season');
}

function signature(record) {
    const safe = { ...record };
    delete safe.updatedAt;
    delete safe.deletedAt;
    return JSON.stringify(safe);
}

function recordKey(scope, collection, recordId) {
    return `${scope}:${collection}:${recordId}`;
}

function ensureMeta(state) {
    state.syncMeta = state.syncMeta && typeof state.syncMeta === 'object' ? state.syncMeta : {};
    state.syncMeta.tombstones = state.syncMeta.tombstones && typeof state.syncMeta.tombstones === 'object' ? state.syncMeta.tombstones : {};
    state.syncMeta.recordFingerprints = state.syncMeta.recordFingerprints && typeof state.syncMeta.recordFingerprints === 'object' ? state.syncMeta.recordFingerprints : {};
    return state.syncMeta;
}

export function ensureRecordMetadata(state, now = new Date()) {
    const iso = now.toISOString();
    RECORD_COLLECTIONS.forEach(collection => {
        if (!Array.isArray(state[collection])) state[collection] = [];
        state[collection].forEach(record => {
            if (!record || typeof record !== 'object') return;
            if (!record.recordId) record.recordId = createRecordId(collection, record);
            if (!record.updatedAt) record.updatedAt = iso;
            if (!Object.prototype.hasOwnProperty.call(record, 'deletedAt')) record.deletedAt = null;
        });
    });
    ensureMeta(state);
    return state;
}

export function touchRecordsForSave(state, now = new Date()) {
    ensureRecordMetadata(state, now);
    const meta = ensureMeta(state);
    const scope = scopeFor(state);
    const seen = new Set();
    RECORD_COLLECTIONS.forEach(collection => {
        (state[collection] || []).forEach(record => {
            if (!record || record.deletedAt) return;
            const key = recordKey(scope, collection, record.recordId);
            seen.add(key);
            const currentSignature = signature(record);
            const previous = meta.recordFingerprints[key];
            if (!previous || previous.signature !== currentSignature) record.updatedAt = now.toISOString();
            meta.recordFingerprints[key] = { signature: signature(record), collection, recordId: record.recordId, scope };
        });
    });
    Object.entries(meta.recordFingerprints).forEach(([key, entry]) => {
        if (entry?.scope === scope && !seen.has(key) && !meta.tombstones[key]) {
            meta.tombstones[key] = { collection: entry.collection, recordId: entry.recordId, scope, deletedAt: now.toISOString() };
        }
    });
    return meta;
}

export function softDeleteRecord(state, collection, idOrRecordId, now = new Date()) {
    if (!RECORD_COLLECTIONS.includes(collection)) throw new Error('論理削除に対応していないデータ種別です');
    ensureRecordMetadata(state, now);
    const record = (state[collection] || []).find(item => String(item.id) === String(idOrRecordId) || item.recordId === idOrRecordId);
    if (!record) return false;
    const scope = scopeFor(state);
    const meta = ensureMeta(state);
    const key = recordKey(scope, collection, record.recordId);
    meta.tombstones[key] = { collection, recordId: record.recordId, scope, deletedAt: now.toISOString() };
    state[collection] = state[collection].filter(item => item !== record);
    return true;
}

function indexRecords(records, collection) {
    return new Map((records || []).filter(record => record && typeof record === 'object').map(record => {
        const normalized = clone(record);
        normalized.recordId = normalized.recordId || createRecordId(collection, normalized);
        normalized.updatedAt = normalized.updatedAt || new Date(0).toISOString();
        return [normalized.recordId, normalized];
    }));
}

function mergeCollection(localRecords, remoteRecords, tombstones, scope, collection) {
    const local = indexRecords(localRecords, collection);
    const remote = indexRecords(remoteRecords, collection);
    const ids = new Set([...local.keys(), ...remote.keys()]);
    return [...ids].map(recordId => {
        const localRecord = local.get(recordId);
        const remoteRecord = remote.get(recordId);
        const deletion = tombstones[recordKey(scope, collection, recordId)];
        const winner = !localRecord ? remoteRecord : !remoteRecord ? localRecord : timestamp(localRecord.updatedAt) >= timestamp(remoteRecord.updatedAt) ? localRecord : remoteRecord;
        if (deletion && timestamp(deletion.deletedAt) >= timestamp(winner?.updatedAt)) return null;
        return winner ? clone(winner) : null;
    }).filter(Boolean);
}

function mergeWorkspace(localWorkspace = {}, remoteWorkspace = {}, tombstones, scope) {
    const result = { ...clone(remoteWorkspace), ...clone(localWorkspace) };
    RECORD_COLLECTIONS.forEach(collection => {
        result[collection] = mergeCollection(localWorkspace[collection], remoteWorkspace[collection], tombstones, scope, collection);
    });
    const localFocus = localWorkspace.teamFocus || {};
    const remoteFocus = remoteWorkspace.teamFocus || {};
    result.teamFocus = timestamp(localFocus.updatedAt) >= timestamp(remoteFocus.updatedAt) ? clone(localFocus) : clone(remoteFocus);
    return result;
}

function mergeTombstones(local = {}, remote = {}) {
    const merged = { ...clone(remote), ...clone(local) };
    Object.keys(remote || {}).forEach(key => {
        if (!local[key] || timestamp(remote[key].deletedAt) > timestamp(local[key].deletedAt)) merged[key] = clone(remote[key]);
    });
    return merged;
}

export function mergeSnapshotsByRecord(localSnapshot, remoteSnapshot) {
    const local = clone(localSnapshot || {});
    const remote = clone(remoteSnapshot || {});
    const localMeta = local.syncMeta || {};
    const remoteMeta = remote.syncMeta || {};
    const tombstones = mergeTombstones(localMeta.tombstones, remoteMeta.tombstones);
    const merged = { ...remote, ...local, syncMeta: { ...remoteMeta, ...localMeta, tombstones } };
    const workspaceKeys = new Set([...Object.keys(local.workspaces || {}), ...Object.keys(remote.workspaces || {})]);
    merged.workspaces = {};
    workspaceKeys.forEach(key => {
        merged.workspaces[key] = mergeWorkspace(local.workspaces?.[key] || {}, remote.workspaces?.[key] || {}, tombstones, key);
    });
    const activeScope = workspaceKey(local.activeTeamId || remote.activeTeamId || 'legacy-team', local.activeSeasonId || remote.activeSeasonId || 'legacy-season');
    const localActive = local.workspaces?.[activeScope] || local;
    const remoteActive = remote.workspaces?.[activeScope] || remote;
    const active = mergeWorkspace(localActive, remoteActive, tombstones, activeScope);
    RECORD_COLLECTIONS.forEach(collection => { merged[collection] = active[collection] || []; });
    merged.teamFocus = active.teamFocus || {};
    const teams = new Map();
    [...(remote.teams || []), ...(local.teams || [])].forEach(team => { if (team?.id) teams.set(team.id, clone(team)); });
    merged.teams = [...teams.values()];
    merged.activeTeamId = local.activeTeamId || remote.activeTeamId || null;
    merged.activeSeasonId = local.activeSeasonId || remote.activeSeasonId || null;
    return merged;
}
