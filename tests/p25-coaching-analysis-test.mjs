import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoachingRecommendations, buildPeriodComparison, buildPositionParticipation } from '../insights-service.js';

const now = new Date('2026-08-18T12:00:00Z');
const state = {
    players: [{ id: 1, name: '選手A', position: 'DF' }, { id: 2, name: '選手B', position: 'FW' }],
    matches: [
        { id: 1, date: '2026-08-10', attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' } }, formations: [{ initialActivePlayerIds: [1], fieldClockSeconds: 600, fieldClockRunning: false, eventHistory: [{ type: 'score', scorerId: 2, elapsedSeconds: 120 }, { type: 'concede', elapsedSeconds: 200 }, { type: 'concede', elapsedSeconds: 260 }, { type: 'substitution', playerOutId: 1, playerInId: 2, elapsedSeconds: 300 }] }] },
        { id: 2, date: '2026-07-01', attendanceByPlayer: { '1': { status: 'attending' } }, formations: [{ initialActivePlayerIds: [1], fieldClockSeconds: 300, fieldClockRunning: false, eventHistory: [{ type: 'score', scorerId: 1, elapsedSeconds: 120 }] }] }
    ],
    practices: [{ id: 3, date: '2026-08-12', attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' } }, menus: [{ id: 1, focus: '守備の切り替え' }] }]
};
const comparison = buildPeriodComparison(state, { days: 30, now });
assert.equal(comparison.current.matches, 1);
assert.equal(comparison.previous.matches, 1);
assert.equal(comparison.current.goalDifference, -1);
assert.equal(comparison.deltas.goalDifference, -2);
const positions = buildPositionParticipation(state, { days: 90, now });
assert.equal(positions.find(item => item.position === 'DF').minutes, 10);
assert.equal(positions.find(item => item.position === 'FW').minutes, 5);
const recommendations = buildCoachingRecommendations(state, { days: 30, now });
assert.ok(recommendations.some(item => item.title.includes('守備')));
assert.ok(recommendations.some(item => item.title.includes('出欠')));

const [html, script, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../insights.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.match(html, /insights-comparison/);
assert.match(html, /insights-position-participation/);
assert.match(html, /insights-recommendations/);
assert.match(script, /buildPeriodComparison/);
assert.match(script, /buildCoachingRecommendations/);
assert.match(css, /insights-comparison-grid/);
console.log('P25 coaching analysis tests passed');
