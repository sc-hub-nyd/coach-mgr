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

// P49-1: c-modalへ移行済みのモーダルは旧.modal規則の対象外で、共通シェルだけを使う。
requireAll(legacyComponents, [
    '.modal-overlay:not(.c-modal-overlay) {',
    '.modal-overlay:not(.c-modal-overlay).hidden {',
    '.modal:not(.c-modal) {',
    '.modal-overlay:not(.c-modal-overlay).hidden .modal:not(.c-modal) {'
], 'レガシーモーダルの適用範囲');
requireAll(system, [
    '.c-modal-overlay {',
    'background: var(--color-overlay-scrim);',
    '.c-modal--legacy {',
    'background: var(--color-surface);',
    '.c-modal-overlay.hidden .c-modal {',
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

// P49-3: 練習操作は狭いカードでヘッダー下に並び、文言付き操作をellipsisで切らない。
requireAll(practices, [
    'ti ti-plus"></i> メニュー',
    'ti ti-bookmark"></i> テンプレ',
    'ti ti-share-3"></i> 共有'
], '練習管理の操作文言');
requireAll(system, [
    '/* Practice-card actions keep their Japanese labels visible instead of shrinking inside the header. */',
    'grid-template-columns: repeat(3, minmax(0, 1fr)) repeat(2, var(--tap-target-min));',
    'overflow: visible;',
    'text-overflow: clip;',
    '@container (max-width: 47rem)',
    'grid-template-columns: minmax(0, 1fr);',
    '@container (min-width: 47.0625rem)',
    'grid-template-columns: max-content max-content max-content repeat(2, var(--tap-target-min));'
], '練習カード操作の可読性');

requireAll(version, ['v1.30.86', 'モーダル・ランキング・練習管理の共通部品整合性を改善'], 'v1.30.86更新履歴');
requireAll(serviceWorker, ["const CACHE_VERSION = 'coachmgr-v196';", './CSS/components.css', './CSS/components-system.css'], 'v1.30.86 PWA資産');

console.log('P49 modal, ranking, and practice consistency contracts passed');
