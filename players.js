// players.js
import { state } from './state.js';
import { escapeHtml, showToast, showCustomConfirm, getNendo } from './utils.js';
import { saveData, navigate, openModal } from './app-context.js';
import { addDevelopmentNote, buildDevelopmentSummary, removeDevelopmentNote } from './player-development-service.js';
import { getMatchGoalRecords, getPlayerStatistics } from './player-statistics-service.js';
import { buildPlayerExperienceArchive } from './player-experience-service.js';
import { buildPlayerTimelineArchive } from './player-timeline-service.js';
import { switchWorkspace } from './workspace-service.js';
import { getPlayerTimelineUiState, patchPlayerTimelineUiState } from './player-timeline-ui-state-service.js';


function getRelativeGrade(currentGrade, recordNendo, currentNendo) {
    const diff = parseInt(recordNendo, 10) - parseInt(currentNendo, 10);
    if (!currentGrade) return '';
    if (diff === 0) return currentGrade;
    const match = currentGrade.match(/(\d+)/);
    if (match) {
        const num = parseInt(match[1], 10);
        const newNum = num + diff;
        if (newNum > 0) return currentGrade.replace(match[1], newNum);
    }
    return '';
}

function renderDevelopmentNotebook(player) {
    const canEdit = state.currentUserRole === 'coach';
    const metrics = state.skillMetrics || [];
    const summary = buildDevelopmentSummary(player, { matches: state.matches, practices: state.practices, metrics });
    const timelineArchive = buildPlayerTimelineArchive(state, player);
    summary.timeline = timelineArchive.items;
    const trends = document.getElementById('pd-notebook-trends');
    const timeline = document.getElementById('pd-notebook-timeline');
    const searchResults = document.getElementById('pd-notebook-search-results');
    const searchInput = document.getElementById('input-notebook-search');
    const filterChips = document.getElementById('notebook-type-filters');
    const nendoFilter = document.getElementById('select-notebook-nendo');
    const signalFilters = document.getElementById('notebook-signal-filters');
    const searchSummary = document.getElementById('pd-notebook-search-summary');
    const clearSearchButton = document.getElementById('btn-notebook-clear-search');
    const timelineView = document.getElementById('pd-notebook-timeline-view');
    const searchView = document.getElementById('pd-notebook-search-view');
    const timelineModeButton = document.getElementById('btn-notebook-view-timeline');
    const searchModeButton = document.getElementById('btn-notebook-view-search');
    const backButton = document.getElementById('btn-notebook-back-timeline');
    const timelineLocation = document.getElementById('pd-timeline-location');
    const timelineSearchReturn = document.getElementById('pd-timeline-search-return');
    const timelineRoleFocus = document.getElementById('pd-timeline-role-focus');
    const ratings = document.getElementById('development-note-ratings');
    const playerId = document.getElementById('development-player-id');
    const dateInput = document.getElementById('development-note-date');
    let timelineState = getPlayerTimelineUiState(player.id, { view: 'timeline', searchQuery: '', filterType: 'all', filterNendo: 'all', filterSignal: 'all', searchLimit: 20, openNendo: '', openMonth: '', openRecord: '', highlightRecord: '', searchReturnActive: false });
    if (!Number.isInteger(timelineState.searchLimit) || timelineState.searchLimit < 20) timelineState = patchPlayerTimelineUiState(player.id, { searchLimit: 20 });
    if (!['all', 'next-step', 'skill-rated'].includes(timelineState.filterSignal)) timelineState = patchPlayerTimelineUiState(player.id, { filterSignal: 'all' });
    if (!timelineState.filterNendo) timelineState = patchPlayerTimelineUiState(player.id, { filterNendo: 'all' });

    if (playerId) playerId.value = player.id;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (searchInput) searchInput.value = timelineState.searchQuery;
    if (ratings) {
        ratings.innerHTML = metrics.map(metric => `<label class="c-form-field"><span class="c-form-field__label">${escapeHtml(metric)}</span><select class="c-input form-control development-rating" data-metric="${escapeHtml(metric)}"><option value="">未評価</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>`).join('');
    }
    if (trends) {
        trends.innerHTML = summary.skillTrend.length ? summary.skillTrend.map(trend => {
            const phaseMap = { 1: '挑戦中', 2: '基礎固め', 3: '安定', 4: '実力発揮', 5: '強み' };
            const phaseText = trend.latest ? phaseMap[trend.latest] : '—';
            const deltaText = trend.delta === null ? '—' : trend.delta > 0 ? '成長サイクル' : trend.delta < 0 ? '振り返り期' : 'キープ';
            const trendClass = trend.delta > 0 ? 'c-metric--positive' : trend.delta < 0 ? 'c-metric--negative' : 'c-metric--neutral';
            return `<article class="c-metric c-metric--inline ${trendClass}"><div class="c-metric__content"><span class="c-metric__label">${escapeHtml(trend.metric)}</span><strong class="c-metric__value" style="font-size: 1.1rem;">${phaseText}</strong><small class="c-metric__note">${deltaText}</small></div></article>`;
        }).join('') : '<p class="c-focus-summary__note">スキル評価を記録すると、現在のフェーズが表示されます。</p>';
    }

    const labels = { note: '育成ノート', observation: '観察メモ', match: '試合', practice: '練習' };
    const icons = { note: 'ti ti-book-2', observation: 'ti ti-eye', match: 'ti ti-ball-football', practice: 'ti ti-run' };
    const timelineItemsById = new Map(summary.timeline.map(item => [String(item.id), item]));
    const getMonthOrder = month => (Number(month) <= 3 ? Number(month) + 12 : Number(month));
    const buildGroups = (items) => items.reduce((groups, item) => {
        const nendo = getNendo(item.date);
        const month = String(Number(item.date.split('-')[1] || 0));
        if (!groups[nendo]) groups[nendo] = { items: [], months: {} };
        if (!groups[nendo].months[month]) groups[nendo].months[month] = [];
        groups[nendo].items.push(item);
        groups[nendo].months[month].push(item);
        return groups;
    }, {});
    const allGroups = buildGroups(summary.timeline);
    const sortedNendos = Object.keys(allGroups).sort((a, b) => Number(b) - Number(a));
    if (nendoFilter) {
        nendoFilter.innerHTML = `<option value="all">すべての年度</option>${sortedNendos.map(nendo => `<option value="${escapeHtml(nendo)}">${escapeHtml(nendo)}年度</option>`).join('')}`;
        nendoFilter.value = sortedNendos.includes(timelineState.filterNendo) ? timelineState.filterNendo : 'all';
    }
    const timelineMonthKeys = sortedNendos.flatMap(nendo => Object.keys(allGroups[nendo].months)
        .sort((a, b) => getMonthOrder(b) - getMonthOrder(a))
        .map(month => `${nendo}-${month}`));
    if (sortedNendos.length) {
        if (!timelineState.openNendo || !allGroups[timelineState.openNendo]) timelineState = patchPlayerTimelineUiState(player.id, { openNendo: sortedNendos[0], openMonth: '', openRecord: '' });
        const months = Object.keys(allGroups[timelineState.openNendo].months).sort((a, b) => getMonthOrder(b) - getMonthOrder(a));
        if (!timelineState.openMonth || !allGroups[timelineState.openNendo].months[timelineState.openMonth.split('-').at(-1)]) timelineState = patchPlayerTimelineUiState(player.id, { openMonth: months[0] ? `${timelineState.openNendo}-${months[0]}` : '', openRecord: '' });
    }

    const setView = (view) => {
        timelineState = patchPlayerTimelineUiState(player.id, { view });
        const timelineActive = view === 'timeline';
        if (timelineView) timelineView.hidden = !timelineActive;
        if (searchView) searchView.hidden = timelineActive;
        if (timelineModeButton) { timelineModeButton.classList.toggle('is-active', timelineActive); timelineModeButton.setAttribute('aria-selected', String(timelineActive)); }
        if (searchModeButton) { searchModeButton.classList.toggle('is-active', !timelineActive); searchModeButton.setAttribute('aria-selected', String(!timelineActive)); }
        if (!timelineActive) renderSearchResults();
    };
    const getGradeLabel = nendo => summary.timeline.find(item => String(item.sourceNendo || getNendo(item.date)) === String(nendo))?.sourcePlayerGrade || getRelativeGrade(player.grade, nendo, getNendo(new Date().toISOString().slice(0, 10)));
    const updateTimelineContext = () => {
        if (!timelineLocation || !timelineState.openNendo) return;
        const record = timelineItemsById.get(timelineState.openRecord);
        const grade = getGradeLabel(timelineState.openNendo);
        const month = timelineState.openMonth.split('-').at(-1);
        timelineLocation.textContent = `現在地: ${grade ? `${grade} / ` : ''}${timelineState.openNendo}年度${month ? ` / ${month}月` : ''}${record ? ` / ${record.title}` : ''}`;
        if (!timelineSearchReturn) return;
        timelineSearchReturn.hidden = !timelineState.searchReturnActive;
        timelineSearchReturn.innerHTML = timelineState.searchReturnActive ? '<span><i class="ti ti-map-pin" aria-hidden="true"></i> 検索結果からこの記録を表示中</span><button type="button" id="btn-timeline-return-search" class="c-button btn c-button--secondary btn-secondary btn-sm">検索結果へ戻る</button>' : '';
    };
    const renderRoleFocus = () => {
        if (!timelineRoleFocus) return;
        const openMonthNumber = timelineState.openMonth.split('-').at(-1);
        const currentItems = allGroups[timelineState.openNendo]?.months?.[openMonthNumber] || [];
        const latest = currentItems[0];
        if (state.currentUserRole !== 'coach') {
            const reflection = latest?.note?.nextStep || latest?.note?.focus || latest?.title || '今月の記録が追加されると、ここに成長のひとこまが表示されます。';
            timelineRoleFocus.innerHTML = `<div class="c-timeline-role-focus__copy"><span class="c-timeline-role-focus__kicker"><i class="ti ti-heart-handshake" aria-hidden="true"></i> この月の振り返り</span><strong>${escapeHtml(reflection)}</strong></div>`;
            return;
        }
        const activeSource = timelineArchive.sources.find(source => source.isActiveSeason);
        const today = new Date();
        const currentNendo = getNendo(today.toISOString().slice(0, 10));
        const activeNendo = activeSource?.nendo || '';
        const currentMonth = today.getMonth() + 1;
        const availableMonths = activeNendo === currentNendo
            ? (currentMonth >= 4 ? Array.from({ length: currentMonth - 3 }, (_, index) => index + 4) : [...Array.from({ length: 9 }, (_, index) => index + 4), ...Array.from({ length: currentMonth }, (_, index) => index + 1)])
            : [];
        const recordedMonths = new Set((allGroups[activeNendo]?.items || []).map(item => Number(item.date.split('-')[1] || 0)));
        const missingMonth = availableMonths.find(month => !recordedMonths.has(month));
        const searchLabel = timelineState.searchQuery || (timelineState.filterType !== 'all' ? (labels[timelineState.filterType] || '種別') : '条件は未指定');
        timelineRoleFocus.innerHTML = `<div class="c-timeline-role-focus__copy"><span class="c-timeline-role-focus__kicker"><i class="ti ti-target" aria-hidden="true"></i> コーチの次の一手</span><strong>前回の探索: ${escapeHtml(searchLabel)}</strong></div><div class="c-timeline-role-focus__actions"><button type="button" class="c-button btn c-button--secondary btn-secondary btn-sm" data-timeline-role-action="search"><i class="ti ti-search" aria-hidden="true"></i> 記録を探す</button>${missingMonth ? `<button type="button" class="c-button btn c-button--primary btn-primary btn-sm" data-timeline-role-action="note" data-timeline-role-month="${activeNendo}-${missingMonth}"><i class="ti ti-pencil" aria-hidden="true"></i> ${missingMonth}月の記録を残す</button>` : ''}</div>`;
    };
    const renderTimeline = () => {
        if (!timeline) return;
        if (!summary.timeline.length) {
            timeline.innerHTML = '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-book-2 c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">まだ育成記録がありません。</p></div></div>';
            return;
        }
        const todayNendo = getNendo(new Date().toISOString().slice(0, 10));
        timeline.innerHTML = sortedNendos.map(nendo => {
            const group = allGroups[nendo];
            const grade = getRelativeGrade(player.grade, nendo, todayNendo);
            const chapterOpen = timelineState.openNendo === nendo;
            const chapterId = `pd-timeline-nendo-${nendo}`;
            const months = Object.keys(group.months).sort((a, b) => getMonthOrder(b) - getMonthOrder(a));
            const theme = group.items.find(item => item.note?.focus)?.note?.focus || '';
            const counts = Object.keys(labels).map(kind => `${labels[kind]}${group.items.filter(item => item.kind === kind).length}`).filter(value => !value.endsWith('0')).join(' / ');
            return `<section class="c-timeline-chapter-group"><button type="button" class="c-timeline-chapter" data-timeline-nendo="${nendo}" aria-expanded="${chapterOpen}" aria-controls="${chapterId}"><span class="c-timeline-chapter__title"><i class="ti ${chapterOpen ? 'ti-chevron-down' : 'ti-chevron-right'}" aria-hidden="true"></i><span>${grade ? `${escapeHtml(grade)} ` : ''}${nendo}年度</span></span><span class="c-timeline-chapter__count">${group.items.length}件</span></button><div class="c-timeline-chapter__summary"><span>${escapeHtml(theme || '成長の足あと')}</span><small>${escapeHtml(counts || `${group.items.length}件の記録`)}</small></div><div id="${chapterId}" ${chapterOpen ? '' : 'hidden'}><div class="c-timeline-section">${months.map(month => renderMonth(nendo, month, group.months[month])).join('')}</div></div></section>`;
        }).join('');
        updateTimelineContext();
        renderRoleFocus();
    };
    const focusTimelineControl = (selector, { scroll = false } = {}) => {
        requestAnimationFrame(() => {
            const control = timeline?.querySelector(selector);
            if (!control) return;
            if (scroll) control.scrollIntoView({ block: 'center' });
            control.focus({ preventScroll: !scroll });
        });
    };
    const focusTimelineRecord = (recordKey, { scroll = false } = {}) => {
        requestAnimationFrame(() => {
            const detail = document.getElementById(`pd-timeline-record-${String(recordKey).replace(/[^a-zA-Z0-9_-]/g, '-')}`);
            const control = detail?.previousElementSibling;
            if (!control) return;
            if (scroll) control.scrollIntoView({ block: 'center' });
            control.focus({ preventScroll: !scroll });
        });
    };
    const renderMonth = (nendo, month, items) => {
        const monthKey = `${nendo}-${month}`;
        const monthOpen = timelineState.openMonth === monthKey;
        const monthId = `pd-timeline-month-${nendo}-${month}`;
        const focus = items.find(item => item.kind === 'note' && item.note?.focus)?.note?.focus || '';
        const countText = Object.entries(labels).map(([kind, label]) => {
            const count = items.filter(item => item.kind === kind).length;
            return count ? `<span><i class="${icons[kind]}" aria-hidden="true"></i>${label}${count}</span>` : '';
        }).filter(Boolean).join('');
        const highlight = items.find(item => item.note?.nextStep || item.note?.focus) || items[0];
        const highlightText = highlight?.note?.nextStep || highlight?.note?.focus || highlight?.title || '';
        const monthIndex = timelineMonthKeys.indexOf(monthKey);
        const newerMonth = monthIndex > 0 ? timelineMonthKeys[monthIndex - 1] : '';
        const olderMonth = monthIndex >= 0 && monthIndex < timelineMonthKeys.length - 1 ? timelineMonthKeys[monthIndex + 1] : '';
        const navigation = newerMonth || olderMonth ? `<nav class="c-timeline-month-nav" aria-label="記録月を移動">${newerMonth ? `<button type="button" data-timeline-jump-month="${newerMonth}"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> 新しい記録月</button>` : ''}${olderMonth ? `<button type="button" data-timeline-jump-month="${olderMonth}">以前の記録月 <i class="ti ti-arrow-down" aria-hidden="true"></i></button>` : ''}</nav>` : '';
        return `<section class="c-timeline-month"><button type="button" class="c-timeline-route" data-timeline-month="${monthKey}" aria-expanded="${monthOpen}" aria-controls="${monthId}"><span class="c-timeline-route__title"><i class="ti ti-flag" aria-hidden="true"></i><i class="ti ${monthOpen ? 'ti-chevron-down' : 'ti-chevron-right'}" aria-hidden="true"></i>${month}月${focus ? ` <small>${escapeHtml(focus)}</small>` : ''}</span><span class="c-timeline-route__count">${items.length}件</span></button><div id="${monthId}" ${monthOpen ? '' : 'hidden'}><div class="c-timeline-month-summary"><span class="c-timeline-month-summary__label">今月のひとこま</span><strong>${escapeHtml(highlightText)}</strong><div class="c-timeline-month-summary__counts">${countText}</div></div><div class="c-timeline-items">${items.map(item => renderRecord(nendo, month, item)).join('')}</div>${navigation}</div></section>`;
    };
    const renderRecord = (nendo, month, item) => {
        const recordId = `pd-timeline-record-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const isOpen = timelineState.openRecord === String(item.id);
        const nextStep = item.note?.nextStep || '';
        return `<article class="c-timeline-record-group${timelineState.highlightRecord === String(item.id) ? ' is-search-target' : ''}"><button type="button" class="c-timeline-record is-${escapeHtml(item.kind)}" data-timeline-record="${escapeHtml(item.id)}" aria-expanded="${isOpen}" aria-controls="${recordId}"><span class="c-timeline-record__icon"><i class="${icons[item.kind] || 'ti ti-circle'}" aria-hidden="true"></i></span><span><span class="c-timeline-record__meta">${escapeHtml(item.date || '')} ・ ${labels[item.kind] || '記録'}</span><strong class="c-timeline-record__title">${escapeHtml(item.title || '')}</strong></span><i class="ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'} c-timeline-record__chevron" aria-hidden="true"></i></button><div id="${recordId}" class="c-timeline-record-detail" ${isOpen ? '' : 'hidden'}><p><strong>記録</strong>${escapeHtml(item.detail || '記録')}</p>${nextStep ? `<p><strong>次の一歩</strong>${escapeHtml(nextStep)}</p>` : ''}<div class="c-data-list__actions c-timeline-record-detail__actions">${item.kind === 'match' ? `<button type="button" class="c-button btn c-button--secondary btn-secondary btn-sm" data-timeline-match-id="${escapeHtml(item.id)}"><i class="ti ti-ball-football" aria-hidden="true"></i> 試合詳細を見る</button>` : ''}${canEdit && item.kind === 'note' ? `<button type="button" class="c-button btn c-button--secondary btn-secondary btn-sm" data-timeline-note-id="${escapeHtml(item.id)}"><i class="ti ti-trash" aria-hidden="true"></i> 削除</button>` : ''}</div></div></article>`;
    };
    const renderSearchResults = () => {
        if (!searchResults) return;
        const query = timelineState.searchQuery.toLocaleLowerCase('ja').trim();
        const filterType = timelineState.filterType;
        const filterNendo = timelineState.filterNendo;
        const filterSignal = timelineState.filterSignal;
        const results = summary.timeline.filter(item => {
            const searchable = `${item.title || ''} ${item.detail || ''} ${item.note?.nextStep || ''}`.toLocaleLowerCase('ja');
            const itemNendo = getNendo(item.date);
            const hasNextStep = Boolean(item.note?.nextStep);
            const hasSkillRating = Object.keys(item.note?.skillRatings || {}).length > 0;
            const matchesSignal = filterSignal === 'all' || (filterSignal === 'next-step' && hasNextStep) || (filterSignal === 'skill-rated' && hasSkillRating);
            return (filterType === 'all' || item.kind === filterType)
                && (filterNendo === 'all' || itemNendo === filterNendo)
                && matchesSignal
                && (!query || searchable.includes(query));
        });
        const hasConditions = Boolean(query) || filterType !== 'all' || filterNendo !== 'all' || filterSignal !== 'all';
        if (searchSummary) {
            const conditions = [
                query ? `「${timelineState.searchQuery.trim()}」` : '',
                filterType === 'all' ? '' : labels[filterType] || filterType,
                filterNendo === 'all' ? '' : `${filterNendo}年度`,
                filterSignal === 'all' ? '' : filterSignal === 'next-step' ? '次の一歩あり' : 'スキル評価あり'
            ].filter(Boolean);
            searchSummary.textContent = hasConditions ? `${conditions.join(' / ')}：${results.length}件` : `すべての記録：${results.length}件`;
        }
        if (clearSearchButton) clearSearchButton.hidden = !hasConditions;
        const visibleResults = results.slice(0, timelineState.searchLimit);
        searchResults.innerHTML = results.length ? `${visibleResults.map(item => {
            const nendo = getNendo(item.date);
            const month = String(Number(item.date.split('-')[1] || 0));
            return `<article class="c-timeline-search-result"><div><span class="c-status c-status--compact"><i class="${icons[item.kind] || 'ti ti-circle'}" aria-hidden="true"></i> ${labels[item.kind] || '記録'}</span><h5>${escapeHtml(item.title || '')}</h5><p>${nendo}年度 / ${month}月 / ${escapeHtml(item.date || '')}</p></div><button type="button" data-timeline-result-nendo="${nendo}" data-timeline-result-month="${month}" data-timeline-result-record="${escapeHtml(item.id)}">年表で見る <i class="ti ti-arrow-right" aria-hidden="true"></i></button></article>`;
        }).join('')}${visibleResults.length < results.length ? `<div class="c-timeline-search-more"><button type="button" class="c-button btn c-button--secondary btn-secondary" data-timeline-load-more>さらに${Math.min(20, results.length - visibleResults.length)}件表示 <i class="ti ti-arrow-down" aria-hidden="true"></i></button></div>` : ''}` : '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-search c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">条件に合う記録がありません。</p></div></div>';
    };

    timeline?.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.dataset.timelineNendo) {
            const nextNendo = timelineState.openNendo === target.dataset.timelineNendo ? '' : target.dataset.timelineNendo;
            const months = nextNendo ? Object.keys(allGroups[nextNendo].months).sort((a, b) => getMonthOrder(b) - getMonthOrder(a)) : [];
            timelineState = patchPlayerTimelineUiState(player.id, { openNendo: nextNendo, openMonth: months[0] ? `${nextNendo}-${months[0]}` : '', openRecord: '' });
            renderTimeline();
            focusTimelineControl(`[data-timeline-nendo="${target.dataset.timelineNendo}"]`);
            return;
        }
        if (target.dataset.timelineMonth) {
            const nextMonth = timelineState.openMonth === target.dataset.timelineMonth ? '' : target.dataset.timelineMonth;
            timelineState = patchPlayerTimelineUiState(player.id, { openMonth: nextMonth, openRecord: '' });
            renderTimeline();
            focusTimelineControl(`[data-timeline-month="${target.dataset.timelineMonth}"]`);
            return;
        }
        if (target.dataset.timelineJumpMonth) {
            const [nextNendo, nextMonth] = target.dataset.timelineJumpMonth.split('-');
            timelineState = patchPlayerTimelineUiState(player.id, { openNendo: nextNendo, openMonth: target.dataset.timelineJumpMonth, openRecord: '', highlightRecord: '' });
            renderTimeline();
            focusTimelineControl(`[data-timeline-month="${nextNendo}-${nextMonth}"]`, { scroll: true });
            return;
        }
        if (target.dataset.timelineRecord) {
            const nextRecord = timelineState.openRecord === target.dataset.timelineRecord ? '' : target.dataset.timelineRecord;
            timelineState = patchPlayerTimelineUiState(player.id, { openRecord: nextRecord, highlightRecord: '' });
            renderTimeline();
            focusTimelineRecord(target.dataset.timelineRecord);
            return;
        }
        if (target.dataset.timelineMatchId) {
            const matchItem = timelineItemsById.get(target.dataset.timelineMatchId);
            if (!matchItem) return;
            if (matchItem.sourceSeasonId !== state.activeSeasonId) switchWorkspace(state, state.activeTeamId, matchItem.sourceSeasonId);
            navigate('match-detail', { id: matchItem.sourceItemId });
            return;
        }
        if (target.dataset.timelineNoteId) {
            if (!canEdit) { showToast('保護者モードでは育成ノートを削除できません'); return; }
            const proceed = await showCustomConfirm('この育成ノートを削除しますか？', '育成ノートの削除', { okText: '削除する', type: 'danger' });
            if (!proceed) return;
            const noteItem = timelineItemsById.get(target.dataset.timelineNoteId);
            if (!noteItem) return;
            removeDevelopmentNote(noteItem.sourceSeasonId === state.activeSeasonId ? player : noteItem.sourcePlayer, noteItem.sourceItemId);
            await saveData();
            renderDevelopmentNotebook(player);
            showToast('育成ノートを削除しました');
        }
    });
    searchResults?.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.hasAttribute('data-timeline-load-more')) {
            timelineState = patchPlayerTimelineUiState(player.id, { searchLimit: timelineState.searchLimit + 20 });
            renderSearchResults();
            requestAnimationFrame(() => searchResults.querySelector('[data-timeline-load-more]')?.focus());
            return;
        }
        if (!target.dataset.timelineResultRecord) return;
        const resultNendo = target.dataset.timelineResultNendo || '';
        const resultRecord = target.dataset.timelineResultRecord || '';
        timelineState = patchPlayerTimelineUiState(player.id, { openNendo: resultNendo, openMonth: `${resultNendo}-${target.dataset.timelineResultMonth || ''}`, openRecord: resultRecord, highlightRecord: resultRecord, searchReturnActive: true });
        setView('timeline');
        renderTimeline();
        focusTimelineRecord(resultRecord, { scroll: true });
    });
    searchInput?.addEventListener('input', () => {
        timelineState = patchPlayerTimelineUiState(player.id, { searchQuery: searchInput.value, searchLimit: 20 });
        renderSearchResults();
    });
    filterChips?.querySelectorAll('.c-chip').forEach(button => button.addEventListener('click', () => {
        filterChips.querySelectorAll('.c-chip').forEach(chip => { chip.classList.remove('active'); chip.setAttribute('aria-pressed', 'false'); });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        timelineState = patchPlayerTimelineUiState(player.id, { filterType: button.dataset.type || 'all', searchLimit: 20 });
        renderSearchResults();
    }));
    nendoFilter?.addEventListener('change', () => {
        timelineState = patchPlayerTimelineUiState(player.id, { filterNendo: nendoFilter.value || 'all', searchLimit: 20 });
        renderSearchResults();
    });
    signalFilters?.querySelectorAll('.c-chip').forEach(button => button.addEventListener('click', () => {
        signalFilters.querySelectorAll('.c-chip').forEach(chip => { chip.classList.remove('active'); chip.setAttribute('aria-pressed', 'false'); });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        timelineState = patchPlayerTimelineUiState(player.id, { filterSignal: button.dataset.notebookSignal || 'all', searchLimit: 20 });
        renderSearchResults();
    }));
    clearSearchButton?.addEventListener('click', () => {
        timelineState = patchPlayerTimelineUiState(player.id, { searchQuery: '', filterType: 'all', filterNendo: 'all', filterSignal: 'all', searchLimit: 20 });
        if (searchInput) searchInput.value = '';
        if (nendoFilter) nendoFilter.value = 'all';
        filterChips?.querySelectorAll('.c-chip').forEach(chip => {
            const active = chip.dataset.type === 'all';
            chip.classList.toggle('active', active);
            chip.setAttribute('aria-pressed', String(active));
        });
        signalFilters?.querySelectorAll('.c-chip').forEach(chip => {
            const active = chip.dataset.notebookSignal === 'all';
            chip.classList.toggle('active', active);
            chip.setAttribute('aria-pressed', String(active));
        });
        renderSearchResults();
        searchInput?.focus();
    });
    timelineSearchReturn?.addEventListener('click', event => {
        if (!event.target.closest('#btn-timeline-return-search')) return;
        timelineState = patchPlayerTimelineUiState(player.id, { view: 'search', searchReturnActive: false, highlightRecord: '' });
        setView('search');
        requestAnimationFrame(() => searchInput?.focus());
    });
    timelineRoleFocus?.addEventListener('click', event => {
        const target = event.target.closest('button[data-timeline-role-action]');
        if (!target) return;
        if (target.dataset.timelineRoleAction === 'search') {
            setView('search');
            requestAnimationFrame(() => searchInput?.focus());
            return;
        }
        if (target.dataset.timelineRoleAction === 'note' && canEdit) {
            const [nendo, month] = (target.dataset.timelineRoleMonth || '').split('-');
            const dateYear = Number(nendo) + (Number(month) <= 3 ? 1 : 0);
            if (dateInput && dateYear && month) dateInput.value = `${dateYear}-${String(month).padStart(2, '0')}-01`;
            document.getElementById('modal-player-development-note')?.classList.remove('hidden');
        }
    });
    timelineModeButton?.addEventListener('click', () => setView('timeline'));
    searchModeButton?.addEventListener('click', () => setView('search'));
    backButton?.addEventListener('click', () => setView('timeline'));
    const modeTabs = [timelineModeButton, searchModeButton].filter(Boolean);
    modeTabs.forEach((button, index) => button.addEventListener('keydown', event => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % modeTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modeTabs.length) % modeTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = modeTabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = modeTabs[nextIndex];
        setView(nextTab === timelineModeButton ? 'timeline' : 'search');
        nextTab.focus();
    }));
    filterChips?.querySelectorAll('.c-chip').forEach(chip => {
        const active = chip.dataset.type === timelineState.filterType;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
    signalFilters?.querySelectorAll('.c-chip').forEach(chip => {
        const active = chip.dataset.notebookSignal === timelineState.filterSignal;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
    renderTimeline();
    setView(timelineState.view);
}

export function populateStrongKeySelects() {
    const optionsHtml = '<option value="">-- 強みの軸を選択 --</option>' +
        (state.skillMetrics || []).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    const sel1 = document.getElementById('player-strong-key-1');
    const sel2 = document.getElementById('player-strong-key-2');
    if (sel1) sel1.innerHTML = optionsHtml;
    if (sel2) sel2.innerHTML = optionsHtml;
}

export function openPlayerDetail(id) {
    navigate('player-detail', { playerId: id });
}

export function openPlayerEditModal(p) {
    if (state.currentUserRole !== 'coach') {
        showToast('保護者モードでは選手情報を編集できません');
        return;
    }
    if (!p) return;
    const editIdEl = document.getElementById('player-edit-id');
    const titleEl = document.getElementById('player-modal-title');
    const nameEl = document.getElementById('player-name');
    const numEl = document.getElementById('player-number');
    const gradeEl = document.getElementById('player-grade');
    const playStyleEl = document.getElementById('player-playstyle');
    const key1El = document.getElementById('player-strong-key-1');
    const text1El = document.getElementById('player-strong-text-1');
    const key2El = document.getElementById('player-strong-key-2');
    const text2El = document.getElementById('player-strong-text-2');
    const shortFocusEl = document.getElementById('player-short-focus');

    if (editIdEl) editIdEl.value = p.id;
    if (titleEl) titleEl.textContent = '選手を編集';
    const btnSubmit = document.querySelector('#form-player button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = '更新';
    if (nameEl) nameEl.value = p.name || '';
    if (numEl) numEl.value = p.number || '';
    if (gradeEl) gradeEl.value = p.grade || '';
    if (playStyleEl) playStyleEl.value = p.playStyle || '';

    populateStrongKeySelects();

    if (key1El) key1El.value = p.strongPoints?.[0]?.key || '';
    if (text1El) text1El.value = p.strongPoints?.[0]?.text || '';
    if (key2El) key2El.value = p.strongPoints?.[1]?.key || '';
    if (text2El) text2El.value = p.strongPoints?.[1]?.text || '';
    if (shortFocusEl) shortFocusEl.value = p.shortFocus || '';

    const posContainer = document.getElementById('player-position-container');
    if (posContainer) {
        posContainer.innerHTML = (state.positions || []).map(pos => {
            const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
            return `
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                </label>
            `;
        }).join('');
    }

    const posCat2Container = document.getElementById('player-position-cat2-container');
    if (posCat2Container) {
        posCat2Container.innerHTML = (state.positionsCat2 || []).map(pos => {
            const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
            return `
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                </label>
            `;
        }).join('');
    }

    openModal('modal-player');
}

function renderPlayerExperience(player) {
    const archive = buildPlayerExperienceArchive(state, player);
    const recentView = document.getElementById('pd-match-footprints-recent-view');
    const searchView = document.getElementById('pd-match-footprints-search-view');
    const recentModeButton = document.getElementById('btn-match-footprints-recent');
    const searchModeButton = document.getElementById('btn-match-footprints-search');
    const backButton = document.getElementById('btn-match-footprints-back');
    const milestones = document.getElementById('pd-match-milestones');
    const recentList = document.getElementById('pd-match-footprints-list');
    const searchInput = document.getElementById('input-match-footprints-search');
    const nendoFilter = document.getElementById('select-match-footprints-nendo');
    const resultFilter = document.getElementById('select-match-footprints-result');
    const signalFilters = document.getElementById('match-footprints-signal-filters');
    const searchSummary = document.getElementById('pd-match-footprints-search-summary');
    const clearButton = document.getElementById('btn-match-footprints-clear-search');
    const searchResults = document.getElementById('pd-match-footprints-search-results');
    if (!recentList || !searchResults) return;

    let experienceState = getPlayerTimelineUiState(player.id, {
        matchView: 'recent', matchQuery: '', matchNendo: 'all', matchResult: 'all', matchSignal: 'all', matchLimit: 20
    });
    const patchExperienceState = patch => {
        experienceState = patchPlayerTimelineUiState(player.id, patch);
        return experienceState;
    };
    if (!['recent', 'search'].includes(experienceState.matchView)) patchExperienceState({ matchView: 'recent' });
    if (!['all', 'goal', 'assist'].includes(experienceState.matchSignal)) patchExperienceState({ matchSignal: 'all' });
    if (!['all', 'win', 'draw', 'loss', 'unknown'].includes(experienceState.matchResult)) patchExperienceState({ matchResult: 'all' });
    if (!Number.isInteger(experienceState.matchLimit) || experienceState.matchLimit < 20) patchExperienceState({ matchLimit: 20 });
    if (!experienceState.matchNendo) patchExperienceState({ matchNendo: 'all' });

    const itemById = new Map(archive.items.map(item => [item.id, item]));
    const nendos = [...new Set(archive.items.map(item => String(item.sourceNendo)))].sort((left, right) => Number(right) - Number(left));
    if (nendoFilter) {
        nendoFilter.innerHTML = `<option value="all">すべての年度</option>${nendos.map(nendo => `<option value="${escapeHtml(nendo)}">${escapeHtml(nendo)}年度</option>`).join('')}`;
        nendoFilter.value = nendos.includes(experienceState.matchNendo) ? experienceState.matchNendo : 'all';
    }
    if (resultFilter) resultFilter.value = experienceState.matchResult;
    if (searchInput) searchInput.value = experienceState.matchQuery;

    const resultLabels = { win: '勝ち', draw: '分け', loss: '負け', unknown: '結果未入力' };
    const matchSummary = item => [item.date, item.sourceNendo ? `${item.sourceNendo}年度` : '', item.type].filter(Boolean).join(' / ');
    const renderMatchItem = item => `<article class="c-experience-item"><div class="c-experience-item__body"><span class="c-experience-item__meta">${escapeHtml(matchSummary(item))}</span><strong>vs ${escapeHtml(item.opponent)}</strong><div class="c-experience-item__signals"><span class="c-status c-status--compact c-status--muted">${escapeHtml(item.result || '結果未入力')}</span>${item.goalCount ? `<span class="c-status c-status--compact c-status--info"><i class="ti ti-ball-football" aria-hidden="true"></i> ${item.goalCount}得点</span>` : ''}${item.assistCount ? `<span class="c-status c-status--compact c-status--success"><i class="ti ti-shoe" aria-hidden="true"></i> ${item.assistCount}アシスト</span>` : ''}</div></div><button type="button" class="c-button btn c-button--secondary btn-secondary btn-sm" data-experience-match="${escapeHtml(item.id)}"><i class="ti ti-arrow-right" aria-hidden="true"></i> 試合詳細</button></article>`;
    const renderMilestones = () => {
        if (!milestones) return;
        milestones.innerHTML = archive.milestones.length ? archive.milestones.map(item => item.matchId
            ? `<button type="button" class="c-experience-milestone" data-experience-match="${escapeHtml(item.matchId)}"><i class="ti ${item.kind === 'goal' ? 'ti-ball-football' : item.kind === 'assist' ? 'ti-shoe' : 'ti-flag'}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.date)}</small></button>`
            : `<span class="c-experience-milestone"><i class="ti ti-note" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></span>`
        ).join('') : '<p class="c-footprint-explorer__empty">出場記録が増えると、ここに経験の節目が表示されます。</p>';
    };
    const renderRecent = () => {
        recentList.innerHTML = archive.items.length
            ? archive.items.slice(0, 5).map(renderMatchItem).join('')
            : '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-trophy c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">まだ出場記録がありません。</p></div></div>';
    };
    const renderSearchResults = () => {
        const query = (experienceState.matchQuery || '').toLocaleLowerCase('ja').trim();
        const results = archive.items.filter(item => {
            const searchable = `${item.opponent} ${item.type} ${item.result} ${item.date}`.toLocaleLowerCase('ja');
            const matchesSignal = experienceState.matchSignal === 'all'
                || (experienceState.matchSignal === 'goal' && item.goalCount > 0)
                || (experienceState.matchSignal === 'assist' && item.assistCount > 0);
            return (!query || searchable.includes(query))
                && (experienceState.matchNendo === 'all' || String(item.sourceNendo) === String(experienceState.matchNendo))
                && (experienceState.matchResult === 'all' || item.resultState === experienceState.matchResult)
                && matchesSignal;
        });
        const hasConditions = Boolean(query) || experienceState.matchNendo !== 'all' || experienceState.matchResult !== 'all' || experienceState.matchSignal !== 'all';
        if (searchSummary) {
            const conditions = [
                query ? `「${experienceState.matchQuery.trim()}」` : '',
                experienceState.matchNendo === 'all' ? '' : `${experienceState.matchNendo}年度`,
                experienceState.matchResult === 'all' ? '' : resultLabels[experienceState.matchResult],
                experienceState.matchSignal === 'all' ? '' : experienceState.matchSignal === 'goal' ? '得点あり' : 'アシストあり'
            ].filter(Boolean);
            searchSummary.textContent = hasConditions ? `${conditions.join(' / ')}：${results.length}件` : `すべての出場試合：${results.length}件`;
        }
        if (clearButton) clearButton.hidden = !hasConditions;
        const visible = results.slice(0, experienceState.matchLimit);
        searchResults.innerHTML = results.length
            ? `${visible.map(renderMatchItem).join('')}${visible.length < results.length ? `<div class="c-experience-load-more"><button type="button" class="c-button btn c-button--secondary btn-secondary" data-experience-load-more>さらに${Math.min(20, results.length - visible.length)}件表示 <i class="ti ti-arrow-down" aria-hidden="true"></i></button></div>` : ''}`
            : '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-search c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">条件に合う出場試合がありません。</p></div></div>';
    };
    const setView = view => {
        patchExperienceState({ matchView: view });
        const recentActive = view === 'recent';
        if (recentView) recentView.hidden = !recentActive;
        if (searchView) searchView.hidden = recentActive;
        if (recentModeButton) { recentModeButton.classList.toggle('is-active', recentActive); recentModeButton.setAttribute('aria-selected', String(recentActive)); }
        if (searchModeButton) { searchModeButton.classList.toggle('is-active', !recentActive); searchModeButton.setAttribute('aria-selected', String(!recentActive)); }
        if (!recentActive) renderSearchResults();
    };
    const openMatch = event => {
        const target = event.target.closest('button[data-experience-match]');
        if (!target) return;
        const item = itemById.get(target.dataset.experienceMatch);
        if (!item) return;
        if (item.sourceSeasonId !== state.activeSeasonId) switchWorkspace(state, state.activeTeamId, item.sourceSeasonId);
        navigate('match-detail', { id: item.sourceItemId });
    };
    recentList.addEventListener('click', openMatch);
    milestones?.addEventListener('click', openMatch);
    searchResults.addEventListener('click', event => {
        const loadMore = event.target.closest('button[data-experience-load-more]');
        if (loadMore) {
            patchExperienceState({ matchLimit: experienceState.matchLimit + 20 });
            renderSearchResults();
            requestAnimationFrame(() => searchResults.querySelector('[data-experience-load-more]')?.focus());
            return;
        }
        openMatch(event);
    });
    searchInput?.addEventListener('input', () => { patchExperienceState({ matchQuery: searchInput.value, matchLimit: 20 }); renderSearchResults(); });
    nendoFilter?.addEventListener('change', () => { patchExperienceState({ matchNendo: nendoFilter.value || 'all', matchLimit: 20 }); renderSearchResults(); });
    resultFilter?.addEventListener('change', () => { patchExperienceState({ matchResult: resultFilter.value || 'all', matchLimit: 20 }); renderSearchResults(); });
    signalFilters?.querySelectorAll('.c-chip').forEach(button => button.addEventListener('click', () => {
        signalFilters.querySelectorAll('.c-chip').forEach(chip => { chip.classList.remove('active'); chip.setAttribute('aria-pressed', 'false'); });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        patchExperienceState({ matchSignal: button.dataset.matchSignal || 'all', matchLimit: 20 });
        renderSearchResults();
    }));
    clearButton?.addEventListener('click', () => {
        patchExperienceState({ matchQuery: '', matchNendo: 'all', matchResult: 'all', matchSignal: 'all', matchLimit: 20 });
        if (searchInput) searchInput.value = '';
        if (nendoFilter) nendoFilter.value = 'all';
        if (resultFilter) resultFilter.value = 'all';
        signalFilters?.querySelectorAll('.c-chip').forEach(chip => {
            const active = chip.dataset.matchSignal === 'all';
            chip.classList.toggle('active', active);
            chip.setAttribute('aria-pressed', String(active));
        });
        renderSearchResults();
        searchInput?.focus();
    });
    recentModeButton?.addEventListener('click', () => setView('recent'));
    searchModeButton?.addEventListener('click', () => setView('search'));
    backButton?.addEventListener('click', () => setView('recent'));
    const modeTabs = [recentModeButton, searchModeButton].filter(Boolean);
    modeTabs.forEach((button, index) => button.addEventListener('keydown', event => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % modeTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modeTabs.length) % modeTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = modeTabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = modeTabs[nextIndex];
        setView(nextTab === recentModeButton ? 'recent' : 'search');
        nextTab.focus();
    }));
    signalFilters?.querySelectorAll('.c-chip').forEach(chip => {
        const active = chip.dataset.matchSignal === experienceState.matchSignal;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
    renderMilestones();
    renderRecent();
    setView(experienceState.matchView);
}

export function initPlayerDetailView(playerId) {
    const p = state.players.find(pl => pl.id === playerId);
    const canEdit = state.currentUserRole === 'coach';
    if (!p) {
        showToast('選手が見つかりませんでした');
        navigate('players');
        return;
    }

    // 選手ヘッダー
    const numEl = document.getElementById('pd-number');
    const nameEl = document.getElementById('pd-name');
    const posEl = document.getElementById('pd-position');
    const metaEl = document.getElementById('pd-meta');
    if (numEl) numEl.textContent = p.number ? `#${p.number}` : '-';
    if (nameEl) nameEl.textContent = p.name || '名前なし';
    if (posEl) posEl.textContent = Array.isArray(p.position) ? p.position.join(' / ') : (p.position || 'ポジション未設定');
    if (metaEl) metaEl.textContent = p.grade ? `${p.grade}` : '学年未設定';

    // 編集ボタン
    const btnEdit = document.getElementById('pd-btn-edit');
    if (btnEdit) {
        btnEdit.hidden = !canEdit;
        btnEdit.disabled = !canEdit;
        btnEdit.onclick = canEdit ? () => openPlayerEditModal(p) : null;
    }

    // 削除ボタン
    const btnDelete = document.getElementById('pd-btn-delete');
    if (btnDelete) {
        btnDelete.hidden = !canEdit;
        btnDelete.disabled = !canEdit;
        btnDelete.onclick = canEdit ? async () => {
            if (state.currentUserRole !== 'coach') {
                showToast('保護者モードでは選手を削除できません');
                return;
            }
            const proceed = await showCustomConfirm(`「${p.name}」選手を削除しますか？`, '選手の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.players = state.players.filter(pl => pl.id !== p.id);
                saveData();
                showToast('選手を削除しました');
                navigate('players');
            }
        } : null;
    }

    // ダッシュボードと同じ選手統計を使い、年度出席・通算得点／アシスト・出場試合を一貫して表示する。
    const playerStatistics = getPlayerStatistics(p, {
        matches: state.matches,
        practices: state.practices
    });
    const {
        attendanceRate,
        goals: playerGoals,
        assists: playerAssists,
        appearanceMatches: playerMatchesList
    } = playerStatistics;

    const elAtt = document.getElementById('pd-attendance-rate');
    const elMatches = document.getElementById('pd-matches-count');
    const elGoals = document.getElementById('pd-goals');
    const elAssists = document.getElementById('pd-assists');
    if (elAtt) elAtt.textContent = `${attendanceRate}%`;
    if (elMatches) elMatches.textContent = `${playerMatchesList.length} 試合`;
    if (elGoals) elGoals.textContent = `${playerGoals} 点`;
    if (elAssists) elAssists.textContent = `${playerAssists} 回`;




    const developmentNoteForm = document.getElementById('form-player-development-note');
    const btnNewDevNote = document.querySelector('.btn-new-development-note');
    if (btnNewDevNote) {
        btnNewDevNote.hidden = !canEdit;
    }
    
    if (developmentNoteForm) {
        developmentNoteForm.hidden = !canEdit;
        developmentNoteForm.querySelectorAll('input, select, textarea, button').forEach(control => {
            control.disabled = !canEdit;
        });
        
        if (canEdit) {
            developmentNoteForm.onsubmit = async (e) => {
                e.preventDefault();
                const observation = document.getElementById('development-note-observation').value.trim();
                const nextStep = document.getElementById('development-note-next-step').value.trim();
                const date = document.getElementById('development-note-date').value;
                const ratingsEl = document.getElementById('development-note-ratings');
                
                const skillRatings = {};
                if (ratingsEl) {
                    ratingsEl.querySelectorAll('.development-rating').forEach(sel => {
                        const m = sel.dataset.metric;
                        if (m && sel.value !== '') {
                            skillRatings[m] = parseInt(sel.value, 10);
                        }
                    });
                }
                
                addDevelopmentNote(p, { date, observation, nextStep, skillRatings });
                await saveData();
                showToast('育成ノートを記録しました');
                
                // フォームリセット
                document.getElementById('development-note-observation').value = '';
                document.getElementById('development-note-next-step').value = '';
                if (ratingsEl) {
                    ratingsEl.querySelectorAll('.development-rating').forEach(sel => sel.value = '');
                }
                
                document.getElementById('modal-player-development-note').classList.add('is-collapsed');
                
                // 再描画
                initPlayerDetailView(p.id);
            };
        } else {
            developmentNoteForm.onsubmit = null;
        }
    }

    // 特徴・プレースタイル
    const playStyleEl = document.getElementById('pd-playstyle');
    const shortFocusEl = document.getElementById('pd-shortfocus');
    if (playStyleEl) playStyleEl.textContent = p.playStyle || '未設定';
    if (shortFocusEl) shortFocusEl.textContent = p.shortFocus || '未設定';

    const spContainer = document.getElementById('pd-strongpoints');
    if (spContainer) {
        if (p.strongPoints && p.strongPoints.length > 0) {
            spContainer.innerHTML = p.strongPoints.map(sp => `
                <div class="c-card c-static-style--246">
                    <span class="c-status c-status--info c-status--stacked"><i class="ti ti-check"></i> ${escapeHtml(sp.key)}</span>
                    <div class="c-static-style--169">${escapeHtml(sp.text)}</div>
                </div>
            `).join('');
        } else {
            spContainer.innerHTML = '<p class="text-secondary c-static-style--170">ストロングポイントは未設定です。</p>';
        }
    }

    renderDevelopmentNotebook(p);
    renderPlayerExperience(p);
}

export function parsePlayerCSV(csvText) {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const results = [];
    const headerKeywords = ['背番号', '番号', '氏名', '名前', '選手名', '学年', 'ポジション', 'num', 'number', 'name', 'pos', 'position'];
    let startIndex = 0;

    const firstLineLower = lines[0].toLowerCase();
    if (headerKeywords.some(k => firstLineLower.includes(k))) {
        startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        let parts = line.split(/,|\t/).map(p => p.trim());
        if (parts.length === 1 && line.includes(' ')) {
            parts = line.split(/\s+/).map(p => p.trim());
        }

        if (parts.length === 0 || !parts[0]) continue;

        let number = '';
        let name = '';
        let grade = '';
        let position = 'MF';

        if (parts.length >= 4) {
            number = parts[0];
            name = parts[1];
            grade = parts[2];
            position = parts[3];
        } else if (parts.length === 3) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
                if (['FW', 'MF', 'DF', 'GK', 'CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'].some(p => parts[2].toUpperCase().includes(p))) {
                    position = parts[2];
                } else {
                    grade = parts[2];
                }
            } else {
                name = parts[0];
                grade = parts[1];
                position = parts[2];
            }
        } else if (parts.length === 2) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
            } else {
                name = parts[0];
                position = parts[1];
            }
        } else if (parts.length === 1) {
            name = parts[0];
        }

        if (name) {
            results.push({
                number: number ? (parseInt(number, 10) || number) : '',
                name,
                grade: grade || '',
                position: position.toUpperCase() || 'MF'
            });
        }
    }

    return results;
}

