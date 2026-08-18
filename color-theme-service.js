const DEFAULT_SEED = '#13795b';
const THEME_ALGORITHM = 'coachmgr-tonal-v1';
const THEME_ALGORITHM_VERSION = 1;
const TEXT_LIGHT = '#14201c';
const TEXT_DARK = '#f3f7f5';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function normalizeHue(hue) {
    return ((Number(hue) % 360) + 360) % 360;
}

export function normalizeHex(input, fallback = DEFAULT_SEED) {
    const value = String(input || '').trim();
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (!match) return fallback;
    const raw = match[1].length === 3
        ? match[1].split('').map(char => `${char}${char}`).join('')
        : match[1];
    return `#${raw.toLowerCase()}`;
}

function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16)
    };
}

function rgbToHex({ r, g, b }) {
    const toHex = value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    if (delta) {
        if (max === red) hue = 60 * (((green - blue) / delta) % 6);
        if (max === green) hue = 60 * ((blue - red) / delta + 2);
        if (max === blue) hue = 60 * ((red - green) / delta + 4);
    }
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    return { h: normalizeHue(hue), s: saturation * 100, l: lightness * 100 };
}

function hslToHex(hue, saturation, lightness) {
    const h = normalizeHue(hue) / 360;
    const s = clamp(saturation, 0, 100) / 100;
    const l = clamp(lightness, 0, 100) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const x = chroma * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - chroma / 2;
    let red = 0;
    let green = 0;
    let blue = 0;
    if (h < 1 / 6) [red, green, blue] = [chroma, x, 0];
    else if (h < 2 / 6) [red, green, blue] = [x, chroma, 0];
    else if (h < 3 / 6) [red, green, blue] = [0, chroma, x];
    else if (h < 4 / 6) [red, green, blue] = [0, x, chroma];
    else if (h < 5 / 6) [red, green, blue] = [x, 0, chroma];
    else [red, green, blue] = [chroma, 0, x];
    return rgbToHex({ r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255 });
}

function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const convert = value => {
        const normalized = value / 255;
        return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
}

