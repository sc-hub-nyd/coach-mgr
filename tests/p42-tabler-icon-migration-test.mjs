import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..');
const read = file => readFile(path.join(root, file), 'utf8');

const runtimeJsFiles = (await readdir(root))
    .filter(file => file.endsWith('.js') && file !== 'sw.js')
    .sort();
const [index, serviceWorker, tablerCss, iconSystem, componentsSystem, dashboard, ...runtimeSources] = await Promise.all([
    read('index.html'),
    read('sw.js'),
    read('assets/vendor/tabler-icons/tabler-icons.css'),
    read('CSS/icon-system.css'),
    read('CSS/components-system.css'),
    read('CSS/dashboard.css'),
    ...runtimeJsFiles.map(read)
]);

await Promise.all([
    access(path.join(root, 'assets/vendor/tabler-icons/LICENSE')),
    access(path.join(root, 'assets/vendor/tabler-icons/fonts/tabler-icons.woff2'))
]);

const applicationSources = [index, componentsSystem, dashboard, ...runtimeSources].join('\n');
const oldFontAwesomePattern = /(?:font-awesome|\bfa-(?:solid|regular|brands|[a-z0-9-]+)\b)/;
assert.doesNotMatch(applicationSources, oldFontAwesomePattern,
    '実行時ソースへFont AwesomeのCDNまたはfa-*クラスを再導入してはいけません');

assert.match(index,
    /assets\/vendor\/tabler-icons\/tabler-icons\.css\?v=3\.46\.0/,
    'Tabler Webfontは固定版のローカルCSSとして読み込む必要があります');
assert.doesNotMatch(index, /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/,
    'Font Awesome CDNをindex.htmlへ戻してはいけません');
assert.match(serviceWorker,
    /'\.\/assets\/vendor\/tabler-icons\/tabler-icons\.css'/,
    'Tabler CSSをService Workerのprecacheへ含める必要があります');
assert.match(serviceWorker,
    /'\.\/assets\/vendor\/tabler-icons\/fonts\/tabler-icons\.woff2'/,
    'Tabler WOFF2をService Workerのprecacheへ含める必要があります');
assert.doesNotMatch(serviceWorker, /font-awesome/,
    'Service Workerの外部キャッシュ対象へFont Awesomeを残してはいけません');

assert.match(tablerCss, /Tabler Icons 3\.46\.0/, '固定版Tabler Icons 3.46.0のライセンスヘッダを維持する必要があります');
['ti-ball-football', 'ti-soccer-field', 'ti-shirt-sport', 'ti-shoe', 'ti-run', 'ti-trophy', 'ti-target'].forEach(icon => {
    assert.match(tablerCss, new RegExp(`\\.${icon}:before`), `サッカー関連のTablerアイコンが不足しています: ${icon}`);
});

assert.match(iconSystem, /\.ti\s*\{[\s\S]*?color:\s*currentColor;[\s\S]*?vertical-align:/,
    'Tablerアイコンは既存テーマへcurrentColorで追従する必要があります');
assert.match(componentsSystem, /\.ti-ball-football/, '得点用の参加者表示カラーはTablerボールアイコンへ適用する必要があります');
assert.match(componentsSystem, /\.ti-shoe/, 'アシスト用の参加者表示カラーはTablerシューズアイコンへ適用する必要があります');
assert.match(dashboard, /details\[open\] summary \.ti-chevron-down/, '開閉ChevronはTablerアイコンへ適用する必要があります');

const usedTablerNames = [...new Set((applicationSources.match(/\bti-([a-z0-9-]+)\b/g) || [])
    .map(className => className.slice(3)))];
const undefinedTablerNames = usedTablerNames.filter(name => !tablerCss.includes(`.ti-${name}:before`));
assert.deepEqual(undefinedTablerNames, [],
    `ローカルTabler Webfontに存在しないクラスがあります: ${undefinedTablerNames.join(', ')}`);

console.log(`P42 Tabler icon migration contracts passed (${usedTablerNames.length} icon classes validated)`);