export function openPlayerCSVImportModal() {
    const modal = document.getElementById('modal-import-players-csv');
    const inputFileInput = document.getElementById('input-csv-file');
    const textareaData = document.getElementById('textarea-csv-data');
    const previewContainer = document.getElementById('csv-preview-container');
    const errorMsg = document.getElementById('csv-error-msg');
    const form = document.getElementById('form-import-players-csv');


    if (!modal) return;

    if (inputFileInput) inputFileInput.value = '';
    if (textareaData) textareaData.value = '';
    if (previewContainer) { previewContainer.style.display = 'none'; previewContainer.innerHTML = ''; }
    if (errorMsg) errorMsg.style.display = 'none';

    const updatePreview = () => {
        const text = textareaData ? textareaData.value : '';
        const parsed = parsePlayerCSV(text);

        if (parsed.length > 0) {
            previewContainer.style.display = 'block';
            previewContainer.innerHTML = `
                <div class="c-static-style--124">
                    <i class="ti ti-eye"></i> プレビュー (${parsed.length}件の選手を検出)
                </div>
                <table class="csv-preview-table">
                    <thead>
                        <tr>
                            <th>背番号</th>
                            <th>氏名</th>
                            <th>学年</th>
                            <th>ポジション</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${parsed.map(p => `
                            <tr>
                                <td>${p.number || '-'}</td>
                                <td><strong>${escapeHtml(p.name)}</strong></td>
                                <td>${p.grade || '-'}</td>
                                <td><span class="c-status c-status--muted c-status--compact">${p.position}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            if (errorMsg) errorMsg.style.display = 'none';
        } else {
            previewContainer.style.display = 'none';
            previewContainer.innerHTML = '';
        }
    };

    if (inputFileInput) {
        inputFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (textareaData) {
                        textareaData.value = event.target.result;
                        updatePreview();
                    }
                };
                reader.readAsText(file, 'UTF-8');
            }
        };
    }

    if (textareaData) {
        textareaData.oninput = updatePreview;
    }

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const text = textareaData ? textareaData.value : '';
            const parsed = parsePlayerCSV(text);

            if (parsed.length === 0) {
                if (errorMsg) {
                    errorMsg.textContent = '登録可能な選手データが検出されませんでした。フォーマットを確認してください。';
                    errorMsg.style.display = 'block';
                }
                return;
            }

            let addedCount = 0;
            parsed.forEach((p, idx) => {
                const newPlayer = {
                    id: Date.now() + Math.floor(Math.random() * 1000) + idx,
                    number: p.number ? p.number : (state.players.length + 1 + idx),
                    name: p.name,
                    grade: p.grade || '',
                    position: p.position || 'MF',
                    history: [{ id: Date.now(), date: new Date().toISOString().split('T')[0], comment: 'CSV一括登録', skills: {} }]
                };
                state.players.push(newPlayer);
                addedCount++;
            });

            saveData();
            modal.classList.add('is-collapsed');
            showToast(`${addedCount}名の選手を一括登録しました！`);
            initPlayers();
        };
    }

    modal.classList.remove('is-collapsed');
}

