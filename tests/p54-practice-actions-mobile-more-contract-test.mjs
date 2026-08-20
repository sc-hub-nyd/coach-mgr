import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [practices, index, system, base, app] = await Promise.all([
    read('../practices.js'),
    read('../index.html'),
    read('../CSS/components-system.css'),
    read('../CSS/base.css'),
    read('../app.js')
]);

const shareIndex = practices.indexOf('btn-share-practice');
const editIndex = practices.indexOf('btn-edit-practice');
const deleteIndex = practices.indexOf('btn-delete-practice');
assert.ok(shareIndex >= 0 && editIndex > shareIndex && deleteIndex > editIndex, '共有は文言付き操作群に置き、編集・削除より前に並べる必要があります');
assert.match(practices, /btn-edit-practice[^>]*aria-label="練習情報を編集"/, '編集操作には支援技術向けの操作名が必要です');
assert.match(practices, /btn-delete-practice[^>]*aria-label="練習を削除"/, '削除操作には支援技術向けの操作名が必要です');
assert.match(practices, /btn-edit-practice[\s\S]*?<span>編集<\/span>/, '均等幅の編集操作には可視ラベルが必要です');
assert.match(practices, /btn-delete-practice[\s\S]*?<span>削除<\/span>/, '均等幅の削除操作には可視ラベルが必要です');

[
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
].forEach(fragment => assert.ok(system.includes(fragment), `練習操作の二段構成契約が不足しています: ${fragment}`));

assert.match(index, /id="modal-mobile-more"[^>]*aria-describedby="mobile-more-description"/, 'その他メニューは説明文と関連付ける必要があります');
assert.match(index, /class="c-modal c-modal--bottom-sheet mobile-more-sheet c-mobile-more__sheet"/, 'その他メニューは共通bottom-sheetを利用する必要があります');
assert.match(index, /<section class="mobile-more-role-card c-mobile-more__section c-mobile-more__role-card"/, 'モード操作は共通セクションで構成する必要があります');
assert.match(index, /<section class="mobile-more-sync-card c-mobile-more__section c-mobile-more__sync-card"/, '同期操作は共通セクションで構成する必要があります');
assert.match(index, /<section id="mobile-more-navigation-section" class="c-mobile-more__navigation"/, '管理画面導線は専用セクションで構成する必要があります');
assert.doesNotMatch(index, /mobile-more-(?:role|sync)-card c-card/, 'その他メニューに独立カードの積み重ねを再導入してはいけません');

[
    '.c-modal--bottom-sheet {',
    'transition: transform var(--duration-sheet) var(--ease-out), opacity var(--duration-fast) var(--ease-out);',
    '.c-modal-overlay.is-closing .c-modal--bottom-sheet {',
    'var(--duration-sheet-close)',
    'border-start-start-radius: var(--radius-lg);',
    'border-start-end-radius: var(--radius-lg);',
    '.c-mobile-more__sheet {',
    'inline-size: min(calc(100% - var(--space-2) - var(--space-2)), 37.5rem);',
    'margin-block-end: calc(var(--safe-bottom) + var(--bottom-nav-float-gap));',
    'border-radius: var(--radius-lg);',
    '.c-mobile-more__sheet::before',
    'background: var(--color-surface);',
    '.c-mobile-more__section {',
    'grid-template-columns: repeat(3, minmax(0, 1fr));',
    '.c-mobile-more__utility-row {'
].forEach(fragment => assert.ok(system.includes(fragment), `その他メニューの共通surface契約が不足しています: ${fragment}`));

assert.match(index, /id="btn-bottom-nav-more"[^>]*aria-controls="modal-mobile-more"[^>]*aria-expanded="false"/, 'その他タブはモーダルと展開状態を関連付ける必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item\s*\{[\s\S]*?border:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;/, 'その他を含むボトムナビ項目はbuttonの既定枠線を持ってはいけません');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item--more\.is-expanded::before \{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*scale\(1\);/, '展開中のその他は他タブと同じチームカラー追随のレンズ選択面を持つ必要があります');
assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item--more\.is-expanded::after \{[\s\S]*?transform:\s*scaleX\(1\);/, '展開中のその他はブランドラインを表示する必要があります');
assert.match(app, /syncBottomNavMoreState[\s\S]*?!mobileMoreModal\.classList\.contains\('hidden'\) && !mobileMoreModal\.classList\.contains\('is-closing'\)[\s\S]*?classList\.toggle\('is-expanded'/, 'その他タブの選択状態はモーダル開閉と即時に同期する必要があります');
assert.match(app, /btnBottomNavMore\.addEventListener\('click'[\s\S]*?openModal\('modal-mobile-more', \{ trigger: btnBottomNavMore \}\)/, 'その他タブは共通モーダルをトリガー情報付きで開く必要があります');
assert.match(app, /export function closeModal[\s\S]*?modalEl\.classList\.add\('is-closing'\)/, 'その他を含むモーダルは閉じるモーションを共通化する必要があります');
assert.match(app, /if \(returnFocus && trigger instanceof HTMLElement && trigger\.isConnected\) trigger\.focus\(\);/, 'モーダルを閉じた後はトリガーへフォーカスを復帰する必要があります');
assert.match(app, /function getTopOpenModal\(\)[\s\S]*?\.modal-overlay:not\(\.hidden\):not\(\.is-closing\)/, 'フォーカストラップは閉じる途中のモーダルを操作対象にしてはいけません');
assert.match(app, /if \(e\.key !== 'Tab'\) return;[\s\S]*?e\.preventDefault\(\);[\s\S]*?focusableElements\[nextIndex\]\.focus\(\);/, '開いているモーダルではTabフォーカスを循環する必要があります');
assert.match(app, /mobile-more-item\[data-mobile-route\]/, 'その他メニューの経路ボタンは既存ナビゲーションへ接続する必要があります');
assert.match(app, /mobileMoreNavigationSection\.style\.display = isCoach \? 'grid' : 'none'/, '保護者モードでは空のチーム管理セクションを表示してはいけません');

console.log('P54 practice actions and mobile more contracts passed');
