import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCloudSnapshot, createStateSnapshot, parseBackupPayload } from '../repository.js';
import { archiveSeason, createSeason, createTeam, ensureWorkspaceState, getActiveSeason, getActiveTeam, switchWorkspace } from '../workspace-service.js';

const state = {
    matches: [{ id: 1, date: '2026-04-01', opponent: 'テストFC' }],
    practices: [{ id: 2, date: '2026-04-02' }],
    players: [{ id: 10, name: '選手A', number: 7 }],
    menuLibrary: [{ id: 3, title: 'パス' }], tactics: [], practiceTemplates: [],
    matchTypes: ['リーグ戦'], menuCategories: ['ゲーム'], tacticsCategories: ['その他'], analysisTags: ['メモ'], skillMetrics: ['パス'], positions: ['MF'], positionsCat2: ['CH'], customFormations: [],
    teamInfo: { name: '既存チーム', color: '#13795b', passcode: '7064', gasAuthToken: 'confidential-token' }, teamFocus: { mainTheme: '守備', points: [], note: '' }, syncMeta: {}
};

ensureWorkspaceState(state);
assert.equal(state.teams.length, 1);
assert.equal(getActiveTeam(state).name, '既存チーム');
assert.equal(getActiveSeason(state).name.endsWith('年度'), true);
const originalTeamId = state.activeTeamId;
const originalSeasonId = state.activeSeasonId;
const snapshot = createStateSnapshot(state);
assert.equal(snapshot.teams.length, 1);
assert.ok(snapshot.workspaces[`${originalTeamId}:${originalSeasonId}`]);
const cloudSnapshot = createCloudSnapshot(state);
assert.equal(cloudSnapshot.teamInfo.gasAuthToken, undefined);
assert.equal(cloudSnapshot.workspaces[`${originalTeamId}:${originalSeasonId}`].teamInfo.gasAuthToken, undefined);
const restored = parseBackupPayload(snapshot);
assert.equal(restored.teams.length, 1);

createSeason(state, { name: '2027年度', copyPlayers: true, copyTeamSetup: true });
assert.equal(getActiveSeason(state).name, '2027年度');
assert.equal(state.matches.length, 0);
assert.equal(state.practices.length, 0);
assert.equal(state.players.length, 1);
const newSeasonId = state.activeSeasonId;
switchWorkspace(state, originalTeamId, originalSeasonId);
assert.equal(state.matches.length, 1);
assert.equal(state.players[0].name, '選手A');
archiveSeason(state, originalTeamId, newSeasonId);
assert.ok(getActiveTeam(state).seasons.find(season => season.id === newSeasonId).archivedAt);
createTeam(state, { name: 'Bチーム', color: '#123456' });
assert.equal(getActiveTeam(state).name, 'Bチーム');
assert.equal(state.matches.length, 0);
assert.equal(state.players.length, 0);

const [html, settings, app, css, stateSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8'),
    readFile(new URL('../state.js', import.meta.url), 'utf8')
]);
assert.match(html, /workspace-team-select/);
assert.match(html, /btn-workspace-new-season/);
assert.match(settings, /switchWorkspace/);
assert.match(settings, /createSeason/);
assert.match(app, /hydrateActiveWorkspace/);
assert.match(css, /workspace-management-body/);
assert.match(stateSource, /activeSeasonId/);
console.log('P22 workspace tests passed');
