import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [script, report] = await Promise.all([
    read('../scripts/analyze-direct-color-debt-v13086.mjs'),
    read('../reports/direct-color-debt-analysis-v13086.md')
]);

[
    "const baselineRef = '01cc45a';",
    "const releaseRef = '95bf53f';",
    "const foundationFiles = new Set(['base.css', 'tokens.css']);",
    "analyze(baseline, { includeFoundation: false })",
    "analyze(release, { includeFoundation: false })",
    'reducedAtV13085: baselineComponentSummary.total - releaseComponentSummary.total'
].forEach(fragment => assert.ok(script.includes(fragment), `色負債分析の基準が不足しています: ${fragment}`));

[
    '画面・部品層の直接指定色を**325件から278件へ47件削減**',
    '| CSS/components.css | 70 | 66 | -4 |',
    '| CSS/dashboard.css | 90 | 47 | -43 |',
    '| 戦術・Canvas視覚表現 | 92 |',
    '| レガシー画面・モーダル互換規則 | 66 |',
    '| ダッシュボード画面固有規則 | 47 |',
    '| 静的テンプレート移行カタログ | 46 |',
    '| 共通部品の旧互換規則 | 20 |',
    '| CSS/drawing.css | 61 | 33 |',
    '| CSS/tactical.css | 31 | 11 |',
    'P0 | レガシー画面・モーダル互換規則',
    'node scripts/analyze-direct-color-debt-v13086.mjs'
].forEach(fragment => assert.ok(report.includes(fragment), `色負債レポートに必要な内訳がありません: ${fragment}`));

console.log('P50 direct color debt analysis contracts passed');
