import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [template, changelog, roadmap, protocol, subsetReport, auditScript] = await Promise.all([
    read('../.github/pull_request_template.md'),
    read('../doc/DESIGN_SYSTEM_CHANGELOG.md'),
    read('../doc/DESIGN_SYSTEM_EVOLUTION_ROADMAP_V13084.md'),
    read('../doc/DESIGN_SYSTEM_VISUAL_REGRESSION_PROTOCOL.md'),
    read('../reports/tabler-subset-evaluation-v13085.md'),
    read('../scripts/audit-design-system-v13085.mjs')
]);

[
    'カラー',
    '状態',
    '共通部品',
    'アイコン',
    'Tablerサブセット',
    '作図',
    '高密度表示',
    'アクセシビリティ',
    'PWA',
    'node tests/run-contract-tests.mjs',
    'node scripts/audit-design-system-v13085.mjs',
    'git diff --check'
].forEach(fragment => assert.ok(template.includes(fragment), `PRテンプレートに必須確認項目がありません: ${fragment}`));

['v1.30.85', 'セマンティックカラー', 'Tablerサブセット', 'P45', 'P46', 'P47', '記載規約'].forEach(fragment => {
    assert.ok(changelog.includes(fragment), `デザインシステム変更履歴に必須項目がありません: ${fragment}`);
});

['基準バージョン：v1.30.85', 'DS-R1〜DS-R6 実装状況', 'DS-R6 | 完了', '278件', '144クラスのサブセット'].forEach(fragment => {
    assert.ok(roadmap.includes(fragment), `進化ロードマップに現在地が反映されていません: ${fragment}`);
});

['高密度シード', 'P47', 'PWA更新', '320px', '1280px'].forEach(fragment => {
    assert.ok(protocol.includes(fragment), `視覚回帰プロトコルに必須項目がありません: ${fragment}`);
});

['採用する。', '96.38%削減', '再生成手順', 'P42'].forEach(fragment => {
    assert.ok(subsetReport.includes(fragment), `Tablerサブセット評価に必須項目がありません: ${fragment}`);
});

['componentOrPageOccurrences', 'usedClassCount', 'undefinedClasses', 'statusInventory'].forEach(fragment => {
    assert.ok(auditScript.includes(fragment), `デザインシステム監査に必須の計測項目がありません: ${fragment}`);
});

console.log('P48 design system release governance contracts passed');
