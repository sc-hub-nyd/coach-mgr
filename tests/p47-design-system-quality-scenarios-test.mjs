import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [fixtureText, protocol, index, serviceWorker, utils, standard] = await Promise.all([
    read('./fixtures/design-system-high-density-fixture.json'),
    read('../doc/DESIGN_SYSTEM_VISUAL_REGRESSION_PROTOCOL.md'),
    read('../index.html'),
    read('../sw.js'),
    read('../utils.js'),
    read('../CSS/components-standard.css')
]);
const fixture = JSON.parse(fixtureText);

assert.equal(fixture.players.length, 12, '高密度シードは選手12名を含む必要があります');
assert.deepEqual(fixture.meta.viewportProfiles, [320, 390, 768, 1024, 1280],
    '高密度シナリオは主要5ビューポートを固定する必要があります');
assert.ok(fixture.players.some(player => player.name.length >= 10), '高密度シードは長い日本語選手名を含む必要があります');
assert.ok(fixture.players.some(player => player.attendance === '未回答'), '高密度シードは未回答状態を含む必要があります');
assert.ok(fixture.players.some(player => player.status === 'warning'), '高密度シードは注意状態を含む必要があります');
assert.ok(fixture.schedule.every(item => item.actions.length === 5), '高密度シードは複数操作を持つカードを含む必要があります');
['success', 'warning', 'danger', 'info', 'pending', 'empty', 'loading', 'disabled'].forEach(state => {
    assert.ok(fixture.states.includes(state), `状態シナリオが不足しています: ${state}`);
});

['高密度シード', '320px', '390px', '768px', '1024px', '1280px', 'P47', 'PWA更新'].forEach(fragment => {
    assert.ok(protocol.includes(fragment), `視覚回帰プロトコルに必要なシナリオがありません: ${fragment}`);
});

assert.match(index, /id="toast-container" class="toast-container" aria-live="polite" aria-atomic="false"/,
    '通知はライブリージョンとして提供する必要があります');
assert.match(index, /role="dialog" aria-modal="true"[\s\S]*?aria-labelledby="global-confirm-title" aria-describedby="global-confirm-message"/,
    '確認ダイアログは名前と説明を支援技術へ関連付ける必要があります');
assert.match(utils, /role: 'alert'/, '危険通知は緊急度を伝えるalertロールを持つ必要があります');
assert.match(standard, /\.c-button:focus-visible/, '主要操作はキーボードフォーカスを持つ必要があります');
assert.match(standard, /\.c-button:disabled/, '主要操作はdisabled状態を持つ必要があります');
assert.match(serviceWorker, /coachmgr-v198/, 'PWA更新シナリオは現在のキャッシュ世代をprecacheする必要があります');
assert.match(serviceWorker, /canvas-palette\.js/, 'PWA更新シナリオはCanvasパレットをprecacheする必要があります');
assert.match(serviceWorker, /pitch-renderer\.js/, 'PWA更新シナリオはピッチレンダラをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.css/, 'PWA更新シナリオはTablerサブセットCSSをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.woff2/, 'PWA更新シナリオはTablerサブセットWOFF2をprecacheする必要があります');

console.log('P47 design system quality scenarios passed');
