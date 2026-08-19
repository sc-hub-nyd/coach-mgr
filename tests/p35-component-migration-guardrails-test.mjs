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
    ['matches', '../matches.js'],
    ['drawing', '../drawing.js'],
    ['app', '../app.js'],
    ['standard', '../CSS/components-standard.css'],
    ['components', '../CSS/components.css'],
    ['base', '../CSS/base.css'],
    ['dashboard', '../CSS/dashboard.css'],
    ['drawingCss', '../CSS/drawing.css'],
    ['system', '../CSS/components-system.css']
].map(async ([key, file]) => [key, await read(file)])));

const requireAll = (text, values, label) => values.forEach(value => {
    assert.match(text, new RegExp(value), `${label}に必要な契約がありません: ${value}`);
});

const requireNone = (text, patterns, label) => patterns.forEach(pattern => {
    assert.doesNotMatch(text, pattern, `${label}に禁止された旧ラベル規則があります: ${pattern}`);
});

// Settings: preserve data entry, theme, workspace, sync, and parent-access contracts while markup migrates.
requireAll(source.index, [
    'template id="tpl-settings"',
    'id="ui-preferences-section"',
    'id="ui-color-mode"',
    'id="ui-font-scale"',
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
    'id="parent-share-section"',
    'id="data-management-settings-section"',
    'c-card c-data-management__operation'
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
    'modal-export-fallback',
    'export-json-textarea',
    'btn-copy-export-json',
    'export-copy-success',
    'btn-save-ui-preferences',
    'form-team-info',
    'btn-workspace-switch',
    'form-gas-sync'
], '設定イベント');

requireAll(source.index, [
    'template id="tpl-animation"',
    'id="canvas-pitch-template"',
    'id="canvas-snap-grid"',
    'id="filmstrip-cards-container"',
    'filmstrip-cards-container c-data-list',
    'id="anim-play"',
    'id="anim-stop"',
    'id="anim-prev-frame"',
    'id="anim-frame-select"',
    'id="anim-next-frame"',
    'id="anim-add-frame"',
    'id="anim-delete-frame"',
    'id="anim-export-video"',
    'id="anim-save"',
    'c-form-field--fluid',
    'c-choice-field'
], '作図設定');

requireAll(source.index, [
    'template id="tpl-match-detail"',
    'id="match-detail-date-input"',
    'id="match-detail-opponent-input"',
    'id="match-detail-type-select"',
    'id="match-detail-tournament-input"',
    'id="match-detail-theme-input"',
    'id="match-detail-summary-input"',
    'id="form-match-detail-inline"',
    'id="match-detail-score-box"',
    'id="match-detail-attendance-summary"',
    'id="match-detail-attendance-roster-display"',
    'id="match-detail-attendance-roster-edit"',
    'c-roster-list match-detail-attendance-roster',
    'id="pk-shootout-container"',
    'id="pk-summary-badge"',
    'id="pk-kickers-list"',
    'c-data-list c-data-list--scrollable pk-kickers-list',
    'id="btn-add-pk-kicker"',
    'id="btn-add-timeline-event"',
    'id="period-timeline-list"',
    'c-data-list period-timeline-list',
    'c-form-field--compact'
], '試合詳細・ピリオド分析');

requireAll(source.index, [
    'c-section-header',
    'c-form-field'
], '振り返り画面');

requireAll(source.index, [
    'id="dash-top-scorers"',
    'id="dash-top-assists"',
    'id="dash-attendance-rank"',
    'id="dash-playtime-content"',
    'id="ranking-scorers-list"',
    'id="ranking-assists-list"',
    'id="ranking-attendance-list"',
    'id="ranking-playtime-list"',
    'c-data-list c-data-list--ranking',
    'c-data-list dash-rank-list',
    'c-card--interactive',
    'c-metric-grid--inline',
    'c-metric__value',
    'id="dash-team-focus-content"',
    'id="dash-btn-edit-focus"',
    'c-page-list',
    'id="season-detail-types-list"',
    'id="season-detail-years-list"',
    'c-data-list c-data-list--scrollable'
], 'ダッシュボードランキング');

