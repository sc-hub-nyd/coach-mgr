import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const cssDir = join(root, 'CSS');
const baselineRef = '01cc45a';
const releaseRef = '95bf53f';
const reportPath = join(root, 'reports', 'direct-color-debt-analysis-v13086.md');
const directColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const cssFiles = (await readdir(cssDir)).filter(file => file.endsWith('.css')).sort();
const foundationFiles = new Set(['base.css', 'tokens.css']);

function sourceAt(ref, file) {
    return execFileSync('git', ['show', `${ref}:CSS/${file}`], { cwd: root, encoding: 'utf8' });
}

function colors(text) {
    return text.match(directColorPattern) || [];
}

function classify(file, text, matchIndex) {
    if (file === 'base.css' || file === 'tokens.css') return '基盤トークン・フォールバック';
    if (file === 'drawing.css' || file === 'tactical.css') return '戦術・Canvas視覚表現';
    if (file === 'components-system.css' && matchIndex >= text.indexOf('CSS_STATIC_CATALOG_START')) return '静的テンプレート移行カタログ';
    if (file === 'components-system.css') return '共通部品の旧互換規則';
    if (file === 'components.css') return 'レガシー画面・モーダル互換規則';
    if (file === 'dashboard.css') return 'ダッシュボード画面固有規則';
    if (file === 'components-standard.css') return '標準部品の例外規則';
    if (file === 'main.css') return 'エントリーポイント・外部資産';
    return '画面・部品の未分類規則';
}

