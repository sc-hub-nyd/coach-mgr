import { captureActiveWorkspace, ensureWorkspaceState } from './workspace-service.js';
import { ensureRecordMetadata } from './record-service.js';

const STORAGE_KEY = 'coachMgrData';
const RECOVERY_KEY = 'coachMgrDataRecovery';
const RECOVERY_TIMESTAMP_KEY = 'coachMgrRecoverySnapshotAt';
const BACKUP_FORMAT = 'coachmgr-backup';
const BACKUP_VERSION = 3;
const CURRENT_SCHEMA_VERSION = 3;

const ARRAY_FIELDS = [
    'matches', 'practices', 'players', 'menuLibrary', 'tactics', 'practiceTemplates',
    'matchTypes', 'menuCategories', 'tacticsCategories', 'analysisTags',
    'skillMetrics', 'positions', 'positionsCat2', 'customFormations'
];

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function migrateSnapshot(input) {
    const source = input && typeof input === 'object' ? clone(input) : {};
    const version = Number(source.schemaVersion || 1);

    // v1 was a plain state object. Keep it readable while adding the v2 contract.
    if (version < 2) source.schemaVersion = 2;
    // v3 adds stable record IDs, updatedAt timestamps, deletion tombstones, and workspaces.
    if (version < 3) source.schemaVersion = 3;

    ARRAY_FIELDS.forEach(key => {
        source[key] = asArray(source[key]);
    });
    source.teamInfo = source.teamInfo && typeof source.teamInfo === 'object' ? source.teamInfo : {};
    source.teamFocus = source.teamFocus && typeof source.teamFocus === 'object' ? source.teamFocus : {};
    source.syncMeta = source.syncMeta && typeof source.syncMeta === 'object' ? source.syncMeta : {};
    source.teams = Array.isArray(source.teams) ? source.teams : [];
    source.workspaces = source.workspaces && typeof source.workspaces === 'object' ? source.workspaces : {};
    source.activeTeamId = source.activeTeamId || null;
    source.activeSeasonId = source.activeSeasonId || null;

    const normalizeAttendance = event => {
        if (!event || typeof event !== 'object') return;
        if (!Array.isArray(event.callUpPlayerIds)) event.callUpPlayerIds = Array.isArray(event.presentPlayerIds) ? [...event.presentPlayerIds] : [];
        if (!event.attendanceByPlayer || typeof event.attendanceByPlayer !== 'object') event.attendanceByPlayer = {};
        event.callUpPlayerIds.forEach(id => {
            const key = String(id);
            const previous = event.attendanceByPlayer[key] || {};
            const status = previous.status || (Array.isArray(event.presentPlayerIds) && event.presentPlayerIds.includes(id) ? 'attending' : 'pending');
            event.attendanceByPlayer[key] = {
                status: ['attending', 'absent', 'pending'].includes(status) ? status : 'pending',
                updatedAt: previous.updatedAt || null,
                updatedBy: previous.updatedBy || null
            };
        });
        event.presentPlayerIds = event.callUpPlayerIds.filter(id => event.attendanceByPlayer[String(id)]?.status === 'attending');
        event.attendance = `${event.presentPlayerIds.length}/${event.callUpPlayerIds.length}`;
    };

    source.practices.forEach(normalizeAttendance);

    // Normalize match periods so eventHistory is always persisted consistently.
    source.matches.forEach(match => {
        normalizeAttendance(match);
        if (!match || typeof match !== 'object') return;
        if (!Array.isArray(match.formations)) match.formations = [];
        match.formations.forEach(period => {
            if (!period || typeof period !== 'object') return;
            if (!Array.isArray(period.goalRecords)) period.goalRecords = [];
            if (!Array.isArray(period.substitutions)) period.substitutions = [];
            if (!Array.isArray(period.analysisMemos)) period.analysisMemos = [];
            if (!Array.isArray(period.cardRecords)) period.cardRecords = [];
            if (!Array.isArray(period.eventHistory)) period.eventHistory = [];
            if (!Number.isFinite(Number(period.fieldClockSeconds))) period.fieldClockSeconds = 0;
            if (typeof period.fieldClockRunning !== 'boolean') period.fieldClockRunning = false;
            if (!period.fieldClockStartedAt) period.fieldClockStartedAt = null;
        });
    });

    ensureRecordMetadata(source);
    Object.values(source.workspaces).forEach(workspace => ensureRecordMetadata(workspace));
    return source;
}

