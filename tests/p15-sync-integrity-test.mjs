import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    ensureSyncMeta,
    markLocalChange,
    markSyncAcknowledged,
    hasSyncConflict,
    applyRemoteSnapshot,
    getExpectedCloudRevision
} from '../sync-controller.js';
import { createCloudPayload, pushCloud, SyncError } from '../sync-service.js';

const iso = '2026-08-18T00:00:00.000Z';
const local = {
    players: [{ id: 1 }],
    matches: [],
    practices: [],
    teamInfo: { name: 'Local' },
    syncMeta: { deviceId: 'device-a', revision: 5, cloudRevision: 3, updatedAt: iso, lastSyncedAt: '2026-08-17T00:00:00.000Z' }
};
ensureSyncMeta(local);
assert.equal(getExpectedCloudRevision(local), 3);
markLocalChange(local, new Date('2026-08-18T01:00:00.000Z'));
assert.equal(local.syncMeta.revision, 6);
assert.equal(local.syncMeta.cloudRevision, 3);

const remote = {
    players: [{ id: 2 }],
    matches: [{ id: 10 }],
    practices: [],
    teamInfo: { name: 'Cloud' },
    syncMeta: { deviceId: 'device-b', revision: 7, cloudRevision: 4, updatedAt: '2026-08-18T02:00:00.000Z' }
};
assert.equal(hasSyncConflict(local, remote), true);
applyRemoteSnapshot(local, remote);
assert.equal(local.syncMeta.deviceId, 'device-a');
assert.equal(local.syncMeta.cloudRevision, 4);
assert.equal(local.players[0].id, 2);
markSyncAcknowledged(local, new Date('2026-08-18T03:00:00.000Z'), { revision: 5, recoveryAvailable: true });
assert.equal(local.syncMeta.cloudRevision, 5);
assert.equal(local.syncMeta.cloudRecoveryAvailable, true);

const payload = createCloudPayload({ gasSheetName: 'test', gasAuthToken: 'secure-token' }, { matches: [] }, { expectedRevision: 5, force: true });
assert.equal(payload.expectedRevision, 5);
assert.equal(payload.force, true);

const calls = [];
await pushCloud({
    teamInfo: { gasApiUrl: 'https://example.test/gas', gasSheetName: 'test', gasAuthToken: 'secure-token' },
    data: { matches: [] },
    expectedRevision: 5,
    fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, json: async () => ({ status: 'success', meta: { revision: 6 } }) };
    }
});
assert.equal(JSON.parse(calls[0].options.body).expectedRevision, 5);

await assert.rejects(
    () => pushCloud({
        teamInfo: { gasApiUrl: 'https://example.test/gas' },
        data: {},
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 'error', code: 'revision_conflict', message: 'conflict', meta: { revision: 7 } }) })
    }),
    error => error instanceof SyncError && error.kind === 'conflict' && error.code === 'revision_conflict' && error.meta.revision === 7
);

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const dialog = await readFile(new URL('../sync-conflict-dialog.js', import.meta.url), 'utf8');
assert.match(app, /expectedRevision/);
assert.match(app, /showSyncConflictDialog/);
assert.match(dialog, /端末版を残す/);
assert.match(dialog, /クラウドを復元/);

console.log('P15 sync integrity tests passed');
