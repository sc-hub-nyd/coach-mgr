import { state } from './state.js';
import { escapeHtml, showToast } from './utils.js';
import { navigate } from './app-context.js';
import { buildTeamInsights, buildPlayerInsights, buildPeriodComparison, buildPositionParticipation, buildCoachingRecommendations, getTimelinePresentation, buildInsightsShareText } from './insights-service.js';
import { buildDecisionCards } from './experience-service.js';

function getSelectedPlayerId() {
    const parentPlayerId = localStorage.getItem('coachMgrMyPlayerId');
    if (state.currentUserRole !== 'coach' && parentPlayerId) return String(parentPlayerId);
    return document.getElementById('insights-player-select')?.value || '';
}

function renderMetric(label, value, icon, tone = 'neutral', note = '') {
    return `
        <article class="insight-metric insight-metric-${tone}">
            <div class="insight-metric-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></div>
            <div>
                <span>${label}</span>
                <strong>${value}</strong>
                ${note ? `<small>${note}</small>` : ''}
            </div>
        </article>`;
}

function renderTimeline(insights) {
    const container = document.getElementById('insights-timeline');
    if (!container) return;
    if (!insights.timeline.length) {
        container.innerHTML = '<div class="insights-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>対象期間の試合・練習記録はまだありません。</p></div>';
        return;
    }
    container.innerHTML = insights.timeline.map(event => {
        const presentation = getTimelinePresentation(event, state.players || []);
        const period = event.typeLabel === '試合' && Number.isFinite(Number(event.elapsedSeconds))
            ? `${Math.floor(event.elapsedSeconds / 60)}分` : '';
        const destination = event.matchId ? `data-route="match-detail" data-id="${event.matchId}"` : '';
        return `
            <button type="button" class="insight-timeline-item ${presentation.className}" ${destination}>
                <span class="insight-timeline-icon"><i class="fa-solid ${presentation.icon}" aria-hidden="true"></i></span>
                <span class="insight-timeline-main"><strong>${escapeHtml(presentation.label)}</strong><small>${escapeHtml(event.date || '')}${period ? ` ・ ${period}` : ''}${event.opponent ? ` ・ vs ${escapeHtml(event.opponent)}` : ''}</small></span>
                <span class="insight-timeline-kind">${event.typeLabel}</span>
            </button>`;
    }).join('');
    container.querySelectorAll('[data-route="match-detail"]').forEach(button => {
        button.onclick = () => navigate('match-detail', { matchId: Number(button.dataset.id) });
    });
}

function renderPlayerHistory(playerInsights) {
    const container = document.getElementById('insights-player-history');
    const title = document.getElementById('insights-player-history-title');
    if (!container || !title) return;
    if (!playerInsights?.player) {
        title.textContent = '選手を選択してください';
        container.innerHTML = '<div class="insights-empty"><i class="fa-solid fa-user"></i><p>選手を選択すると、出欠・出場・試合イベントをまとめて確認できます。</p></div>';
        return;
    }
    title.textContent = `${playerInsights.player.number ? `${playerInsights.player.number}. ` : ''}${playerInsights.player.name} 選手の活動履歴`;
    const attendance = playerInsights.attendance;
    const performance = playerInsights.performance;
    container.innerHTML = `
        <div class="insight-player-summary">
            <div class="insight-progress-row"><span>出席率</span><strong>${attendance.rate}%</strong><div class="insight-progress"><span style="width:${attendance.rate}%"></span></div></div>
            <div class="insight-player-stat-grid">
                <span>参加 <strong>${attendance.attending}/${attendance.invited}</strong></span>
                <span>試合 <strong>${attendance.matches}</strong></span>
                <span>練習 <strong>${attendance.practices}</strong></span>
                <span>得点 <strong>${performance.goals}</strong></span>
            </div>
        </div>
        <div class="insight-activity-list">
            ${playerInsights.activities.length ? playerInsights.activities.map(activity => {
                const icons = { goal: 'fa-futbol', 'match-attendance': 'fa-trophy', 'practice-attendance': 'fa-clipboard-check' };
                const label = activity.status === 'attending' ? '参加' : activity.status === 'absent' ? '欠席' : activity.status === 'pending' ? '未回答' : '';
                return `<div class="insight-activity"><i class="fa-solid ${icons[activity.kind] || 'fa-circle'}" aria-hidden="true"></i><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.date || '')}${label ? ` ・ ${label}` : ''}</small></span></div>`;
            }).join('') : '<div class="insights-empty compact"><p>対象期間の活動記録はありません。</p></div>'}
        </div>`;
}

