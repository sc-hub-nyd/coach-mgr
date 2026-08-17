import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
};
globalThis.localforage = undefined;

const {
    clearPersistedSnapshot,
    savePersistedSnapshot,
    loadRecoverySnapshot,
    getLastRecoveryAt
} = await import('../repository.js');
const {
    ensureSyncMeta,
    markSyncFailure,
    markSyncAcknowledged
} = await import('../sync-controller.js');
const {
    buildOperationalDiagnostics,
    buildOperationsShareText
} = await import('../operations-service.js');

await clearPersistedSnapshot();
await savePersistedSnapshot({ matches: [{ id: 1 }], practices: [], players: [], menuLibrary: [], tactics: [] });
await savePersistedSnapshot({ matches: [{ id: 2 }], practices: [], players: [], menuLibrary: [], tactics: [] });
const recovery = await loadRecoverySnapshot();
assert.equal(recovery.matches[0].id, 1);
assert.ok(getLastRecoveryAt());

const state = {
    teamInfo: { name: 'テストユナイテッド', gasApiUrl: 'https://example.test/gas' },
    matches: [{ id: 2 }], practices: [], players: [], menuLibrary: [], tactics: [], practiceTemplates: []
};
ensureSyncMeta(state);
markSyncFailure(state, { kind: 'network', message: 'https://token.example.test/path に接続できません' }, new Date('2026-08-18T01:00:00.000Z'));
assert.equal(state.syncMeta.lastErrorKind, 'network');
assert.match(state.syncMeta.lastErrorMessage, /\[URL非表示\]/);
assert.doesNotMatch(state.syncMeta.lastErrorMessage, /token\.example/);

let diagnostics = buildOperationalDiagnostics(state, { now: new Date('2026-08-18T01:30:00.000Z') });
assert.equal(diagnostics.lastSyncError.kind, 'network');
assert.equal(diagnostics.checks.find(check => check.key === 'sync').status, 'attention');
assert.equal(diagnostics.checks.find(check => check.key === 'recovery').status, 'ready');
assert.match(buildOperationsShareText('テストユナイテッド', diagnostics), /自動復旧ポイント/);
assert.match(buildOperationsShareText('テストユナイテッド', diagnostics), /直近の失敗：network/);

markSyncAcknowledged(state, new Date('2026-08-18T02:00:00.000Z'));
diagnostics = buildOperationalDiagnostics(state, { now: new Date('2026-08-18T02:01:00.000Z') });
assert.equal(diagnostics.lastSyncError, null);

const settingsSource = await readFile(new URL('../settings.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(settingsSource, /exportRecoveryBackupData/);
assert.match(indexSource, /btn-export-recovery/);

console.log('P11 reliability tests passed');