export function initPlayers() {
    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) return;

    if (state.players.length === 0) {
        playerGrid.innerHTML = `
            <section class="c-empty-state" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon ti ti-users" aria-hidden="true"></i>
                    <h3 class="c-empty-state__title">登録選手がいません</h3>
                    <p class="c-empty-state__text">選手を登録して、強みや指導フォーカスの設定、試合での出場ポジション設定、成長履歴の管理を始めましょう。</p>
                    <button class="c-button btn c-button--primary btn-primary" id="btn-empty-add-player"><i class="ti ti-user-plus" aria-hidden="true"></i> 最初の選手を追加</button>
                </div>
            </section>
        `;
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-player');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-player');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    } else {
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        playerGrid.innerHTML = sortedPlayers.map(p => {
            const badges = (Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
                if (!pos) return '';
                const lower = pos.toLowerCase();
                const statusVariant = lower === 'fw'
                    ? ''
                    : lower === 'mf'
                        ? 'c-status--warning'
                        : lower === 'df'
                            ? 'c-status--info'
                            : lower === 'gk'
                                ? 'c-status--success'
                                : 'c-status--muted';
                return `<span class="player-position c-status c-status--compact ${statusVariant}">${pos}</span>`;
            }).join('');

            const spTags = (p.strongPoints || []).filter(sp => sp.key).map(sp =>
                `<span class="c-status c-status--info"><i class="ti ti-check"></i> ${escapeHtml(sp.key)}</span>`
            ).join('');

            return `
                <article class="player-card c-card c-static-style--032" role="button" tabindex="0" aria-label="${escapeHtml(p.name)}の選手詳細を開く" onclick="openPlayerDetail(${p.id});" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPlayerDetail(${p.id}); }">
                    <div class="player-card-header">
                        <div class="player-card__identity">
                            <div class="player-card__positions c-static-style--069">${badges || '<span class="c-status c-status--muted c-status--compact">未設定</span>'}</div>
                            <div class="player-card__name c-static-style--162">${escapeHtml(p.name)}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div class="player-card__summary c-static-style--097">
                        <p class="player-card__playstyle c-static-style--173">${escapeHtml(p.playStyle || 'プレースタイル未設定')}</p>
                        <div class="player-card__strongpoints c-static-style--060">${spTags}</div>
                        <p class="player-card__focus c-static-style--207"><i class="ti ti-crosshair c-static-style--022" aria-hidden="true"></i> ${escapeHtml(p.shortFocus || 'フォーカス未設定')}</p>
                    </div>
                </article>
            `;
        }).join('');
    }

    const formPlayer = document.getElementById('form-player');
    if (formPlayer) {
        formPlayer.onsubmit = (e) => {
            e.preventDefault();
            const editId = document.getElementById('player-edit-id').value;
            const selectedPositions = [];
            document.querySelectorAll('.player-pos-checkbox:checked').forEach(cb => {
                selectedPositions.push(cb.value);
            });

            const playStyle = document.getElementById('player-playstyle') ? document.getElementById('player-playstyle').value.trim() : '';
            const grade = document.getElementById('player-grade') ? document.getElementById('player-grade').value.trim() : '';
            const key1 = document.getElementById('player-strong-key-1') ? document.getElementById('player-strong-key-1').value : '';
            const text1 = document.getElementById('player-strong-text-1') ? document.getElementById('player-strong-text-1').value.trim() : '';
            const key2 = document.getElementById('player-strong-key-2') ? document.getElementById('player-strong-key-2').value : '';
            const text2 = document.getElementById('player-strong-text-2') ? document.getElementById('player-strong-text-2').value.trim() : '';
            const shortFocus = document.getElementById('player-short-focus') ? document.getElementById('player-short-focus').value.trim() : '';

            const strongPoints = [
                { key: key1, text: text1 },
                { key: key2, text: text2 }
            ].filter(sp => sp.key || sp.text);

            if (editId) {
                const player = state.players.find(p => p.id === parseInt(editId, 10));
                if (player) {
                    player.name = document.getElementById('player-name').value;
                    player.number = parseInt(document.getElementById('player-number').value, 10);
                    player.grade = grade;
                    player.position = selectedPositions;
                    player.playStyle = playStyle;
                    player.strongPoints = strongPoints;
                    player.shortFocus = shortFocus;

                    saveData();
                    showToast('選手情報を更新しました');
                    document.getElementById('modal-player').classList.add('is-collapsed');
                    openPlayerDetail(player.id);
                    initPlayers();
                }
            } else {
                const newPlayer = {
                    id: Date.now(),
                    name: document.getElementById('player-name').value,
                    number: parseInt(document.getElementById('player-number').value, 10),
                    grade: grade,
                    position: selectedPositions,
                    playStyle: playStyle,
                    strongPoints: strongPoints,
                    shortFocus: shortFocus,
                    history: []
                };
                state.players.push(newPlayer);
                saveData();
                showToast('選手を登録しました');
                document.getElementById('modal-player').classList.add('is-collapsed');
                initPlayers();
            }
        };
    }

    const formAssessment = document.getElementById('form-player-assessment');
    if (formAssessment) {
        formAssessment.onsubmit = (e) => {
            e.preventDefault();
            const playerId = parseInt(document.getElementById('assessment-player-id').value, 10);
            const editId = document.getElementById('assessment-edit-id').value;
            const player = state.players.find(p => p.id === playerId);
            if (player) {
                const goodText = document.getElementById('assessment-good') ? document.getElementById('assessment-good').value.trim() : '';
                const improveText = document.getElementById('assessment-improve') ? document.getElementById('assessment-improve').value.trim() : '';
                let commentText = '【Good！】\n' + goodText;
                if (improveText) {
                    commentText += '\n【More】\n' + improveText;
                }
                const evalDate = document.getElementById('assessment-date').value;

                if (editId) {
                    const hId = parseInt(editId, 10);
                    const hItem = player.history ? player.history.find(h => h.id === hId) : null;
                    if (hItem) {
                        hItem.date = evalDate;
                        hItem.comment = commentText;
                        showToast('観察メモを更新しました');
                    }
                } else {
                    if (!player.history) player.history = [];
                    player.history.push({
                        id: Date.now(),
                        date: evalDate,
                        comment: commentText
                    });
                    showToast('観察メモを記録しました');
                }

                player.history.sort((a, b) => new Date(b.date) - new Date(a.date));
                saveData();
                document.getElementById('modal-player-assessment').classList.add('is-collapsed');
                openPlayerDetail(playerId);
                initPlayers();
            }
        };
    }

    const btnAdd = document.getElementById('btn-add-player');
    if (btnAdd) {
        const posContainer = document.getElementById('player-position-container');
        if (posContainer) {
            posContainer.innerHTML = (state.positions || []).map(p => `
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }

        const posCat2Container = document.getElementById('player-position-cat2-container');
        if (posCat2Container) {
            posCat2Container.innerHTML = (state.positionsCat2 || []).map(p => `
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }

        btnAdd.addEventListener('click', () => {
            document.getElementById('player-edit-id').value = '';
            document.getElementById('player-modal-title').textContent = '選手を登録';

            const nameEl = document.getElementById('player-name');
            if (nameEl) nameEl.value = '';
            const numEl = document.getElementById('player-number');
            if (numEl) numEl.value = '';
            const gradeEl = document.getElementById('player-grade');
            if (gradeEl) gradeEl.value = '';
            const psEl = document.getElementById('player-playstyle');
            if (psEl) psEl.value = '';
            const st1El = document.getElementById('player-strong-text-1');
            if (st1El) st1El.value = '';
            const st2El = document.getElementById('player-strong-text-2');
            if (st2El) st2El.value = '';
            const sfEl = document.getElementById('player-short-focus');
            if (sfEl) sfEl.value = '';

            populateStrongKeySelects();
            document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);

            openModal('modal-player');
        });

        populateStrongKeySelects();
    }

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            openPlayerCSVImportModal();
        });
    }

    const tabsContainer = document.getElementById('player-view-tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.player-view-tab').forEach(tab => {
            tab.onclick = (e) => {
                const targetView = e.currentTarget.dataset.view;

                tabsContainer.querySelectorAll('.player-view-tab').forEach(t => {
                    t.classList.remove('active', 'is-active');
                    t.setAttribute('aria-selected', 'false');
                });

                e.currentTarget.classList.add('active', 'is-active');
                e.currentTarget.setAttribute('aria-selected', 'true');

                document.querySelectorAll('.player-subview').forEach(view => {
                    view.classList.add('is-collapsed');
                });

                if (targetView === 'cards') {
                    document.getElementById('player-grid')?.classList.remove('is-collapsed');
                } else if (targetView === 'participation') {
                    document.getElementById('player-view-participation')?.classList.remove('is-collapsed');
                    renderParticipationGraph();
                }
            };
        });
    }
}

