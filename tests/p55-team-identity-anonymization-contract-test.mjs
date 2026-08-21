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

test('P55-3: 汎用化したアイコン資産と実行時参照を完全に維持する', async () => {
    const iconDirectories = ['custom', 'ui', 'activity', 'family'];
    const iconCount = (await Promise.all(iconDirectories.map(async directory => (
        await readdir(join(rootDir, 'assets', 'icons', 'team', directory))
    ))).then(groups => groups.flat().filter(file => file.endsWith('.svg')).length));
    const [iconSystem, serviceWorker] = await Promise.all([
        readFile(join(rootDir, 'CSS', 'icon-system.css'), 'utf8'),
        readFile(join(rootDir, 'sw.js'), 'utf8')
    ]);

    assert.equal(iconCount, 44, '汎用チームアイコンは44個すべてを管理対象にする');
    assert.match(iconSystem, /assets\/icons\/team\//, 'icon-system.cssは汎用チームアイコンディレクトリを参照する');
    assert.match(serviceWorker, /assets\/icons\/team\//, 'Service Workerは汎用チームアイコンをprecacheする');
});

console.log('P55 team identity anonymization contracts passed');