export function createStateSnapshot(state) {
    ensureWorkspaceState(state);
    captureActiveWorkspace(state);
    return migrateSnapshot({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        matches: state.matches || [],
        practices: state.practices || [],
        players: state.players || [],
        menuLibrary: state.menuLibrary || [],
        tactics: state.tactics || [],
        practiceTemplates: state.practiceTemplates || [],
        matchTypes: state.matchTypes || [],
        menuCategories: state.menuCategories || [],
        tacticsCategories: state.tacticsCategories || [],
        analysisTags: state.analysisTags || [],
        skillMetrics: state.skillMetrics || [],
        positions: state.positions || [],
        positionsCat2: state.positionsCat2 || [],
        teamInfo: state.teamInfo || {},
        customFormations: state.customFormations || [],
        teamFocus: state.teamFocus || {},
        teams: state.teams || [],
        workspaces: state.workspaces || {},
        activeTeamId: state.activeTeamId || null,
        activeSeasonId: state.activeSeasonId || null,
        syncMeta: state.syncMeta || {}
    });
}

export function createCloudSnapshot(state) {
    const snapshot = createStateSnapshot(state);
    if (snapshot.teamInfo) delete snapshot.teamInfo.gasAuthToken;
    // P22の各ワークスペースにもチーム設定が含まれるため、認証トークンはすべての保存先から除外する。
    Object.values(snapshot.workspaces || {}).forEach(workspace => {
        if (workspace?.teamInfo) delete workspace.teamInfo.gasAuthToken;
    });
    return snapshot;
}

export function createBackupPayload(state) {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: createStateSnapshot(state)
    };
}

export function parseBackupPayload(raw) {
    let parsed;
    try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
        throw new Error('バックアップJSONを解析できませんでした', { cause: error });
    }
    const candidate = parsed && parsed.format === BACKUP_FORMAT ? parsed.data : parsed;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('バックアップデータの形式が正しくありません');
    }
    const hasKnownCollection = ['matches', 'practices', 'players', 'menuLibrary', 'tactics']
        .some(key => Array.isArray(candidate[key]));
    if (!hasKnownCollection) {
        throw new Error('CoachMgrのバックアップデータではありません');
    }
    return migrateSnapshot(candidate);
}

function decodeStoredValue(saved, decryptData) {
    if (!saved) return null;
    let value = saved;
    if (typeof value === 'string' && value.startsWith('enc:')) {
        value = decryptData(value.slice(4));
    }
    if (typeof value === 'string') return JSON.parse(value);
    return value;
}

async function getItem(key) {
    if (typeof localforage !== 'undefined') return localforage.getItem(key);
    return localStorage.getItem(key);
}

async function setItem(key, value) {
    if (typeof localforage !== 'undefined') return localforage.setItem(key, value);
    localStorage.setItem(key, value);
    return value;
}

async function removeItem(key) {
    if (typeof localforage !== 'undefined') await localforage.removeItem(key);
    localStorage.removeItem(key);
}

async function decodeSnapshot(saved, decryptData) {
    if (!saved) return null;
    return migrateSnapshot(decodeStoredValue(saved, decryptData || (value => value)));
}

export async function loadPersistedSnapshot({ decryptData } = {}) {
    let saved = await getItem(STORAGE_KEY);
    if (!saved) {
        const oldSaved = localStorage.getItem(STORAGE_KEY);
        if (oldSaved) {
            saved = oldSaved;
            await setItem(STORAGE_KEY, oldSaved);
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    if (!saved) return null;

    try {
        return await decodeSnapshot(saved, decryptData);
    } catch (error) {
        const recovery = await getItem(RECOVERY_KEY);
        if (recovery) {
            try {
                return await decodeSnapshot(recovery, decryptData);
            } catch (recoveryError) {
                throw new Error('保存データと復旧用データの両方を読み込めませんでした', { cause: recoveryError });
            }
        }
        throw new Error('保存データを読み込めませんでした', { cause: error });
    }
}

export async function savePersistedSnapshot(snapshot, { encryptData } = {}) {
    const normalized = migrateSnapshot(snapshot);
    const serialized = JSON.stringify(normalized);
    const value = encryptData ? `enc:${encryptData(serialized)}` : serialized;
    const previous = await getItem(STORAGE_KEY);
    if (previous) {
        await setItem(RECOVERY_KEY, previous);
        if (typeof localStorage !== 'undefined') localStorage.setItem(RECOVERY_TIMESTAMP_KEY, new Date().toISOString());
    }
    await setItem(STORAGE_KEY, value);
    return normalized;
}

export async function loadRecoverySnapshot({ decryptData } = {}) {
    const recovery = await getItem(RECOVERY_KEY);
    return recovery ? decodeSnapshot(recovery, decryptData) : null;
}

export function getLastRecoveryAt() {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(RECOVERY_TIMESTAMP_KEY) : null;
}

export async function clearPersistedSnapshot() {
    await removeItem(STORAGE_KEY);
    await removeItem(RECOVERY_KEY);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(RECOVERY_TIMESTAMP_KEY);
}

export { STORAGE_KEY, RECOVERY_KEY, RECOVERY_TIMESTAMP_KEY, BACKUP_FORMAT, BACKUP_VERSION, CURRENT_SCHEMA_VERSION };
