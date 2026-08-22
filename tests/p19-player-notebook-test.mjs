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
const observationSummary = buildDevelopmentSummary({ id: 10, history: [{ id: 11, date: '2026-08-09', comment: '観察記録' }] });
assert.equal(observationSummary.timeline[0].kind, 'observation');
assert.equal(removeDevelopmentNote(player, first.id).id, first.id);
assert.equal(player.developmentNotes.length, 1);
assert.throws(() => addDevelopmentNote(player, {}), /観察メモ、次の一歩/);

const [html, players, css, componentCss, base, tokens, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../players.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components-system.css', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/base.css', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/tokens.css', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8')
]);
assert.match(html, /pd-tab-notebook/);
assert.match(html, /form-player-development-note/);
assert.match(html, /development-note-ratings/);
assert.match(html, /c-focus-summary/);
assert.match(html, /c-data-list--notebook/);
assert.match(html, /pd-notebook-timeline-view/);
assert.match(html, /pd-notebook-search-view/);
assert.match(html, /role="tablist" aria-label="育成記録の表示モード"/);
assert.match(html, /pd-notebook-search-results/);
assert.match(html, /pd-timeline-location/);
assert.match(html, /pd-timeline-search-return/);
assert.match(html, /pd-timeline-role-focus/);
assert.match(html, /pd-notebook-search-summary/);
assert.match(html, /btn-notebook-clear-search/);
assert.match(html, /select-notebook-nendo/);
assert.match(html, /notebook-signal-filters/);
assert.match(html, /data-notebook-signal="next-step"/);
assert.match(html, /data-notebook-signal="skill-rated"/);
assert.match(html, /pd-match-footprints/);
assert.match(html, /pd-match-milestones/);
assert.match(html, /pd-match-footprints-search-view/);
assert.match(html, /input-match-footprints-search/);
assert.match(html, /select-match-footprints-nendo/);
assert.match(html, /select-match-footprints-result/);
assert.match(html, /match-footprints-signal-filters/);
assert.doesNotMatch(html, /id="pd-notebook-timeline" class="[^"]*c-data-list--scrollable/);
assert.match(html, /c-settings-form/);
assert.match(players, /renderDevelopmentNotebook/);
assert.match(players, /addDevelopmentNote/);
assert.match(players, /c-metric--inline/);
assert.match(players, /c-data-list__item/);
assert.match(players, /c-empty-state c-empty-state--compact/);
assert.match(players, /data-timeline-nendo/);
assert.match(players, /data-timeline-result-record/);
assert.match(players, /buildPlayerTimelineArchive/);
assert.match(players, /buildPlayerExperienceArchive/);
assert.match(players, /renderPlayerExperience/);
assert.match(players, /getPlayerTimelineUiState/);
assert.match(players, /data-timeline-jump-month/);
assert.match(players, /data-timeline-role-action/);
assert.match(players, /searchReturnActive/);
assert.match(players, /focusTimelineRecord/);
assert.match(players, /ArrowRight/);
assert.match(players, /aria-selected/);
assert.match(players, /data-timeline-load-more/);
assert.match(players, /filterNendo/);
assert.match(players, /filterSignal/);
assert.match(players, /motionIntent/);
assert.match(players, /is-pulse-arrival-enter/);
assert.match(players, /is-pulse-complete-enter/);
assert.match(players, /showToast\('育成ノートを記録しました', \{ type: 'success'/);
assert.match(players, /data-experience-match/);
assert.match(players, /matchLimit/);
assert.match(players, /addEventListener\('click'/);
assert.doesNotMatch(players, /custom-footprints|onclick=".*timeline/);
assert.match(css, /c-data-list--notebook/);
assert.match(componentCss, /c-timeline-mode-switch/);
assert.match(componentCss, /c-timeline-record/);
assert.match(componentCss, /c-timeline-location/);
assert.match(componentCss, /c-timeline-search-return/);
assert.match(componentCss, /c-timeline-month-summary/);
assert.match(componentCss, /c-timeline-month-nav/);
assert.match(componentCss, /c-timeline-role-focus/);
assert.match(componentCss, /c-timeline-search-more/);
assert.match(componentCss, /c-timeline-search-structured/);
assert.match(componentCss, /c-experience-milestones/);
assert.match(componentCss, /c-experience-item/);
assert.match(componentCss, /color-motion-arrival/);
assert.match(componentCss, /is-pulse-route-enter/);
assert.match(componentCss, /is-route-arrival/);
assert.doesNotMatch(componentCss, /data:image\/svg|custom-footprints/);
assert.match(base, /form-player-development-note/);
assert.match(tokens, /--color-motion-route: var\(--color-success\)/);
assert.match(tokens, /--color-motion-arrival: var\(--color-warning\)/);
assert.match(tokens, /--duration-route: 220ms/);
assert.match(tokens, /data-reduce-motion="true"[\s\S]*--duration-route: 1ms/);
assert.match(app, /triggerTransientMotion/);
assert.match(app, /is-route-arrival/);
console.log('P19 player notebook tests passed');
