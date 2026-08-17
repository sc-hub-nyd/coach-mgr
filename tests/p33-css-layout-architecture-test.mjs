import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
    index: '../index.html',
    main: '../CSS/main.css',
    base: '../CSS/base.css',
    tokens: '../CSS/tokens.css',
    layouts: '../CSS/layouts.css',
    components: '../CSS/components-standard.css',
    utilities: '../CSS/utilities.css',
    architecture: '../CSS_ARCHITECTURE.md'
};

const source = Object.fromEntries(await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(new URL(file, import.meta.url), 'utf8')])
));

for (const stylesheet of ['tokens.css', 'layouts.css', 'components-standard.css', 'utilities.css']) {
    assert.ok(source.main.includes(`@import url('${stylesheet}');`), `main.css must import ${stylesheet}`);
}

assert.match(source.tokens, /--space-4/);
assert.match(source.tokens, /--content-wide/);
assert.match(source.tokens, /--duration-base/);
assert.match(source.layouts, /\.l-page/);
assert.match(source.layouts, /\.l-stack/);
assert.match(source.layouts, /\.l-grid/);
assert.match(source.components, /\.card\.c-card/);
assert.match(source.components, /\.c-section-header/);
assert.match(source.components, /\.c-action-group/);
assert.match(source.components, /\.c-empty-state/);
assert.match(source.utilities, /\.u-visually-hidden/);
assert.match(source.base, /:focus-visible/);
assert.match(source.tokens, /prefers-reduced-motion/);
assert.match(source.tokens, /data-reduce-motion/);

assert.match(source.index, /l-page--wide/);
assert.match(source.index, /l-stack--spacious/);
assert.match(source.index, /c-card--accent/);
assert.match(source.index, /c-field__label/);
assert.match(source.index, /c-action-group--end/);
assert.match(source.index, /card c-card insights-panel/);
assert.match(source.index, /settings-hub card c-card/);
assert.match(source.architecture, /`l-`/);
assert.match(source.architecture, /`c-`/);
assert.match(source.architecture, /`is-`/);

for (const [name, css] of Object.entries({ tokens: source.tokens, layouts: source.layouts, components: source.components, utilities: source.utilities })) {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(declarations, /!important/, `${name}.css must not introduce !important`);
    assert.doesNotMatch(declarations, /u-ext-\d+/, `${name}.css must not introduce numbered extension classes`);
}

const inlineStyleCount = (source.index.match(/style="/g) || []).length;
assert.ok(inlineStyleCount < 539, `expected fewer than 539 inline styles, received ${inlineStyleCount}`);

console.log('P33 CSS layout architecture tests passed');
