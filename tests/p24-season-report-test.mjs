import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSeasonReport, buildSeasonReportCsv, buildSeasonReportPrintHtml } from '../season-report-service.js';

const state = {
    teamInfo: { name: 'テストユナイテッド' },
    players: [{ id: 1, number: 8, name: '選手A' }, { id: 2, number: 9, name: '選手B' }],
    matches: [{ id: 1, date: '2026-05-01', opponent: 'FC A', type: 'リーグ戦', result: '2-1', goalRecords: [{ scorerId: 1, assistId: 2 }, { scorerId: 1 }], callUpPlayerIds: [1, 2], attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'absent' } } }],
    practices: [{ id: 2, date: '2026-05-03', location: 'G', callUpPlayerIds: [1, 2], attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' } } }]
};
const report = buildSeasonReport(state, { teamName: 'テストユナイテッド', seasonName: '2026年度' });
assert.equal(report.summary.matches, 1);
assert.equal(report.summary.wins, 1);
assert.equal(report.summary.goalsFor, 2);
assert.equal(report.summary.goalsAgainst, 1);
assert.equal(report.summary.practices, 1);
assert.equal(report.players.find(player => player.id === 1).attendanceRate, 100);
assert.equal(report.players.find(player => player.id === 1).goals, 2);
assert.equal(report.players.find(player => player.id === 2).assists, 1);
const csv = buildSeasonReportCsv(report);
assert.ok(csv.startsWith('\uFEFF'));
assert.match(csv, /選手A/);
assert.match(csv, /FC A/);
const printable = buildSeasonReportPrintHtml(report);
assert.match(printable, /2026年度/);
assert.match(printable, /window\.print/);

const [index, settings, css, sw] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8')
]);
assert.match(index, /season-report-section/);
assert.match(index, /btn-export-season-report-csv/);
assert.match(settings, /buildSeasonReportCsv/);
assert.match(settings, /btn-print-season-report/);
assert.match(css, /season-report-summary/);
assert.match(sw, /season-report-service\.js/);
console.log('P24 season report tests passed');
