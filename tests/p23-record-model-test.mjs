import assert from 'node:assert/strict';
import { createStateSnapshot, parseBackupPayload, CURRENT_SCHEMA_VERSION } from '../repository.js';
import { ensureRecordMetadata, mergeSnapshotsByRecord, softDeleteRecord, touchRecordsForSave } from '../record-service.js';
import { applyRemoteSnapshot } from '../sync-controller.js';
import { ensureWorkspaceState, hydrateActiveWorkspace } from '../workspace-service.js';
import { readFile } from 'node:fs/promises';

const state = {
    matches: [{ id: 100, date: '2026-05-01', opponent: 'A' }], practices: [], players: [{ id: 1, name: '選手A' }], menuLibrary: [], tactics: [], practiceTemplates: [], customFormations: [],
    matchTypes: [], menuCategories: [], tacticsCategories: [], analysisTags: [], skillMetrics: [], positions: [], positionsCat2: [],
    teamInfo: { name: 'テスト', color: '#13795b' }, teamFocus: {}, syncMeta: {}
};
ensureWorkspaceState(state);
ensureRecordMetadata(state, new Date('2026-05-01T00:00:00Z'));
assert.equal(CURRENT_SCHEMA_VERSION, 3);
assert.match(state.players[0].recordId, /^players-/);
assert.equal(state.players[0].deletedAt, null);
touchRecordsForSave(state, new Date('2026-05-02T00:00:00Z'));
const originalUpdatedAt = state.players[0].updatedAt;
state.players[0].name = '選手A 改';
touchRecordsForSave(state, new Date('2026-05-03T00:00:00Z'));
assert.notEqual(state.players[0].updatedAt, originalUpdatedAt);
const playerRecordId = state.players[0].recordId;
assert.equal(softDeleteRecord(state, 'players', 1, new Date('2026-05-04T00:00:00Z')), true);
assert.equal(state.players.length, 0);
assert.ok(Object.values(state.syncMeta.tombstones).some(item => item.recordId === playerRecordId));
const snapshot = createStateSnapshot(state);
assert.equal(snapshot.schemaVersion, 3);
assert.equal(parseBackupPayload(snapshot).schemaVersion, 3);

const local = {
    activeTeamId: 'team', activeSeasonId: 'season', teams: [], workspaces: {},
    players: [{ id: 2, recordId: 'players-2', name: 'Local', updatedAt: '2026-05-04T00:00:00Z', deletedAt: null }],
    matches: [], practices: [], menuLibrary: [], tactics: [], practiceTemplates: [], customFormations: [], teamFocus: { updatedAt: '2026-05-04T00:00:00Z' },
    syncMeta: { tombstones: {} }
};
const remote = {
    activeTeamId: 'team', activeSeasonId: 'season', teams: [], workspaces: {},
    players: [{ id: 2, recordId: 'players-2', name: 'Remote newer', updatedAt: '2026-05-05T00:00:00Z', deletedAt: null }],
    matches: [], practices: [], menuLibrary: [], tactics: [], practiceTemplates: [], customFormations: [], teamFocus: { updatedAt: '2026-05-03T00:00:00Z' },
    syncMeta: { tombstones: {} }
};
let merged = mergeSnapshotsByRecord(local, remote);
assert.equal(merged.players[0].name, 'Remote newer');
remote.syncMeta.tombstones = { 'team:season:players:players-2': { collection: 'players', recordId: 'players-2', scope: 'team:season', deletedAt: '2026-05-06T00:00:00Z' } };
merged = mergeSnapshotsByRecord(local, remote);
assert.equal(merged.players.length, 0);

const tokenRetentionState = { syncMeta: {}, workspaces: { 'team:season': { teamInfo: { gasAuthToken: 'device-only-token' } } }, teamInfo: {}, matches: [], practices: [], players: [] };
applyRemoteSnapshot(tokenRetentionState, { workspaces: { 'team:season': { teamInfo: { name: 'クラウドチーム' }, players: [] } }, syncMeta: {} });
assert.equal(tokenRetentionState.workspaces['team:season'].teamInfo.gasAuthToken, 'device-only-token');

const importedPractice = { id: 9001, date: '2026-08-18', location: 'チームグラウンド', menus: [] };
const importedState = {
    activeTeamId: 'team', activeSeasonId: 'season',
    teams: [{ id: 'team', name: 'テスト', seasons: [{ id: 'season', name: '2026年度' }] }],
    workspaces: { 'team:season': { practices: [], matches: [], players: [] } },
    practices: [importedPractice], matches: [], players: [], menuLibrary: [], tactics: [], practiceTemplates: [],
    matchTypes: [], menuCategories: [], tacticsCategories: [], analysisTags: [], skillMetrics: [], positions: [], positionsCat2: [], customFormations: [],
    teamInfo: { name: 'テスト' }, teamFocus: {}, syncMeta: {}
};
hydrateActiveWorkspace(importedState, { preferTopLevel: true });
assert.equal(importedState.practices.length, 1);
assert.equal(importedState.practices[0].id, importedPractice.id);
assert.equal(importedState.workspaces['team:season'].practices.length, 1);

const [app, controller, dialog] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../sync-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../sync-conflict-dialog.js', import.meta.url), 'utf8')
]);
assert.match(app, /mergeSnapshotsByRecord/);
assert.match(app, /touchRecordsForSave/);
assert.match(controller, /tombstones/);
assert.match(dialog, /data-action="merge"/);
console.log('P23 record model tests passed');
