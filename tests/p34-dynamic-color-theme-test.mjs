import assert from 'node:assert/strict';
import { buildTeamTheme, contrastRatio, normalizeHex, validateThemePalette } from '../color-theme-service.js';

const SEEDS = [
    '#000000', '#ffffff', '#808080', '#ef3340', '#ff0000', '#ff7a00', '#fff000', '#00a86b',
    '#0066ff', '#6f2dbd', '#ff00aa', '#00ffff', '#13795b', '#155eef', '#9f2d2d'
];

for (const seed of SEEDS) {
    assert.match(normalizeHex(seed), /^#[0-9a-f]{6}$/i, `seed must normalize: ${seed}`);
    for (const mode of ['light', 'dark']) {
        const palette = buildTeamTheme(seed, mode);
        const validation = validateThemePalette(palette);
        assert.equal(validation.passes, true, `${seed} / ${mode}: ${validation.checks.map(check => `${check.id}=${check.ratio.toFixed(2)}`).join(', ')}`);
        assert.ok(contrastRatio(palette.onPrimary, palette.primary) >= 5, `${seed} / ${mode}: action label must be at least 5:1`);
        assert.ok(contrastRatio(palette.text, palette.surface) >= 5, `${seed} / ${mode}: surface text must be at least 5:1`);
        assert.ok(contrastRatio(palette.border, palette.surface) >= 3.5, `${seed} / ${mode}: border must be at least 3.5:1`);
        assert.ok(contrastRatio(palette.success, palette.successSurface) >= 4.5, `${seed} / ${mode}: success text must be at least 4.5:1`);
        assert.ok(contrastRatio(palette.warning, palette.warningSurface) >= 4.5, `${seed} / ${mode}: warning text must be at least 4.5:1`);
        assert.ok(contrastRatio(palette.danger, palette.dangerSurface) >= 4.5, `${seed} / ${mode}: danger text must be at least 4.5:1`);
        assert.ok(contrastRatio(palette.info, palette.infoSurface) >= 4.5, `${seed} / ${mode}: info text must be at least 4.5:1`);
        assert.ok(contrastRatio('#ffffff', palette.dangerHover) >= 4.5, `${seed} / ${mode}: destructive hover label must be at least 4.5:1`);
    }
}

console.log(`P34 dynamic team theme tests passed (${SEEDS.length} seeds × 2 modes)`);
