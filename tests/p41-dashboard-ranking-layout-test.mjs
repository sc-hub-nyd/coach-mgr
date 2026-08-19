import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [index, app, system, dashboard] = await Promise.all([
    read('../index.html'),
    read('../app.js'),
    read('../CSS/components-system.css'),
    read('../CSS/dashboard.css')
]);

const requireAll = (text, values, label) => values.forEach(value => {
    assert.match(text, new RegExp(value), `${label}に必要な契約がありません: ${value}`);
});

// P41: 得点・アシスト、出席率・出場時間アラートは画面幅にかかわらず同じ二列ランキングペアである。
const rankingPairMarkup = index.match(/c-dashboard-grid__row c-dashboard-grid__row--ranking-pair/g) || [];
assert.equal(rankingPairMarkup.length, 2, 'ランキング用二列行は得点・アシストと出席率・出場時間アラートの2組で共有する必要があります');
requireAll(index, [
    'id="dash-top-scorers" class="c-data-list c-dashboard-rank-list"',
    'id="dash-top-assists" class="c-data-list c-dashboard-rank-list"',
    'id="dash-attendance-rank" class="c-data-list c-dashboard-rank-list"',
    'id="dash-playtime-content" class="c-data-list c-dashboard-rank-list"',
    'c-dashboard-grid__row c-dashboard-grid__row--ranking-pair coach-only" id="dash-coach-row"'
], '4つのランキング系カード');

requireAll(system, [
    '\\.c-dashboard-grid__row--ranking-pair,[\\s\\S]*?#dash-coach-row\\.c-dashboard-grid__row--ranking-pair \\{\\s*grid-template-columns: repeat\\(2, minmax\\(0, 1fr\\)\\);',
    '@media \\(max-width: 40rem\\) \\{[\\s\\S]*?#dash-coach-row\\.c-dashboard-grid__row--ranking-pair \\{\\s*grid-template-columns: repeat\\(2, minmax\\(0, 1fr\\)\\);',
    '\\.c-dashboard-rank-item \\.c-data-list__header \\{[\\s\\S]*?flex-wrap: nowrap;[\\s\\S]*?min-inline-size: 0;',
    '\\.c-dashboard-rank-item \\.c-data-list__identity \\{[\\s\\S]*?flex: 1 1 0;[\\s\\S]*?text-overflow: ellipsis;[\\s\\S]*?white-space: nowrap;',
    '\\.c-dashboard-rank-item \\.c-data-list__metric \\{[\\s\\S]*?flex: 0 0 4\\.5rem;[\\s\\S]*?justify-content: flex-end;[\\s\\S]*?margin-inline-start: auto;',
    '\\.c-dashboard-rank-item \\.c-data-list__metric-label,[\\s\\S]*?\\.c-dashboard-rank-item \\.c-data-list__metric-value \\{[\\s\\S]*?white-space: nowrap;'
], '共通2列レイアウト・右揃え指標');

// 4カードは氏名と指標を同一のc-data-list構造で生成し、CSSだけで整列を統一する。
requireAll(app, [
    "renderRankList\\(scorerCounts, '得点', 'dash-top-scorers'\\)",
    "renderRankList\\(assistCounts, 'A', 'dash-top-assists'\\)",
    "const attendanceRankEl = document.getElementById\\('dash-attendance-rank'\\)",
    "const playtimeContent = document.getElementById\\('dash-playtime-content'\\)",
    'c-data-list__identity',
    'c-data-list__metric-label',
    'c-data-list__metric-value'
], 'ランキング行の共通マークアップ');

requireAll(dashboard, [
    '\\.c-dashboard-widget--rank',
    '\\.c-dashboard-rank-item'
], 'ランキングカード基礎スタイル');

console.log('P41 dashboard ranking layout contracts passed');
