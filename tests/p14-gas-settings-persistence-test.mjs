import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settingsSource = await readFile(new URL('../settings.js', import.meta.url), 'utf8');

assert.match(settingsSource, /const applyGasSettingsFromForm = \(\) => \{/);
assert.match(settingsSource, /const persistGasSettings = async \(\) => \{/);
assert.match(settingsSource, /await saveData\(\{ sync: false, markChange: false \}\);/);
assert.match(settingsSource, /btnPush\.onclick = async \(\) => \{\s*try \{\s*await persistGasSettings\(\);\s*await syncPushGasCloud\(false\);/s);
assert.match(settingsSource, /btnPull\.onclick = async \(\) => \{\s*try \{\s*await persistGasSettings\(\);/s);
assert.match(settingsSource, /if \(proceed\) \{\s*await syncPullGasCloud\(false\);/s);
assert.doesNotMatch(settingsSource, /btnPush\.onclick = \(\) => \{\s*const urlVal/s);

console.log('P14 GAS settings persistence tests passed');