requireAll(source.app, [
    'c-data-list__item',
    'c-data-list__metric',
    'c-data-list__rank',
    'c-data-list__value--accent',
    'c-data-list__meta',
    'c-data-list__body',
    "navigate\\('practices', \\{ date:",
    'c-progress-bar',
    'c-progress-bar__indicator--attention',
    'c-data-list__item--selected',
    'c-data-list__kind',
    'c-focus-summary',
    'c-step-list__item',
    'c-step-list__index',
    'dash-btn-set-focus-empty',
    'renderEmptyState\\(\\{ icon:',
    'openPlayerDetail'
], 'ダッシュボードランキング生成');

requireAll(source.index, [
    'id="dash-setup-checklist"',
    'c-glass-surface--spotlight',
    // 'id="dash-action-center"',
    // 'id="dash-parent-agenda"',
    // 'c-liquid-panel--immersive',
    'c-text-effect--liquid',
    'c-kinetic-kicker--reveal'
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

requireAll(source.drawing, [
    'filmstrip-card c-data-list__item',
    'filmstrip-card-header c-data-list__header',
    'filmstrip-card__meta c-action-group',
    'btn-card-delete',
    'anim-frame-select',
    'anim-add-frame',
    'anim-delete-frame',
    'anim-export-video'
], '作図フィルムストリップ・フレーム操作');

requireAll(source.matches, [
    'c-empty-state',
    'c-roster-row c-roster-row--attendance',
    'match-attendance-badge',
    'timeline-edit-row c-data-list__item',
    'c-empty-state c-empty-state--compact',
    'c-match-score',
    'c-match-score__result',
    'c-match-score-actions',
    'pk-kicker-row c-data-list__item',
    'pk-kicker-row__controls',
    'side-sub-row c-data-list__item',
    'id="side-substitutions-container"',
    'id="btn-add-side-sub"',
    'memo-seconds-val',
    'btn-use-current-timestamp',
    'getTimelineTimestampSeconds',
    'normalizeTimelineMemo',
    'btn-add-match',
    'btn-add-match'
], '試合空状態');

requireAll(source.library, [
    'c-empty-state',
    'btn-empty-add-library',
    'c-data-list__item',
    'c-data-list__meta',
    'c-data-list__actions',
    'c-action-group--compact',
    'btn-execute-assign',
    'btn-assign-add-practice'
], 'メニュー空状態・アサイン先一覧');

requireAll(source.index, [
    'id="modal-assign-practice"',
    'id="assign-practices-list" class="c-data-list c-data-list--modal-compact"'
], 'ライブラリアサインモーダル');

requireAll(source.tactics, [
    'c-empty-state',
    'btn-empty-add-tactic',
    'c-action-group--compact',
    'btn-edit-tactic',
    'btn-delete-tactic'
], '戦術空状態・コンパクト操作群');

requireAll(source.players, [
    'c-empty-state',
    'btn-empty-add-player',
    'player-view-tab',
    'c-data-list__item',
    'c-data-list__actions',
    'btn-edit-assessment',
    'btn-delete-assessment',
    'btn-timeline-anim'
], '選手空状態・履歴');

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
    'id="pd-history-list"',
    'c-data-list--scrollable',
    'id="btn-import-players-csv"',
    'id="btn-add-player"',
    'id="modal-player"',
    'modal c-modal modal-player-form',
    'id="form-player"',
    'id="player-name"',
    'id="player-number"',
    'id="player-position-container"',
    'id="player-position-cat2-container"',
    'c-modal__footer',
    'id="modal-import-players-csv"',
    'modal c-modal modal-player-csv-import',
    'id="form-import-players-csv"',
    'id="input-csv-file"',
    'id="textarea-csv-data"',
    'id="csv-preview-container"',
    'id="csv-error-msg"',
    'id="btn-submit-csv-import"',
    'id="modal-edit-team-focus"',
    'modal c-modal modal-team-focus',
    'id="form-edit-team-focus"',
    'id="input-focus-main-theme"',
    'id="input-focus-point-1"',
    'id="input-focus-point-2"',
    'id="input-focus-point-3"',
    'id="input-focus-note"',
    'id="btn-clear-team-focus"',
    'id="modal-tactic"',
    'modal c-modal modal-tactic-form',
    'id="modal-tactic-title"',
    'id="form-tactic"',
    'id="tactic-id"',
    'id="tactic-title"',
    'id="tactic-category"',
    'id="tactic-description"',
    'id="modal-menu"',
    'modal c-modal modal-menu-form',
    'id="modal-menu-title"',
    'id="form-menu"',
    'id="menu-practice-id"',
    'id="menu-library-source-id"',
    'id="menu-edit-id"',
    'id="menu-library-select"',
    'id="menu-focus"',
    'id="menu-category"',
    'id="menu-organize"',
    'id="menu-keyfactor"',
    'id="menu-video-url"',
    'id="menu-options"',
    'id="menu-engagement"',
    'c-view-switcher'
], '選手ビュー切替');

