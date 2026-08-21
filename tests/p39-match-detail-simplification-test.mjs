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

const [html, source, systemCss, componentsCss] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components-system.css', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);

assert.match(html, /id="btn-add-timeline-event"/);
assert.match(html, /id="period-timeline-list"/);
assert.doesNotMatch(html, /field-companion|field-matchday-readiness|dash-preflight-card/);

assert.match(source, /renderPeriodGrid\(m\);/);
assert.doesNotMatch(source, /initFieldCompanionActions|refreshFieldCompanion/);

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
assert.match(html, /id="period-analysis-mobile-context-bar" class="c-context-bar c-context-bar--period-analysis hidden"/, '動画分析はモバイル共通戻るバーを持つ必要があります');
assert.match(html, /id="btn-period-analysis-mobile-back"/, '動画分析のモバイル戻る操作が必要です');
assert.match(source, /const closePeriodAnalysis = \(e\) =>/, '動画分析の終了処理は共通化する必要があります');
assert.match(source, /btnMobileBack\.onclick = closePeriodAnalysis/, '動画分析モバイル戻るは既存終了処理を呼ぶ必要があります');
assert.match(source, /mobileContextBar\.classList\.remove\('hidden', 'is-closing'\)/, '動画分析の開始時にモバイル戻るを表示する必要があります');
assert.match(componentsCss, /\.period-analysis-header-left,[\s\S]*?#btn-back-to-match-detail \{[\s\S]*?display: none !important;/, 'スマホ動画分析では左上の独自戻るを隠す必要があります');
assert.match(componentsCss, /\.c-context-bar--period-analysis \{[\s\S]*?bottom: calc\(var\(--safe-bottom\) \+ var\(--bottom-nav-float-gap\)\)/, '動画分析の戻るバーは非表示ボトムナビの予約領域を空けてはいけません');

console.log('P39 match detail period-view recovery and editable timeline tests passed');
