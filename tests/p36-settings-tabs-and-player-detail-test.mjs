// tests/p36-settings-tabs-and-player-detail-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const basePath = path.resolve('.');
const indexHtml = fs.readFileSync(path.join(basePath, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(basePath, 'app.js'), 'utf8');
const playersJs = fs.readFileSync(path.join(basePath, 'players.js'), 'utf8');
const settingsJs = fs.readFileSync(path.join(basePath, 'settings.js'), 'utf8');
const libraryJs = fs.readFileSync(path.join(basePath, 'library.js'), 'utf8');
const practicesJs = fs.readFileSync(path.join(basePath, 'practices.js'), 'utf8');
const systemCss = fs.readFileSync(path.join(basePath, 'CSS', 'components-system.css'), 'utf8');

test('1. メニュー管理・練習管理の refInp ReferenceError 修正検証', () => {
    assert.match(libraryJs, /const refInp = document\.getElementById\('menu-reflection'\);/, 'library.js has refInp definition');
    assert.match(practicesJs, /const refInp = document\.getElementById\('menu-reflection'\);/, 'practices.js has refInp definition');
});

test('2. 設定画面の Settings Hub 撤廃 & カテゴリ別タブ切り替え構造検証', () => {
    // Settings Hub は存在しないこと
    assert.doesNotMatch(indexHtml, /<section class="settings-hub/, 'settings-hub is removed');
    assert.doesNotMatch(indexHtml, /data-settings-target=/, 'data-settings-target is removed');

    // カテゴリ別タブナビゲーションが存在すること
    assert.match(indexHtml, /class="settings-tabs-nav"/, 'settings-tabs-nav exists');
    assert.match(indexHtml, /data-settings-tab="general"/, 'tab general exists');
    assert.match(indexHtml, /data-settings-tab="sync"/, 'tab sync exists');
    assert.match(indexHtml, /data-settings-tab="master"/, 'tab master exists');
    assert.match(indexHtml, /data-settings-tab="summary"/, 'tab summary exists');

    // 各タブパネルが存在すること
    assert.match(indexHtml, /data-settings-panel="general"/, 'panel general exists');
    assert.match(indexHtml, /data-settings-panel="sync"/, 'panel sync exists');
    assert.match(indexHtml, /data-settings-panel="master"/, 'panel master exists');
    assert.match(indexHtml, /data-settings-panel="summary"/, 'panel summary exists');

    // settings.js にタブ切り替えロジックが実装されていること
    assert.match(settingsJs, /data-settings-tab/, 'settings.js handles data-settings-tab');
    assert.match(settingsJs, /data-settings-panel/, 'settings.js handles data-settings-panel');

    // CSS にタブパネルの切り替え定義があること
    assert.match(systemCss, /\.settings-tab-panel/, 'CSS defines .settings-tab-panel');
});

test('3. 選手詳細の個別ページ化 & 選手編集モーダル検証', () => {
    // テンプレート tpl-player-detail が存在し、タブではなく縦セクション構成であること
    assert.match(indexHtml, /<template id="tpl-player-detail">/, 'tpl-player-detail template exists');
    assert.doesNotMatch(indexHtml, /id="btn-back-to-players"/, 'Duplicate inline back button is removed for unified topbar back');
    assert.match(indexHtml, /id="topbar-back"/, 'Unified topbar-back button exists');
    assert.match(indexHtml, /class="player-detail-number-badge"/, 'Player number badge exists');
    assert.match(indexHtml, /id="pd-attendance-rate"/, 'Attendance KPI exists');
    assert.match(indexHtml, /id="pd-profile-title"/, 'Profile section exists');
    assert.match(indexHtml, /id="pd-timeline-title"/, 'Timeline section exists');
    assert.match(indexHtml, /id="pd-matches-title"/, 'Matches section exists');
    assert.doesNotMatch(indexHtml, /data-pd-tab=/, 'Tab switcher is removed for flat vertical view');

    // 選手登録・編集モーダル (modal-player) の検証
    assert.match(indexHtml, /id="player-grade"/, 'player-grade input exists in modal-player');
    assert.match(indexHtml, /id="modal-player"/, 'modal-player exists');
    assert.doesNotMatch(indexHtml, /id="modal-player-detail"/, 'old modal-player-detail is removed');

    // app.js のルーティング検証
    assert.match(appJs, /import.*initPlayerDetailView.*from '\.\/players\.js'/, 'app.js imports initPlayerDetailView');
    assert.match(appJs, /route === 'player-detail'/, 'app.js handles player-detail route');
    assert.match(appJs, /tpl-player-detail/, 'app.js templates include tpl-player-detail');

    // players.js の関数検証
    assert.match(playersJs, /export function openPlayerDetail\(id\)/, 'openPlayerDetail is exported');
    assert.match(playersJs, /navigate\('player-detail', \{ playerId: id \}\)/, 'openPlayerDetail navigates to player-detail');
    assert.match(playersJs, /export function initPlayerDetailView\(playerId\)/, 'initPlayerDetailView is exported');
    assert.match(playersJs, /export function openPlayerEditModal\(p\)/, 'openPlayerEditModal is exported');
    assert.match(playersJs, /export function populateStrongKeySelects\(\)/, 'populateStrongKeySelects is exported');
});
