import assert from 'node:assert/strict';
import {
    createStateSnapshot,
    createBackupPayload,
    parseBackupPayload,
    savePersistedSnapshot,
    loadPersistedSnapshot,
    clearPersistedSnapshot,
    CURRENT_SCHEMA_VERSION,
    BACKUP_VERSION
} from '../repository.js';
import {
    SyncError,
    pushCloud,
    pullCloud,
    withRetry
} from '../sync-service.js';

const local = new Map();
globalThis.localStorage = {
    getItem: key => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, String(value)),
    removeItem: key => local.delete(key)
};
globalThis.localforage = undefined;

const legacy = {
    matches: [{ id: 1, formations: [{ goalRecords: [] }] }],
    practices: [],
    players: [],
    menuLibrary: [],
    tactics: []
};
const migrated = parseBackupPayload(legacy);
assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
assert.deepEqual(migrated.matches[0].formations[0].eventHistory, []);
assert.equal(migrated.teamInfo.constructor, Object);

const payload = createBackupPayload({ ...legacy, teamInfo: { name: 'Test' } });
assert.equal(payload.version, BACKUP_VERSION);
assert.equal(parseBackupPayload(JSON.stringify(payload)).matches.length, 1);

await savePersistedSnapshot(legacy);
const loaded = await loadPersistedSnapshot();
assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION);
assert.equal(loaded.matches[0].formations[0].eventHistory.length, 0);

await savePersistedSnapshot({ matches: [{ id: 2 }], practices: [], players: [], menuLibrary: [], tactics: [] });
local.set('coachMgrData', '{broken-json');
const recovered = await loadPersistedSnapshot();
assert.equal(recovered.matches[0].id, 1);
await clearPersistedSnapshot();
assert.equal(await loadPersistedSnapshot(), null);

let attempts = 0;
const retried = await withRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new SyncError('temporary', { kind: 'network', retryable: true });
    return 'ok';
}, { retries: 2, baseDelayMs: 0, sleep: async () => {} });
assert.equal(retried, 'ok');
assert.equal(attempts, 3);

const calls = [];
const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: { matches: [] } }) };
};
const teamInfo = { gasApiUrl: 'https://example.test/gas', gasSheetName: 'Coach', gasAuthToken: 'token' };
await pushCloud({ teamInfo, data: { matches: [] }, fetchImpl: fakeFetch, timeoutMs: 1000 });
const pulled = await pullCloud({ teamInfo, fetchImpl: fakeFetch, timeoutMs: 1000 });
assert.deepEqual(pulled, { matches: [] });
assert.equal(calls[0].options.method, 'POST');
assert.equal(calls[1].options.method, 'GET');

await assert.rejects(
    () => pushCloud({ teamInfo: { gasApiUrl: 'not-a-url' }, data: {}, fetchImpl: fakeFetch }),
    error => error instanceof SyncError && error.kind === 'configuration' && !error.retryable
);

console.log('P4 core tests passed');
