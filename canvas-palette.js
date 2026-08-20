/*
 * Canvas color resolver
 *
 * CanvasRenderingContext2D cannot consume CSS custom-property references directly.
 * This module is the only owner of literal Canvas fallback values. UI code consumes
 * semantic CSS custom properties; stored drawing objects keep their existing color
 * values and are resolved only immediately before rendering.
 */

const FALLBACKS = Object.freeze({
    workspaceSurface: '#f1f5f9',
    pitchSurface: '#f1f5f9',
    pitchLine: '#334155',
    pitchGrid: 'rgba(51, 65, 85, 0.07)',
    pitchGuide: 'rgba(0, 0, 0, 0.2)',
    pitchGuideSubtle: 'rgba(0, 0, 0, 0.15)',
    pitchGuideStrong: 'rgba(51, 65, 85, 0.7)',
    objectPlayer: '#1d0b5e',
    objectPlayerRed: '#800a1d',
    objectPlayerBlue: '#1d0b5e',
    objectPlayerGreen: '#064e3b',
    objectPlayerOrange: '#7c2d12',
    objectPlayerSkin: '#ffdfc4',
    objectPlayerBlueHighlight: '#311096',
    objectPlayerBlueShadow: '#0f0538',
    objectBall: '#ffffff',
    objectMarker: '#f97316',
    objectCone: '#facc15',
    objectLadder: '#eab308',
    objectVision: '#38bdf8',
    objectAnnotation: '#06b6d4',
    objectText: '#000000',
    objectOutlineLight: '#ffffff',
    objectOutlineDark: '#0f172a',
    objectShadow: 'rgba(0, 0, 0, 0.3)',
    objectSelection: '#c72c38',
    objectSelectionHandlePrimary: '#10b981',
    objectSelectionHandleSecondary: '#f59e0b',
    overlaySurface: 'rgba(15, 23, 42, 0.82)',
    overlayText: '#ffffff',
    overlayBorder: 'rgba(255, 255, 255, 0.28)',
    chromeLine: '#64748b',
    chromeLineSubtle: 'rgba(100, 116, 139, 0.4)',
    chromeSurface: '#ffffff',
    chromeBorder: '#cbd5e1',
    chromeText: '#475569',
    chromeTextStrong: '#1e293b',
    selectionFill: 'rgba(148, 163, 184, 0.25)',
    selectionStroke: 'rgba(100, 116, 139, 0.8)',
    teamHome: '#f23932',
    teamAway: '#2563eb'
});

const CSS_TOKEN_BY_KEY = Object.freeze({
    workspaceSurface: '--theme-canvas',
    pitchSurface: '--canvas-pitch-surface',
    pitchLine: '--canvas-pitch-line',
    pitchGrid: '--canvas-grid-line',
    pitchGuide: '--canvas-pitch-guide',
    pitchGuideSubtle: '--canvas-pitch-guide-subtle',
    pitchGuideStrong: '--canvas-pitch-guide-strong',
    objectPlayer: '--canvas-object-player',
    objectPlayerRed: '--canvas-object-player-red',
    objectPlayerBlue: '--canvas-object-player-blue',
    objectPlayerGreen: '--canvas-object-player-green',
    objectPlayerOrange: '--canvas-object-player-orange',
    objectPlayerSkin: '--canvas-object-player-skin',
    objectPlayerBlueHighlight: '--canvas-object-player-blue-highlight',
    objectPlayerBlueShadow: '--canvas-object-player-blue-shadow',
    objectBall: '--canvas-object-ball',
    objectMarker: '--canvas-object-marker',
    objectCone: '--canvas-object-cone',
    objectLadder: '--canvas-object-ladder',
    objectVision: '--canvas-object-vision',
    objectAnnotation: '--canvas-object-annotation',
    objectText: '--canvas-object-text',
    objectOutlineLight: '--canvas-object-outline-light',
    objectOutlineDark: '--canvas-object-outline-dark',
    objectShadow: '--canvas-object-shadow',
    objectSelection: '--theme-primary',
    objectSelectionHandlePrimary: '--canvas-selection-handle-primary',
    objectSelectionHandleSecondary: '--canvas-selection-handle-secondary',
    overlaySurface: '--canvas-overlay-surface',
    overlayText: '--canvas-overlay-text',
    overlayBorder: '--canvas-overlay-border',
    chromeLine: '--canvas-chrome-line',
    chromeLineSubtle: '--canvas-chrome-line-subtle',
    chromeSurface: '--theme-surface-raised',
    chromeBorder: '--canvas-chrome-border',
    chromeText: '--theme-text-muted',
    chromeTextStrong: '--theme-text',
    selectionFill: '--canvas-selection-fill',
    selectionStroke: '--canvas-selection-stroke',
    teamHome: '--theme-primary',
    teamAway: '--theme-info'
});