function renderCoachingSignals(comparison, positionParticipation, recommendations) {
    const comparisonContainer = document.getElementById('insights-comparison');
    if (comparisonContainer) {
        if (!comparison.previous) {
            comparisonContainer.innerHTML = '<div class="insights-empty compact"><p>「すべて」の期間では、前期間との比較は表示されません。</p></div>';
        } else {
            const sign = value => `${value > 0 ? '+' : ''}${value}`;
            comparisonContainer.innerHTML = [
                ['活動数', `${comparison.current.matches + comparison.current.practices}`, `${sign(comparison.deltas.activities)}件`, comparison.deltas.activities >= 0 ? 'positive' : 'negative'],
                ['得失点差', `${comparison.current.goalDifference >= 0 ? '+' : ''}${comparison.current.goalDifference}`, `${sign(comparison.deltas.goalDifference)}`, comparison.deltas.goalDifference >= 0 ? 'positive' : 'negative'],
                ['勝利数', `${comparison.current.results.wins}勝`, `${sign(comparison.deltas.wins)}勝`, comparison.deltas.wins >= 0 ? 'positive' : 'negative'],
                ['失点', `${comparison.current.conceded}`, `${sign(comparison.deltas.conceded)}点`, comparison.deltas.conceded <= 0 ? 'positive' : 'negative']
            ].map(([label, value, delta, tone]) => `<article class="insight-comparison insight-comparison-${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>前期間比 ${escapeHtml(delta)}</small></article>`).join('');
        }
    }
    const positionContainer = document.getElementById('insights-position-participation');
    if (positionContainer) {
        positionContainer.innerHTML = positionParticipation.length ? positionParticipation.map(item => `<div class="insight-position-row"><span>${escapeHtml(item.position)}</span><strong>${item.minutes}分</strong><small>${item.playerCount}名が出場</small></div>`).join('') : '<div class="insights-empty compact"><p>Field Companionで時計・交代を記録すると、ポジション別の出場時間を表示できます。</p></div>';
    }
    const recommendationsContainer = document.getElementById('insights-recommendations');
    if (recommendationsContainer) {
        recommendationsContainer.innerHTML = recommendations.map(item => `<article class="insight-recommendation is-${escapeHtml(item.tone)}"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.reason)}</p></div><small><i class="fa-solid fa-arrow-right"></i> ${escapeHtml(item.action)}</small></article>`).join('');
    }
}

function renderDecisionCards(cards) {
    const container = document.getElementById('insights-decision-cards');
    if (!container) return;
    if (!cards.length) {
        container.innerHTML = '<div class="insights-empty compact"><p>活動記録が増えると、ここに次の判断と根拠が表示されます。</p></div>';
        return;
    }
    container.innerHTML = cards.map(card => `<article class="decision-card is-${escapeHtml(card.tone || 'neutral')}">
        <div class="decision-card-icon"><i class="fa-solid ${escapeHtml(card.icon || 'fa-circle-info')}" aria-hidden="true"></i></div>
        <div><span class="decision-card-label">${escapeHtml(card.title)}</span><p>${escapeHtml(card.evidence)}</p><button type="button" class="btn btn-secondary btn-sm" data-decision-action="${escapeHtml(card.action || '')}" data-decision-id="${escapeHtml(card.id)}">${escapeHtml(card.actionLabel || '確認する')} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
    </article>`).join('');
    container.querySelectorAll('[data-decision-action]').forEach(button => {
        button.onclick = () => {
            const card = cards.find(item => item.id === button.dataset.decisionId);
            if (button.dataset.decisionAction === 'open-insights') return renderInsights();
            if (button.dataset.decisionAction === 'open-matches') return navigate('matches');
            if (button.dataset.decisionAction === 'create-practice-plan') return window.openCoachMgrPracticePlan?.(card?.recommendation);
        };
    });
}

