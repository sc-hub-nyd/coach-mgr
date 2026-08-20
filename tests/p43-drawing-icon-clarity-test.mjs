import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [index, drawing, drawingCss, tactics] = await Promise.all([
    read('../index.html'),
    read('../drawing.js'),
    read('../CSS/drawing.css'),
    read('../tactics.js')
]);

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const requireTool = ({ tool, icon, label, ariaLabel }) => {
    const toolStart = `data-tool="${tool}"`;
    const start = index.indexOf(toolStart);
    assert.notEqual(start, -1, `作図ツールがありません: ${tool}`);
    const markup = index.slice(start, index.indexOf('</button>', start) + '</button>'.length);
    assert.match(markup, new RegExp(`class="ti ti-${escapeRegex(icon)}(?:[\\s\"]|$)`), `${tool}が${icon}を使用していません`);
    assert.match(markup, new RegExp(`c-tool-dock__label">${escapeRegex(label)}<`), `${tool}の常時ラベルが不正です`);
    assert.match(markup, new RegExp(`aria-label="${escapeRegex(ariaLabel)}"`), `${tool}のaria-labelが不正です`);
    assert.match(markup, /aria-pressed="(?:true|false)"/, `${tool}にaria-pressed初期値がありません`);
    assert.match(markup, /aria-hidden="true"/, `${tool}の装飾アイコンが支援技術へ露出しています`);
};

// P43: Canvas上の線種とツールドックの意味を一致させる。
assert.match(index, /<nav class="c-tool-dock" id="anim-tool-dock" aria-label="作図ツール">/, '作図ツールドックに名前がありません');
[
    { tool: 'player', icon: 'shirt-sport', label: '選手', ariaLabel: '選手配置ツール' },
    { tool: 'ball', icon: 'ball-football', label: 'ボール', ariaLabel: 'ボール配置ツール' },
    { tool: 'line-move', icon: 'route', label: '移動', ariaLabel: '選手移動ツール: 実線' },
    { tool: 'line-pass', icon: 'arrow-right-dashed', label: 'パス', ariaLabel: 'パスツール: 点線矢印' },
    { tool: 'line-dribble', icon: 'arrow-zig-zag', label: 'ドリブル', ariaLabel: 'ドリブルツール: ジグザグ' },
    { tool: 'cone', icon: 'cone', label: 'コーン', ariaLabel: 'コーン配置ツール' },
    { tool: 'ladder', icon: 'ladder', label: 'ラダー', ariaLabel: 'ラダー配置ツール' }
].forEach(requireTool);

// 過去の曖昧な代替を、同じツールへ戻さない。
[
    ['line-move', 'arrow-right'],
    ['line-pass', 'dots'],
    ['line-dribble', 'activity'],
    ['cone', 'caret-up'],
    ['ladder', 'menu-2']
].forEach(([tool, icon]) => {
    const start = index.indexOf(`data-tool="${tool}"`);
    const markup = index.slice(start, index.indexOf('</button>', start) + '</button>'.length);
    assert.doesNotMatch(markup, new RegExp(`ti ti-${escapeRegex(icon)}(?:[\\s\"]|$)`), `${tool}に曖昧な旧アイコン${icon}が戻っています`);
});

// 常時ラベル、キーボードフォーカス、モバイルでも読めるツールドック幅を保護する。
assert.match(drawingCss, /\.c-tool-dock__button \.c-tool-dock__label \{[\s\S]*?display: block;/, 'ツールドックのラベルが常時表示されません');
assert.match(drawingCss, /\.c-tool-dock__button:focus-visible \{[\s\S]*?outline:/, 'ツールドックのキーボードフォーカスがありません');
assert.match(drawingCss, /\.anim-main-workspace:has\(\.c-tool-dock\) \.c-tool-dock \{[\s\S]*?width: 100%;/, 'モバイルツールドックのボトム表示幅がありません');
assert.match(drawingCss, /\.anim-main-workspace:has\(\.c-tool-dock\) \.c-tool-dock__button \{[\s\S]*?width: 44px;/, 'モバイルツールボタンの幅がラベルを収容しません');

// 視覚状態と支援技術向け状態を同期する。
assert.match(drawing, /const isActive = btn\.dataset\.tool === currentTool;/, 'ツール選択状態を算出していません');
assert.match(drawing, /btn\.classList\.toggle\('active', isActive\);/, 'ツール選択の視覚状態を同期していません');
assert.match(drawing, /btn\.setAttribute\('aria-pressed', String\(isActive\)\);/, 'ツール選択のaria-pressedを同期していません');
assert.match(drawing, /if \(!btn\.dataset\.tool\) return;/, '選択ツール以外へaria-pressedを付与する危険があります');

// 戦術導線は走行アイコンでなくサッカーのピッチを表す。
assert.match(tactics, /ti ti-soccer-field/, '戦術導線にサッカーのピッチアイコンがありません');
assert.doesNotMatch(tactics, /btn-edit-tactic-board[\s\S]{0,260}ti ti-run/, '戦術作図導線へ走行アイコンが戻っています');

console.log('P43 drawing icon clarity contracts passed');