const LEGACY_NAMED_COLORS = Object.freeze({
    red: 'objectPlayerRed',
    blue: 'objectPlayerBlue',
    green: 'objectPlayerGreen',
    orange: 'objectPlayerOrange'
});

const LEGACY_SWATCH_NAMES = Object.freeze({
    '#f23932': 'red', '#ef4444': 'red',
    '#3d79d5': 'blue', '#3b82f6': 'blue',
    '#63a84d': 'green', '#22c55e': 'green',
    '#f09f4d': 'orange', '#f97316': 'orange'
});

function getStyle(root) {
    if (!root || typeof getComputedStyle !== 'function') return null;
    return getComputedStyle(root);
}

function readColor(style, token, fallback) {
    if (!style || !token) return fallback;
    const value = style.getPropertyValue(token).trim();
    return value && !value.includes('var(') ? value : fallback;
}

export function getCanvasPalette(root = typeof document !== 'undefined' ? document.documentElement : null) {
    const style = getStyle(root);
    return Object.fromEntries(Object.entries(FALLBACKS).map(([key, fallback]) => [
        key,
        readColor(style, CSS_TOKEN_BY_KEY[key], fallback)
    ]));
}

export function getCanvasSwatchColor(name, objectType = 'player', palette = getCanvasPalette()) {
    const key = LEGACY_NAMED_COLORS[name] || 'objectPlayer';
    if (objectType === 'marker') {
        const markerKeys = { red: 'objectPlayerRed', blue: 'objectVision', green: 'objectSelectionHandlePrimary', orange: 'objectMarker' };
        return palette[markerKeys[name] || 'objectMarker'];
    }
    return palette[key];
}

export function getCanvasSwatchName(value, objectType = 'player', palette = getCanvasPalette()) {
    if (!value) return objectType === 'marker' ? 'orange' : 'red';
    const normalized = String(value).toLowerCase();
    if (LEGACY_NAMED_COLORS[normalized]) return normalized;
    if (LEGACY_SWATCH_NAMES[normalized]) return LEGACY_SWATCH_NAMES[normalized];
    return ['red', 'blue', 'green', 'orange'].find(name => getCanvasSwatchColor(name, objectType, palette).toLowerCase() === normalized) || null;
}

export function resolveCanvasObjectColor(object = {}, palette = getCanvasPalette()) {
    const requested = object.color;
    if (requested && !LEGACY_NAMED_COLORS[requested]) return requested;
    if (requested && LEGACY_NAMED_COLORS[requested]) return palette[LEGACY_NAMED_COLORS[requested]];

    switch (object.type) {
    case 'ball':
    case 'minigoal':
        return palette.objectBall;
    case 'marker':
        return palette.objectMarker;
    case 'cone':
        return palette.objectCone;
    case 'ladder':
        return palette.objectLadder;
    case 'vision':
        return palette.objectVision;
    case 'text':
        return palette.objectText;
    case 'line-move':
    case 'line-pass':
    case 'line-dribble':
    case 'rect':
    case 'circle':
        return palette.objectAnnotation;
    default:
        return palette.objectPlayer;
    }
}

function parseRgb(color) {
    const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(String(color).trim());
    if (hex) {
        const value = hex[1].length === 3
            ? hex[1].split('').map(char => char + char).join('')
            : hex[1];
        return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
    }
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)/i.exec(String(color).trim());
    return rgb ? rgb.slice(1, 4).map(Number) : null;
}

export function resolveCanvasOutline(color, palette = getCanvasPalette()) {
    const rgb = parseRgb(color);
    if (!rgb) return palette.objectOutlineLight;
    const [red, green, blue] = rgb.map(value => value / 255);
    const linear = [red, green, blue].map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return luminance > 0.48 ? palette.objectOutlineDark : palette.objectOutlineLight;
}

export function withCanvasAlpha(context, alpha, callback) {
    context.save();
    context.globalAlpha = alpha;
    callback();
    context.restore();
}

export const canvasPaletteFallbacks = FALLBACKS;
