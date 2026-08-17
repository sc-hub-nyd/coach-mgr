import { state } from './state.js';
import { escapeHtml, showToast } from './utils.js';
import { navigate } from './app-context.js';
import { buildTeamInsights, buildPlayerInsights, getTimelinePresentation, buildInsightsShareText } from './insights-service.js';

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
    renderTimeline(teamInsights);
    renderPlayerHistory(playerInsights);
    return { teamInsights, playerInsights };
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
