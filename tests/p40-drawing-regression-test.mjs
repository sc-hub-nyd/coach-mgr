import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBuiltInFormationKeys, getFormationPlayerList } from '../formation-defs.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [drawing, drawingCss, index] = await Promise.all([
    read('../drawing.js'),
    read('../CSS/drawing.css'),
    read('../index.html')
]);

const requireAll = (text, values, label) => values.forEach(value => {
    assert.match(text, new RegExp(value), `${label}に必要な契約がありません: ${value}`);
});

const requireDomIds = (ids, label) => ids.forEach(id => {
    assert.match(index, new RegExp(`id=["']${id}["']`), `${label}のDOM IDがありません: #${id}`);
});

const requireInOrder = (text, values, label) => {
    let offset = 0;
    values.forEach(value => {
        const found = text.indexOf(value, offset);
        assert.notEqual(found, -1, `${label}の順序契約が満たされていません: ${value}`);
        offset = found + value.length;
    });
};

// P40: 作図画面の基盤。作図用Canvasと標準ツールドックはID/クラスを維持する。
requireDomIds([
    'pitch-bg-canvas', 'pitch-canvas', 'anim-back', 'anim-save',
    'tool-undo', 'tool-redo', 'tool-rotate', 'tool-delete',
    'canvas-pitch-template', 'anim-timeline-toggle',
    'anim-prev-frame', 'anim-frame-select', 'anim-next-frame',
    'anim-add-frame', 'anim-delete-frame', 'anim-play', 'anim-stop', 'anim-export-video'
], '作図基盤');
requireAll(index, [
    'c-tool-dock',
    'c-tool-dock__button',
    'data-tool="select"',
    'data-tool="player"',
    'data-tool="ball"',
    'data-tool="marker"',
    'data-tool="cone"',
    'data-tool="ladder"',
    'data-tool="minigoal"',
    'data-tool="line-rect"',
    'data-tool="line-circle"',
    'data-tool="vision"',
    'data-tool="text"',
    'data-tool="line-move"',
    'data-tool="line-pass"',
    'data-tool="line-dribble"'
], '標準ツールドック');

// モバイル作図は、Canvas領域内の補助要素も同一flex列で制御し、ピッチ→タブ→ツールドック→下部情報の順を保つ。
requireAll(drawingCss, [
    '\\.anim-main-workspace:has\\(\\.c-tool-dock\\) \\.anim-canvas-area \\{\\s*display: contents;',
    '\\.anim-main-workspace:has\\(\\.c-tool-dock\\) \\.canvas-wrapper \\{[\\s\\S]*?order: 1;',
    '\\.anim-mobile-dock-tabs \\{[\\s\\S]*?order: 2;',
    '\\.anim-main-workspace:has\\(\\.c-tool-dock\\) \\.c-tool-dock \\{[\\s\\S]*?order: 3;',
    '\\.anim-mobile-lower-panel \\{[\\s\\S]*?order: 10;'
], 'モバイル作図のピッチ・操作・詳細の順序');

// 作図初期化は練習・試合フォーメーション・ライブラリ・戦術の4保存先を解決する。
requireAll(drawing, [
    'export function initAnimation\\(params, navigateFunc, openModalFunc\\)',
    'currentPracticeId = params && params.practiceId',
    'currentMatchId = params && params.matchId',
    'currentFormationId = params && params.formId',
    'currentLibraryId = params && params.libraryId',
    'let currentTacticId = params && params.tacticId',
    'let isFormationMode = !!\\(currentMatchId && currentFormationId\\)',
    'let isLibraryMode = !!currentLibraryId',
    'let isTacticsMode = !!currentTacticId',
    "if \\(isTacticsMode\\) \\{[\\s\\S]*?animContainer.classList.add\\('is-tactics-mode'\\)",
    "else \\{[\\s\\S]*?animContainer.classList.remove\\('is-tactics-mode'\\)"
], '作図モード初期化');