requireAll(source.index, [
    'id="modal-export-fallback"',
    'modal c-modal modal-export-fallback',
    'id="export-json-textarea"',
    'id="btn-copy-export-json"',
    'id="export-copy-success"',
    'c-modal__footer c-action-group'
], 'JSON出力フォールバック');

requireAll(source.index, [
    'template id="tpl-data"',
    'c-data-management',
    'id="data-export-card"',
    'id="btn-data-view-export"',
    'id="input-data-view-import"',
    'id="btn-data-all-clear"',
    'c-card c-data-management__danger'
], 'データ管理画面');

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

// Label-shape contract: only common status labels may represent state, counts, and compact metadata.
const labelSources = [
    source.index,
    source.app,
    source.matches,
    source.practices,
    source.library,
    source.drawing,
    source.standard,
    source.components,
    source.base,
    source.dashboard,
    source.drawingCss
].join('\n');

requireAll(source.standard, [
    '\\.c-button',
    '\\.c-button--primary',
    '\\.c-button--secondary',
    '\\.c-button--danger',
    '\\.c-button--compact',
    '\\.c-input',
    '\\.c-card',
    '\\.c-status',
    '\\.c-status--count',
    '\\.c-status--interactive',
    '\\.c-status__dismiss'
], '標準プリミティブ・共通ステータス部品');

requireAll(source.index, [
    'c-button btn',
    'c-input form-control',
    'c-card card',
    'c-modal-overlay modal-overlay',
    'c-modal c-modal--legacy modal',
    'c-status c-status--count c-status--compact',
    'id="dash-setup-progress" class="c-status c-status--info"'
], '標準プリミティブ・共通ステータスのテンプレート利用');

requireAll([source.matches, source.practices, source.library].join('\n'), [
    'c-status c-status--interactive c-status--compact',
    'c-status__dismiss'
], '解除可能な絞り込みタグ');

requireAll(source.drawing, [
    'c-status c-status--compact c-status--info',
    'c-status c-status--compact c-status--muted'
], 'フィルムストリップの共通ステータス利用');

requireNone(labelSources, [
    /\.badge(?:-(?:required|sub|fw|mf|df|gk))?\b/,
    /class=["'][^"']*(?:\s|["'])badge(?:-(?:required|sub|fw|mf|df|gk))?(?=\s|["'])/,
    /\.(?:filter-count-badge|active-tag-chip|tag-remove|setup-progress|status-badge|dash-form-badge-lg|dash-circle-match|dash-circle-practice|filmstrip-badge|pause-badge|caption-badge)\b/,
    /class=["'][^"']*(?:\s|["'])(?:filter-count-badge|active-tag-chip|tag-remove|setup-progress|status-badge|dash-form-badge-lg|dash-circle-match|dash-circle-practice|filmstrip-badge|pause-badge|caption-badge)(?=\s|["'])/
], '旧ラベル形状');

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
    '\\.c-modal',
    '\\.c-data-management',
    '\\.c-data-management__grid',
    '\\.c-data-management__danger',
    '\\.c-roster-row--attendance',
    '\\.match-detail-attendance-roster',
    '\\.period-timeline-list',
    '\\.period-timeline-edit__controls',
    '\\.c-match-score',
    '\\.c-match-score__result',
    '\\.pk-shootout-editor',
    '\\.pk-kicker-row__controls',
    '\\.period-timeline-edit__seconds',
    '\\.btn-use-current-timestamp',
    '\\.filmstrip-cards-container\\.c-data-list',
    '\\.filmstrip-cards-container \\.filmstrip-card\\.c-data-list__item',
    '\\.c-modal-overlay',
    '\\.c-modal--legacy',
    '\\.c-modal\\.modal-export-fallback',
    '\\.export-json-textarea',
    '\\.c-status--success'
], 'システム部品');

console.log('P35 component migration guardrails passed');
