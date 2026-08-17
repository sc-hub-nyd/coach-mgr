import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
};

const { markBackupCreated, getLastBackupAt, buildOperationalDiagnostics, buildOperationsShareText } = await import('../operations-service.js');
const state = {
    teamInfo: { name: 'テストユナイテッド', gasApiUrl: 'https://example.test/gas' },
    syncMeta: { updatedAt: '2026-08-17T08:00:00.000Z', lastSyncedAt: '2026-08-17T07:00:00.000Z' },
    players: [{ id: 1 }, { id: 2 }],
    matches: [{ id: 1 }],
    practices: [{ id: 2 }],
    menuLibrary: [], tactics: [], practiceTemplates: [{ id: 1 }]
};

let diagnostics = buildOperationalDiagnostics(state);
assert.equal(diagnostics.hasCloud, true);
assert.equal(diagnostics.hasUnsyncedChanges, true);
assert.equal(diagnostics.checks.find(check => check.key === 'backup').status, 'attention');
assert.equal(diagnostics.records.players, 2);

markBackupCreated(new Date('2026-08-17T09:00:00.000Z'));
assert.equal(getLastBackupAt(), '2026-08-17T09:00:00.000Z');
diagnostics = buildOperationalDiagnostics(state);
assert.equal(diagnostics.checks.find(check => check.key === 'backup').status, 'ready');
const shareText = buildOperationsShareText('テストユナイテッド', diagnostics);
assert.match(shareText, /テストユナイテッド/);
assert.match(shareText, /未同期の変更あり/);
assert.match(shareText, /選手 2名/);

const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(sw, /SKIP_WAITING/);
assert.match(sw, /operations-service\.js/);
assert.match(html, /pwa-update-banner/);
assert.match(html, /operations-diagnostics/);

console.log('P8 operations tests passed');
