import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../CSS/components-standard.css', import.meta.url), 'utf8');
const required = [
    '.c-button:focus-visible {',
    '.c-button:disabled,',
    '.c-button[aria-disabled="true"] {',
    '.c-button[aria-busy="true"],',
    '.c-button--loading {',
    '.c-button--primary:not(:disabled):hover {',
    '.c-button--danger:not(:disabled):hover {',
    '.c-input[aria-invalid="true"],',
    '.c-input.is-invalid {',
    '.c-input:disabled {',
    '.c-action-group--equal > .c-button,',
    '.c-status--interactive[aria-pressed="true"] {',
    '.c-data-item__main {',
    '.c-data-item__meta {',
    '.c-data-item__value {',
    '.c-data-item--dense {',
    '@media (max-width: 640px) {',
    '.c-data-item .c-action-group {',
    'flex-basis: 100%;'
];
required.forEach(fragment => assert.ok(css.includes(fragment), `DS-R4の部品状態・高密度契約が不足しています: ${fragment}`));
assert.doesNotMatch(css, /\.c-button:disabled[\s\S]*?pointer-events:\s*auto/,
    '無効化ボタンをpointer-events有効へ戻してはいけません');
console.log('P46 component state and density contracts passed');
