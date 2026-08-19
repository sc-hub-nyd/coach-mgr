import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '..');
const indexHtml = readFileSync(join(rootDir, 'index.html'), 'utf8');
const appJs = readFileSync(join(rootDir, 'app.js'), 'utf8');
const baseCss = readFileSync(join(rootDir, 'CSS/base.css'), 'utf8');
const systemCss = readFileSync(join(rootDir, 'CSS/components-system.css'), 'utf8');
const practicesJs = readFileSync(join(rootDir, 'practices.js'), 'utf8');

test('P38-1: PCサイドバーフッターの配置と機能契約検証', () => {
    assert.match(indexHtml, /id="sidebar-footer"/, 'sidebar-footer exists in index.html');
    assert.match(indexHtml, /id="user-role-badge"/, 'user-role-badge exists in sidebar');
    assert.match(indexHtml, /id="btn-toggle-role"/, 'btn-toggle-role exists in sidebar');
    assert.match(indexHtml, /id="btn-toggle-color-mode"/, 'btn-toggle-color-mode exists in sidebar');
    assert.match(indexHtml, /id="btn-topbar-sync-status"/, 'sync-status exists in sidebar');
    assert.match(indexHtml, /id="topbar-version-badge"/, 'topbar-version-badge exists in sidebar');
    assert.match(baseCss, /\.c-sidebar__footer\s*\{/, 'CSS defines c-sidebar footer');
    assert.match(baseCss, /\.c-sidebar__user-card\s*\{/, 'CSS defines c-sidebar user card');
    assert.match(indexHtml, /class="c-sidebar"/, 'sidebar uses the common app-shell class');
    assert.match(appJs, /badge\.innerHTML = .*?<span>コーチ<\/span>';/, 'sidebar role badge uses the concise coach label');
    assert.match(appJs, /badge\.innerHTML = .*?<span>保護者<\/span>';/, 'sidebar role badge uses the concise guardian label');
    assert.doesNotMatch(appJs, /badge\.innerHTML = .*?<span>(?:コーチ|保護者)モード<\/span>';/, 'sidebar role badge must not restore the redundant モード suffix');
});

test('P38-2: トップバーのスリム化とタイトル＆スマホモード表示検証', () => {
    assert.match(indexHtml, /id="topbar-title"/, 'topbar-title exists in topbar');
    assert.match(indexHtml, /id="topbar-back"/, 'topbar-back exists in topbar');
    assert.match(indexHtml, /id="mobile-topbar-role-badge"/, 'mobile-topbar-role-badge exists in topbar');
    assert.match(appJs, /mobileTopBarRoleBadge\.addEventListener\('click'/, 'app.js binds mobile role badge');
});

test('P38-3: スマホ向けボトムナビゲーション（5項目親指最適化＆権限制御）検証', () => {
    assert.match(indexHtml, /id="bottom-nav"/, 'bottom-nav exists');
    assert.match(indexHtml, /data-route="dashboard"/, 'bottom-nav has dashboard');
    assert.match(indexHtml, /data-route="matches"/, 'bottom-nav has matches');
    assert.match(indexHtml, /data-route="practices"/, 'bottom-nav has practices');
    assert.match(indexHtml, /class="c-bottom-nav__item coach-only" data-route="library"/, 'bottom-nav library is coach-only');
    assert.match(indexHtml, /class="c-bottom-nav" id="bottom-nav"/, 'bottom-nav uses the common app-shell class');
    assert.match(indexHtml, /id="btn-bottom-nav-more"/, 'bottom-nav has more button');
    assert.match(appJs, /btnBottomNavMore\.addEventListener\('click'/, 'app.js binds bottom nav more button');
    assert.match(appJs, /#bottom-nav \.coach-only/, 'app.js controls bottom-nav coach-only items');
});

test('P38-4: スマホ向けモバイルスライドシート（片手操作コントロールセンター＆クラウド同期）検証', () => {
    assert.match(indexHtml, /id="modal-mobile-more"/, 'modal-mobile-more exists');
    assert.match(indexHtml, /id="mobile-user-role-label"/, 'mobile-user-role-label exists in sheet');
    assert.match(indexHtml, /id="mobile-btn-toggle-role"/, 'mobile-btn-toggle-role exists in sheet');
    assert.match(indexHtml, /id="mobile-sync-card"/, 'mobile-sync-card exists in sheet');
    assert.match(indexHtml, /id="mobile-sync-status-dot"/, 'mobile-sync-status-dot exists in sheet');
    assert.match(indexHtml, /id="mobile-btn-sync-now"/, 'mobile-btn-sync-now exists in sheet');
    assert.doesNotMatch(indexHtml, /id="mobile-btn-my-player"/, 'mobile-btn-my-player is removed from sheet');
    assert.match(indexHtml, /class="[^"]*c-button[^"]*mobile-more-item[^"]*coach-only[^"]*" data-mobile-route="settings"/, 'settings in mobile sheet is coach-only');
    assert.match(indexHtml, /id="mobile-btn-toggle-color-mode"/, 'mobile-btn-toggle-color-mode exists in sheet');
    assert.match(indexHtml, /id="mobile-version-badge"/, 'mobile-version-badge exists in sheet');
    assert.match(appJs, /mobileBtnToggleRole\.onclick = handleToggleRoleClick/, 'app.js binds mobile role toggle');
    assert.match(appJs, /mobileBtnSyncNow\.addEventListener\('click'/, 'app.js binds mobile sync button');
});

test('P38-5: ナビゲーション階層設計＆戻るボタン（navigateBack）契約検証', () => {
    assert.match(appJs, /export function navigateBack\(\)/, 'app.js exports navigateBack function');
    assert.match(appJs, /const detailRoutes = \['player-detail', 'match-detail'\];/, 'app.js identifies detail routes');
    assert.match(appJs, /navigate\('dashboard', null, true\);/, 'app.js returns to dashboard from main menu pages');
    assert.match(appJs, /topbarBack\.onclick\s*=\s*\(e\)\s*=>\s*\{[\s\S]*?navigateBack\(\)/, 'topbarBack.onclick triggers navigateBack');
});

test('P38-6: 練習管理カードの1行ツールバー配置＆同期ポップオーバー不透明背景検証', () => {
    assert.match(systemCss, /\.c-popover--sync[\s\S]*?background:\s*var\(--card-bg,\s*var\(--surface-card\)\);/, 'popover background is solid opaque');
    assert.match(systemCss, /\.c-popover--sync\.c-popover--sidebar[\s\S]*?inset-block-end:/, 'sidebar popover is positioned upward');
    assert.match(practicesJs, /c-practice-card--toolbar-actions/, 'practice card opts into the compact toolbar modifier');
    assert.match(systemCss, /\.c-practice-card--toolbar-actions \.c-practice-card__actions[\s\S]*?display:\s*flex;/, 'practice card actions are styled cleanly');
    assert.match(systemCss, /\.c-practice-card--toolbar-actions \.btn-edit-practice/, 'compact edit button styled');
    assert.match(systemCss, /\.c-practice-card--toolbar-actions \.btn-delete-practice/, 'compact delete button styled');
});

test('P38-7: スマホ向けスリム戻るコンテキストバー（Mobile Context Back Bar）契約検証', () => {
    assert.match(indexHtml, /id="mobile-context-bar"/, 'mobile-context-bar exists in index.html');
    assert.match(indexHtml, /id="mobile-context-back-btn"/, 'mobile-context-back-btn exists in index.html');
    assert.match(indexHtml, /id="mobile-context-title"/, 'mobile-context-title exists in index.html');
    assert.match(baseCss, /\.c-context-bar\s*\{[\s\S]*?display:\s*none\s*!important;/, 'context bar is hidden on desktop');
    assert.match(baseCss, /\.c-context-bar\s*\{[\s\S]*?position:\s*fixed/i, 'context bar is fixed on mobile');
    assert.match(appJs, /const mobileContextBar = document\.getElementById\('mobile-context-bar'\);/, 'app.js accesses mobile-context-bar');
    assert.match(appJs, /mobileContextBackBtn\.onclick[\s\S]*?navigateBack\(\)/, 'mobile-context-back-btn triggers navigateBack');
});


test('P38-8: 戻るドックの44px操作領域とセーフエリア配置を検証', () => {
    assert.match(
        baseCss,
        /\.c-context-bar\s*\{[\s\S]*?bottom:\s*calc\(64px\s*\+\s*var\(--safe-bottom\)\)\s*!important;[\s\S]*?height:\s*48px\s*!important;[\s\S]*?min-height:\s*48px\s*!important;/,
        'mobile context bar reserves the bottom safe area and a 48px bar height'
    );
    assert.match(
        baseCss,
        /\.c-context-bar__back-button\s*\{[\s\S]*?min-width:\s*var\(--tap-target\)\s*!important;[\s\S]*?min-height:\s*var\(--tap-target\)\s*!important;[\s\S]*?height:\s*var\(--tap-target\)\s*!important;/,
        'mobile context back button uses the shared 44px tap target token'
    );
});

test('P38-9: 詳細画面から一覧文脈を保存・復元する契約検証', () => {
    assert.match(appJs, /function captureRouteContext\(route\)/, 'app.js captures list context before entering detail');
    assert.match(appJs, /currentMatchSearch/, 'match search state is included in the saved context');
    assert.match(appJs, /currentMatchPage/, 'match pagination state is included in the saved context');
    assert.match(appJs, /filterAccordionOpen/, 'filter accordion visibility is included in the saved context');
    assert.match(appJs, /activePlayerView/, 'player view tab is included in the saved context');
    assert.match(appJs, /context:\s*captureRouteContext\(uiState\.currentRoute\)/, 'navigation history stores the route context');
    assert.match(appJs, /navigate\(prev\.route, prev\.params, true, prev\.context \|\| null\)/, 'back navigation passes the saved context');
    assert.match(appJs, /function restoreRouteContextDom\(context\)/, 'app.js restores DOM-level route context after rendering');
    assert.match(appJs, /restoreRouteContextDom\(appliedRouteContext\)/, 'route context restoration runs after route initialization');
});
