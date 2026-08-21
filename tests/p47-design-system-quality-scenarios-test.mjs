import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [fixtureText, protocol, index, serviceWorker, utils, standard, components, tokens, base, system, dashboard, drawing, tactical, matches, exceptionLedger, manifestText, appJs] = await Promise.all([
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
    read('../doc/UI_EXCEPTION_LEDGER.md'),
    read('../manifest.json'),
    read('../app.js')
]);
const fixture = JSON.parse(fixtureText);
const manifest = JSON.parse(manifestText);

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
assert.match(components, /@media \(max-width: 600px\) \{ \.pwa-update-banner \{[\s\S]*?bottom: calc\(var\(--bottom-nav-reserve\) \+ 0\.7rem\);/, 'PWA更新通知は浮遊ボトムナビの保護余白より上に配置する必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:not\(:disabled\):hover\s*\{[\s\S]*?var\(--color-update-action-hover-surface\)/, 'PWA更新操作のhoverは成功状態のsurfaceトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:not\(:disabled\):hover\s*\{[\s\S]*?var\(--color-update-action-hover-text\)/, 'PWA更新操作のhoverは成功状態のtextトークンを使う必要があります');
assert.match(components, /\.pwa-update-banner #btn-pwa-reload:focus-visible\s*\{[\s\S]*?var\(--color-success\)/, 'PWA更新操作のfocusは成功状態のフォーカスリングを持つ必要があります');
assert.doesNotMatch(components, /\.pwa-update-banner \.btn-primary\s*\{/, 'PWA更新操作を汎用primaryの色役割へ再結合してはいけません');
assert.match(tokens, /--color-update-action-hover-surface:/, 'PWA更新操作のhover surfaceトークンが必要です');
assert.match(tokens, /--color-update-action-hover-text:/, 'PWA更新操作のhover textトークンが必要です');
assert.match(tokens, /--color-update-action-pressed-surface:/, 'PWA更新操作のpressed surfaceトークンが必要です');
assert.match(serviceWorker, /coachmgr-v269/, 'PWA更新シナリオは現在のキャッシュ世代をprecacheする必要があります');
assert.match(index, /rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png"/, 'iOSは文字なしApple Touch Iconを参照する必要があります');
assert.match(index, /rel="icon" type="image\/png" sizes="32x32" href="\.\/icons\/favicon-32\.png"/, 'ブラウザは32pxの文字なしFaviconを参照する必要があります');
assert.ok(manifest.icons.some(icon => icon.src === './icons/icon-192.png' && icon.sizes === '192x192' && icon.purpose === 'any'), 'manifestは通常PWA用192px文字なしアイコンを宣言する必要があります');
assert.ok(manifest.icons.some(icon => icon.src === './icons/icon-512.png' && icon.sizes === '512x512' && icon.purpose === 'any'), 'manifestは通常PWA用512px文字なしアイコンを宣言する必要があります');
assert.ok(manifest.icons.some(icon => icon.src === './icons/icon-512-maskable.png' && icon.sizes === '512x512' && icon.purpose === 'maskable'), 'manifestはmaskable専用512pxアイコンを宣言する必要があります');
['./icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-16.png'].forEach(asset => {
    assert.match(serviceWorker, new RegExp(asset.replace(/[./]/g, '\\$&')), `PWA更新シナリオは${asset}をprecacheする必要があります`);
});
assert.match(serviceWorker, /canvas-palette\.js/, 'PWA更新シナリオはCanvasパレットをprecacheする必要があります');
assert.match(serviceWorker, /pitch-renderer\.js/, 'PWA更新シナリオはピッチレンダラをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.css/, 'PWA更新シナリオはTablerサブセットCSSをprecacheする必要があります');
assert.match(serviceWorker, /tabler-icons-subset\.woff2/, 'PWA更新シナリオはTablerサブセットWOFF2をprecacheする必要があります');
assert.match(index, /id="btn-toggle-color-mode" role="switch" aria-checked="false" data-color-mode="light"/, 'PCテーマ切替は状態を読めるswitchとして提供する必要があります');
assert.match(index, /id="mobile-btn-toggle-color-mode" role="switch" aria-checked="false" data-color-mode="light"/, 'モバイルテーマ切替は状態を読めるswitchとして提供する必要があります');
assert.match(index, /c-theme-mode-switch__segment--light[\s\S]*?ti-sun[\s\S]*?ライト[\s\S]*?c-theme-mode-switch__segment--dark[\s\S]*?ti-moon[\s\S]*?ダーク/, 'テーマ切替は太陽＋ライトと月＋ダークを常時表示する必要があります');
assert.match(base, /\.c-theme-mode-switch\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'テーマ切替は二択セグメントを等幅で配置する必要があります');
assert.match(base, /\.c-theme-mode-switch\[data-color-mode="dark"\] \.c-theme-mode-switch__segment--dark[\s\S]*?background: var\(--color-surface-raised\);/, 'ダークテーマではダークセグメントを選択面として表示する必要があります');
assert.match(base, /prefers-reduced-motion: reduce[\s\S]*?\.c-theme-mode-switch__segment[\s\S]*?transition-duration: 1ms/, '動きを減らす設定ではテーマ切替セグメントも1msへ縮退する必要があります');
assert.match(appJs, /toggle\.setAttribute\('aria-checked', String\(isDark\)\)/, 'テーマ切替はモードに合わせてaria-checkedを同期する必要があります');
assert.match(base, /h1,[\s\S]*?h6 \{[\s\S]*?text-align: center;/, '全画面のh1〜h6は中央揃えのタイトル基準を使う必要があります');
assert.match(standard, /\.c-section-header \{[\s\S]*?flex-direction: column;[\s\S]*?align-items: center;[\s\S]*?text-align: center;/, '共通セクション見出しは中央揃えである必要があります');
assert.match(system, /\.c-modal__title \{[\s\S]*?text-align: center;/, 'モーダルタイトルは中央揃えである必要があります');
assert.match(system, /\.c-dashboard-widget__label \{[\s\S]*?justify-content: center;[\s\S]*?text-align: center;/, 'ダッシュボード見出しは中央揃えである必要があります');
assert.match(system, /\.c-mobile-route-choice__heading,[\s\S]*?text-align: center;/, '非h要素の共通タイトルも中央揃えである必要があります');

// P47-UI: P1〜P3の色役割、非標準操作、形状尺度、例外台帳を保護する。
assert.match(tokens, /--radius-micro:/, 'スクロールバー用の微小半径トークンが必要です');
assert.match(tokens, /--radius-progress:/, '進捗バー用の半径トークンが必要です');
assert.match(tokens, /--color-shadow-success:/, '同期成功状態のshadowトークンが必要です');
assert.match(tokens, /--color-shadow-danger:/, '同期失敗状態のshadowトークンが必要です');
assert.match(tokens, /--color-shadow-info:/, '同期中状態のshadowトークンが必要です');
assert.match(tokens, /--duration-micro:\s*80ms;/, '押下と短いアクセントには80msの共通トークンが必要です');
assert.match(tokens, /--duration-sheet:\s*260ms;/, 'ボトムシートの開く操作には260msの共通トークンが必要です');
assert.match(tokens, /--duration-sheet-close:\s*180ms;/, 'ボトムシートの閉じる操作には180msの共通トークンが必要です');
assert.match(tokens, /--bottom-nav-height:\s*4rem;/, '浮遊ボトムナビの高さトークンが必要です');
assert.match(tokens, /--bottom-nav-float-gap:\s*0\.625rem;/, '浮遊ボトムナビのSafe Area上余白トークンが必要です');
assert.match(tokens, /--color-nav-floating-surface:/, '浮遊ボトムナビのテーマ追随透過surfaceトークンが必要です');
assert.match(tokens, /--surface-nav-floating:/, '浮遊ボトムナビのライト／ダーク別ガラスsurfaceトークンが必要です');
assert.match(tokens, /--liquid-veil:\s*radial-gradient\(/, 'ライトモードの白基調でもガラス感を見せる背景ベールが必要です');
assert.match(tokens, /--nav-floating-blur:\s*blur\(2\.1rem\) saturate\(220%\) brightness\(1\.05\);/, 'ライトモードの浮遊ナビは超高透過面を補う専用blurトークンを持つ必要があります');
assert.match(tokens, /--shadow-nav-floating:/, '浮遊ボトムナビのテーマ追随shadowトークンが必要です');
assert.match(tokens, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?--duration-sheet-close:\s*1ms;/, 'OSの動きを減らす設定ではボトムシートの動きも1msへ短縮する必要があります');
assert.match(tokens, /:root\[data-reduce-motion="true"\][\s\S]*?--duration-sheet-close:\s*1ms;/, 'アプリ内の動きを減らす設定ではボトムシートの動きも1msへ短縮する必要があります');
assert.match(base, /\.c-sidebar__nav li:hover,[\s\S]*?background: var\(--color-surface-selected\);/, 'サイドバーの選択面はチームカラー追随トークンを使う必要があります');
assert.match(base, /\.c-bottom-nav \{[\s\S]*?bottom: calc\(var\(--safe-bottom\) \+ var\(--bottom-nav-float-gap\)\) !important;[\s\S]*?background: var\(--surface-nav-floating\) !important;[\s\S]*?backdrop-filter: var\(--nav-floating-blur\) !important;[\s\S]*?border: 0 !important;[\s\S]*?box-shadow: var\(--shadow-nav-floating\) !important;/, 'ボトムナビは境界線なしのテーマ別ガラスsurfaceとしてSafe Areaの上へ浮遊する必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item::before \{[\s\S]*?background: var\(--color-surface-selected\);/, 'ボトムナビの選択面はチームカラー追随トークンを使う必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item\.active::before,[\s\S]*?transform: scale\(1\);/, '選択中のボトムナビはレンズ面を収束させる必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item\.is-kinetic-feedback::after/, 'ボトムナビは一度だけのキネティック余韻状態を持つ必要があります');
assert.match(base, /\.sync-status-dot \{[\s\S]*?background: var\(--color-success\);/, '同期成功状態はsuccessトークンを使う必要があります');
assert.doesNotMatch(base, /#22c55e|#ef4444|#3b82f6|rgba\(242, 57, 50/, '基盤操作に既定固定色を再導入してはいけません');
assert.match(system, /\.c-modal--bottom-sheet \{[\s\S]*?transition: transform var\(--duration-sheet\) var\(--ease-out\), opacity var\(--duration-fast\) var\(--ease-out\);/, 'ボトムシートは260msの共通モーショントークンで開く必要があります');
assert.match(system, /\.c-modal-overlay\.is-closing \.c-modal--bottom-sheet \{[\s\S]*?var\(--duration-sheet-close\)/, 'ボトムシートは閉じる専用トークンで退場する必要があります');
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