// 個別配置。ツールの選択イベントは標準ツールドックへ登録し、Canvasに必要なオブジェクト型を作成する。
requireAll(drawing, [
    "const tools = \\['select', 'player', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'line-circle', 'vision', 'text', 'line-move', 'line-pass', 'line-dribble'\\]",
    '\\.c-tool-dock__button\\[data-tool="\\$\\{tool\\}"\\]',
    'newEl.addEventListener\\(\'click\'',
    'currentTool = tool',
    "currentTool = 'select'",
    "if \\(currentTool === 'player'\\)",
    "type = 'player'",
    "type = 'ball'",
    "type = 'marker'",
    "type = 'cone'",
    "type = 'minigoal'",
    "type = 'vision'",
    "type = 'text'"
], '個別オブジェクト配置');

// 図形・線・ラダーは描画開始・移動・終了を通して確定し、履歴へ保存する。
requireAll(drawing, [
    "currentTool && \\(currentTool.startsWith\\('line-'\\) \\|\\| currentTool === 'ladder'\\)",
    "currentTool === 'ladder'",
    "currentTool === 'line-rect'",
    "currentTool === 'line-circle'",
    "type: 'ladder'",
    "type: 'rect'",
    "type: 'circle'",
    "const lType = currentTool.replace\\('line-', ''\\)",
    "registerListener\\('drawing.canvas', canvas, 'mousedown', handleMouseDown\\)",
    "registerListener\\('drawing.canvas', canvas, 'mousemove', handleMouseMove\\)",
    "registerListener\\('drawing.canvas', canvas, 'mouseup', handleMouseUp\\)",
    "registerListener\\('drawing.canvas', canvas, 'touchstart', handleTouchStart, \\{ passive: false \\}\\)",
    "registerListener\\('drawing.canvas', canvas, 'touchmove', handleTouchMove, \\{ passive: false \\}\\)",
    "registerListener\\('drawing.canvas', canvas, 'touchend', handleTouchEnd, \\{ passive: false \\}\\)"
], '図形・ドラッグ描画');

// 選択後の回転・削除・Undo/Redoは履歴と再描画を伴う。
requireAll(drawing, [
    'function saveHistory\\(\\)',
    'function undoHistory\\(\\)',
    'function redoHistory\\(\\)',
    'commandStack.undo\\(\\)',
    'commandStack.redo\\(\\)',
    "newBtn.addEventListener\\('click', undoHistory\\)",
    "newBtn.addEventListener\\('click', redoHistory\\)",
    'selectedObject.angle = \\(\\(selectedObject.angle \\|\\| 0\\) \\+ 45\\) % 360',
    'objects = objects.filter\\(o => o.id !== selectedObject.id\\)',
    'saveHistory\\(\\)',
    'drawPitch\\(objects\\)'
], '選択・編集・履歴');

// 一括配置はポップオーバー、選択値、フォーメーション解決、配置対象別の置換、履歴・再描画までを保証する。
requireDomIds([
    'anim-bulk-formation-btn', 'anim-bulk-formation-popover',
    'select-bulk-team-mode', 'select-bulk-home-formation', 'select-bulk-away-formation',
    'wrapper-bulk-home-formation', 'wrapper-bulk-away-formation', 'bulk-formation-apply-help', 'btn-apply-bulk-formation'
], '一括配置');
requireAll(index, [
    'フォーメーションを変更した後は、「キャンバスに一括配置」を押して反映します。'
], '一括配置の操作案内');
requireAll(drawing, [
    "const bulkFormationBtn = document.getElementById\\('anim-bulk-formation-btn'\\)",
    "const bulkFormationPopover = document.getElementById\\('anim-bulk-formation-popover'\\)",
    "const btnApplyBulk = document.getElementById\\('btn-apply-bulk-formation'\\)",
    'bulkFormationBtn.onclick = \\(e\\) =>',
    'btnApplyBulk.onclick = \\(\\) =>',
    'applyBulkFormationToCanvas\\(homeKey, awayKey, teamMode, template\\)',
    'function getFormationList\\(formationKey\\)',
    'getFormationPlayerList\\(formationKey, state.customFormations\\)',
    "if \\(teamMode === 'both'\\)",
    "teamMode === 'home'",
    "teamMode === 'away'",
    "objects = objects.filter\\(o => o.type !== 'player'\\)",
    "o.type !== 'player' \\|\\| o.team !== 'home'",
    "o.type !== 'player' \\|\\| o.team !== 'away'",
    "team: 'home'",
    "team: 'away'",
    "showToast\\('フォーメーションを一括配置しました'\\)"
], '一括配置の状態更新');
requireInOrder(drawing, [
    'function applyBulkFormationToCanvas(homeKey, awayKey, teamMode, template)',
    'isDirty = true;',
    'saveHistory();',
    'drawPitch(objects);',
    "showToast('フォーメーションを一括配置しました');"
], '一括配置の確定処理');

