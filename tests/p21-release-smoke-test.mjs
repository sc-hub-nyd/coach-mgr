import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, sw, version, app, syncService, css, workflow] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../version.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../sync-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/contract-tests.yml', import.meta.url), 'utf8')
]);

assert.match(index, /<meta name="viewport"/);
assert.match(index, /field-live-score/);
assert.match(index, /field-event-filter/);
assert.match(index, /parent-share-section/);
assert.match(index, /form-player-development-note/);
assert.match(sw, /player-development-service\.js/);
assert.match(sw, /parent-operations-service\.js/);
assert.match(sw, /workspace-service\.js/);
assert.match(sw, /record-service\.js/);
assert.match(sw, /season-report-service\.js/);
assert.match(sw, /SKIP_WAITING/);
assert.match(version, /APP_VERSION/);
assert.match(app, /syncPullGasCloud/);
assert.match(syncService, /secure-v2/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(workflow, /run-contract-tests\.mjs/);
assert.match(workflow, /pull_request/);
assert.match(workflow, /push/);
console.log('P21 release smoke tests passed');
