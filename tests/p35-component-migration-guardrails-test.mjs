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
    ['conflict', '../sync-conflict-dialog.js'],
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

// Wave D: settings, synchronization, recovery, and guardian operations share common components.
requireAll(source.index, [
    'c-settings-section',
    'c-settings-section__body',
    'id="operations-diagnostics" class="c-data-list c-data-list--diagnostics"',
    'class="c-data-list c-data-list--recovery" id="cloud-recovery-history"',
    'class="c-data-list c-data-list--audit" id="sync-audit-history"',
    'id="parent-access-invites"'
], '波Dの設定・同期・保護者運用テンプレート');

requireAll(source.settings, [
    'c-data-list__header',
    'c-data-list__identity',
    'c-data-list__content',
    'c-data-list__actions',
    'c-empty-state__text',
    'c-empty-state c-empty-state--compact',
    'c-status--success',
    'c-status--warning',
    'c-status--muted',
    'data-operation-action',
    'data-parent-access-copy',
    'data-parent-access-revoke',
    'btn-restore-cloud-generation'
], '波Dの設定・同期・保護者運用生成');

requireAll(source.conflict, [
    'c-modal-overlay c-modal-overlay--critical',
    'c-modal c-modal--sync-conflict',
    'c-modal__header',
    'c-modal__body',
    'c-modal__footer',
    'c-data-list c-data-list--conflict',
    'data-action="keep-local"'
], '波Dの同期競合モーダル');

