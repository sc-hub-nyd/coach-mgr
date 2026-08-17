import assert from 'node:assert/strict';
import { createStateSnapshot, parseBackupPayload, CURRENT_SCHEMA_VERSION } from '../repository.js';

const state = {
    matches: [{
        id: 1,
        formations: [{
            scoreUs: 1,
            scoreThem: 1,
            fieldClockSeconds: 425,
            fieldClockRunning: false,
            fieldClockStartedAt: null,
            cardRecords: [{ playerId: 7, cardType: 'yellow', eventId: 'card-1' }],
            eventHistory: [
                { id: 'score-1', type: 'score', elapsedSeconds: 190, recordedAt: '2026-08-17T00:00:00.000Z' },
                { id: 'card-1', type: 'card', playerId: 7, cardType: 'yellow', elapsedSeconds: 425, recordedAt: '2026-08-17T00:04:00.000Z' }
            ]
        }]
    }],
    practices: [], players: [], menuLibrary: [], tactics: [], matchTypes: [], menuCategories: [],
    tacticsCategories: [], analysisTags: [], skillMetrics: [], positions: [], positionsCat2: [],
    teamInfo: {}, customFormations: [], teamFocus: {}
};

const snapshot = createStateSnapshot(state);
const period = snapshot.matches[0].formations[0];
assert.equal(snapshot.schemaVersion, CURRENT_SCHEMA_VERSION);
assert.equal(period.fieldClockSeconds, 425);
assert.equal(period.cardRecords[0].cardType, 'yellow');
assert.equal(period.eventHistory[1].elapsedSeconds, 425);

const legacy = parseBackupPayload({ matches: [{ id: 2, formations: [{}] }], practices: [], players: [] });
const legacyPeriod = legacy.matches[0].formations[0];
assert.deepEqual(legacyPeriod.cardRecords, []);
assert.equal(legacyPeriod.fieldClockSeconds, 0);
assert.equal(legacyPeriod.fieldClockRunning, false);
assert.equal(legacyPeriod.fieldClockStartedAt, null);

console.log('P5 Field Companion contract tests passed');
