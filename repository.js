const STORAGE_KEY = 'coachMgrData';
const BACKUP_FORMAT = 'coachmgr-backup';
const BACKUP_VERSION = 1;

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createStateSnapshot(state) {
    return clone({
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
        exportedAt: new Date().toISOString(),
        data: createStateSnapshot(state)
    };
}

export function parseBackupPayload(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const candidate = parsed && parsed.format === BACKUP_FORMAT ? parsed.data : parsed;
    if (!candidate || typeof candidate !== 'object') {
        throw new Error('バックアップデータの形式が正しくありません');
    }
    const hasKnownCollection = ['matches', 'practices', 'players', 'menuLibrary', 'tactics']
        .some(key => Array.isArray(candidate[key]));
    if (!hasKnownCollection) {
        throw new Error('CoachMgrのバックアップデータではありません');
    }
    return clone(candidate);
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

export async function loadPersistedSnapshot({ decryptData } = {}) {
    let saved = null;
    if (typeof localforage !== 'undefined') {
        saved = await localforage.getItem(STORAGE_KEY);
    }
    if (!saved) {
        const oldSaved = localStorage.getItem(STORAGE_KEY);
        if (oldSaved) {
            saved = oldSaved;
            if (typeof localforage !== 'undefined') await localforage.setItem(STORAGE_KEY, oldSaved);
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    if (!saved) return null;
    return decodeStoredValue(saved, decryptData || (value => value));
}

export async function savePersistedSnapshot(snapshot, { encryptData } = {}) {
    const serialized = JSON.stringify(snapshot);
    const value = encryptData ? `enc:${encryptData(serialized)}` : serialized;
    if (typeof localforage !== 'undefined') {
        await localforage.setItem(STORAGE_KEY, value);
    } else {
        localStorage.setItem(STORAGE_KEY, value);
    }
    return snapshot;
}

export async function clearPersistedSnapshot() {
    if (typeof localforage !== 'undefined') {
        await localforage.removeItem(STORAGE_KEY);
    }
    localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY, BACKUP_FORMAT, BACKUP_VERSION };