const waveDLegacySources = [source.index, source.settings, source.conflict, source.components, source.system].join('\n');
requireNone(waveDLegacySources, [
    /\.(?:sl-section|sl-section-body|sl-section-label|sl-row|sl-input|sl-add-row)\b/,
    /class=["'][^"']*(?:\s|["'])(?:sl-section|sl-section-body|sl-section-label|sl-row|sl-input|sl-add-row)(?=\s|["'])/,
    /\.(?:sync-audit(?:-(?:item|heading|empty|history))?|operations-check(?:-(?:icon|action))?|cloud-recovery-(?:item|empty)|parent-access-(?:invite|invites|empty|status)|sync-conflict-[a-z-]+)\b/,
    /class=["'][^"']*(?:\s|["'])(?:sync-audit(?:-(?:item|heading|empty|history))?|operations-check(?:-(?:icon|action))?|cloud-recovery-(?:item|empty)|parent-access-(?:invite|invites|empty|status)|sync-conflict-[a-z-]+)(?=\s|["'])/
], '波Dで廃止した設定・同期・保護者運用クラス');

requireAll(source.index, [
    'template id="tpl-animation"',
    'id="canvas-pitch-template"',
    'id="canvas-snap-grid"',
    'id="filmstrip-cards-container"',
    'c-frame-strip__list c-data-list',
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
    'c-data-list c-data-list--scrollable c-pk-kickers-list',
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
    'c-data-list c-dashboard-rank-list',
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

requireAll(source.app, [
    'const rankItemTag = isCoach',
    'const dashboardRankInteraction = playerId => isCoach',
    'aria-disabled="true"'
], '保護者モードのランキング閲覧専用制御');

requireAll(source.dashboard, [
    '\\.c-dashboard-rank-item\\.is-readonly'
], '保護者モードのランキング閲覧専用スタイル');

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
    'c-frame-strip__item c-data-list__item',
    'c-frame-strip__header c-data-list__header',
    'c-frame-strip__meta c-action-group',
    'c-frame-strip__delete',
    'anim-frame-select',
    'anim-add-frame',
    'anim-delete-frame',
    'anim-export-video'
], '作図フィルムストリップ・フレーム操作');

requireAll(source.matches, [
    'c-empty-state',
    'c-roster-row c-roster-row--attendance',
    'c-attendee-chip',
    'timeline-edit-row c-data-list__item',
    'c-empty-state c-empty-state--compact',
    'c-match-score',
    'c-match-score__result',
    'c-match-score-actions',
    'c-pk-kicker-row c-data-list__item',
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

// Wave E: player detail, application shell, and drawing-adjacent controls use common component contracts.
requireAll(source.index, [
    'c-focus-summary',
    'c-metric-grid c-metric-grid--inline',
    'c-data-list c-data-list--scrollable c-data-list--notebook',
    'c-settings-form',
    'c-sidebar',
    'c-topbar',
    'c-context-bar',
    'c-bottom-nav',
    'c-tool-dock',
    'c-popover c-popover--canvas',
    'c-drawer',
    'c-inspector-panel'
], '波Eの選手詳細・アプリシェル・作図テンプレート');

requireAll(source.players, [
    'c-metric--inline',
    'c-data-list--participation',
    'data-player-detail-id',
    'c-progress-bar__indicator'
], '波Eの選手詳細生成');

requireAll(source.app, [
    'c-sidebar__nav',
    'c-bottom-nav .c-bottom-nav__item',
    'c-sidebar__sync-row',
    'c-sidebar__header h2'
], '波Eのアプリシェルイベント');

requireAll(source.drawing, [
    'c-tool-dock .c-tool-dock__button',
    'c-drawer__preset-chip'
], '波Eの作図操作');

requireAll(source.base, [
    '\\.c-sidebar__footer',
    '\\.c-topbar__back-button',
    '\\.c-bottom-nav',
    '\\.c-context-bar__back-button'
], '波EのアプリシェルCSS');

requireAll(source.drawingCss, [
    '\\.c-tool-dock',
    '\\.c-popover--canvas',
    '\\.c-drawer',
    '\\.c-inspector-panel'
], '波Eの作図周辺CSS');

const waveELegacySources = [source.index, source.players, source.app, source.drawing, source.matches, source.components, source.base, source.drawingCss].join('\n');
requireNone(waveELegacySources, [
    /\.(?:player-notebook|player-participation)[a-z-]*/,
    /class=["'][^"']*(?:\s|["'])(?:player-notebook|player-participation)[a-z-]*(?=\s|["'])/,
    /\.(?:sidebar(?:-[a-z-]+)?|topbar(?:-[a-z-]+)?|bottom-nav|nav-links|nav-item|mobile-context-[a-z-]+|sync-popover)\b/,
    /class=["'][^"']*(?:\s|["'])(?:sidebar(?:-[a-z-]+)?|topbar(?:-[a-z-]+)?|bottom-nav|nav-links|nav-item|mobile-context-[a-z-]+|sync-popover)(?=\s|["'])/,
    /\.(?:anim-tool-dock|dock-btn|dock-text|anim-settings-popover|anim-quick-drawer|drawer-(?:header|title|close-btn|body|field|preset)[a-z-]*|preset-chip|anim-detail-side-panel|side-panel-[a-z-]+|side-info-[a-z-]+)\b/,
    /class=["'][^"']*(?:\s|["'])(?:anim-tool-dock|dock-btn|dock-text|anim-settings-popover|anim-quick-drawer|drawer-(?:header|title|close-btn|body|field|preset)[a-z-]*|preset-chip|anim-detail-side-panel|side-panel-[a-z-]+|side-info-[a-z-]+)(?=\s|["'])/
], '波Eで廃止した選手詳細・アプリシェル・作図周辺クラス');

// Wave F F0: unused legacy classes must not be reintroduced after removal.
const waveFUnusedLegacySources = Object.values(source).join('\n');
requireNone(waveFUnusedLegacySources, [
    /\.u-ext-(?:171|172|173)\b/,
    /class=["'][^"']*(?:\s|["'])u-ext-(?:171|172|173)(?=\s|["'])/
], '波F F0で削除した未参照u-extクラス');

requireAll(source.system, [
    '\\.c-content-disclosure',
    '\\.c-content-disclosure__summary',
    '\\.c-content-disclosure__body',
    '\\.c-content-disclosure__note',
    '\\.c-content-disclosure-list'
], '波F F1の共通開示部品');

requireAll([source.practices, source.library, source.tactics].join('\n'), [
    'c-content-disclosure',
    'c-content-disclosure__summary',
    'c-content-disclosure__body'
], '波F F1の開示コンテンツ移行');

const waveFDisclosureLegacySources = [source.practices, source.library, source.tactics, source.components, source.base, source.dashboard].join('\n');
requireNone(waveFDisclosureLegacySources, [
    /\.u-ext-(?:150|151|152|153|154|155|156|157|158|163|164|165|166|167|191|192|193|194|195|196|197|198)\b/,
    /class=["'][^"']*(?:\s|["'])u-ext-(?:150|151|152|153|154|155|156|157|158|163|164|165|166|167|191|192|193|194|195|196|197|198)(?=\s|["'])/,
    /\.(?:practice-menu-item|practice-menu-details|practice-menu-item-header|practice-menu-title-block|practice-menu-item-title|practice-menu-actions-block|practice-menu-item-details)\b/
], '波F F1で廃止した開示コンテンツクラス');

requireAll(source.system, [
    '\\.c-media-preview',
    '\\.c-media-preview__canvas',
    '\\.c-media-preview__overlay',
    '\\.c-media-preview__status',
    '\\.c-library-card',
    '\\.c-tactic-card',
    '\\.c-section-group'
], '波F F2・F4の共通プレビュー・戦術カード部品');

requireAll([source.practices, source.library, source.tactics].join('\n'), [
    'c-media-preview',
    'c-media-preview__canvas',
    'c-media-preview__status'
], '波F F2のミニピッチプレビュー移行');

requireAll([source.library, source.tactics].join('\n'), [
    'c-section-group',
    'c-section-group__title'
], '波F F4の戦術カテゴリ移行');

const waveFPreviewLegacySources = [source.practices, source.library, source.tactics, source.components, source.dashboard].join('\n');
requireNone(waveFPreviewLegacySources, [
    /\.u-ext-(?:159|160|161|162|183|185|186|187|188|189|190|199|200|201)\b/,
    /class=["'][^"']*(?:\s|["'])u-ext-(?:159|160|161|162|183|185|186|187|188|189|190|199|200|201)(?=\s|["'])/,
    /\.(?:library-canvas-wrapper|practice-canvas-wrapper|canvas-hover-overlay|library-card-header)\b/
], '波F F2・F4で廃止したプレビュー・戦術カードクラス');

requireAll(source.system, [
    '\\.c-period-editor__goal-row',
    '\\.c-period-editor__position-row',
    '\\.c-period-editor__pitch-token',
    '\\.c-score-stepper',
    '\\.c-period-editor__save'
], '波F F3のピリオド編集部品');

requireAll(source.matches, [
    'c-period-editor__goal-row',
    'c-period-editor__position-row',
    'c-score-stepper',
    'c-period-editor__pitch-token',
    'btn-side-save-period'
], '波F F3のピリオド編集移行');

const waveFPeriodEditorLegacySources = [source.matches, source.components].join('\n');
requireNone(waveFPeriodEditorLegacySources, [
    /\.u-ext-(?:78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|94|95|96|97|98|104|105|107|108|109|112|113|114)\b/,
    /class=["'][^"']*(?:\s|["'])u-ext-(?:78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|94|95|96|97|98|104|105|107|108|109|112|113|114)(?=\s|["'])/
], '波F F3で廃止したピリオド編集クラス');

requireAll(source.system, [
    '\\.c-period-card',
    '\\.c-period-card__header',
    '\\.c-period-card__record-list',
    '\\.c-period-card__actions'
], '波G G1のピリオドカード部品');

requireAll(source.matches, [
    'c-period-card',
    'c-period-card__record-list',
    'c-period-card__actions',
    'c-empty-state__text'
], '波G G1・G2の試合詳細移行');

const waveGMatchCardLegacySources = [source.matches, source.components].join('\n');
requireNone(waveGMatchCardLegacySources, [
    /\.u-ext-(?:63|64|65|66|67|68|69|70|71|72|73|74|75|76)\b/,
    /class=["'][^"']*(?:\s|["'])u-ext-(?:63|64|65|66|67|68|69|70|71|72|73|74|75|76)(?=\s|["'])/
], '波G G1・G2で廃止した試合カードクラス');

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
    'c-dashboard-grid',
    'c-dashboard-grid__row',
    'c-dashboard-widget',
    'c-dashboard-widget__label',
    'c-dashboard-strip',
    'c-dashboard-rank-list',
    'c-attendee-list',
    'c-status c-status--count c-status--compact',
    'id="dash-setup-progress" class="c-status c-status--info"'
], '標準プリミティブ・ダッシュボード・共通ステータスのテンプレート利用');

requireAll([source.matches, source.practices, source.library].join('\n'), [
    'c-status c-status--interactive c-status--compact',
    'c-status__dismiss'
], '解除可能な絞り込みタグ');

requireAll(source.drawing, [
    'c-status c-status--compact c-status--info',
    'c-status c-status--compact c-status--muted'
], 'フィルムストリップの共通ステータス利用');

requireAll([source.matches, source.practices].join('\n'), [
    'c-attendee-list',
    'c-attendee-chip',
    'c-attendee-chip__number',
    'c-attendee-chip__name',
    'c-attendee-list__empty'
], '試合・練習で共有する参加者チップ');

requireNone(labelSources, [
    /\.badge(?:-(?:required|sub|fw|mf|df|gk))?\b/,
    /class=["'][^"']*(?:\s|["'])badge(?:-(?:required|sub|fw|mf|df|gk))?(?=\s|["'])/,
    /\.(?:filter-count-badge|active-tag-chip|tag-remove|setup-progress|status-badge|dash-form-badge-lg|dash-circle-match|dash-circle-practice|filmstrip-badge|pause-badge|caption-badge)\b/,
    /class=["'][^"']*(?:\s|["'])(?:filter-count-badge|active-tag-chip|tag-remove|setup-progress|status-badge|dash-form-badge-lg|dash-circle-match|dash-circle-practice|filmstrip-badge|pause-badge|caption-badge)(?=\s|["'])/
], '旧ラベル形状');

requireNone(labelSources, [
    /\.(?:attendance-roster-row|pk-kicker-row(?:__[a-z-]+)?|practice-card(?:-[a-z-]+)?|filmstrip-card(?:__[a-z-]+)?|btn-card-delete)\b/,
    /class=["'][^"']*(?:\s|["'])(?:attendance-roster-row|pk-kicker-row(?:__[a-z-]+)?|practice-card(?:-[a-z-]+)?|filmstrip-card(?:__[a-z-]+)?|btn-card-delete)(?=\s|["'])/
], '波Bで廃止した画面固有クラス');

requireNone(labelSources, [
    /\.u-ext-(?:54|55|56|140)\b/,
    /class=["'][^"']*(?:\s|["'])(?:u-ext-54|u-ext-55|u-ext-56|u-ext-140)(?=\s|["'])/
], '試合一覧の旧参加者チップ・コンテナ');

requireNone(source.dashboard, [
    /\.match-card-header\s+span\b/,
    /\.match-card-header>div:first-child\b/
], '参加者チップを圧縮する試合カードの汎用セレクタ');

// Standard component contracts used by Phase 1 must exist before templates are migrated.
requireAll(source.standard, [
    '\\.c-card',
    '\\.c-section-header',
    '\\.c-action-group',
    '\\.c-empty-state',
    '\\.c-empty-state--compact'
], '標準部品');

requireAll(source.system, [
    '\\.c-attendee-list[\\s\\S]*?flex-wrap:\\s*wrap',
    '\\.c-attendee-chip[\\s\\S]*?flex:\\s*0\\s+0\\s+auto',
    '\\.c-attendee-chip__number[\\s\\S]*?aspect-ratio:\\s*1',
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
    '\\.c-pk-kicker-row__controls',
    '\\.period-timeline-edit__seconds',
    '\\.btn-use-current-timestamp',
    '\\.c-frame-strip',
    '\\.c-frame-strip__list',
    '\\.c-frame-strip__item',
    '\\.c-frame-strip__delete',
    '\\.c-dashboard-grid',
    '\\.c-dashboard-widget',
    '\\.c-dashboard-alert',
    '\\.c-dashboard-strip',
    '\\.c-dashboard-rank-list',
    '\\.c-attendee-list',
    '\\.c-attendee-chip',
    '\\.c-modal-overlay',
    '\\.c-modal--legacy',
    '\\.c-modal\\.modal-export-fallback',
    '\\.export-json-textarea',
    '\\.c-status--success',
    '\\.c-data-list__content',
    '\\.c-data-list--diagnostics',
    '\\.c-data-list--recovery',
    '\\.c-data-list--audit',
    '\\.c-data-list--parent-access',
    '\\.c-data-list--conflict',
    '\\.c-modal--sync-conflict',
    '\\.c-modal-overlay--critical',
    '\\.c-popover--sync',
    '\\.c-popover--sidebar'
], 'システム部品');

// Wave H5: modal/form static layout is centralized without changing DOM IDs or events.
requireAll(source.system, [
    '\\.c-modal--narrow',
    '\\.c-modal--medium',
    '\\.c-modal__heading',
    '\\.c-modal__actions',
    '\\.c-modal__actions--split',
    '\\.c-form-field--spaced'
], '波H5のモーダル・フォーム共通レイアウト部品');

requireAll(source.index, [
    'id="modal-text-input"',
    'c-modal--narrow modal',
    'id="form-text-input"',
    'id="modal-scene-title"',
    'id="form-scene-title"',
    'c-form-field--spaced',
    'id="modal-assign-practice"',
    'c-modal--medium modal',
    'c-modal__actions c-modal__actions--split'
], '波H5のモーダル・フォーム移行');

requireNone(source.index, [
    /class=["']c-modal c-modal--legacy modal["'] style=["']max-width:400px; position:relative;["']/,
    /id=["']modal-assign-practice["'][\\s\\S]*?style=["']max-width: 450px; position:relative;["']/
], '波H5で廃止したモーダル静的インラインレイアウト');

// Wave H6: a localized app-shell rule keeps back-button precedence through selector specificity instead of !important.
requireAll(source.base, [
    '\\.c-topbar \\.c-topbar__back-button'
], '波H6の戻るボタン詳細度調整');
requireNone(source.base, [
    /\\.c-topbar__back-button \\{\\n    padding: 0\\.25rem 0\\.6rem !important;/
], '波H6で削減した戻るボタン!important');

// CSS refactor stage 1/2: static application shell and modal layouts use components-system as the single source of truth.
requireAll(source.system, [
    '\\.c-mobile-more__sheet',
    '\\.c-mobile-more__item',
    '\\.c-popover--sync',
    '\\.c-popover--sidebar',
    '\\.c-practice-card--toolbar-actions',
    '\\.c-loading-state',
    '\\.c-modal__close--floating'
], 'CSSリファクタリング共通部品');

requireAll(source.index, [
    'c-mobile-more__sheet',
    'c-mobile-more__item',
    'c-popover--sync c-popover--sidebar hidden',
    'c-loading-state',
    'c-modal__close--floating'
], 'CSSリファクタリング後のアプリシェル・モーダル利用');

requireAll(source.practices, [
    'c-practice-card--toolbar-actions'
], 'CSSリファクタリング後の練習カード利用');

requireNone([source.base, source.components].join('\n'), [
    /\.mobile-more-sheet\s*\{/,
    /\.mobile-more-grid\s*\{/,
    /\.mobile-more-item\s*\{/,
    /\.c-sidebar__sync-row \.c-popover\s*\{/,
    /body \.c-practice-card__actions\s*\{/
], 'CSSリファクタリングで廃止した重複正本');

console.log('P35 component migration guardrails passed');