export function contrastRatio(foreground, background) {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function bestOnColor(background, minimum = 5) {
    const candidates = [TEXT_LIGHT, '#ffffff'];
    const results = candidates.map(color => ({ color, ratio: contrastRatio(color, background) }));
    const best = results.sort((left, right) => right.ratio - left.ratio)[0];
    return best.ratio >= minimum ? best : null;
}

function buildActionColor({ hue, saturation, mode, canvas }) {
    const target = mode === 'dark' ? 66 : 38;
    const values = Array.from({ length: 73 }, (_, index) => 14 + index);
    const candidates = values.map(lightness => {
        const color = hslToHex(hue, saturation, lightness);
        const on = bestOnColor(color, 5);
        return {
            color,
            lightness,
            on: on?.color || null,
            onRatio: on?.ratio || 0,
            surfaceRatio: contrastRatio(color, canvas)
        };
    }).filter(candidate => candidate.on && candidate.surfaceRatio >= 3.5);

    if (candidates.length) {
        return candidates.sort((left, right) => Math.abs(left.lightness - target) - Math.abs(right.lightness - target))[0];
    }

    const safe = mode === 'dark'
        ? { color: '#5bd3a5', on: TEXT_LIGHT }
        : { color: '#13795b', on: '#ffffff' };
    return { ...safe, lightness: target, onRatio: contrastRatio(safe.on, safe.color), surfaceRatio: contrastRatio(safe.color, canvas) };
}

function colorAt({ hue, saturation, lightness }) {
    return hslToHex(hue, saturation, lightness);
}

function findNeutralForContrast({ hue, saturation, start, direction, background, minimum }) {
    const steps = direction === 'lighter'
        ? Array.from({ length: 100 - start }, (_, index) => start + index)
        : Array.from({ length: start }, (_, index) => start - index);
    for (const lightness of steps) {
        const candidate = colorAt({ hue, saturation, lightness });
        if (contrastRatio(candidate, background) >= minimum) return candidate;
    }
    return direction === 'lighter' ? '#c5d0c9' : '#52635a';
}

function staticStatus(mode) {
    if (mode === 'dark') {
        return {
            success: '#5bd3a5',
            warning: '#f4c35e',
            danger: '#ffb4ab',
            dangerHover: '#be342c',
            info: '#a9c7ff',
            successSurface: '#123c30',
            warningSurface: '#453514',
            dangerSurface: '#4d201b',
            infoSurface: '#1c3458'
        };
    }
    return {
        success: '#167c5a',
        warning: '#925f00',
        danger: '#b42318',
        dangerHover: '#8f1d14',
        info: '#1769aa',
        successSurface: '#e6f5ee',
        warningSurface: '#fff5d9',
        dangerSurface: '#fcebea',
        infoSurface: '#e8f2fc'
    };
}

function buildNeutralPalette(hue, mode) {
    if (mode === 'dark') {
        const surface = colorAt({ hue, saturation: 11, lightness: 15 });
        return {
            canvas: colorAt({ hue, saturation: 12, lightness: 10 }),
            surface,
            raised: colorAt({ hue, saturation: 10, lightness: 20 }),
            subtle: colorAt({ hue, saturation: 10, lightness: 13 }),
            border: findNeutralForContrast({ hue, saturation: 10, start: 42, direction: 'lighter', background: surface, minimum: 3.5 }),
            borderStrong: findNeutralForContrast({ hue, saturation: 10, start: 56, direction: 'lighter', background: surface, minimum: 4.5 }),
            text: TEXT_DARK,
            textMuted: '#c4d0c9'
        };
    }
    const surface = '#ffffff';
    return {
        canvas: colorAt({ hue, saturation: 15, lightness: 97 }),
        surface,
        raised: colorAt({ hue, saturation: 12, lightness: 99 }),
        subtle: colorAt({ hue, saturation: 14, lightness: 94 }),
        border: findNeutralForContrast({ hue, saturation: 10, start: 55, direction: 'darker', background: surface, minimum: 3.5 }),
        borderStrong: findNeutralForContrast({ hue, saturation: 10, start: 42, direction: 'darker', background: surface, minimum: 4.5 }),
        text: TEXT_LIGHT,
        textMuted: '#52635a'
    };
}

function composePalette(seed, mode) {
    const seedHsl = rgbToHsl(hexToRgb(seed));
    const hue = seedHsl.h;
    const accentSaturation = clamp(Math.max(seedHsl.s, 48), 48, 78);
    const neutral = buildNeutralPalette(hue, mode);
    const action = buildActionColor({ hue, saturation: accentSaturation, mode, canvas: neutral.canvas });
    const hover = buildActionColor({
        hue,
        saturation: accentSaturation,
        mode,
        canvas: neutral.canvas
    });
    const hoverLightness = clamp(hover.lightness + (mode === 'dark' ? 8 : -8), 14, 86);
    const hoverColor = hslToHex(hue, accentSaturation, hoverLightness);
    const hoverOn = bestOnColor(hoverColor, 5)?.color || action.on;
    const soft = colorAt({
        hue,
        saturation: clamp(accentSaturation - 24, 20, 54),
        lightness: mode === 'dark' ? 25 : 91
    });
    const softText = buildActionColor({ hue, saturation: accentSaturation, mode: mode === 'dark' ? 'light' : 'dark', canvas: soft });
    const companion = colorAt({
        hue: hue + 32,
        saturation: clamp(accentSaturation - 24, 24, 55),
        lightness: mode === 'dark' ? 66 : 38
    });
    const status = staticStatus(mode);

    return {
        mode,
        seed,
        hue,
        canvas: neutral.canvas,
        surface: neutral.surface,
        surfaceRaised: neutral.raised,
        surfaceSubtle: neutral.subtle,
        border: neutral.border,
        borderStrong: neutral.borderStrong,
        text: neutral.text,
        textMuted: neutral.textMuted,
        primary: action.color,
        primaryHover: hoverColor,
        primarySoft: soft,
        onPrimary: action.on,
        onPrimaryHover: hoverOn,
        onPrimarySoft: bestOnColor(soft, 4.5)?.color || softText.on,
        companion,
        focus: action.color,
        ...status
    };
}

export function validateThemePalette(palette) {
    const checks = [
        { id: 'text-canvas', foreground: palette.text, background: palette.canvas, minimum: 5 },
        { id: 'text-surface', foreground: palette.text, background: palette.surface, minimum: 5 },
        { id: 'muted-surface', foreground: palette.textMuted, background: palette.surface, minimum: 4.5 },
        { id: 'on-primary', foreground: palette.onPrimary, background: palette.primary, minimum: 5 },
        { id: 'on-primary-hover', foreground: palette.onPrimaryHover, background: palette.primaryHover, minimum: 5 },
        { id: 'primary-canvas', foreground: palette.primary, background: palette.canvas, minimum: 3.5 },
        { id: 'border-surface', foreground: palette.border, background: palette.surface, minimum: 3.5 },
        { id: 'focus-surface', foreground: palette.focus, background: palette.surface, minimum: 3.5 }
    ].map(check => ({ ...check, ratio: contrastRatio(check.foreground, check.background) }));
    return { checks, passes: checks.every(check => check.ratio >= check.minimum) };
}

export function buildTeamTheme(seed, mode = 'light') {
    const normalizedMode = mode === 'dark' ? 'dark' : 'light';
    let palette = composePalette(normalizeHex(seed), normalizedMode);
    let validation = validateThemePalette(palette);
    if (!validation.passes) {
        const fallback = composePalette(DEFAULT_SEED, normalizedMode);
        palette = { ...fallback, seed: normalizeHex(seed) };
        validation = validateThemePalette(palette);
    }
    return { ...palette, validation };
}

export function normalizeTeamTheme(teamInfo = {}) {
    const existing = teamInfo.theme && typeof teamInfo.theme === 'object' ? teamInfo.theme : {};
    const seed = normalizeHex(existing.seed || teamInfo.color || DEFAULT_SEED);
    return {
        seed,
        algorithm: THEME_ALGORITHM,
        algorithmVersion: THEME_ALGORITHM_VERSION
    };
}

export function getThemeCustomProperties(palette) {
    return {
        '--team-seed': palette.seed,
        '--theme-mode': palette.mode,
        '--theme-primary': palette.primary,
        '--theme-primary-hover': palette.primaryHover,
        '--theme-primary-soft': palette.primarySoft,
        '--theme-on-primary': palette.onPrimary,
        '--theme-on-primary-hover': palette.onPrimaryHover,
        '--theme-on-primary-soft': palette.onPrimarySoft,
        '--theme-companion': palette.companion,
        '--theme-canvas': palette.canvas,
        '--theme-surface': palette.surface,
        '--theme-surface-raised': palette.surfaceRaised,
        '--theme-surface-subtle': palette.surfaceSubtle,
        '--theme-border': palette.border,
        '--theme-border-strong': palette.borderStrong,
        '--theme-text': palette.text,
        '--theme-text-muted': palette.textMuted,
        '--theme-focus': palette.focus,
        '--theme-success': palette.success,
        '--theme-warning': palette.warning,
        '--theme-danger': palette.danger,
        '--theme-danger-hover': palette.dangerHover,
        '--theme-info': palette.info,
        '--theme-success-surface': palette.successSurface,
        '--theme-warning-surface': palette.warningSurface,
        '--theme-danger-surface': palette.dangerSurface,
        '--theme-info-surface': palette.infoSurface
    };
}

export function applyTeamTheme({ teamInfo = {}, colorMode = 'light', root = globalThis.document?.documentElement } = {}) {
    const theme = normalizeTeamTheme(teamInfo);
    const palette = buildTeamTheme(theme.seed, colorMode);
    if (!root) return { theme, palette };

    root.dataset.colorMode = palette.mode;
    root.style.colorScheme = palette.mode;
    Object.entries(getThemeCustomProperties(palette)).forEach(([name, value]) => root.style.setProperty(name, value));

    const metaThemeColor = globalThis.document?.querySelector?.('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', palette.canvas);
    const appleStatusBar = globalThis.document?.querySelector?.('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusBar) appleStatusBar.setAttribute('content', palette.mode === 'dark' ? 'black-translucent' : 'default');
    return { theme, palette };
}

export const TEAM_THEME_DEFAULT_SEED = DEFAULT_SEED;
export const TEAM_THEME_ALGORITHM = THEME_ALGORITHM;
export const TEAM_THEME_ALGORITHM_VERSION = THEME_ALGORITHM_VERSION;
