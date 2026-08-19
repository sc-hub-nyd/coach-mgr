import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = readFileSync(resolve(root, 'CSS/base.css'), 'utf8');
const lines = source.split(/\r?\n/);
let selectorBuffer = '';
let currentSelector = '';
let media = 'base';
let depth = 0;
const rows = [];

const classify = ({ selector, media: mediaQuery, property }) => {
  const context = `${selector} ${mediaQuery}`.toLowerCase();
  if (/role-read-only|coach-only|parent-only/.test(context)) return 'authorization';
  if (/\.hidden\b|\.modal-open\b|\[style\*=\"display: none\"\]|\.is-[\w-]+|\.active\b/.test(context)) return 'runtime-state';
  if (/c-bottom-nav|c-context-bar/.test(context) && /max-width/.test(context)) return 'mobile-app-shell';
  if (/safe-(top|bottom)|env\(safe-area/.test(context)) return 'safe-area';
  if (/c-topbar|c-sidebar|main-content/.test(context) && /max-width/.test(context)) return 'responsive-app-shell';
  if (/z-index|position|display|visibility|pointer-events/.test(property)) return 'layout-protection';
  return 'ordinary-presentation';
};

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('/*')) continue;

  if (trimmed.startsWith('@media')) {
    media = trimmed;
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    continue;
  }

  if (trimmed.includes('{')) {
    const before = trimmed.split('{')[0].trim();
    if (before) currentSelector = selectorBuffer ? `${selectorBuffer} ${before}`.trim() : before;
    selectorBuffer = '';
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
  } else if (!trimmed.includes(':') && !trimmed.includes('}')) {
    selectorBuffer = `${selectorBuffer} ${trimmed}`.trim();
  }

  if (trimmed.includes('!important') && !trimmed.includes('/*') && !trimmed.includes('*/')) {
    const property = (trimmed.match(/^([\w-]+)\s*:/) || [null, 'unknown'])[1];
    const row = { line: index + 1, selector: currentSelector || '(unresolved)', media, property };
    row.classification = classify(row);
    rows.push(row);
  }

  if (trimmed.includes('}')) {
    depth -= (line.match(/\}/g) || []).length;
    if (depth <= 0) {
      media = 'base';
      depth = 0;
    }
  }
}

const categories = [...new Set(rows.map(row => row.classification))];
const summary = categories.map(category => ({ category, count: rows.filter(row => row.classification === category).length }));
const tsv = ['line\tclassification\tmedia\tselector\tproperty', ...rows.map(row => [row.line, row.classification, row.media, row.selector, row.property].join('\t'))].join('\n') + '\n';
writeFileSync(resolve(root, 'reports/base-important-classification-v13076.tsv'), tsv);
const report = `# base.css !important Classification\n\n## Summary\n\n| Classification | Declarations |\n|---|---:|\n${summary.map(row => `| ${row.category} | ${row.count} |`).join('\n')}\n| **Total** | **${rows.length}** |\n\n## Rule-level inventory\n\n| Line | Classification | Media / selector | Property |\n|---:|---|---|---|\n${rows.map(row => `| ${row.line} | ${row.classification} | \`${row.media} ${row.selector}\` | \`${row.property}\` |`).join('\n')}\n\n## Required treatment\n\n- \`ordinary-presentation\`: migrate to component or scoped app-shell selectors without \`!important\`.\n- \`runtime-state\`, \`authorization\`, \`mobile-app-shell\`, \`safe-area\`, \`responsive-app-shell\`, and \`layout-protection\`: retain only when the rule is documented in the exception ledger and protected by P35/P38 or its owning contract.\n`;
writeFileSync(resolve(root, 'reports/base-important-classification-v13076.md'), report);
console.log(JSON.stringify({ total: rows.length, summary }, null, 2));
