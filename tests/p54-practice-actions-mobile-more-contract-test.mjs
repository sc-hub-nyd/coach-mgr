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
assert.match(practices, /btn-edit-practice[^>]*aria-label="練習情報を編集"/, '編集アイコンには操作名が必要です');
assert.match(practices, /btn-delete-practice[^>]*aria-label="練習を削除"/, '削除アイコンには操作名が必要です');

[
    '/* Practice-card action hierarchy: primary action, supporting actions, then compact edit and destructive actions. */',
    'grid-template-columns: minmax(4.75rem, 1.18fr) minmax(4.4rem, 1fr) minmax(3.9rem, 0.78fr) repeat(2, var(--tap-target-min));',
    '.c-practice-card--toolbar-actions .btn-add-menu {',
    '.c-practice-card--toolbar-actions .btn-edit-practice,',
    '@container (max-width: 22rem)'
].forEach(fragment => assert.ok(system.includes(fragment), `練習操作の幅配分契約が不足しています: ${fragment}`));

assert.match(index, /id="modal-mobile-more"[^>]*aria-describedby="mobile-more-description"/, 'その他メニューは説明文と関連付ける必要があります');
assert.match(index, /class="c-modal c-modal--bottom-sheet mobile-more-sheet c-mobile-more__sheet"/, 'その他メニューは共通bottom-sheetを利用する必要があります');
assert.match(index, /<section class="mobile-more-role-card c-mobile-more__section c-mobile-more__role-card"/, 'モード操作は共通セクションで構成する必要があります');
assert.match(index, /<section class="mobile-more-sync-card c-mobile-more__section c-mobile-more__sync-card"/, '同期操作は共通セクションで構成する必要があります');
assert.match(index, /<section id="mobile-more-navigation-section" class="c-mobile-more__navigation"/, '管理画面導線は専用セクションで構成する必要があります');
assert.doesNotMatch(index, /mobile-more-(?:role|sync)-card c-card/, 'その他メニューに独立カードの積み重ねを再導入してはいけません');

[
    '.c-mobile-more__sheet::before',
    'background: var(--color-surface);',
    '.c-mobile-more__section {',
    'grid-template-columns: repeat(3, minmax(0, 1fr));',
    '.c-mobile-more__utility-row {'
].forEach(fragment => assert.ok(system.includes(fragment), `その他メニューの共通surface契約が不足しています: ${fragment}`));

assert.match(base, /\.c-bottom-nav \.c-bottom-nav__item\s*\{[\s\S]*?border:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;/, 'その他を含むボトムナビ項目はbuttonの既定枠線を持ってはいけません');
assert.match(app, /btnBottomNavMore\.addEventListener\('click'[\s\S]*?openModal\('modal-mobile-more'\)/, 'その他タブは共通モーダルを開く必要があります');
assert.match(app, /mobile-more-item\[data-mobile-route\]/, 'その他メニューの経路ボタンは既存ナビゲーションへ接続する必要があります');
assert.match(app, /mobileMoreNavigationSection\.style\.display = isCoach \? 'grid' : 'none'/, '保護者モードでは空のチーム管理セクションを表示してはいけません');

console.log('P54 practice actions and mobile more contracts passed');
