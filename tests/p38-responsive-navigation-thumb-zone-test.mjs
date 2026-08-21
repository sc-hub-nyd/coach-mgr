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
    assert.match(indexHtml, /class="c-sidebar__theme-row"[\s\S]*?ti-palette[\s\S]*?<span>テーマ<\/span>/, 'PCサイドバーのテーマ行は簡潔な「テーマ」表記を使う');
    assert.doesNotMatch(indexHtml, /class="c-sidebar__theme-row"[\s\S]*?<span>表示テーマ<\/span>/, 'PCサイドバーに旧「表示テーマ」表記を戻してはいけない');
    assert.match(indexHtml, /id="topbar-version-badge"/, 'topbar-version-badge exists in sidebar');
    assert.match(baseCss, /\.c-sidebar\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?overflow:\s*hidden;/, 'sidebar owns the viewport and does not create a competing page scroll area');
    assert.match(baseCss, /\.c-sidebar__nav\s*\{[\s\S]*?min-block-size:\s*0;[\s\S]*?flex-grow:\s*1;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/, 'sidebar navigation is the stable, contained scroll region');
    assert.match(baseCss, /\.c-sidebar__footer\s*\{[\s\S]*?flex:\s*0\s+0\s+auto;/, 'sidebar footer remains fixed while navigation scrolls');
    assert.match(baseCss, /\.c-sidebar__user-card(?:,|\s*\{)/, 'CSS defines c-sidebar user card');
    assert.match(indexHtml, /class="c-sidebar"/, 'sidebar uses the common app-shell class');
    assert.match(indexHtml, /id="user-role-badge"[\s\S]*?ti-user-cog[\s\S]*?<span>役割<\/span>/, 'sidebar role row uses the fixed 「役割」 label');
    assert.match(appJs, /badge\.innerHTML = '<i class="ti ti-user-cog" aria-hidden="true"><\/i> <span>役割<\/span>';/, 'sidebar role label stays fixed when the selected role changes');
    assert.doesNotMatch(appJs, /badge\.innerHTML = .*?<span>(?:コーチ|保護者)(?:モード)?<\/span>';/, 'sidebar role label must not duplicate the switch state');

    const roleRowIndex = indexHtml.indexOf('class="c-sidebar__user-card"');
    const syncRowIndex = indexHtml.indexOf('class="c-sidebar__sync-row');
    const themeRowIndex = indexHtml.indexOf('class="c-sidebar__theme-row"');
    const versionRowIndex = indexHtml.indexOf('class="c-sidebar__version-row"');
    assert.ok(roleRowIndex < themeRowIndex && themeRowIndex < syncRowIndex && syncRowIndex < versionRowIndex, 'sidebar utilities stay vertically ordered as role, theme mode, cloud sync, then version');
    assert.match(baseCss, /\.c-sidebar__user-card,\s*\.c-sidebar__theme-row\s*\{[\s\S]*?inline-size:\s*100%;[\s\S]*?min-block-size:\s*2\.35rem;[\s\S]*?justify-content:\s*space-between;/, 'mode and theme rows share a full-width balanced layout');
    assert.match(baseCss, /\.c-sidebar__sync-button\s*\{[\s\S]*?min-block-size:\s*2\.35rem;/, 'cloud sync uses the same minimum touch-row height');
    assert.match(indexHtml, /class="c-role-mode-switch" id="btn-toggle-role" aria-pressed="false" data-user-role="parent"/, 'desktop role control uses the accessible two-choice pill');
    assert.match(indexHtml, /class="c-role-mode-switch c-role-mode-switch--mobile" id="mobile-btn-toggle-role" aria-pressed="false" data-user-role="parent"/, 'mobile role control uses the same accessible two-choice pill');
    assert.match(indexHtml, /c-role-mode-switch__segment--parent[\s\S]*?ti-eye[\s\S]*?保護者[\s\S]*?c-role-mode-switch__segment--coach[\s\S]*?ti-user-shield[\s\S]*?コーチ/, 'role control keeps an icon and text for both guardian and coach segments');
    assert.match(baseCss, /\.c-role-mode-switch\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'role control uses two equal visible segments');
    assert.match(baseCss, /\.c-role-mode-switch\[data-user-role="coach"\] \.c-role-mode-switch__segment--coach[\s\S]*?background: var\(--color-surface-raised\);/, 'coach state selects the coach segment surface');
    assert.match(baseCss, /prefers-reduced-motion: reduce[\s\S]*?\.c-role-mode-switch__segment[\s\S]*?transition-duration: 1ms/, 'reduced motion shortens the role segment animation');
    assert.match(appJs, /toggle\.dataset\.userRole = isCoach \? 'coach' : 'parent';/, 'role control synchronizes its visual state with currentUserRole');
    assert.match(appJs, /toggle\.setAttribute\('aria-pressed', String\(isCoach\)\)/, 'role control exposes its selected role state to assistive technology');
});

test('P38-2: トップバーのスリム化とタイトル＆スマホモード表示検証', () => {
    assert.match(indexHtml, /id="topbar-title"/, 'topbar-title exists in topbar');
    assert.match(indexHtml, /id="topbar-back"/, 'topbar-back exists in topbar');
    assert.match(indexHtml, /id="mobile-topbar-role-badge"/, 'mobile-topbar-role-badge exists in topbar');
    assert.match(appJs, /mobileTopBarRoleBadge\.addEventListener\('click'/, 'app.js binds mobile role badge');
});

test('P38-3: スマホ向けボトムナビゲーション（コーチ5項目・二択・保護者互換）検証', () => {
    assert.match(indexHtml, /class="c-bottom-nav" id="bottom-nav"/, 'bottom-nav uses the common app-shell class');
    assert.match(indexHtml, /data-route="dashboard"/, 'bottom-nav has dashboard');
    assert.match(indexHtml, /class="[^"]*coach-only[^"]*" data-route="players"/, 'コーチ用の選手管理を直接導線として提供する必要があります');
    assert.match(indexHtml, /id="btn-bottom-nav-match-practice"[^>]*data-mobile-route-group="schedule"/, '試合／練習の二択トリガーを提供する必要があります');
    assert.match(indexHtml, /id="btn-bottom-nav-library-tactics"[^>]*data-mobile-route-group="planning"/, 'メニュー／戦術の二択トリガーを提供する必要があります');
    assert.match(indexHtml, /class="[^"]*c-bottom-nav__item--parent-route[^"]*" data-route="matches"/, '保護者用の試合導線を維持する必要があります');
    assert.match(indexHtml, /class="[^"]*c-bottom-nav__item--parent-route[^"]*" data-route="practices"/, '保護者用の練習導線を維持する必要があります');
    assert.match(indexHtml, /id="btn-bottom-nav-more"/, 'bottom-nav has more button');
    assert.match(appJs, /btnBottomNavMore\.addEventListener\('click'/, 'app.js binds bottom nav more button');
    assert.match(appJs, /const mobileRouteChoiceTriggers = document\.querySelectorAll\('\[data-mobile-route-group\]'\)/, 'app.js collects both mobile route-choice triggers');
    assert.match(appJs, /mobileRouteChoiceTriggers\.forEach\(trigger => \{[\s\S]*?trigger\.addEventListener\('click', \(\) => openMobileRouteChoice\(trigger\.dataset\.mobileRouteGroup, trigger\)\);/, 'app.js binds both choice triggers to the shared selection sheet');
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
    assert.match(appJs, /route === 'match-detail' \|\| route === 'player-detail' \|\| route === 'animation'/, 'animation uses the shared mobile context bar as a detail route');
    assert.match(appJs, /if \(route === 'animation'\) \{[\s\S]*?await requestAnimationBack\(\);/, 'animation context back keeps the drawing-specific safe return flow');
});


test('P38-8: 戻るドックの44px操作領域とセーフエリア配置を検証', () => {
    assert.match(
        baseCss,
        /\.c-bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-bottom\)\s*\+\s*var\(--bottom-nav-float-gap\)\)\s*!important;[\s\S]*?min-height:\s*var\(--bottom-nav-height\)\s*!important;[\s\S]*?background:\s*var\(--surface-nav-floating\)\s*!important;[\s\S]*?backdrop-filter:\s*var\(--nav-floating-blur\)\s*!important;/,
        'mobile bottom nav floats above the safe area with the theme-specific frosted surface and blur'
    );
    assert.match(
        baseCss,
        /\.c-context-bar\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-bottom\)\s*\+\s*var\(--bottom-nav-float-gap\)\s*\+\s*var\(--bottom-nav-height\)\s*\+\s*var\(--bottom-nav-stack-gap\)\)\s*!important;[\s\S]*?height:\s*48px\s*!important;[\s\S]*?min-height:\s*48px\s*!important;/,
        'mobile context bar stacks above the floating bottom nav while preserving the 48px bar height'
    );
    assert.match(
        baseCss,
        /\.c-context-bar__back-button\s*\{[\s\S]*?min-width:\s*var\(--tap-target\)\s*!important;[\s\S]*?min-height:\s*var\(--tap-target\)\s*!important;[\s\S]*?height:\s*var\(--tap-target\)\s*!important;/,
        'mobile context back button uses the shared 44px tap target token'
    );
});

test('P38-9: スマホ設定タブをボトムナビ直上に固定する契約検証', () => {
    assert.match(systemCss, /body\[data-route="settings"\] \.settings-tabs-nav\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*calc\(var\(--safe-bottom\) \+ var\(--bottom-nav-float-gap\) \+ var\(--bottom-nav-height\) \+ var\(--bottom-nav-stack-gap\)\);/, 'settings tabs are fixed directly above the mobile bottom navigation');
    assert.match(systemCss, /body\[data-route="settings"\] \.sl-settings\s*\{[\s\S]*?padding-bottom:/, 'settings content reserves room for the docked tab navigation');
});

test('P38-10: 詳細画面から一覧文脈を保存・復元する契約検証', () => {
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
