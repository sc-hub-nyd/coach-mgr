import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    setFieldSessionActive,
    bindFieldSessionVisibility,
    triggerFieldHaptic,
    isFieldWakeLockActive,
    resetFieldSessionForTest
} from '../field-session-service.js';

let releaseHandler = null;
let released = false;
const wakeLockSentinel = {
    addEventListener: (type, handler) => { if (type === 'release') releaseHandler = handler; },
    release: async () => { released = true; releaseHandler?.(); }
};
const vibrations = [];
const fakeNavigator = {
    wakeLock: { request: async type => { assert.equal(type, 'screen'); return wakeLockSentinel; } },
    vibrate: pattern => { vibrations.push(pattern); return true; }
};
let visibilityHandler = null;
const fakeDocument = {
    visibilityState: 'visible',
    addEventListener: (type, handler) => { if (type === 'visibilitychange') visibilityHandler = handler; }
};

await resetFieldSessionForTest();
assert.equal(await setFieldSessionActive(true, { navigatorRef: fakeNavigator, documentRef: fakeDocument }), true);
assert.equal(isFieldWakeLockActive(), true);
assert.equal(triggerFieldHaptic('timerStart', { navigatorRef: fakeNavigator }), true);
assert.deepEqual(vibrations[0], [12]);
bindFieldSessionVisibility({ navigatorRef: fakeNavigator, documentRef: fakeDocument });
assert.equal(typeof visibilityHandler, 'function');
await setFieldSessionActive(false, { navigatorRef: fakeNavigator, documentRef: fakeDocument });
assert.equal(released, true);
assert.equal(isFieldWakeLockActive(), false);
assert.equal(triggerFieldHaptic('record', { navigatorRef: {} }), false);

const matchesSource = await readFile(new URL('../matches.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.doesNotMatch(matchesSource, /field-session-service|setFieldSessionActive|triggerFieldHaptic|renderFieldSessionStatus/);
assert.doesNotMatch(appSource, /releaseFieldCompanionSession/);
assert.doesNotMatch(indexSource, /field-session-status/);

console.log('P12 field session compatibility and detached UI tests passed');
