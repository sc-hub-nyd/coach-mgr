import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [brandStandard, iconSystem, iconValidation, evolutionRoadmap, legacyRoadmap, tokens, index, drawing] = await Promise.all([
    read('../doc/TEAM_AGNOSTIC_BRAND_DESIGN_SYSTEM_STANDARD.md'),
    read('../doc/ICON_SYSTEM.md'),
    read('../doc/ICON_SYSTEM_VALIDATION.md'),
    read('../doc/DESIGN_SYSTEM_EVOLUTION_ROADMAP_V13084.md'),
    read('../doc/DESIGN_SYSTEM_ROADMAP.md'),
    read('../CSS/tokens.css'),
    read('../index.html'),
    read('../drawing.js')
]);

const requireAll = (text, values, label) => values.forEach(value => {
    assert.ok(text.includes(value), `${label}に必要な記述がありません: ${value}`);
});

// P44: ブランド標準はセマンティックカラー、4層アイコン、作図の意味契約を正本として明記する。
requireAll(brandStandard, [
    'CoachMgr v1.30.85',
    '--color-action',
    '--color-text-on-action',
    'Tabler Icons 3.46.0',
    'Canvas作図',
    '### 作図ツールの意味契約',
    'ti-route',
    'ti-arrow-right-dashed',
    'ti-arrow-zig-zag',
    'P42 Tabler移行テスト',
    'P43 作図アイコン識別性テスト'
], 'ブランド・デザインシステム標準');

// アイコン台帳はローカルTabler、4層、タッチ操作時の可視ラベル、変更レビューを持つ。
requireAll(iconSystem, [
    'ローカル配信のTabler Icons 3.46.0',
    '第1層のカスタムSVG',
    '第2層のTabler Icons',
    '第3層の絵文字',
    '第4層のCanvas描画',
    '作図ツールのアイコン台帳',
    'デスクトップ68px・モバイル64px',
    'P40・P42・P43'
], 'アイコン台帳');

// 検証標準はD1〜D5とテーマ・PWAを横断する品質ゲートを明記する。
requireAll(iconValidation, [
    '## 3. 作図ツールのD1〜D3契約',
    '## 4. D4：台帳と変更レビュー',
    '## 5. D5：自動品質ゲート',
    'Font Awesome再導入禁止',
    'Service Workerのprecache',
    'P40',
    'P42',
    'P43',
    'P34'
], 'アイコン検証基準');

// 現行ロードマップは、次期の優先順位・品質ゲート・完了条件を管理する正本である。
requireAll(evolutionRoadmap, [
    '## 3. DS-R1〜DS-R6 実装状況（v1.30.85）',
    '## 4. 優先順位付きロードマップ',
    '### DS-R1：統制・計測を先に固定する',
    '### DS-R2：カラーと状態のトークン移行を完了する',
    '### DS-R3：アイコン資産を軽量化し、競技語彙を補完する',
    '### DS-R4：コンポーネント状態と高密度画面を標準化する',
    '### DS-R5：視覚回帰とアクセシビリティ検証を実データへ広げる',
    '### DS-R6：運用を製品開発サイクルへ定着させる',
    '## 6. リリース品質ゲート',
    '## 7. 完了の定義'
], 'デザインシステム進化ロードマップ');
assert.ok(legacyRoadmap.includes('DESIGN_SYSTEM_EVOLUTION_ROADMAP_V13084.md'), '導入初期ロードマップから現行ロードマップへ誘導されていません');

// カラーは部品が使うセマンティックトークンとして定義される。
requireAll(tokens, [
    '--color-canvas: var(--theme-canvas);',
    '--color-surface: var(--theme-surface);',
    '--color-text: var(--theme-text);',
    '--color-action: var(--theme-primary);',
    '--color-focus: var(--theme-focus);',
    '--color-success: var(--theme-success);',
    '--color-warning: var(--theme-warning);',
    '--color-danger: var(--theme-danger);',
    '--color-info: var(--theme-info);'
], 'セマンティックカラートークン');

// 作図の実装は、台帳の第一候補・可視ラベル・ARIA状態と一致する。
[
    ['line-move', 'ti-route', '移動', '選手移動ツール: 実線'],
    ['line-pass', 'ti-arrow-right-dashed', 'パス', 'パスツール: 点線矢印'],
    ['line-dribble', 'ti-arrow-zig-zag', 'ドリブル', 'ドリブルツール: ジグザグ'],
    ['cone', 'ti-cone', 'コーン', 'コーン配置ツール'],
    ['ladder', 'ti-ladder', 'ラダー', 'ラダー配置ツール']
].forEach(([tool, icon, label, ariaLabel]) => {
    const start = index.indexOf(`data-tool="${tool}"`);
    assert.notEqual(start, -1, `作図ツールがありません: ${tool}`);
    const markup = index.slice(start, index.indexOf('</button>', start) + '</button>'.length);
    assert.ok(markup.includes(icon), `${tool}のTablerクラスが台帳と一致しません`);
    assert.ok(markup.includes(`c-tool-dock__label">${label}<`), `${tool}の可視ラベルが台帳と一致しません`);
    assert.ok(markup.includes(`aria-label="${ariaLabel}"`), `${tool}のaria-labelが台帳と一致しません`);
    assert.ok(markup.includes('aria-pressed="false"'), `${tool}にaria-pressed初期値がありません`);
});

requireAll(drawing, [
    "btn.classList.toggle('active', isActive);",
    "btn.setAttribute('aria-pressed', String(isActive));"
], '作図ツールの状態同期');

console.log('P44 design system governance contracts passed');
