import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [index, app, base, system, iconSystem, serviceWorker] = await Promise.all([
    read('../index.html'),
    read('../app.js'),
    read('../CSS/base.css'),
    read('../CSS/components-system.css'),
    read('../CSS/icon-system.css'),
    read('../sw.js')
]);

const homeIndex = index.indexOf('data-route="dashboard" aria-label="ホーム"');
const playersIndex = index.indexOf('data-route="players" aria-label="選手管理"');
const scheduleIndex = index.indexOf('id="btn-bottom-nav-match-practice"');
const planningIndex = index.indexOf('id="btn-bottom-nav-library-tactics"');
const moreIndex = index.indexOf('id="btn-bottom-nav-more"');
assert.ok(homeIndex >= 0 && playersIndex > homeIndex && scheduleIndex > playersIndex && planningIndex > scheduleIndex && moreIndex > planningIndex,
    'コーチのボトムナビはホーム→選手管理→試合／練習→メニュー／戦術→その他の順である必要があります');
assert.match(index, /id="btn-bottom-nav-library-tactics"[\s\S]*?ti-soccer-field/, 'メニュー／戦術トリガーはピッチを表すTablerアイコンを使う必要があります');

assert.match(index, /class="[^"]*c-bottom-nav__item--parent-route[^"]*" data-route="matches"/, '保護者用の試合導線を維持する必要があります');
assert.match(index, /class="[^"]*c-bottom-nav__item--parent-route[^"]*" data-route="practices"/, '保護者用の練習導線を維持する必要があります');
assert.doesNotMatch(index, /class="[^"]*coach-only[^"]*" data-route="matches"/, '保護者用の試合導線をコーチ専用にしてはいけません');
assert.doesNotMatch(index, /class="[^"]*coach-only[^"]*" data-route="practices"/, '保護者用の練習導線をコーチ専用にしてはいけません');

[
    'data-mobile-route-group="schedule"',
    'data-mobile-route-group="planning"',
    'aria-controls="modal-mobile-route-choice"',
    'id="modal-mobile-route-choice"',
    'aria-labelledby="mobile-route-choice-title"',
    'aria-describedby="mobile-route-choice-description"',
    'id="mobile-route-choice-list"'
].forEach(fragment => assert.ok(index.includes(fragment), `コーチ用二択ナビの構造が不足しています: ${fragment}`));

[
    "schedule: {",
    "route: 'matches'",
    "route: 'practices'",
    "planning: {",
    "route: 'library'",
    "route: 'tactics'",
    "openModal('modal-mobile-route-choice', { trigger })",
    "closeModal('modal-mobile-route-choice', { returnFocus: false, immediate: true })",
    "data-mobile-choice-route",
    "activeMobileRouteChoiceTrigger",
    "bottomParentRoutes.forEach(el => { el.style.display = 'none'; })",
    "link.dataset.mobileRouteGroup === activeMobileRouteGroup"
].forEach(fragment => assert.ok(app.includes(fragment), `コーチ用二択ナビの操作・役割制御が不足しています: ${fragment}`));

[
    '.c-bottom-nav .c-bottom-nav__item--choice.is-expanded',
    '.c-mobile-route-choice__sheet',
    'margin-block-end: calc(var(--safe-bottom) + var(--bottom-nav-float-gap));',
    '.c-mobile-route-choice__item',
    'min-block-size: var(--tap-target-min);'
].forEach(fragment => {
    const css = fragment.startsWith('.c-bottom-nav') ? base : system;
    assert.ok(css.includes(fragment), `二択ナビのモバイル・Safe Area契約が不足しています: ${fragment}`);
});

assert.match(iconSystem, /\.ti\s*\{[\s\S]*?color:\s*currentColor/, 'Tablerアイコンはテーマ色に追従する必要があります');
assert.doesNotMatch(index, /c-icon--|class="c-icon/, '実行時HTMLへカスタムSVG部品を再導入してはいけません');
assert.doesNotMatch(iconSystem, /c-icon|assets\/icons\/|mask:/, 'アイコンCSSへカスタムSVGの描画規則を残してはいけません');
assert.doesNotMatch(serviceWorker, /assets\/icons\//, 'PWA precacheへ削除済みカスタムSVGを残してはいけません');

console.log('P56 coach mobile navigation and Tabler-only icon contracts passed');
