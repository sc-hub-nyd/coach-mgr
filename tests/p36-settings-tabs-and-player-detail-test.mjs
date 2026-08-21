// tests/p36-settings-tabs-and-player-detail-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPlayerStatistics } from '../player-statistics-service.js';

const basePath = path.resolve('.');
const indexHtml = fs.readFileSync(path.join(basePath, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(basePath, 'app.js'), 'utf8');
const playersJs = fs.readFileSync(path.join(basePath, 'players.js'), 'utf8');
const settingsJs = fs.readFileSync(path.join(basePath, 'settings.js'), 'utf8');
const libraryJs = fs.readFileSync(path.join(basePath, 'library.js'), 'utf8');
const practicesJs = fs.readFileSync(path.join(basePath, 'practices.js'), 'utf8');
const systemCss = fs.readFileSync(path.join(basePath, 'CSS', 'components-system.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(basePath, 'CSS', 'base.css'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(basePath, 'CSS', 'dashboard.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(basePath, 'sw.js'), 'utf8');

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
    assert.match(indexHtml, /id="pd-btn-edit"/, 'Player detail edit action exists for coach mode');
    assert.match(indexHtml, /id="pd-btn-delete"/, 'Player detail delete action exists for coach mode');
    assert.match(indexHtml, /id="form-player-development-note"/, 'Development note form exists for coach mode');
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
    assert.match(playersJs, /const canEdit = state\.currentUserRole === 'coach';/, 'Player detail derives editability from the active role');
    assert.match(playersJs, /btnEdit\.hidden = !canEdit;[\s\S]*?btnEdit\.disabled = !canEdit;/, 'Parent mode hides and disables player edit');
    assert.match(playersJs, /btnDelete\.hidden = !canEdit;[\s\S]*?btnDelete\.disabled = !canEdit;/, 'Parent mode hides and disables player deletion');
    assert.match(playersJs, /if \(state\.currentUserRole !== 'coach'\) \{[\s\S]*?保護者モードでは選手情報を編集できません/, 'Direct player-edit calls reject parent mode');
    assert.match(playersJs, /canEdit && hId \?/, 'Assessment edit and delete actions render only for coach mode');
    assert.match(playersJs, /developmentNoteForm\.hidden = !canEdit;[\s\S]*?control\.disabled = !canEdit;/, 'Development note form is disabled in parent mode');
    assert.match(baseCss, /body\.role-read-only #pd-btn-edit,[\s\S]*?body\.role-read-only #pd-btn-delete,/, 'Read-only CSS covers the current player-detail action IDs');
    assert.match(playersJs, /getPlayerStatistics\(p, \{[\s\S]*?appearanceMatches: playerMatchesList/, 'Player detail uses the shared statistics definition for KPIs and appearances');
    assert.match(playersJs, /getMatchGoalRecords\(m\)/, 'Player detail uses shared goal-record compatibility for appearance rows');
    assert.match(appJs, /getPlayerStatistics\(player, \{[\s\S]*?attendanceRate: attendancePct,[\s\S]*?goals: playerGoals,[\s\S]*?assists: playerAssists/, 'Dashboard uses the shared statistics definition for my-player KPIs');
    assert.match(dashboardCss, /player-card__identity[\s\S]*?grid-template-rows: 1\.5rem 1\.75rem;/, 'Player cards reserve fixed identity rows');
    assert.match(dashboardCss, /player-card__summary[\s\S]*?grid-template-rows: minmax\(2\.75rem, 1fr\) 1\.5rem 1\.75rem;/, 'Player cards reserve fixed summary rows');
    assert.match(serviceWorker, /player-statistics-service\.js/, 'Shared player statistics service is available offline');
});

test('4. 選手別統計のダッシュボード・詳細統一と出場履歴互換性', () => {
    const player = { id: 7 };
    const statistics = getPlayerStatistics(player, {
        referenceDate: new Date('2026-08-21T00:00:00Z'),
        matches: [
            { date: '2026-05-01', presentPlayerIds: [7], goalRecords: [{ scorerId: 7, assistId: 3 }, { scorerId: 3, assistId: 7 }] },
            { date: '2026-06-01', formations: [{ slots: [{ playerId: 7 }], goalRecords: [{ scorerId: 3, assistId: 7 }] }] },
            { date: '2026-07-01', presentPlayerIds: ['7'] },
            { date: '2025-12-01', goalRecords: [{ scorerId: 7 }] }
        ],
        practices: [
            { date: '2026-05-04', attendedPlayerIds: [7] },
            { date: '2026-05-11', presentPlayerIds: [] },
            { date: '2025-12-08', presentPlayerIds: [7] }
        ]
    });

    assert.equal(statistics.attendanceNumerator, 3, 'Current-year attendance includes presentPlayerIds and attendedPlayerIds');
    assert.equal(statistics.attendanceDenominator, 5, 'Current-year attendance counts matches and practices consistently');
    assert.equal(statistics.attendanceRate, 60, 'Dashboard and detail share the same attendance percentage');
    assert.equal(statistics.goals, 2, 'Career goals include root and historic goal records');
    assert.equal(statistics.assists, 2, 'Career assists include formation-level legacy goal records');
    assert.equal(statistics.appearanceMatches.length, 3, 'Appearance history includes formation slots and attendance records');
});
