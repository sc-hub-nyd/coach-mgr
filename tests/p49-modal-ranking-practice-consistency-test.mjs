import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [legacyComponents, system, practices, version, serviceWorker] = await Promise.all([
    read('../CSS/components.css'),
    read('../CSS/components-system.css'),
    read('../practices.js'),
    read('../version.js'),
    read('../sw.js')
]);

const requireAll = (text, values, label) => values.forEach(value => {
    assert.ok(text.includes(value), `${label}に必要な契約がありません: ${value}`);
});

// P49-1: すべてのモーダルはc-modalへ移行済みで、旧shell互換規則を残さない。
assert.equal(legacyComponents.includes('.modal-overlay:not(.c-modal-overlay)'), false, '旧overlay互換規則を再導入してはいけません');
assert.equal(legacyComponents.includes('.modal:not(.c-modal)'), false, '旧modal shell互換規則を再導入してはいけません');
assert.equal(legacyComponents.includes('.bottom-sheet-modal'), false, '旧bottom-sheet規則を再導入してはいけません');
requireAll(system, [
    '.c-modal-overlay {',
    'background: var(--color-overlay-scrim);',
    '.c-modal--legacy {',
    'background: var(--color-surface);',
    '.c-modal-overlay.is-opening .c-modal:not(.c-modal--bottom-sheet),',
    '.c-modal-overlay.is-closing .c-modal:not(.c-modal--bottom-sheet) {',
    '.c-modal--bottom-sheet {',
    'border-start-start-radius: var(--radius-lg);',
    'border-start-end-radius: var(--radius-lg);',
    '.c-mobile-more__sheet {',
    'margin-block-end: calc(var(--safe-bottom) + var(--bottom-nav-float-gap));',
    'border-radius: var(--radius-lg);',
    '.c-modal-overlay.is-opening .c-modal--bottom-sheet,',
    '.c-modal-overlay.is-closing .c-modal--bottom-sheet {',
    '.c-modal--legacy .c-modal__heading {',
    '.c-modal--legacy .c-modal__actions {'
], '共通モーダルシェル');
assert.equal(system.includes('.c-modal-overlay.hidden .c-modal--legacy {'), false, 'legacy専用の異なる閉じ遷移を再導入してはいけません');

// P49-2: ランキングは種別ラベルを左端、数値を右端に置き、狭い2列カードで収縮できる。
requireAll(system, [
    '.c-dashboard-rank-item .c-data-list__metric {',
    'flex: 0 0 min(6.5rem, 46%);',
    'inline-size: min(6.5rem, 46%);',
    'grid-template-columns: minmax(0, 1fr) auto;',
    '.c-dashboard-rank-item .c-data-list__metric-label {',
    'justify-self: start;',
    'text-align: start;',
    '.c-dashboard-rank-item .c-data-list__metric-value {',
    'justify-self: end;',
    'text-align: end;'
], 'ランキングのラベル左・値右整列');

// P49-3: 練習操作は二段に分け、各段の操作を均等幅・統一高で配分する。
requireAll(practices, [
    'ti ti-plus"></i> メニュー',
    'ti ti-bookmark"></i> テンプレ',
    'ti ti-share-3"></i> 共有',
    'ti ti-pencil" aria-hidden="true"></i><span>編集</span>',
    'ti ti-trash" aria-hidden="true"></i><span>削除</span>'
], '練習管理の操作文言');
requireAll(system, [
    '/* Practice-card actions use two ordered rows. The explicit card modifier outranks generic container rules, so the three maintenance actions always occupy equal columns. */',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions {',
    'grid-template-columns: repeat(6, minmax(0, 1fr));',
    'inline-size: 100%;',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions .btn-add-menu {',
    'grid-column: 1 / 4;',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions .btn-save-practice-template {',
    'grid-column: 4 / -1;',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions .btn-share-practice {',
    'grid-column: 1 / 3;',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions .btn-edit-practice {',
    'grid-column: 3 / 5;',
    '.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions .btn-delete-practice {',
    'grid-column: 5 / -1;',
    'block-size: var(--tap-target-min);',
    'min-block-size: var(--tap-target-min);',
    'margin: 0;'
], '練習カード操作の均等二段構成');

requireAll(version, ['v1.30.86', 'モーダル・ランキング・練習管理の共通部品整合性を改善'], 'v1.30.86更新履歴');
requireAll(serviceWorker, ["const CACHE_VERSION = 'coachmgr-v261';", './CSS/components.css', './CSS/components-system.css', './canvas-palette.js', './pitch-renderer.js'], 'R1〜R6 PWA資産');

console.log('P49 modal, ranking, and practice consistency contracts passed');
