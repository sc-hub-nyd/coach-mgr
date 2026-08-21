import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '..');
const ignoredDirectories = new Set(['.git', 'responsive-artifacts']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.txt', '.xml', '.yml', '.yaml']);
const bannedTeamIdentifier = new RegExp([
    String.fromCodePoint(0x5357, 0x967d, 0x53f0),
    ['nan', 'yo', 'dai'].join(''),
    `\\b${['n', 'y', 'd'].join('')}\\b`
].join('|'), 'iu');

async function collectRepositoryFiles(directory, files = []) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirectories.has(entry.name)) await collectRepositoryFiles(join(directory, entry.name), files);
            continue;
        }
        if (entry.isFile()) files.push(join(directory, entry.name));
    }
    return files;
}

test('P55-1: リポジトリ本体に特定チーム名・略称を含むパスを残さない', async () => {
    const files = await collectRepositoryFiles(rootDir);
    const pathMatches = files
        .map(file => relative(rootDir, file))
        .filter(file => bannedTeamIdentifier.test(file));

    assert.deepEqual(pathMatches, [], `特定チーム名・略称を含むパスが残っています: ${pathMatches.join(', ')}`);
});

test('P55-2: ソース・設定・ドキュメントに特定チーム名・略称を残さない', async () => {
    const files = await collectRepositoryFiles(rootDir);
    const matches = [];

    for (const file of files) {
        const extension = file.slice(file.lastIndexOf('.'));
        if (!textExtensions.has(extension)) continue;
        const content = await readFile(file, 'utf8');
        if (bannedTeamIdentifier.test(content)) matches.push(relative(rootDir, file));
    }

    assert.deepEqual(matches, [], `特定チーム名・略称を含むテキストが残っています: ${matches.join(', ')}`);
});

test('P55-3: カスタムSVGを残さず、Tabler Iconsだけを実行時アイコン体系にする', async () => {
    const [iconSystem, serviceWorker, tablerCss] = await Promise.all([
        readFile(join(rootDir, 'CSS', 'icon-system.css'), 'utf8'),
        readFile(join(rootDir, 'sw.js'), 'utf8'),
        readFile(join(rootDir, 'assets', 'vendor', 'tabler-icons', 'tabler-icons-subset.css'), 'utf8')
    ]);

    await assert.rejects(
        () => readdir(join(rootDir, 'assets', 'icons')),
        error => error && error.code === 'ENOENT',
        'カスタムSVG用assets/iconsディレクトリを残してはいけません'
    );
    assert.match(iconSystem, /\.ti\s*\{[\s\S]*?color:\s*currentColor/, 'Tablerアイコンはテーマ色へ追従する必要があります');
    assert.doesNotMatch(iconSystem, /c-icon|assets\/icons\/|mask:/, 'カスタムSVGの部品・資産参照・マスク描画を残してはいけません');
    assert.doesNotMatch(serviceWorker, /assets\/icons\//, 'Service Workerは削除済みカスタムSVGをprecacheしてはいけません');
    const remainingSvgAssets = (await collectRepositoryFiles(rootDir))
        .map(file => relative(rootDir, file))
        .filter(file => file.endsWith('.svg'));
    assert.deepEqual(remainingSvgAssets, [], `Tabler専用体系にSVG資産を再導入してはいけません: ${remainingSvgAssets.join(', ')}`);
    ['ti-home', 'ti-users', 'ti-ball-football', 'ti-book-2', 'ti-route'].forEach(icon => {
        assert.match(tablerCss, new RegExp(`\\.${icon}:before`), `必要なTablerアイコンが不足しています: ${icon}`);
    });
});

console.log('P55 team identity anonymization contracts passed');
