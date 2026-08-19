import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
};

const { markBackupCreated, buildOperationalDiagnostics, buildPreflightChecklist, buildOperationsShareText } = await import('../operations-service.js');
const now = new Date('2026-08-18T09:00:00.000Z');
markBackupCreated(new Date('2026-08-18T08:30:00.000Z'));
const state = {
    teamInfo: { gasApiUrl: 'https://example.test/gas', gasSyncProtocol: 'secure-v2' },
    players: [{ id: 1 }, { id: 2 }], matches: [{ id: 1 }], practices: [], practiceTemplates: [], menuLibrary: [], tactics: [],
    syncMeta: {
        cloudRevision: 8,
        cloudRecoveryAvailable: true,
        updatedAt: '2026-08-18T08:00:00.000Z',
        lastSyncedAt: '2026-08-18T08:15:00.000Z'
    }
};
const diagnostics = buildOperationalDiagnostics(state, { now });
assert.equal(diagnostics.cloudRevision, 8);
assert.equal(diagnostics.cloudRecoveryAvailable, true);
assert.equal(diagnostics.preflight.status, 'ready');
assert.equal(diagnostics.preflight.readyCount, 3);
assert.equal(diagnostics.checks.some(check => check.key === 'cloudRecovery' && check.status === 'ready'), true);
assert.match(buildOperationsShareText('Test', diagnostics), /クラウド世代：世代 8（復旧可）/);

const attentionState = {
    ...state,
    syncMeta: { ...state.syncMeta, updatedAt: '2026-08-18T09:30:00.000Z', lastSyncedAt: '2026-08-18T08:15:00.000Z', cloudRecoveryAvailable: false }
};
const preflight = buildPreflightChecklist(attentionState, buildOperationalDiagnostics(attentionState, { now }));
assert.equal(preflight.status, 'attention');
assert.equal(preflight.nextAction.action, 'sync');
assert.equal(preflight.items.some(item => item.key === 'sync' && item.status === 'attention'), true);

const [app, html, css] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.doesNotMatch(app, /renderDashboardPreflight|runDashboardPreflightAction/);
assert.doesNotMatch(html, /dash-preflight-card|btn-dash-preflight-action/);
assert.doesNotMatch(css, /dash-preflight-item/);

console.log('P17 operations diagnostics and removed preflight UI tests passed');
