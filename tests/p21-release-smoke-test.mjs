import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, sw, version, app, syncService, css, workflow] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../version.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../sync-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components-system.css', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/contract-tests.yml', import.meta.url), 'utf8')
]);

assert.match(index, /<meta name="viewport"/);
assert.match(index, /id="modal-period-analysis"/);
assert.match(index, /btn-add-timeline-event/);
assert.match(index, /period-timeline-list/);
assert.doesNotMatch(index, /field-live-score|field-event-filter|field-matchday-readiness/);
assert.match(index, /parent-share-section/);
assert.match(index, /form-player-development-note/);
assert.match(index, /btn-create-parent-access/);
assert.match(index, /btn-retry-sync-outbox/);
// assert.match(index, /dash-action-center/);
assert.match(index, /ui-preferences-section/);
assert.match(sw, /player-development-service\.js/);
assert.match(sw, /parent-operations-service\.js/);
assert.match(sw, /workspace-service\.js/);
assert.match(sw, /record-service\.js/);
assert.match(sw, /season-report-service\.js/);
assert.match(sw, /sync-outbox-service\.js/);
assert.match(sw, /experience-service\.js/);
assert.match(sw, /matchday-ux-service\.js/);
assert.match(sw, /tokens\.css/);
assert.match(sw, /layouts\.css/);
assert.match(sw, /components-standard\.css/);
assert.match(sw, /utilities\.css/);
assert.match(sw, /SKIP_WAITING/);
assert.match(version, /APP_VERSION/);
assert.match(app, /syncPullGasCloud/);
assert.match(app, /renderExperienceDashboard/);
assert.match(syncService, /secure-v2/);
assert.match(css, /c-data-list--participation/);
assert.match(css, /@media \(max-width: 37\.5rem\)/);
assert.match(workflow, /run-contract-tests\.mjs/);
assert.match(workflow, /pull_request/);
assert.match(workflow, /push/);
console.log('P21 release smoke tests passed');
