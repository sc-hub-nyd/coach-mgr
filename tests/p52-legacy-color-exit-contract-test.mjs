import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [components, system, index, tokens] = await Promise.all([
    read('../CSS/components.css'),
    read('../CSS/components-system.css'),
    read('../index.html'),
    read('../CSS/tokens.css')
]);

const directColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/;

assert.doesNotMatch(components, directColorPattern, 'components.cssへ直接指定色を再追加してはいけません');
assert.doesNotMatch(components, /\.modal-overlay:not\(\.c-modal-overlay\)|\.modal:not\(\.c-modal\)|\.bottom-sheet-modal/, '旧モーダル互換規則が残っています');
assert.match(system, /\.c-modal--bottom-sheet/, '共通bottom-sheet修飾子がありません');
assert.match(system, /\.c-modal-overlay\.hidden \.c-modal--bottom-sheet/, 'bottom-sheetの閉じ遷移が共通shellへ定義されていません');
assert.doesNotMatch(index, /bottom-sheet-modal/, 'テンプレートに旧bottom-sheetクラスを残してはいけません');

const overlayCount = (index.match(/c-modal-overlay/g) || []).length;
const modalCount = (index.match(/\bc-modal\b/g) || []).length;
assert.ok(overlayCount >= 10, '既存モーダルoverlayが共通クラスへ移行されていません');
assert.ok(modalCount >= overlayCount, '各モーダル内容が共通c-modalへ移行されていません');

[
    '--color-text-inverse', '--color-surface-success-strong', '--color-surface-warning-soft',
    '--color-surface-info-soft', '--color-update-surface', '--color-update-action-surface'
].forEach(token => assert.match(tokens, new RegExp(token), `レガシー移行トークンが不足しています: ${token}`));

console.log('P52 legacy color exit contracts passed');
