import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoachActionCenter, buildParentHomeAgenda, buildPracticePlanDraft, savePracticePlan, buildDecisionCards, loadUiPreferences, saveUiPreferences, applyUiPreferences, UI_PREFERENCES_KEY } from '../experience-service.js';
import { buildMatchdayReadiness, buildMatchdaySaveStatus } from '../matchday-ux-service.js';

const now = new Date('2026-08-18T12:00:00');
const state = {
    currentUserRole: 'coach',
    players: [{ id: 1, name: '蒼', number: 7, position: 'MF' }, { id: 2, name: '凛', number: 9, position: 'FW' }],
    practices: [{ id: 11, date: '2026-08-20', title: 'パス練習', callUpPlayerIds: [1, 2], attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' } } }],
    matches: [{ id: 21, date: '2026-08-16', opponent: 'FCテスト', result: 'loss', scoreUs: 1, scoreThem: 3, formations: [{ scoreUs: 1, scoreThem: 3, lineup: [{ playerId: 1, position: 'MF' }], fieldClockSeconds: 600, eventHistory: [] }] }],
    syncOutbox: { items: [{ id: 'queued-1', status: 'queued' }] },
    teamInfo: {}
};

const coachCenter = buildCoachActionCenter(state, { now });
assert.ok(coachCenter.actions.some(item => item.id === 'sync-outbox'));
assert.ok(coachCenter.actions.some(item => item.id.startsWith('attendance-')));
assert.ok(coachCenter.actions.some(item => item.action === 'create-practice-plan'));

const parentAgenda = buildParentHomeAgenda(state, { playerId: '2', scopes: ['schedule', 'attendance', 'development'] });
// assert.ok(parentAgenda.some(item => item.id.startsWith('rsvp-')));
assert.ok(parentAgenda.some(item => item.id === 'development'));

const draft = buildPracticePlanDraft(state, { date: '2026-08-20', durationMinutes: 80 });
assert.equal(draft.blocks.reduce((total, block) => total + block.minutes, 0), 80);
const savedPlan = savePracticePlan(state, draft, { now });
assert.equal(state.teamInfo.practicePlans[0].id, savedPlan.id);
assert.equal(savedPlan.date, '2026-08-20');

const decisions = buildDecisionCards(state, { rangeDays: 30, now });
assert.ok(decisions.length >= 1);
assert.ok(decisions.some(item => item.id === 'period-comparison'));
assert.ok(decisions.every(item => item.title && item.evidence && item.action));

const storage = new Map();
const fakeStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const preferences = saveUiPreferences({ fontScale: 'large', preferredHand: 'left', reduceMotion: true, compactMode: true }, fakeStorage);
assert.equal(JSON.parse(storage.get(UI_PREFERENCES_KEY)).preferredHand, 'left');
assert.equal(loadUiPreferences(fakeStorage).fontScale, 'large');
const root = { dataset: {} };
applyUiPreferences(preferences, root);
assert.equal(root.dataset.fontScale, 'large');
assert.equal(root.dataset.preferredHand, 'left');
assert.equal(root.dataset.reduceMotion, 'true');

const readiness = buildMatchdayReadiness({ match: { id: 3, date: '2026-08-20', opponent: 'FC', formations: [{ initialActivePlayerIds: [1, 2] }] }, hasBackup: true, outboxCount: 1 });
assert.equal(readiness.requiredReady, true);
assert.equal(readiness.items.find(item => item.id === 'storage').ready, true);
assert.equal(buildMatchdaySaveStatus({ isOnline: false }).tone, 'offline');
assert.match(buildMatchdaySaveStatus({ isOnline: true, outboxCount: 2, syncStatus: 'error' }).label, /同期待機 2件/);

const [index, app, settings, matches, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
// assert.match(index, /dash-action-center/);
// assert.match(index, /dash-parent-agenda/);
assert.match(index, /field-matchday-readiness/);
assert.match(index, /ui-preferred-hand/);
assert.match(index, /ui-preferences-section/);
assert.match(app, /experience-service\.js/);
assert.match(settings, /loadUiPreferences/);
assert.match(matches, /matchday-ux-service\.js/);
assert.match(css, /data-preferred-hand/);
assert.match(css, /prefers-reduced-motion/);
console.log('P28-P32 experience tests passed');
