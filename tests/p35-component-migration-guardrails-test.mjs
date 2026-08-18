import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const source = Object.fromEntries(await Promise.all([
    ['index', '../index.html'],
    ['settings', '../settings.js'],
    ['practices', '../practices.js'],
    ['library', '../library.js'],
    ['tactics', '../tactics.js'],
    ['players', '../players.js'],
    ['insights', '../insights.js'],
    ['matches', '../matches.js'],
    ['app', '../app.js'],
    ['standard', '../CSS/components-standard.css'],
    ['system', '../CSS/components-system.css']
].map(async ([key, file]) => [key, await read(file)])));

const requireAll = (text, values, label) => values.forEach(value => {
    assert.match(text, new RegExp(value), `${label}に必要な契約がありません: ${value}`);
});

// Settings: preserve data entry, theme, workspace, sync, and parent-access contracts while markup migrates.
requireAll(source.index, [
    'template id="tpl-settings"',
    'id="ui-preferences-section"',
    'id="ui-color-mode"',
    'id="ui-font-scale"',
    'id="ui-preferred-hand"',
    'id="btn-save-ui-preferences"',
    'id="team-theme-section"',
    'id="form-team-info"',
    'id="team-info-name"',
    'id="team-info-color"',
    'id="team-theme-preview"',
    'id="workspace-management-section"',
    'id="workspace-team-select"',
    'id="workspace-season-select"',
    'id="btn-workspace-switch"',
    'id="gas-sync-section"',
    'id="form-gas-sync"',
    'id="parent-share-section"'
], '設定画面');

// Practices: preserve filtering, creation, editing, attendance, and drawing-preview entry points.
requireAll(source.index, [
    'template id="tpl-practices"',
    'id="input-practice-search"',
    'id="btn-toggle-filter-practices"',
    'id="filter-accordion-practices"',
    'id="filter-nendo-practice"',
    'id="filter-month-practice"',
    'id="filter-category-practice"',
    'id="filter-player-practice"',
    'id="btn-reset-filter-practices"',
    'id="btn-add-practice"',
    'id="practice-list"',
    'id="form-practice"',
    'id="practice-attendance-roster"',
    'id="modal-practice-anim-preview"'
], '練習管理画面');

requireAll(source.settings, [
    'btn-save-ui-preferences',
    'form-team-info',
    'btn-workspace-switch',
    'form-gas-sync'
], '設定イベント');

requireAll(source.index, [
    'template id="tpl-animation"',
    'id="canvas-pitch-template"',
    'id="canvas-snap-grid"',
    'id="anim-save"',
    'c-form-field--fluid',
    'c-choice-field'
], '作図設定');

requireAll(source.index, [
    'template id="tpl-match-detail"',
    'id="field-match-timer"',
    'id="btn-field-timer-toggle"',
    'id="field-period-select"',
    'id="field-event-filter"',
    'id="field-event-list"',
    'id="match-detail-date-input"',
    'id="match-detail-opponent-input"',
    'id="match-detail-type-select"',
    'id="match-detail-tournament-input"',
    'id="match-detail-theme-input"',
    'id="match-detail-summary-input"',
    'c-form-field--compact'
], 'Field Companion');

requireAll(source.index, [
    'template id="tpl-insights"',
    'id="insights-range-select"',
    'id="insights-player-select"',
    'id="btn-copy-insights-report"',
    'c-section-header',
    'c-form-field'
], '振り返り画面');

requireAll(source.insights, [
    'function renderCompactEmptyState',
    'c-empty-state--compact',
    'insights-range-select',
    'insights-player-select'
], '振り返り空状態');

requireAll(source.index, [
    'id="dash-action-center"',
    'id="dash-practice-plan"',
    'id="dash-parent-agenda"',
    'c-liquid-panel'
], 'Liquid UIダッシュボード');

requireAll(source.app, [
    'function renderEmptyState',
    'c-empty-state',
    'c-empty-state__body',
    'c-empty-state__title',
    'c-empty-state__text',
    'c-empty-state--compact',
    "compact = false"
], '共通空状態');

requireAll(source.matches, [
    'c-empty-state',
    'btn-empty-add-match',
    'btn-add-match'
], '試合空状態');

requireAll(source.library, [
    'c-empty-state',
    'btn-empty-add-library'
], 'メニュー空状態');

requireAll(source.tactics, [
    'c-empty-state',
    'btn-empty-add-tactic'
], '戦術空状態');

requireAll(source.players, [
    'c-empty-state',
    'btn-empty-add-player',
    'player-view-tab'
], '選手空状態');

requireAll(source.practices, [
    'btn-add-practice',
    'form-practice',
    'practice-attendance-roster',
    'btn-share-practice',
    'btn-open-anim-preview',
    'c-empty-state',
    'btn-empty-add-practice'
], '練習イベント');

requireAll(source.index, [
    'template id="tpl-practices"',
    'c-filter-bar',
    'c-filter-bar__search',
    'c-filter-bar__filters'
], '練習フィルター');

requireAll(source.index, [
    'template id="tpl-players"',
    'id="player-view-tabs"',
    'player-view-tab',
    'id="player-grid"',
    'id="player-view-participation"',
    'id="btn-import-players-csv"',
    'id="btn-add-player"',
    'c-view-switcher'
], '選手ビュー切替');

requireAll(source.index, [
    'template id="tpl-tactics"',
    'id="input-tactics-search"',
    'id="filter-tactics-category"',
    'id="btn-add-tactic"',
    'c-filter-bar__search',
    'c-filter-bar__actions'
], '戦術フィルター');

requireAll(source.index, [
    'template id="tpl-library"',
    'id="input-library-search"',
    'id="btn-toggle-filter-library"',
    'id="filter-accordion-library"',
    'id="filter-library-category"',
    'id="filter-library-media"',
    'id="filter-library-assigned"',
    'id="filter-library-rating"',
    'id="btn-reset-filter-library"',
    'id="btn-add-library-menu"',
    'c-filter-bar__search',
    'c-filter-bar__filters'
], 'メニューフィルター');

requireAll(source.index, [
    'template id="tpl-matches"',
    'id="input-match-search"',
    'id="btn-toggle-filter-matches"',
    'id="filter-accordion-matches"',
    'id="filter-nendo-match"',
    'id="filter-type-match"',
    'id="filter-opponent-match"',
    'id="filter-result-match"',
    'id="btn-reset-filter-matches"',
    'id="btn-add-match"',
    'c-filter-bar__search',
    'c-filter-bar__filters'
], '試合フィルター');

// Standard component contracts used by Phase 1 must exist before templates are migrated.
requireAll(source.standard, [
    '\\.c-card',
    '\\.c-section-header',
    '\\.c-action-group',
    '\\.c-empty-state',
    '\\.c-empty-state--compact'
], '標準部品');

requireAll(source.system, [
    '\\.c-settings-section',
    '\\.c-settings-form',
    '\\.c-form-field',
    '\\.c-fieldset',
    '\\.c-roster-row',
    '\\.c-practice-card',
    '\\.c-data-list',
    '\\.c-filter-bar',
    '\\.c-view-switcher',
    '\\.c-modal'
], 'システム部品');

console.log('P35 component migration guardrails passed');
