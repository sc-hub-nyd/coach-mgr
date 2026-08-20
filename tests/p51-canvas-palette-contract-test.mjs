import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    canvasPaletteFallbacks,
    getCanvasPalette,
    getCanvasSwatchColor,
    getCanvasSwatchName,
    resolveCanvasObjectColor,
    resolveCanvasOutline
} from '../canvas-palette.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [tokens, drawingCss, tacticalCss, drawing, renderer, sw] = await Promise.all([
    read('../CSS/tokens.css'),
    read('../CSS/drawing.css'),
    read('../CSS/tactical.css'),
    read('../drawing.js'),
    read('../pitch-renderer.js'),
    read('../sw.js')
]);

const directColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/;

[
    '--canvas-workspace-surface', '--canvas-pitch-surface', '--canvas-pitch-line',
    '--canvas-grid-line', '--canvas-object-player', '--canvas-object-marker',
    '--canvas-object-cone', '--canvas-object-ball', '--canvas-object-vision',
    '--canvas-selection', '--canvas-overlay-surface', '--canvas-chrome-surface'
].forEach(token => assert.match(tokens, new RegExp(token), `Canvasトークンが不足しています: ${token}`));

[drawingCss, tacticalCss].forEach((css, index) => {
    const name = index === 0 ? 'drawing.css' : 'tactical.css';
    assert.doesNotMatch(css, directColorPattern, `${name}へ直接指定色を再追加してはいけません`);
});

[drawing, renderer].forEach((source, index) => {
    const name = index === 0 ? 'drawing.js' : 'pitch-renderer.js';
    assert.doesNotMatch(source, directColorPattern, `${name}ではCanvasパレット以外の直接指定色を禁止します`);
    assert.doesNotMatch(source, /(?:fillStyle|strokeStyle)\s*=\s*['"]var\(/, `${name}ではCanvas APIへ未解決CSS変数を渡してはいけません`);
});

assert.match(drawing, /getCanvasPalette/, '作図モジュールがCanvasパレットを利用していません');
assert.match(renderer, /getCanvasPalette/, 'ピッチレンダラがCanvasパレットを利用していません');
assert.match(sw, /canvas-palette\.js/, 'CanvasパレットがPWA precacheに含まれていません');
assert.match(sw, /pitch-renderer\.js/, 'ピッチレンダラがPWA precacheに含まれていません');

const palette = getCanvasPalette(null);
assert.equal(palette.objectMarker, canvasPaletteFallbacks.objectMarker, 'DOM未初期化時はパレットフォールバックを返します');
assert.equal(resolveCanvasObjectColor({ type: 'player', color: 'red' }, palette), palette.objectPlayerRed, '旧red保存値を互換解決できません');
assert.equal(resolveCanvasObjectColor({ type: 'cone' }, palette), palette.objectCone, 'コーンの既定色が不正です');
assert.equal(resolveCanvasObjectColor({ type: 'player', color: '#123456' }, palette), '#123456', '任意の保存済みHEXを保持できません');
assert.equal(getCanvasSwatchName('#ef4444', 'marker', palette), 'red', '旧マーカー赤をスウォッチへ復元できません');
assert.equal(getCanvasSwatchColor('orange', 'marker', palette), palette.objectMarker, 'マーカー橙の役割色が不正です');
assert.equal(resolveCanvasOutline(palette.objectBall, palette), palette.objectOutlineDark, '明色オブジェクトの輪郭が不正です');

console.log('P51 canvas palette contracts passed');
