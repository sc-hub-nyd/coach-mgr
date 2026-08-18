import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const files = {
    index: '../index.html',
    main: '../CSS/main.css',
    base: '../CSS/base.css',
    tokens: '../CSS/tokens.css',
    layouts: '../CSS/layouts.css',
    components: '../CSS/components-standard.css',
    systemComponents: '../CSS/components-system.css',
    dashboard: '../CSS/dashboard.css',
    iconSystem: '../CSS/icon-system.css',
    utilities: '../CSS/utilities.css',
    themeService: '../color-theme-service.js',
    settings: '../settings.js',
    app: '../app.js',
    serviceWorker: '../sw.js',
    architecture: '../CSS_ARCHITECTURE.md',
    brandStandard: '../NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD.md',
    typographyStandard: '../TYPOGRAPHY_SYSTEM.md',
    surfaceDesign: '../NEUMORPHISM_DESIGN_SYSTEM.md'
};

const source = Object.fromEntries(await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(new URL(file, import.meta.url), 'utf8')])
));

for (const stylesheet of ['tokens.css', 'layouts.css', 'components-standard.css', 'components-system.css', 'utilities.css']) {
    assert.ok(source.main.includes(`@import url('${stylesheet}');`), `main.css must import ${stylesheet}`);
}

assert.match(source.tokens, /--space-4/);
assert.match(source.tokens, /--content-wide/);
assert.match(source.tokens, /--duration-base/);
assert.match(source.tokens, /--color-canvas/);
assert.match(source.tokens, /--color-success-surface/);
assert.match(source.tokens, /--color-text-on-action:\s*var\(--theme-on-primary\)/);
assert.match(source.tokens, /--color-text-on-action-hover:\s*var\(--theme-on-primary-hover\)/);
assert.match(source.tokens, /--color-brand:\s*var\(--theme-primary\)/);
assert.match(source.tokens, /--color-brand-surface:\s*var\(--theme-primary-soft\)/);
assert.match(source.tokens, /--color-text-on-brand:\s*var\(--theme-on-primary\)/);
assert.match(source.tokens, /--text-dense-leading/);
assert.match(source.tokens, /--font-jp:\s*'Noto Sans JP'/);
assert.match(source.tokens, /--font-latin:\s*'Inter'/);
assert.match(source.tokens, /--font-ui/);
assert.match(source.tokens, /--font-heading/);
assert.match(source.tokens, /--font-numeric/);
assert.match(source.tokens, /--font-mono/);
assert.match(source.tokens, /--font-weight-heading/);
assert.match(source.tokens, /--neo-highlight/);
assert.match(source.tokens, /--neo-shadow/);
assert.match(source.tokens, /--shadow-neo-raised/);
assert.match(source.tokens, /--shadow-neo-pressed/);
assert.match(source.tokens, /--surface-inset-inline/);
assert.match(source.tokens, /--control-inset-inline/);
assert.match(source.tokens, /--icon-control-size/);
assert.match(source.tokens, /--glass-surface/);
assert.match(source.tokens, /--glass-border/);
assert.match(source.tokens, /--glass-blur/);
assert.match(source.tokens, /--liquid-veil/);
assert.match(source.base, /--theme-primary/);
assert.match(source.base, /data-color-mode="dark"/);
assert.match(source.base, /--glass-surface-strong/);
assert.match(source.base, /--liquid-veil/);
assert.doesNotMatch(source.base, /high-contrast-mode/);
assert.doesNotMatch(source.tokens, /high-contrast-mode/);
assert.match(source.layouts, /\.l-page/);
assert.match(source.layouts, /\.l-stack/);
assert.match(source.layouts, /\.l-grid/);
assert.match(source.components, /\.card\.c-card/);
assert.match(source.components, /\.c-section-header/);
assert.match(source.components, /\.c-action-group/);
assert.match(source.components, /\.c-empty-state/);
assert.match(source.components, /\.c-card--flat/);
assert.match(source.components, /--shadow-neo-raised/);
assert.match(source.components, /\.c-glass-surface/);
assert.match(source.components, /\.c-liquid-panel/);
assert.match(source.tokens, /--control-radius/);
assert.match(source.systemComponents, /\.c-form-field/);
assert.match(source.systemComponents, /\.c-fieldset/);
assert.match(source.systemComponents, /\.c-roster-row/);
assert.match(source.systemComponents, /\.c-practice-card/);
assert.match(source.systemComponents, /\.c-data-list/);
assert.match(source.systemComponents, /\.c-modal/);
assert.match(source.systemComponents, /\.c-filter-bar/);
assert.match(source.systemComponents, /--shadow-neo-pressed/);
assert.match(source.systemComponents, /--surface-inset-compact-inline/);
assert.match(source.dashboard, /--surface-inset-inline/);
assert.match(source.dashboard, /--surface-inset-compact-inline/);
assert.match(source.utilities, /\.u-visually-hidden/);
assert.match(source.base, /:focus-visible/);
assert.match(source.tokens, /prefers-reduced-motion/);
assert.match(source.tokens, /data-reduce-motion/);

