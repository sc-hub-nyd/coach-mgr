import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = [
  'index.html', 'app.js', 'matches.js', 'settings.js', 'practices.js',
  'library.js', 'tactics.js', 'players.js', 'drawing.js', 'insights.js'
];

const classify = (style, line) => {
  const dynamicTokens = /\$\{|\b(left|right|top|bottom|width|height|transform):\s*[^;]*(?:\$\{|%\b|px\b)/;
  const stateTokens = /(?:^|;)\s*display\s*:\s*none\b|visibility\s*:\s*hidden\b|opacity\s*:\s*(?:0|1)\b/;
  if (dynamicTokens.test(style) || /\.style\./.test(line)) return 'dynamic';
  if (stateTokens.test(style)) return 'state';
  return 'static';
};

const rows = [];
for (const file of files) {
  const content = readFileSync(resolve(root, file), 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const matcher = /style\s*=\s*(["'])(.*?)\1/g;
    let match;
    while ((match = matcher.exec(line)) !== null) {
      rows.push({ file, line: index + 1, kind: classify(match[2], line), style: match[2] });
    }
    if (/\.style\.[a-zA-Z-]+\s*=/.test(line)) {
      rows.push({ file, line: index + 1, kind: 'dynamic', style: line.trim() });
    }
  });
}

const counts = rows.reduce((acc, row) => {
  acc[row.file] ??= { static: 0, dynamic: 0, state: 0 };
  acc[row.file][row.kind] += 1;
  return acc;
}, {});
const summary = files.map(file => ({ file, ...(counts[file] ?? { static: 0, dynamic: 0, state: 0 }) }));
const total = summary.reduce((acc, item) => ({
  static: acc.static + item.static,
  dynamic: acc.dynamic + item.dynamic,
  state: acc.state + item.state
}), { static: 0, dynamic: 0, state: 0 });

const tsv = [
  'file\tline\tclassification\tstyle',
  ...rows.map(row => [row.file, row.line, row.kind, row.style.replaceAll('\t', ' ')].join('\t'))
].join('\n') + '\n';
writeFileSync(resolve(root, 'reports/inline-style-classification-v13076.tsv'), tsv);

const table = [
  '| File | Static | Dynamic | State | Total |',
  '|---|---:|---:|---:|---:|',
  ...summary.map(item => `| \`${item.file}\` | ${item.static} | ${item.dynamic} | ${item.state} | ${item.static + item.dynamic + item.state} |`),
  `| **Total** | **${total.static}** | **${total.dynamic}** | **${total.state}** | **${total.static + total.dynamic + total.state}** |`
].join('\n');

const report = `# Inline Style Classification Audit\n\n## Baseline\n\n${table}\n\n## Classification Rules\n\n| Classification | Meaning | Target treatment |\n|---|---|---|\n| Static | Fixed layout, typography, color, flex/grid, fixed size or spacing | Move to \`c-*\`, \`l-*\`, or a page-specific CSS modifier |\n| Dynamic | Values interpolated from data, coordinates, widths, transforms, or direct DOM mutations | Keep inline or promote to a documented CSS custom property |\n| State | Temporary display or visibility state controlled by runtime behavior | Prefer \`hidden\` / \`is-*\` / ARIA state; keep only when behavior requires it |\n\n## Audit Note\n\nThis automated classification is a first-pass inventory. Every candidate must be reviewed in its rendering context before migration; values that appear static but encode data or geometry are treated as dynamic until proven otherwise.\n`;
writeFileSync(resolve(root, 'reports/inline-style-classification-v13076.md'), report);
console.log(JSON.stringify({ total, summary }, null, 2));
