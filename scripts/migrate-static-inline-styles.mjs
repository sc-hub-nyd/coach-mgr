import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = [
  'index.html', 'app.js', 'matches.js', 'settings.js', 'practices.js',
  'library.js', 'tactics.js', 'players.js', 'drawing.js'
];
const cssFile = resolve(root, 'CSS/components-system.css');
const reportFile = resolve(root, 'reports/static-style-catalog-v13076.md');
const markerStart = '/* CSS_STATIC_CATALOG_START */';
const markerEnd = '/* CSS_STATIC_CATALOG_END */';

const isRuntimeStyle = style => /\$\{|\{\{|display\s*:\s*none\b|visibility\s*:\s*hidden\b/i.test(style);
const normalize = style => style.trim().replace(/\s*;\s*/g, '; ').replace(/;\s*$/, '');

const findTagEnd = (text, start) => {
  let quote = null;
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
};

const catalog = new Map();
const occurrences = [];
const collectTagStyles = (content, file) => {
  let cursor = 0;
  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) break;
    if (!/[A-Za-z]/.test(content[start + 1] || '')) {
      cursor = start + 1;
      continue;
    }
    const end = findTagEnd(content, start);
    if (end === -1) break;
    const tag = content.slice(start, end + 1);
    const styleMatch = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
    if (styleMatch && !isRuntimeStyle(styleMatch[2])) {
      const style = normalize(styleMatch[2]);
      if (!catalog.has(style)) catalog.set(style, new Set());
      catalog.get(style).add(file);
      occurrences.push({ file, start, end, style });
    }
    cursor = end + 1;
  }
};

const original = new Map(files.map(file => [file, readFileSync(resolve(root, file), 'utf8')]));
for (const [file, content] of original) collectTagStyles(content, file);
const styles = [...catalog.keys()].sort((a, b) => a.localeCompare(b));
const classByStyle = new Map(styles.map((style, index) => [style, `c-static-style--${String(index + 1).padStart(3, '0')}`]));

const migrateContent = (content, file) => {
  let output = '';
  let cursor = 0;
  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) return output + content.slice(cursor);
    if (!/[A-Za-z]/.test(content[start + 1] || '')) {
      output += content.slice(cursor, start + 1);
      cursor = start + 1;
      continue;
    }
    const end = findTagEnd(content, start);
    if (end === -1) return output + content.slice(cursor);
    const beforeTag = content.slice(cursor, start);
    let tag = content.slice(start, end + 1);
    const styleMatch = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
    if (styleMatch && !isRuntimeStyle(styleMatch[2])) {
      const style = normalize(styleMatch[2]);
      const className = classByStyle.get(style);
      if (className) {
        tag = tag.replace(styleMatch[0], '');
        const classMatch = /\sclass\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
        if (classMatch) {
          const combined = `${classMatch[2]} ${className}`.trim();
          tag = `${tag.slice(0, classMatch.index)} class=${classMatch[1]}${combined}${classMatch[1]}${tag.slice(classMatch.index + classMatch[0].length)}`;
        } else {
          tag = tag.replace(/<([A-Za-z][^\s/>]*)/, `<$1 class="${className}"`);
        }
      }
    }
    output += beforeTag + tag;
    cursor = end + 1;
  }
  return output;
};

for (const [file, content] of original) {
  writeFileSync(resolve(root, file), migrateContent(content, file));
}

const catalogCss = [
  markerStart,
  '/* Generated from static template styles. Dynamic geometry, runtime state, and theme values remain inline by design. */',
  ...styles.map(style => `.${classByStyle.get(style)} { ${style}; }`),
  markerEnd
].join('\n');
let css = readFileSync(cssFile, 'utf8');
const catalogPattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
css = catalogPattern.test(css) ? css.replace(catalogPattern, catalogCss) : `${css.trimEnd()}\n\n${catalogCss}\n`;
writeFileSync(cssFile, css);

const reportRows = styles.map(style => {
  const className = classByStyle.get(style);
  const sourceFiles = [...catalog.get(style)].sort().map(file => `\`${file}\``).join(', ');
  return `| \`.${className}\` | ${sourceFiles} | \`${style.replaceAll('|', '\\|')}\` |`;
});
const report = `# Static Style Catalog\n\n## Purpose\n\nThis catalog removes static template presentation from HTML and JavaScript while leaving runtime geometry and state inline. Each generated class represents an exact static declaration set discovered during the R1 audit. It is centralized in \`CSS/components-system.css\` and mapped below for later semantic consolidation when a reusable domain component is identified.\n\n## Catalog\n\n| Class | Sources | Static declarations |\n|---|---|---|\n${reportRows.join('\n')}\n\n## Runtime exclusions\n\nStyles containing interpolation (\`\${...}\`), template interpolation (\`{{...}}\`), or runtime hidden state remain inline and are recorded in \`inline-style-classification-v13076.tsv\`.\n`;
writeFileSync(reportFile, report);
console.log(JSON.stringify({ migratedStaticStyles: occurrences.length, catalogEntries: styles.length }, null, 2));
