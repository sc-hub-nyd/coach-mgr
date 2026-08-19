import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '..');
const indexHtml = readFileSync(join(rootDir, 'index.html'), 'utf8');
const appJs = readFileSync(join(rootDir, 'app.js'), 'utf8');
const baseCss = readFileSync(join(rootDir, 'CSS/base.css'), 'utf8');

test('P38-1: PCサイドバーフッターの配置と機能契約検証', () => {
    assert.match(indexHtml, /id="sidebar-footer"/, 'sidebar-footer exists in index.html');
    assert.match(indexHtml, /id="user-role-badge"/, 'user-role-badge exists in sidebar');
    assert.match(indexHtml, /id="btn-toggle-role"/, 'btn-toggle-role exists in sidebar');
    assert.match(indexHtml, /id="btn-toggle-color-mode"/, 'btn-toggle-color-mode exists in sidebar');
    assert.match(indexHtml, /id="btn-topbar-sync-status"/, 'sync-status exists in sidebar');
    assert.match(indexHtml, /id="topbar-version-badge"/, 'topbar-version-badge exists in sidebar');
    assert.match(baseCss, /\.sidebar-footer\s*\{/, 'CSS defines .sidebar-footer');
    assert.match(baseCss, /\.sidebar-user-card\s*\{/, 'CSS defines .sidebar-user-card');
});

test('P38-2: トップバーのスリム化とパンくずナビゲーション＆スマホモード表示検証', () => {
    assert.match(indexHtml, /id="topbar-breadcrumb"/, 'topbar-breadcrumb exists in topbar');
    assert.match(indexHtml, /id="topbar-title"/, 'topbar-title exists in topbar');
    assert.match(indexHtml, /id="topbar-back"/, 'topbar-back exists in topbar');
    assert.match(indexHtml, /id="mobile-topbar-role-badge"/, 'mobile-topbar-role-badge exists in topbar');
    assert.match(appJs, /navigate\('dashboard'\)/, 'app.js navigates back to dashboard');
    assert.match(appJs, />ダッシュボード<\/a>/, 'app.js uses ダッシュボード as breadcrumb home');
    assert.match(appJs, /mobileTopBarRoleBadge\.addEventListener\('click'/, 'app.js binds mobile role badge');
});

test('P38-3: スマホ向けボトムナビゲーション（5項目親指最適化＆権限制御）検証', () => {
    assert.match(indexHtml, /id="bottom-nav"/, 'bottom-nav exists');
    assert.match(indexHtml, /data-route="dashboard"/, 'bottom-nav has dashboard');
    assert.match(indexHtml, /data-route="matches"/, 'bottom-nav has matches');
    assert.match(indexHtml, /data-route="practices"/, 'bottom-nav has practices');
    assert.match(indexHtml, /class="nav-item coach-only" data-route="library"/, 'bottom-nav library is coach-only');
    assert.match(indexHtml, /id="btn-bottom-nav-more"/, 'bottom-nav has more button');
    assert.match(appJs, /btnBottomNavMore\.addEventListener\('click'/, 'app.js binds bottom nav more button');
    assert.match(appJs, /#bottom-nav \.coach-only/, 'app.js controls bottom-nav coach-only items');
});

test('P38-4: スマホ向けモバイルスライドシート（片手操作コントロールセンター＆クラウド同期）検証', () => {
    assert.match(indexHtml, /id="modal-mobile-more"/, 'modal-mobile-more exists');
    assert.match(indexHtml, /id="mobile-user-role-label"/, 'mobile-user-role-label exists in sheet');
    assert.match(indexHtml, /id="mobile-btn-toggle-role"/, 'mobile-btn-toggle-role exists in sheet');
    assert.match(indexHtml, /id="mobile-sync-card"/, 'mobile-sync-card exists in sheet');
    assert.match(indexHtml, /id="mobile-btn-sync-now"/, 'mobile-btn-sync-now exists in sheet');
    assert.match(indexHtml, /id="mobile-btn-toggle-color-mode"/, 'mobile-btn-toggle-color-mode exists in sheet');
    assert.match(indexHtml, /id="mobile-version-badge"/, 'mobile-version-badge exists in sheet');
    assert.match(appJs, /mobileBtnToggleRole\.onclick = handleToggleRoleClick/, 'app.js binds mobile role toggle');
    assert.match(appJs, /mobileBtnSyncNow\.addEventListener\('click'/, 'app.js binds mobile sync button');
});
