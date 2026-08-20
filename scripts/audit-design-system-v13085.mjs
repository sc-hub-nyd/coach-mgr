import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const cssRoot = join(root, 'CSS');
const reportPath = join(root, 'reports', 'design-system-audit-v13085.json');
const runtimeJsFiles = (await readdir(root))
    .filter(file => file.endsWith('.js') && file !== 'sw.js')
    .sort();
const sourceRoots = ['index.html', 'CSS/components-system.css', 'CSS/dashboard.css', ...runtimeJsFiles];
const allowedFoundationFiles = new Set(['CSS/base.css', 'CSS/tokens.css']);

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    }));
    return files.flat();
}

const normalize = value => value.toLowerCase().replace(/\s+/g, ' ');
const cssFiles = (await walk(cssRoot)).filter(file => file.endsWith('.css'));
const directColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const colorFiles = [];
const colorValues = new Map();
for (const file of cssFiles) {
    const text = await readFile(file, 'utf8');
    const values = text.match(directColorPattern) || [];
    const fileKey = relative(root, file);
    const normalizedValues = values.map(normalize);
    normalizedValues.forEach(value => colorValues.set(value, (colorValues.get(value) || 0) + 1));
    colorFiles.push({
        file: fileKey,
        layer: allowedFoundationFiles.has(fileKey) ? 'foundation' : 'component_or_page',
        directColorOccurrences: normalizedValues.length,
        uniqueDirectColors: [...new Set(normalizedValues)].length,
        topValues: [...new Set(normalizedValues)].slice(0, 12)
    });
}

const sourceText = (await Promise.all(sourceRoots.map(async file => ({
    file,
    text: await readFile(join(root, file), 'utf8')
})))).filter(Boolean);
const tablerClasses = new Set();
sourceText.forEach(({ text }) => {
    for (const match of text.matchAll(/\bti-([a-z0-9-]+)\b/g)) tablerClasses.add(`ti-${match[1]}`);
});
const tablerCss = await readFile(join(root, 'assets/vendor/tabler-icons/tabler-icons.css'), 'utf8');
const tablerFontBytes = (await stat(join(root, 'assets/vendor/tabler-icons/fonts/tabler-icons.woff2'))).size;
const tablerCssBytes = (await stat(join(root, 'assets/vendor/tabler-icons/tabler-icons.css'))).size;
const undefinedTabler = [...tablerClasses].filter(icon => !tablerCss.includes(`.${icon}:before`));

const componentCss = await Promise.all(cssFiles.map(async file => ({ file: relative(root, file), text: await readFile(file, 'utf8') })));
const statusPatterns = ['c-status', 'c-alert', 'toast', 'empty-state', 'sync-status-dot', 'is-error', 'is-success', 'is-warning', 'status--'];
const statusInventory = statusPatterns.map(pattern => ({
    pattern,
    files: componentCss.filter(({ text }) => text.includes(pattern)).map(({ file }) => file)
})).filter(({ files }) => files.length);

const report = {
    generatedAt: new Date().toISOString(),
    scope: {
        cssFiles: cssFiles.length,
        sourceFiles: sourceRoots.length,
        foundationFiles: [...allowedFoundationFiles]
    },
    directColors: {
        totalOccurrences: colorFiles.reduce((sum, entry) => sum + entry.directColorOccurrences, 0),
        componentOrPageOccurrences: colorFiles.filter(entry => entry.layer === 'component_or_page').reduce((sum, entry) => sum + entry.directColorOccurrences, 0),
        files: colorFiles.sort((a, b) => b.directColorOccurrences - a.directColorOccurrences),
        topValues: [...colorValues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([value, occurrences]) => ({ value, occurrences }))
    },
    tabler: {
        usedClasses: [...tablerClasses].sort(),
        usedClassCount: tablerClasses.size,
        undefinedClasses: undefinedTabler,
        cssBytes: tablerCssBytes,
        fontBytes: tablerFontBytes,
        combinedBytes: tablerCssBytes + tablerFontBytes
    },
    statusInventory
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
    report: relative(root, reportPath),
    componentOrPageDirectColors: report.directColors.componentOrPageOccurrences,
    totalDirectColors: report.directColors.totalOccurrences,
    tablerUsedClasses: report.tabler.usedClassCount,
    tablerBytes: report.tabler.combinedBytes,
    undefinedTablerClasses: report.tabler.undefinedClasses.length
}, null, 2));
