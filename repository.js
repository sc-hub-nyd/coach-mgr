const STORAGE_KEY = 'coachMgrData';
const RECOVERY_KEY = 'coachMgrDataRecovery';
const BACKUP_FORMAT = 'coachmgr-backup';
const BACKUP_VERSION = 2;
const CURRENT_SCHEMA_VERSION = 2;

const ARRAY_FIELDS = [
    'matches', 'practices', 'players', 'menuLibrary', 'tactics',
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
    if (version < 2) {
        source.schemaVersion = 2;
    }

    ARRAY_FIELDS.forEach(key => {
        source[key] = asArray(source[key]);
    });
    source.teamInfo = source.teamInfo && typeof source.teamInfo === 'object' ? source.teamInfo : {};
    source.teamFocus = source.teamFocus && typeof source.teamFocus === 'object' ? source.teamFocus : {};

    // Normalize match periods so eventHistory is always persisted consistently.
    source.matches.forEach(match => {
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

    return source;
}

export function createStateSnapshot(state) {
    return migrateSnapshot({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        matches: state.matches || [],
        practices: state.practices || [],
        players: state.players || [],
        menuLibrary: state.menuLibrary || [],
        tactics: state.tactics || [],
        matchTypes: state.matchTypes || [],
        menuCategories: state.menuCategories || [],
        tacticsCategories: state.tacticsCategories || [],
        analysisTags: state.analysisTags || [],
        skillMetrics: state.skillMetrics || [],
        positions: state.positions || [],
        positionsCat2: state.positionsCat2 || [],
        teamInfo: state.teamInfo || {},
        customFormations: state.customFormations || [],
        teamFocus: state.teamFocus || {}
    });
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
    if (previous) await setItem(RECOVERY_KEY, previous);
    await setItem(STORAGE_KEY, value);
    return normalized;
}

export async function clearPersistedSnapshot() {
    await removeItem(STORAGE_KEY);
    await removeItem(RECOVERY_KEY);
}

export { STORAGE_KEY, RECOVERY_KEY, BACKUP_FORMAT, BACKUP_VERSION, CURRENT_SCHEMA_VERSION };
