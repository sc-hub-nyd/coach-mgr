import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const requested = process.argv.slice(2).filter(Boolean);
const testFiles = requested.length
    ? requested
    : (await readdir(testDir)).filter(file => file.endsWith('-test.mjs')).sort();

if (!testFiles.length) {
    console.error('実行対象の契約テストがありません。');
    process.exit(1);
}

const results = [];
for (const file of testFiles) {
    const target = path.isAbsolute(file) ? file : path.join(testDir, file);
    process.stdout.write(`\n▶ ${path.basename(target)}\n`);
    const result = spawnSync(process.execPath, [target], { stdio: 'inherit', timeout: 30_000 });
    results.push({ file: path.basename(target), ok: result.status === 0 && !result.error });
    if (result.error || result.status !== 0) break;
}

const passed = results.filter(result => result.ok).length;
console.log(`\n契約テスト結果: ${passed}/${testFiles.length} 件成功`);
if (passed !== testFiles.length) {
    const failed = results.find(result => !result.ok)?.file || '不明なテスト';
    console.error(`失敗: ${failed}`);
    process.exit(1);
}
