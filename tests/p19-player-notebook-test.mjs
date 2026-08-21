import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    addDevelopmentNote,
    buildDevelopmentSummary,
    getSkillTrend,
    removeDevelopmentNote
} from '../player-development-service.js';

const player = { id: 9, name: '選手A', history: [] };
const first = addDevelopmentNote(player, {
    date: '2026-08-01', focus: '守備の寄せ', observation: '相手の利き足を切れた', nextStep: '声を掛けて誘導する', skillRatings: { 守備: 3, パス: 2 }
}, new Date('2026-08-01T01:00:00.000Z'));
const second = addDevelopmentNote(player, {
    date: '2026-08-10', focus: '守備の寄せ', observation: '連続して奪い切れた', skillRatings: { 守備: 4, パス: 2 }
}, new Date('2026-08-10T01:00:00.000Z'));
assert.equal(player.developmentNotes.length, 2);
assert.equal(player.developmentNotes[0].id, second.id);
const trend = getSkillTrend(player, ['守備', 'パス']);
assert.deepEqual(trend[0], { metric: '守備', latest: 4, previous: 3, delta: 1, count: 2 });
assert.deepEqual(trend[1], { metric: 'パス', latest: 2, previous: 2, delta: 0, count: 2 });
const summary = buildDevelopmentSummary(player, {
    metrics: ['守備', 'パス'],
    matches: [{ id: 1, date: '2026-08-12', opponent: 'FC', presentPlayerIds: [9] }],
    practices: [{ id: 2, date: '2026-08-11', presentPlayerIds: [9], location: '河川敷' }]
});
assert.equal(summary.noteCount, 2);
assert.equal(summary.timeline[0].kind, 'match');
assert.equal(removeDevelopmentNote(player, first.id).id, first.id);
assert.equal(player.developmentNotes.length, 1);
assert.throws(() => addDevelopmentNote(player, {}), /観察メモ、次の一歩/);

const [html, players, css, base] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../players.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components-system.css', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/base.css', import.meta.url), 'utf8')
]);
assert.match(html, /pd-tab-notebook/);
assert.match(html, /form-player-development-note/);
assert.match(html, /development-note-ratings/);
assert.match(html, /c-focus-summary/);
assert.match(html, /c-data-list--notebook/);
assert.match(html, /c-settings-form/);
assert.match(players, /renderDevelopmentNotebook/);
assert.match(players, /addDevelopmentNote/);
assert.match(players, /c-metric--inline/);
assert.match(players, /c-data-list__item/);
assert.match(players, /c-empty-state c-empty-state--compact/);
assert.match(css, /c-data-list--notebook/);
assert.match(base, /form-player-development-note/);
console.log('P19 player notebook tests passed');
