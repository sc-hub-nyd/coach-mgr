import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCloudSnapshot, createStateSnapshot, parseBackupPayload } from '../repository.js';
import { archiveSeason, createSeason, createTeam, ensureWorkspaceState, getActiveSeason, getActiveTeam, switchWorkspace } from '../workspace-service.js';
import { buildPlayerTimelineArchive } from '../player-timeline-service.js';

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

const timelineState = {
    matches: [{ id: 'match-2024', date: '2024-09-08', opponent: 'テストFC', presentPlayerIds: ['persist-player'] }],
    practices: [{ id: 'practice-2024', date: '2024-09-01', presentPlayerIds: ['persist-player'], location: '公園' }],
    players: [{
        id: 'persist-player', name: '継続選手', grade: '4年', history: [{ id: 'observe-2024', date: '2024-09-02', comment: '観察' }],
        developmentNotes: [{ id: 'note-2024', date: '2024-09-03', focus: '守備', observation: '寄せる', nextStep: '声を出す', skillRatings: {} }]
    }],
    menuLibrary: [], tactics: [], practiceTemplates: [], matchTypes: [], menuCategories: [], tacticsCategories: [], analysisTags: [], skillMetrics: [], positions: [], positionsCat2: [], customFormations: [], teamInfo: {}, teamFocus: {}, syncMeta: {}
};
ensureWorkspaceState(timelineState);
timelineState.teams[0].seasons[0].name = '2024年度';
createSeason(timelineState, { name: '2025年度', copyPlayers: true, copyTeamSetup: false });
timelineState.players[0].grade = '5年';
timelineState.players[0].developmentNotes.push({ id: 'note-2025', date: '2025-05-03', focus: '展開', observation: '視野を広げる', nextStep: '逆サイドを見る', skillRatings: {} });
timelineState.matches.push({ id: 'match-2025', date: '2025-05-10', opponent: '検証FC', presentPlayerIds: ['persist-player'] });
const archive = buildPlayerTimelineArchive(timelineState, timelineState.players[0]);
assert.equal(archive.sources.length, 2, '同一選手を含む二年度のワークスペースを集約する必要があります');
assert.equal(archive.items.filter(item => item.sourceItemId === 'note-2024').length, 1, '年度コピーされた同一ノートは重複表示してはいけません');
assert.ok(archive.items.some(item => item.sourceItemId === 'match-2024' && item.sourceNendo === '2024'), '過去年度の試合を年表へ含める必要があります');
assert.ok(archive.items.some(item => item.sourceItemId === 'match-2025' && item.sourceNendo === '2025'), '現在年度の試合を年表へ含める必要があります');

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