let currentHeatmapPosFilter = 'ALL';

export function renderParticipationGraph() {
    const container = document.getElementById('player-view-participation');
    if (!container) return;

    const totalMatches = state.matches.length;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const recentPracs = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
    const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
    const totalEvents = recentPracs.length + recentMatches.length;

    const playersStats = state.players.map(p => {
        let matchCount = 0, goals = 0, assists = 0;
        state.matches.forEach(m => {
            if ((m.presentPlayerIds || []).includes(p.id)) matchCount++;
            if (m.goalRecords) {
                m.goalRecords.forEach(r => {
                    if (r.scorerId === p.id) goals++;
                    if (r.assistId === p.id) assists++;
                });
            }
        });

        let presentCount = 0;
        recentPracs.forEach(prac => { if ((prac.presentPlayerIds || []).includes(p.id)) presentCount++; });
        recentMatches.forEach(m => { if ((m.presentPlayerIds || []).includes(p.id)) presentCount++; });
        const attPct = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0;
        const matchPct = totalMatches > 0 ? Math.round((matchCount / totalMatches) * 100) : 0;

        return { ...p, matchCount, matchPct, goals, assists, attPct };
    });

    playersStats.sort((a, b) => b.matchCount - a.matchCount);

    const cat1List = (state.positions || ['GK', 'DF', 'MF', 'FW']).map(pos => pos.toUpperCase());
    const cat2ToCat1Map = {
        'CB': 'DF', 'SB': 'DF',
        'CH': 'MF', 'SH': 'MF', 'OH': 'MF', 'DH': 'MF',
        'ST': 'FW', 'WG': 'FW'
    };

    const rowsHTML = playersStats.map(p => {
        const rawPositions = (Array.isArray(p.position) ? p.position : [p.position]).filter(Boolean);
        let cat1Positions = rawPositions
            .map(pos => {
                const u = pos.toUpperCase();
                if (cat1List.includes(u)) return u;
                if (cat2ToCat1Map[u]) return cat2ToCat1Map[u];
                return null;
            })
            .filter(Boolean);
        cat1Positions = [...new Set(cat1Positions)];
        const positionsStr = cat1Positions.join(', ');

        return `
            <button type="button" class="c-data-list__item c-data-list__item--button" data-player-detail-id="${Number(p.id)}">
                <span class="c-data-list__identity">${escapeHtml(String(p.number || '-'))}</span>
                <span class="c-data-list__content"><strong>${escapeHtml(p.name)}</strong><span class="c-data-list__meta">${escapeHtml(positionsStr || '-')}</span><span class="c-data-list__meta">試合参加 ${p.matchCount}試合 (${p.matchPct}%) ・ 30日出席率 ${p.attPct}%</span><span class="c-progress-bar" aria-label="試合参加率 ${p.matchPct}%"><span class="c-progress-bar__indicator" style="width:${p.matchPct}%"></span></span></span>
                <span class="c-data-list__value-group" aria-label="得点とアシスト"><span title="得点"><i class="ti ti-ball-football" aria-hidden="true"></i> <strong class="c-data-list__value">${p.goals}</strong></span><span title="アシスト"><i class="ti ti-shoe" aria-hidden="true"></i> <strong class="c-data-list__value">${p.assists}</strong></span></span>
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <section class="c-card" aria-labelledby="player-participation-title">
            <div class="c-section-header c-card__header"><div class="c-section-header__content"><span class="c-kicker"><i class="ti ti-chart-column" aria-hidden="true"></i> PARTICIPATION</span><h3 class="c-section-header__title c-card__title" id="player-participation-title">試合出場機会＆スタッツ比較</h3></div></div>
            <div class="c-card__body"><div class="c-data-list c-data-list--participation">${rowsHTML}</div></div>
        </section>
    `;
    container.querySelectorAll('[data-player-detail-id]').forEach(button => {
        button.addEventListener('click', () => openPlayerDetail(Number(button.dataset.playerDetailId)));
    });
}
