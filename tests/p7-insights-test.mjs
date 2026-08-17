import assert from 'node:assert/strict';
import { buildTeamInsights, buildPlayerInsights, getTimelinePresentation, buildInsightsShareText } from '../insights-service.js';

const state = {
    teamInfo: { name: 'テストユナイテッド' },
    players: [{ id: 1, name: '太郎', number: 10 }, { id: 2, name: '花子', number: 11 }],
    practices: [{
        id: 301,
        date: '2026-08-16',
        location: '市民G',
        callUpPlayerIds: [1, 2],
        attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'absent' } },
        presentPlayerIds: [1],
        menus: [{ id: 1, focus: '対面パス' }]
    }],
    matches: [{
        id: 201,
        date: '2026-08-15',
        opponent: 'テストFC',
        callUpPlayerIds: [1, 2],
        attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' } },
        presentPlayerIds: [1],
        formations: [{
            eventHistory: [
                { id: 'e1', type: 'score', scorerId: 1, assistId: 2, elapsedSeconds: 180 },
                { id: 'e2', type: 'concede', elapsedSeconds: 360 },
                { id: 'e3', type: 'card', playerId: 1, cardType: 'yellow', elapsedSeconds: 420 }
            ]
        }]
    }, {
        id: 202,
        date: '2026-08-14',
        opponent: 'レガシーFC',
        presentPlayerIds: [1],
        formations: [{ goalRecords: [{ scorerId: 1 }, { isOpponent: true }] }]
    }]
};

const team = buildTeamInsights(state, { days: 'all' });
assert.equal(team.matches, 2);
assert.equal(team.practices, 1);
assert.equal(team.goals, 2);
assert.equal(team.conceded, 2);
assert.equal(team.cards, 1);
assert.equal(team.attendance.attending, 2);
assert.equal(team.attendance.absent, 1);
assert.equal(team.attendance.pending, 1);
assert.equal(team.timeline.length, 6);

const player = buildPlayerInsights(state, 1, { days: 'all' });
assert.equal(player.player.name, '太郎');
assert.equal(player.attendance.invited, 3);
assert.equal(player.attendance.attending, 3);
assert.equal(player.attendance.rate, 100);
assert.equal(player.performance.goals, 2);
assert.equal(player.performance.cards, 1);

const card = getTimelinePresentation({ type: 'card', playerId: 1, cardType: 'yellow' }, state.players);
assert.equal(card.label, '太郎に警告');
const report = buildInsightsShareText(state.teamInfo, player.player, team, player);
assert.match(report, /テストユナイテッド/);
assert.match(report, /2得点/);
assert.match(report, /太郎 選手/);

console.log('P7 insights tests passed');
