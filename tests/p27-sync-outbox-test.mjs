import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { acknowledgeSyncOutboxItem, appendSyncAudit, enqueueSyncSnapshot, getNextSyncItem, getSyncOutboxSummary, markSyncOutboxFailed, markSyncOutboxSending } from '../sync-outbox-service.js';
import { buildOperationalDiagnostics } from '../operations-service.js';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const state = { syncOutbox: { items: [] }, syncAudit: [], teamInfo: { gasApiUrl: 'https://example.test', gasSyncProtocol: 'secure-v2' }, syncMeta: {}, players: [], matches: [], practices: [], practiceTemplates: [] };
const first = enqueueSyncSnapshot(state, { revision: 1 }, { expectedRevision: 3 });
const collapsed = enqueueSyncSnapshot(state, { revision: 2 }, { expectedRevision: 4 });
assert.equal(state.syncOutbox.items.length, 1);
assert.equal(first.id, collapsed.id);
assert.equal(collapsed.payload.revision, 2);
markSyncOutboxSending(state, collapsed.id);
assert.equal(collapsed.status, 'sending');
assert.equal(collapsed.attempts, 1);
markSyncOutboxFailed(state, collapsed.id, { kind: 'network', message: 'offline' });
assert.equal(collapsed.status, 'pending');
assert.equal(collapsed.lastError.kind, 'network');
appendSyncAudit(state, { type: 'failed', itemId: collapsed.id, message: 'offline' });
assert.equal(getSyncOutboxSummary(state).pendingCount, 1);
assert.equal(getNextSyncItem(state).id, collapsed.id);
acknowledgeSyncOutboxItem(state, collapsed.id);
appendSyncAudit(state, { type: 'acknowledged', itemId: collapsed.id, message: 'accepted' });
assert.equal(state.syncOutbox.items.length, 0);
assert.equal(getSyncOutboxSummary(state).latest.type, 'acknowledged');
const diagnostics = buildOperationalDiagnostics(state);
assert.equal(diagnostics.outbox.pendingCount, 0);
assert.ok(diagnostics.checks.some(check => check.key === 'outbox'));

const [app, repository, settings, index, css] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../repository.js', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.match(app, /enqueueSyncSnapshot/);
assert.match(app, /acknowledgeSyncOutboxItem/);
assert.match(app, /retryPendingSyncOutbox/);
assert.match(repository, /loadSyncOutbox/);
assert.match(repository, /saveSyncAudit/);
assert.match(settings, /sync-audit-history/);
assert.match(index, /btn-retry-sync-outbox/);
assert.match(css, /sync-audit-history/);
console.log('P27 sync outbox tests passed');
