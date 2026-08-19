import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = {};
const { getTimelineTimestampSeconds, normalizeTimelineMemo } = await import('../matches.js');

const legacyMemo = normalizeTimelineMemo({ time: '03:44', tag: '守備', text: '旧形式' });
assert.equal(legacyMemo.timestampSec, 224);
assert.equal(legacyMemo.time, '03:44');

const editedMemo = normalizeTimelineMemo({ time: '00:00', timestampSec: 245, tag: '攻撃', text: '編集後' });
assert.equal(getTimelineTimestampSeconds(editedMemo), 245);
assert.equal(editedMemo.time, '04:05');

const [html, source, systemCss] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components-system.css', import.meta.url), 'utf8')
]);

assert.match(html, /id="btn-add-timeline-event"/);
assert.match(html, /id="period-timeline-list"/);
assert.doesNotMatch(html, /field-companion|field-matchday-readiness|dash-preflight-card/);

assert.match(source, /let substitutionDraft = Array\.isArray\(period\.substitutions\)/);
assert.match(source, /id="side-substitutions-container"/);
assert.match(source, /id="btn-add-side-sub"/);
assert.match(source, /OUT選手とIN選手を選択してください/);
assert.match(source, /同じ選手をOUTとINにできません/);
assert.match(source, /getTimelineTimestampSeconds/);
assert.match(source, /normalizeTimelineMemo/);
assert.match(source, /memo-seconds-val/);
assert.match(source, /btn-use-current-timestamp/);
assert.match(source, /sortTimelineMemos\(period\.analysisMemos\)/);
assert.match(systemCss, /\.period-timeline-edit__seconds/);
assert.match(systemCss, /\.btn-use-current-timestamp/);

console.log('P39 match detail simplification and editable timeline tests passed');