function renderInsights() {
    const range = document.getElementById('insights-range-select')?.value || '90';
    const teamInsights = buildTeamInsights(state, { days: range === 'all' ? 'all' : Number(range) });
    const playerId = getSelectedPlayerId();
    const playerInsights = playerId ? buildPlayerInsights(state, playerId, { days: range === 'all' ? 'all' : Number(range) }) : null;
    const teamMetrics = document.getElementById('insights-team-metrics');
    if (teamMetrics) {
        teamMetrics.innerHTML = [
            renderMetric('活動回数', `${teamInsights.matches + teamInsights.practices}`, 'fa-calendar-days', 'primary', `試合 ${teamInsights.matches} / 練習 ${teamInsights.practices}`),
            renderMetric('試合結果', `${teamInsights.results.wins}勝 ${teamInsights.results.draws}分 ${teamInsights.results.losses}敗`, 'fa-trophy', 'positive', `得点 ${teamInsights.goals} ・ 失点 ${teamInsights.conceded}`),
            renderMetric('得失点差', `${teamInsights.goalDifference >= 0 ? '+' : ''}${teamInsights.goalDifference}`, 'fa-scale-balanced', teamInsights.goalDifference >= 0 ? 'positive' : 'negative', `得点 ${teamInsights.goals} / 失点 ${teamInsights.conceded}`),
            renderMetric('出欠回答', `${teamInsights.attendance.attending}名`, 'fa-user-check', 'primary', `未回答 ${teamInsights.attendance.pending} / 欠席 ${teamInsights.attendance.absent}`)
        ].join('');
    }
    const comparison = buildPeriodComparison(state, { days: range === 'all' ? 'all' : Number(range) });
    const positionParticipation = buildPositionParticipation(state, { days: range === 'all' ? 'all' : Number(range) });
    const recommendations = buildCoachingRecommendations(state, { days: range === 'all' ? 'all' : Number(range) });
    renderCoachingSignals(comparison, positionParticipation, recommendations);
    renderDecisionCards(buildDecisionCards(state, { rangeDays: range === 'all' ? 90 : Number(range) }));
    renderTimeline(teamInsights);
    renderPlayerHistory(playerInsights);
    return { teamInsights, playerInsights, comparison, positionParticipation, recommendations };
}

async function copyInsightsReport() {
    const { teamInsights, playerInsights } = renderInsights();
    const player = playerInsights?.player || null;
    const text = buildInsightsShareText(state.teamInfo, player, teamInsights, playerInsights);
    try {
        await navigator.clipboard.writeText(text);
        showToast('振り返りレポートをコピーしました');
    } catch (_error) {
        window.prompt('以下をコピーして共有してください。', text);
    }
}

export function initInsights() {
    const rangeSelect = document.getElementById('insights-range-select');
    const playerSelect = document.getElementById('insights-player-select');
    const reportButton = document.getElementById('btn-copy-insights-report');
    const isParent = state.currentUserRole !== 'coach';
    const savedPlayerId = localStorage.getItem('coachMgrMyPlayerId') || '';
    const sortedPlayers = [...(state.players || [])].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));

    if (playerSelect) {
        playerSelect.innerHTML = `<option value="">チーム全体</option>${sortedPlayers.map(player => `<option value="${player.id}">${player.number ? `${player.number}. ` : ''}${escapeHtml(player.name)}</option>`).join('')}`;
        playerSelect.value = isParent ? savedPlayerId : '';
        playerSelect.disabled = isParent;
        playerSelect.closest('.insights-player-filter')?.classList.toggle('hidden', isParent && !savedPlayerId);
        playerSelect.onchange = renderInsights;
    }
    if (rangeSelect) rangeSelect.onchange = renderInsights;
    if (reportButton) reportButton.onclick = copyInsightsReport;
    renderInsights();
}
