import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    ensureFieldPeriod,
    initializeFieldRoster,
    getCurrentFieldRoster,
    getFieldPlayingSeconds,
    recordFieldSubstitution,
    recordFieldPositionChange,
    removeFieldEvent
} from '../field-companion-service.js';

const match = { formations: [{ lineup: [{ playerId: 1, position: 'CB' }, { playerId: 2, position: 'ST' }], fieldClockSeconds: 120, fieldClockRunning: false }] };
const period = ensureFieldPeriod(match, 0);
const firstRoster = initializeFieldRoster(period, [1, 2, 3]);
assert.deepEqual(firstRoster.activePlayerIds, [1, 2]);
assert.deepEqual(firstRoster.benchPlayerIds, [3]);

const substitution = recordFieldSubstitution(period, 1, 3, [1, 2, 3], new Date('2026-08-18T00:00:00.000Z'));
assert.equal(substitution.elapsedSeconds, 120);
assert.deepEqual(getCurrentFieldRoster(period, [1, 2, 3]).activePlayerIds.sort(), [2, 3]);
assert.deepEqual(getCurrentFieldRoster(period, [1, 2, 3]).benchPlayerIds, [1]);

period.fieldClockSeconds = 600;
const playingSeconds = getFieldPlayingSeconds(period, [1, 2, 3]);
assert.equal(playingSeconds['1'], 120);
assert.equal(playingSeconds['2'], 600);
assert.equal(playingSeconds['3'], 480);

const position = recordFieldPositionChange(period, 3, 'CH', new Date('2026-08-18T00:00:00.000Z'));
assert.equal(period.positionChanges[0].position, 'CH');
removeFieldEvent(period, position.id);
assert.equal(period.positionChanges.length, 0);
removeFieldEvent(period, substitution.id);
assert.deepEqual(getCurrentFieldRoster(period, [1, 2, 3]).activePlayerIds.sort(), [1, 2]);

await assert.rejects(
    async () => recordFieldSubstitution(period, 3, 1, [1, 2, 3]),
    /OUT選手は現在出場中/
);

const [html, source, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.match(html, /field-live-score/);
assert.match(html, /field-active-roster/);
assert.match(html, /field-event-filter/);
assert.match(html, /btn-field-finish/);
assert.match(source, /recordFieldSubstitution/);
assert.match(source, /recordFieldPositionChange/);
assert.match(source, /opponentDetail/);
assert.match(source, /試合終了サマリー/);
assert.match(css, /field-roster/);
assert.match(css, /field-live-score/);

console.log('P18 field operations tests passed');