function analyze(textByFile, { includeFoundation = true } = {}) {
    const byFile = [];
    const byCategory = new Map();
    const byValue = new Map();
    for (const [file, text] of Object.entries(textByFile)) {
        if (!includeFoundation && foundationFiles.has(file)) continue;
        const occurrences = [];
        for (const match of text.matchAll(directColorPattern)) {
            const value = match[0].toLowerCase();
            const category = classify(file, text, match.index);
            occurrences.push({ value, category });
            byCategory.set(category, (byCategory.get(category) || 0) + 1);
            byValue.set(value, (byValue.get(value) || 0) + 1);
        }
        byFile.push({ file: `CSS/${file}`, occurrences: occurrences.length, unique: new Set(occurrences.map(item => item.value)).size });
    }
    return {
        total: byFile.reduce((sum, item) => sum + item.occurrences, 0),
        byFile: byFile.sort((a, b) => b.occurrences - a.occurrences),
        byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
        byValue: [...byValue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    };
}

const baseline = {};
const release = {};
const current = {};
for (const file of cssFiles) {
    baseline[file] = sourceAt(baselineRef, file);
    release[file] = sourceAt(releaseRef, file);
    current[file] = await readFile(join(cssDir, file), 'utf8');
}

const baselineSummary = analyze(baseline);
const releaseSummary = analyze(release);
const currentSummary = analyze(current);
const baselineComponentSummary = analyze(baseline, { includeFoundation: false });
const releaseComponentSummary = analyze(release, { includeFoundation: false });
const currentComponentSummary = analyze(current, { includeFoundation: false });
const fileComparison = cssFiles.map(file => {
    const before = colors(baseline[file]).length;
    const releaseCount = colors(release[file]).length;
    const currentCount = colors(current[file]).length;
    return { file: `CSS/${file}`, before, releaseCount, currentCount, v13085Delta: releaseCount - before, currentDelta: currentCount - releaseCount };
}).filter(item => item.v13085Delta !== 0 || item.currentDelta !== 0);

const markdownTable = (rows, headers) => [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map(row => `| ${row.join(' | ')} |`)
].join('\n');

const report = `# 直接指定色の削減・残債分析\n\n**対象：CoachMgr v1.30.85を基準にしたDS-R2の色移行**\n**基準コミット：${baselineRef}（移行前）**\n**リリースコミット：${releaseRef}（v1.30.85実装）**\n\n## 結論\n\nDS-R2では、画面・部品層の直接指定色を**${baselineComponentSummary.total}件から${releaseComponentSummary.total}件へ${baselineComponentSummary.total - releaseComponentSummary.total}件削減**した。削減はダッシュボードの状態・ブランド・進捗表現と、共通コンポーネントのtoast・overlay表現をセマンティックトークンへ移すことで実現した。\n\n直接指定色を無条件にゼロへはしない。テーマ生成器自身のフォールバック、Canvas・戦術盤の図形配色、静的テンプレートの移行待ち規則は、意味・移行順・PWA互換性を確認してから扱う必要がある。\n\n## 47件の削減内訳\n\n${markdownTable(fileComparison.filter(item => item.v13085Delta !== 0).map(item => [item.file, item.before, item.releaseCount, item.v13085Delta]), ['ファイル', '移行前', 'v1.30.85', '増減'])}\n\n### ダッシュボードで削減した43件\n\nダッシュボードでは、選択面、予定・実績、勝敗バッジ、進捗バー、カード境界、背景の黒アルファ面、文字色、ブランド強調を、\`--color-action\`、\`--color-brand\`、\`--color-success\`、\`--color-danger\`、\`--color-border\`、\`--color-surface-subtle\`、\`--color-overlay-scrim-subtle\`、\`--color-text\`、\`--color-text-muted\`へ移行した。これにより、任意チーム色とlight/darkが同じ役割へ伝播する。\n\n### 共通部品で削減した4件\n\n共通部品では、toastと通知面の直接指定RGBAを、状態トークンとoverlayトークンへ移行した。トーストの種類、確認ダイアログ、状態面はP45が保護する。\n\n## v1.30.85時点で残る278件の内訳\n\n${markdownTable(releaseComponentSummary.byCategory.map(([category, occurrences]) => [category, occurrences]), ['用途分類', '件数'])}\n\n### ファイル別の残債\n\n${markdownTable(releaseComponentSummary.byFile.filter(item => item.occurrences > 0).map(item => [item.file, item.occurrences, item.unique]), ['ファイル', '直接指定色', 'ユニーク値'])}\n\n### 上位の残存色値\n\n${markdownTable(releaseComponentSummary.byValue.map(([value, occurrences]) => [value, occurrences]), ['値', '件数'])}\n\n## 残債の扱いと優先順位\n\n| 優先度 | 分類 | 方針 | 完了条件 |\n|---|---|---|---|\n| P0 | レガシー画面・モーダル互換規則 | 共通モーダル・状態・surfaceトークンへ移行する。 | 新規\`.modal\`規則を追加せず、P45とモーダル回帰を通す。 |\n| P1 | ダッシュボード画面固有規則 | カード・ランキング・進捗の残る直接色を役割トークンへ移す。 | 画面固有HEX／RGBAの追加をゼロにする。 |\n| P1 | 共通部品の旧互換規則 | 静的カタログから意味部品へ段階移行する。 | 例外を台帳化し、未使用規則を削除する。 |\n| P2 | 戦術・Canvas視覚表現 | 線種・配置・チーム別の視認性を保ちながら、生成色とCanvasパレットを分離する。 | 視覚回帰と作図P40を通す。 |\n| P3 | 基盤トークン・フォールバック | テーマ生成器や初期描画に必要な具体色だけを明文化して維持する。 | トークン外のフォールバックが増えない。 |\n\n## 現在の作業ツリーとの差分\n\nUI修正作業中の現在の画面・部品直接指定色は${currentComponentSummary.total}件で、v1.30.85基準との差分は${currentComponentSummary.total - releaseComponentSummary.total >= 0 ? '+' : ''}${currentComponentSummary.total - releaseComponentSummary.total}件である。この行はコミット前の作業状態を示すため、リリース時には再生成する。\n\n## 再生成\n\n\`node scripts/analyze-direct-color-debt-v13086.mjs\`を実行すると、このレポートを基準コミット・v1.30.85・現作業ツリーから再生成する。\n`;

await writeFile(reportPath, report);
console.log(JSON.stringify({
    report: 'reports/direct-color-debt-analysis-v13086.md',
    baselineComponentOrPage: baselineComponentSummary.total,
    v13085ComponentOrPage: releaseComponentSummary.total,
    reducedAtV13085: baselineComponentSummary.total - releaseComponentSummary.total,
    currentComponentOrPage: currentComponentSummary.total,
    totalIncludingFoundation: currentSummary.total
}, null, 2));
