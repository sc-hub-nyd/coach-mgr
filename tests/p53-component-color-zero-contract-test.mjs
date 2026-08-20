import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const componentFiles = [
    '../CSS/components.css',
    '../CSS/components-standard.css',
    '../CSS/components-system.css',
    '../CSS/dashboard.css',
    '../CSS/drawing.css',
    '../CSS/icon-system.css',
    '../CSS/layouts.css',
    '../CSS/main.css',
    '../CSS/tactical.css',
    '../CSS/utilities.css'
];
const [sources, tokens, auditScript] = await Promise.all([
    Promise.all(componentFiles.map(read)),
    read('../CSS/tokens.css'),
    read('../scripts/audit-design-system-v13085.mjs')
]);

const directColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/;
componentFiles.forEach((file, index) => {
    assert.doesNotMatch(sources[index], directColorPattern, `${file}へ直接指定色を再追加してはいけません`);
});

[
    '--color-heatmap-level-0-surface', '--color-heatmap-level-5-text',
    '--color-media-preview-surface', '--color-swatch-blue', '--color-accent-violet'
].forEach(token => assert.match(tokens, new RegExp(token), `色の所有トークンが不足しています: ${token}`));

assert.match(auditScript, /componentOrPageOccurrences/, '監査は画面・部品層の色債務を集計する必要があります');
assert.match(auditScript, /foundationFiles/, '監査は基盤トークンと画面・部品層を区別する必要があります');

console.log('P53 component color zero contracts passed');
