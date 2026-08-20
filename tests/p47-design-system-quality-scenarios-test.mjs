import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [fixtureText, protocol, index, serviceWorker, utils, standard, components, tokens, base, system, dashboard, drawing, tactical, matches, exceptionLedger] = await Promise.all([
    read('./fixtures/design-system-high-density-fixture.json'),
    read('../doc/DESIGN_SYSTEM_VISUAL_REGRESSION_PROTOCOL.md'),
    read('../index.html'),
    read('../sw.js'),
    read('../utils.js'),
    read('../CSS/components-standard.css'),
    read('../CSS/components.css'),
    read('../CSS/tokens.css'),
    read('../CSS/base.css'),
    read('../CSS/components-system.css'),
    read('../CSS/dashboard.css'),
    read('../CSS/drawing.css'),
    read('../CSS/tactical.css'),
    read('../matches.js'),
    read('../doc/UI_EXCEPTION_LEDGER.md')
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
assert.match(components, /\.pwa-update-banner #btn-pwa-reload\s*\{[\s\S]*?var\(--color-update-action-surface\)/, 'PWA更新操作は成功状態の通常surfaceトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload\s*\{[\s\S]*?var\(--color-update-action-text\)/, 'PWA更新操作は成功状態の通常textトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:not\(:disabled\):hover\s*\{[\s\S]*?var\(--color-update-action-hover-surface\)/, 'PWA更新操作のhoverは成功状態のsurfaceトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:not\(:disabled\):hover\s*\{[\s\S]*?var\(--color-update-action-hover-text\)/, 'PWA更新操作のhoverは成功状態のtextトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:focus-visible\s*\{[\s\S]*?var\(--color-success\)/, 'PWA更新操作のfocusは成功状態のフォーカスリングを持つ必要があります');
assert.doesNotMatch(components, /\.pwa-update-banner \.btn-primary\s*\{/, 'PWA更新操作を汎用primaryの色役割へ再結合してはいけません');
assert.match(tokens, /--color-update-action-hover-surface:/, 'PWA更新操作のhover surfaceトークンが必要です');
assert.match(tokens, /--color-update-action-hover-text:/, 'PWA更新操作のhover textトークンが必要です');
assert.match(tokens, /--color-update-action-pressed-surface:/, 'PWA更新操作のpressed surfaceトークンが必要です');
assert.match(serviceWorker, /coachmgr-v205/, 'PWA更新シナリオは現在のキャッシュ世代をprecacheする必要があります');
assert.match(serviceWorker, /canvas-palette\.js/, 'PWA更新シナリオはCanvasパレットをprecacheする必要があります');
assert.match(serviceWorker, /pitch-renderer\.js/, 'PWA更新シナリオはピッチレンダラをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.css/, 'PWA更新シナリオはTablerサブセットCSSをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.woff2/, 'PWA更新シナリオはTablerサブセットWOFF2をprecacheする必要があります');

// P47-UI: P1〜P3の色役割、非標準操作、形状尺度、例外台帳を保護する。
assert.match(tokens, /--radius-micro:/, 'スクロールバー用の微小半径トークンが必要です');
assert.match(tokens, /--radius-progress:/, '進捗バー用の半径トークンが必要です');
assert.match(tokens, /--color-shadow-success:/, '同期成功状態のshadowトークンが必要です');
assert.match(tokens, /--color-shadow-danger:/, '同期失敗状態のshadowトークンが必要です');
assert.match(tokens, /--color-shadow-info:/, '同期中状態のshadowトークンが必要です');
assert.match(base, /\.c-sidebar__nav li:hover,[\s\S]*?background: var\(--color-surface-selected\);/, 'サイドバーの選択面はチームカラー追随トークンを使う必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item\.active \{[\s\S]*?background: var\(--color-surface-selected\);/, 'ボトムナビの選択面はチームカラー追随トークンを使う必要があります');
assert.match(base, /\.sync-status-dot \{[\s\S]*?background: var\(--color-success\);/, '同期成功状態はsuccessトークンを使う必要があります');
assert.doesNotMatch(base, /#22c55e|#ef4444|#3b82f6|rgba\(242, 57, 50/, '基盤操作に既定固定色を再導入してはいけません');
assert.match(system, /\.c-modal__close:not\(:disabled\):hover/, 'モーダルの閉じる操作はhover状態を持つ必要があります');
assert.match(system, /\.c-modal__close:focus-visible/, 'モーダルの閉じる操作はfocus-visible状態を持つ必要があります');
assert.match(system, /\.c-data-list__item--button:disabled/, '行操作はdisabled状態を持つ必要があります');
assert.match(standard, /\.c-icon-button--danger/, '危険アイコン操作の共通部品が必要です');
assert.match(standard, /\.c-status--interactive:not\(:disabled\):active/, 'ステータスタグ操作はactive状態を持つ必要があります');
assert.match(matches, /c-icon-button c-icon-button--danger btn-side-remove-pk/, 'PK削除操作は共通危険アイコン部品を使う必要があります');
[components, dashboard, drawing, tactical].forEach((stylesheet, index) => {
    assert.doesNotMatch(stylesheet, /border-radius:\s*\d+px/, `ページ／部品層${index + 1}に直書き半径を再導入してはいけません`);
});
assert.match(exceptionLedger, /--radius-micro/, 'UI例外台帳に微小半径の理由を記録する必要があります');
assert.match(exceptionLedger, /Canvas幾何/, 'UI例外台帳にCanvas形状の理由を記録する必要があります');

console.log('P47 design system quality scenarios passed');