// フレームの追加・削除・切替・再生を操作できることを固定する。
requireAll(drawing, [
    'function addFrame\\(\\)',
    'function deleteFrame\\(index\\)',
    'function selectFrame\\(index\\)',
    "document.getElementById\\('anim-frame-select'\\)",
    "document.getElementById\\('anim-prev-frame'\\)",
    "document.getElementById\\('anim-next-frame'\\)",
    "document.getElementById\\('anim-add-frame'\\)",
    "document.getElementById\\('anim-delete-frame'\\)",
    "newBtn.addEventListener\\('click', addFrame\\)",
    'newBtn.addEventListener\\(\'click\', \\(\\) => deleteFrame\\(currentFrameIndex\\)\\)',
    'playAnimation',
    'stopAnimation'
], 'フレーム操作・アニメーション');

// 保存は4モードごとに状態を更新し、保存後に正しい画面へ戻る。
requireAll(drawing, [
    "const btnSave = document.getElementById\\('anim-save'\\)",
    'if \\(isFormationMode\\)',
    'formObj.boardData = JSON.parse\\(JSON.stringify\\(objects\\)\\)',
    "navigateFunc\\('matches', null, true\\)",
    'else if \\(currentPracticeId && currentMenuId\\)',
    'menu.frames = JSON.parse\\(JSON.stringify\\(frames\\)\\)',
    "navigateFunc\\('practices', null, true\\)",
    'else if \\(isLibraryMode\\)',
    'libMenu.frames = JSON.parse\\(JSON.stringify\\(frames\\)\\)',
    "navigateFunc\\('library', null, true\\)",
    'else if \\(isTacticsMode\\)',
    'tactic.frames = JSON.parse\\(JSON.stringify\\(frames\\)\\)',
    "navigateFunc\\('tactics', null, true\\)",
    "const btnBack = document.getElementById\\('anim-back'\\)"
], 'モード別保存・戻る操作');

// フォーメーション定義は、すべての組み込み編成とカスタム編成を空配列にしない。
const expectedCounts = new Map([
    ['3-3-1', 8], ['2-4-1', 8], ['3-2-2', 8], ['2-3-2', 8], ['4-4-2', 11], ['4-3-3', 11]
]);
assert.deepEqual(getBuiltInFormationKeys(), [...expectedCounts.keys()], '組み込みフォーメーションの公開キーが変わりました');
for (const [key, count] of expectedCounts) {
    const players = getFormationPlayerList(key, []);
    assert.equal(players.length, count, `${key}の選手数が不正です`);
    players.forEach((player, index) => {
        assert.ok(Number.isFinite(player.x) && player.x >= 0 && player.x <= 1, `${key}の${index + 1}人目のx座標が不正です`);
        assert.ok(Number.isFinite(player.y) && player.y >= 0 && player.y <= 1, `${key}の${index + 1}人目のy座標が不正です`);
        assert.notEqual(player.num, '', `${key}の${index + 1}人目に背番号がありません`);
    });
}
const customPlayers = getFormationPlayerList('custom_0', [{
    name: '回帰テスト用',
    coords: [{ x: 10, y: 20 }, { x: 50, y: 50 }, { x: 90, y: 80 }]
}]);
assert.deepEqual(customPlayers, [
    { x: 0.8, y: 0.1, num: '1' },
    { x: 0.5, y: 0.5, num: '2' },
    { x: 0.2, y: 0.9, num: '3' }
], 'カスタムフォーメーションの座標変換が不正です');
assert.equal(getFormationPlayerList('unknown', []).length, 8, '未知の編成で標準編成へフォールバックしません');

console.log('P40 drawing regression contracts passed');
