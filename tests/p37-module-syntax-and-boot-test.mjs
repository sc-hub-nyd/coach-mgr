import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '..');

test('P37-1: すべてのJSファイルのESモジュール構文完全性検証', () => {
    const jsFiles = readdirSync(rootDir)
        .filter(f => f.endsWith('.js') && !f.startsWith('.'));

    assert.ok(jsFiles.length > 5, 'Found root JS files');

    for (const file of jsFiles) {
        const filePath = join(rootDir, file);
        const code = readFileSync(filePath, 'utf8');

        assert.doesNotThrow(() => {
            new vm.SourceTextModule(code, {
                identifier: file
            });
        }, `JavaScript syntax error in ${file}`);
    }
});

test('P37-2: index.htmlに登録された全スクリプトの存在と整合性検証', () => {
    const indexHtml = readFileSync(join(rootDir, 'index.html'), 'utf8');
    const scriptMatches = [...indexHtml.matchAll(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g)];

    assert.ok(scriptMatches.length > 0, 'Found module script tags in index.html');

    for (const match of scriptMatches) {
        const scriptPath = match[1].replace(/^\.\//, '');
        const fullPath = join(rootDir, scriptPath);
        const code = readFileSync(fullPath, 'utf8');

        assert.doesNotThrow(() => {
            new vm.SourceTextModule(code, {
                identifier: scriptPath
            });
        }, `Script ${scriptPath} in index.html has syntax error`);
    }
});
