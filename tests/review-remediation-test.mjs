import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ensureFieldPeriod, appendFieldEvent, removeFieldEvent, setFieldClockRunning, getFieldClockSeconds } from '../field-companion-service.js';
import { createCloudSnapshot } from '../repository.js';
import { ensureSyncMeta, markLocalChange, markSyncAcknowledged, hasSyncConflict, applyRemoteSnapshot } from '../sync-controller.js';

const match = { formations: [] };
const first = ensureFieldPeriod(match, 0);
const second = ensureFieldPeriod(match, 1);
assert.equal(match.formations.length, 2);
assert.notEqual(first, second);
first.scoreUs = 1;
const score = appendFieldEvent(first, { type: 'score', scorerId: 1 }, new Date('2026-08-17T00:01:00.000Z'));
first.goalRecords.push({ eventId: score.id, scorerId: 1 });
second.scoreThem = 1;
const concede = appendFieldEvent(second, { type: 'concede' }, new Date('2026-08-17T00:02:00.000Z'));
assert.equal(first.eventHistory.length, 1);
assert.equal(second.eventHistory.length, 1);
removeFieldEvent(second, concede.id);
assert.equal(second.scoreThem, 0);
assert.equal(second.eventHistory.length, 0);
setFieldClockRunning(first, true, new Date('2026-08-17T00:00:00.000Z'));
assert.equal(getFieldClockSeconds(first, new Date('2026-08-17T00:01:05.000Z').getTime()), 65);
setFieldClockRunning(first, false, new Date('2026-08-17T00:01:05.000Z'));
assert.equal(first.fieldClockSeconds, 65);

const local = { teamInfo: {}, matches: [{ id: 1 }], syncMeta: { deviceId: 'local', revision: 1, updatedAt: '2026-08-17T10:00:00.000Z', lastSyncedAt: '2026-08-17T09:00:00.000Z' } };
ensureSyncMeta(local);
const remote = { matches: [{ id: 2 }], syncMeta: { deviceId: 'remote', revision: 1, updatedAt: '2026-08-17T10:30:00.000Z', lastSyncedAt: '2026-08-17T09:00:00.000Z' } };
assert.equal(hasSyncConflict(local, remote), true);
applyRemoteSnapshot(local, { ...remote, teamInfo: { name: '共有チーム', gasAuthToken: 'remote-secret' } });
assert.equal(local.matches[0].id, 2);
assert.equal(local.teamInfo.gasAuthToken, undefined);
// P15: pullはクラウド側の端末IDをコピーせず、このブラウザ固有の識別子を保持する。
assert.equal(local.syncMeta.deviceId, 'local');
markLocalChange(local, new Date('2026-08-17T11:00:00.000Z'));
assert.equal(local.syncMeta.revision, 2);
markSyncAcknowledged(local, new Date('2026-08-17T11:01:00.000Z'));
assert.equal(local.syncMeta.lastSyncedAt, '2026-08-17T11:01:00.000Z');

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const urls = [...sw.matchAll(/'\.\/([^']+)'/g)].map(matchItem => matchItem[1]);
for (const url of urls) {
    assert.equal(existsSync(new URL(`../${url}`, import.meta.url)), true, `missing precache asset: ${url}`);
}
assert.equal(sw.includes("'./base.css'"), false);

const settings = readFileSync(new URL('../settings.js', import.meta.url), 'utf8');
const inviteSection = settings.slice(settings.indexOf('btnCopyInviteLink'), settings.indexOf('function renderList'));
assert.equal(inviteSection.includes("params.set('authToken'"), false);
const cloudSnapshot = createCloudSnapshot({ teamInfo: { name: '共有チーム', gasAuthToken: 'local-secret' } });
assert.equal(Object.hasOwn(cloudSnapshot.teamInfo, 'gasAuthToken'), false);

for (const moduleName of ['library.js', 'matches.js', 'players.js', 'practices.js', 'settings.js', 'tactics.js']) {
    const source = readFileSync(new URL(`../${moduleName}`, import.meta.url), 'utf8');
    assert.equal(source.includes("from './app.js'"), false, `${moduleName} must not import app.js directly`);
    assert.equal(source.includes("from './app-context.js'"), true, `${moduleName} must import app-context.js`);
}
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.equal(appSource.includes('configureAppContext({'), true);

console.log('Review remediation tests passed');