assert.match(source.index, /l-page--wide/);
assert.match(source.index, /l-stack--spacious/);
assert.match(source.index, /c-card--accent/);
assert.match(source.index, /c-form-field__label/);
assert.match(source.index, /c-action-group--end/);
assert.match(source.index, /card c-card insights-panel/);
assert.match(source.index, /settings-hub card c-card/);
assert.match(source.index, /c-form-field--fluid/);
assert.match(source.index, /c-fieldset/);
assert.match(source.index, /c-modal__body/);
assert.match(source.index, /c-page-list--bottom-safe/);
assert.match(source.index, /btn-toggle-color-mode/);
assert.match(source.index, /ui-color-mode/);
assert.match(source.index, /team-theme-preview/);
assert.match(source.index, /family=Noto\+Sans\+JP/);
assert.match(source.index, /family=Inter/);
assert.match(source.index, /fonts\.gstatic\.com/);
assert.doesNotMatch(source.index, /btn-toggle-contrast/);
assert.match(source.systemComponents, /\.c-theme-preview/);
assert.match(source.systemComponents, /\.c-data-list__metric-value/);
assert.match(source.systemComponents, /font-variant-numeric:\s*tabular-nums slashed-zero/);
assert.match(source.utilities, /\.u-tabular-nums/);
assert.match(source.utilities, /\.u-mono/);
assert.match(source.iconSystem, /\.c-icon\s*\{/);
assert.match(source.iconSystem, /c-icon--team-signal/);
assert.match(source.iconSystem, /c-icon--brand/);
assert.match(source.iconSystem, /c-icon--on-brand/);
assert.match(source.iconSystem, /forced-colors/);
assert.match(source.index, /c-icon--team-signal/);
assert.match(source.index, /c-icon--home/);
assert.match(source.index, /c-icon--trophy/);
assert.match(source.themeService, /export function buildTeamTheme/);
assert.match(source.themeService, /export function validateThemePalette/);
assert.match(source.settings, /applyCurrentTeamTheme/);
assert.match(source.app, /applyCurrentTeamTheme/);
assert.doesNotMatch(source.app, /applyThemePreset/);
assert.match(source.serviceWorker, /color-theme-service\.js/);
assert.match(source.architecture, /`l-`/);
assert.match(source.architecture, /`c-`/);
assert.match(source.architecture, /`is-`/);
assert.match(source.architecture, /#EF3340/);
assert.match(source.architecture, /NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD/);
assert.match(source.brandStandard, /#EF3340/);
assert.match(source.architecture, /--color-brand/);
assert.match(source.architecture, /サーフェスシステム/);
assert.match(source.architecture, /--glass-\*/);
assert.match(source.architecture, /c-liquid-panel/);
assert.match(source.surfaceDesign, /Neumorphism 2\.0 × Liquid UI \/ Frosted Glass/);
assert.match(source.surfaceDesign, /--glass-surface-strong/);
assert.match(source.surfaceDesign, /--liquid-veil/);
assert.match(source.surfaceDesign, /backdrop-filter/);
assert.match(source.brandStandard, /既存チームの保存済み種色/);
assert.match(source.brandStandard, /TYPOGRAPHY_SYSTEM/);
assert.match(source.typographyStandard, /Noto Sans JP/);
assert.match(source.typographyStandard, /Inter/);
assert.match(source.typographyStandard, /tabular-nums/);

const iconDirectories = ['custom', 'ui', 'activity', 'family'];
const iconCount = (await Promise.all(iconDirectories.map(async directory => (
    await readdir(new URL(`../assets/icons/nanyodai/${directory}/`, import.meta.url))
))).then(groups => groups.flat().filter(file => file.endsWith('.svg')).length));
assert.equal(iconCount, 44, '南陽台FCアイコンは44個すべてを管理対象にする');

for (const [name, css] of Object.entries({ tokens: source.tokens, layouts: source.layouts, components: source.components, systemComponents: source.systemComponents, iconSystem: source.iconSystem, utilities: source.utilities })) {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(declarations, /!important/, `${name}.css must not introduce !important`);
    assert.doesNotMatch(declarations, /u-ext-\d+/, `${name}.css must not introduce numbered extension classes`);
}

assert.doesNotMatch(source.utilities, /data-route|practice-card|ui-preferences-section/, 'utilities.css must not contain page or component overrides');

const inlineStyleCount = (source.index.match(/style="/g) || []).length;
assert.ok(inlineStyleCount < 539, `expected fewer than 539 inline styles, received ${inlineStyleCount}`);

console.log('P33 CSS layout architecture tests passed');
