// Dashboard View Module

import { state, getNendo } from '../state.js?v=25';
import { filters } from '../state.js?v=25';
import { navigate } from '../router.js';
import { openModal } from '../ui.js';

export function openLeaderRankingModal(type = 'all') {
    const modal = document.getElementById('modal-leader-ranking');
    const scorersContainer = document.getElementById('ranking-scorers-list');
    const assistsContainer = document.getElementById('ranking-assists-list');
    if (!modal || !scorersContainer || !assistsContainer) return;

    const scorerCounts = {};
    const assistCounts = {};

    state.matches.forEach(m => {
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId) {
                    scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                }
                if (r.assistId) {
                    assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                }
            });
        }
    });

    const sortedScorers = Object.keys(scorerCounts)
        .map(id => ({ player: state.players.find(p => p.id === parseInt(id, 10)), count: scorerCounts[id] }))
        .filter(item => item.player)
        .sort((a, b) => b.count - a.count);

    const sortedAssists = Object.keys(assistCounts)
        .map(id => ({ player: state.players.find(p => p.id === parseInt(id, 10)), count: assistCounts[id] }))
        .filter(item => item.player)
        .sort((a, b) => b.count - a.count);

    scorersContainer.innerHTML = sortedScorers.length === 0
        ? '<div style="color:var(--text-secondary); font-style:italic;">得点記録なし</div>'
        : sortedScorers.map((item, idx) => `
            <div style="display:flex; justify-content:space-between; padding:0.35rem 0; border-bottom:1px solid var(--surface-border);">
                <span><strong>${idx + 1}.</strong> ${item.player.number} ${item.player.name}</span>
                <span style="font-weight:bold; color:var(--primary);">${item.count} 点</span>
            </div>
        `).join('');

    assistsContainer.innerHTML = sortedAssists.length === 0
        ? '<div style="color:var(--text-secondary); font-style:italic;">アシスト記録なし</div>'
        : sortedAssists.map((item, idx) => `
            <div style="display:flex; justify-content:space-between; padding:0.35rem 0; border-bottom:1px solid var(--surface-border);">
                <span><strong>${idx + 1}.</strong> ${item.player.number} ${item.player.name}</span>
                <span style="font-weight:bold; color:#22c55e;">${item.count} 回</span>
            </div>
        `).join('');

    openModal('modal-leader-ranking');
}

export function openMatchListModal(title, matches) {
    const modal = document.getElementById('modal-player-matches-list');
    const titleEl = document.getElementById('pml-title');
    const contentEl = document.getElementById('pml-content');
    if (!modal || !titleEl || !contentEl) return;

    titleEl.textContent = title;
    
    if (matches.length === 0) {
        contentEl.innerHTML = '<div class="text-secondary" style="font-style:italic; font-size:0.85rem;">該当する試合がありません</div>';
    } else {
        contentEl.innerHTML = matches.map((m, idx) => `
            <div class="schedule-item pml-match-item" data-id="${m.id}" style="cursor:pointer;">
                <div class="schedule-item-info">
                    <div class="schedule-item-icon-box match"><i class="fa-solid fa-trophy"></i></div>
                    <div class="schedule-item-details">
                        <div class="schedule-item-meta"><span>${m.date}</span> <span>vs ${m.opponent || '対戦相手未設定'}</span></div>
                        <div class="schedule-item-title">${m.type || '試合'} - ${m.result || 'スコア未登録'}</div>
                    </div>
                </div>
            </div>
        `).join('');

        contentEl.querySelectorAll('.pml-match-item').forEach(item => {
            item.onclick = () => {
                const matchId = parseInt(item.dataset.id, 10);
                document.getElementById('modal-player-matches-list').classList.add('hidden');
                navigate('matches');
                setTimeout(() => {
                    const btn = document.querySelector(`.btn-detail-match[data-id='${matchId}']`);
                    if (btn) btn.click();
                }, 100);
            };
        });
    }
    openModal('modal-player-matches-list');
}

export function initDashboard() {
    const elRecord = document.getElementById('dash-db-record');
    const elRecordBar = document.getElementById('dash-db-record-bar');
    const elMatchTypes = document.getElementById('dash-db-match-types');
    const elUpcoming = document.getElementById('dash-upcoming-schedule-content');
    const elPast = document.getElementById('dash-past-schedule-content');
    const elLeaderRankings = document.getElementById('dash-leader-rankings');

    // Calculate W-L-D stats
    let wins = 0, losses = 0, draws = 0;
    const typeStats = {};

    state.matches.forEach(m => {
        const type = m.type || 'その他';
        if (!typeStats[type]) typeStats[type] = { wins: 0, losses: 0, draws: 0, total: 0 };
        typeStats[type].total++;

        if (m.result && m.result.includes('-')) {
            const parts = m.result.split('-').map(s => parseInt(s.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                if (parts[0] > parts[1]) { wins++; typeStats[type].wins++; }
                else if (parts[0] < parts[1]) { losses++; typeStats[type].losses++; }
                else { draws++; typeStats[type].draws++; }
            }
        }
    });

    const totalMatches = wins + losses + draws;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    if (elRecord) elRecord.textContent = `${wins}勝 ${losses}敗 ${draws}分`;
    if (elRecordBar) elRecordBar.style.width = `${winRate}%`;

    if (elMatchTypes) {
        elMatchTypes.innerHTML = Object.keys(typeStats).map(t => {
            const s = typeStats[t];
            return `<div><span>${t}:</span> <strong>${s.wins}勝 ${s.losses}敗 ${s.draws}分</strong></div>`;
        }).join('');
    }

    // Leader Rankings Preview
    if (elLeaderRankings) {
        const scorerCounts = {};
        const assistCounts = {};
        state.matches.forEach(m => {
            if (m.goalRecords) {
                m.goalRecords.forEach(r => {
                    if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                    if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                });
            }
        });

        const topScorerId = Object.keys(scorerCounts).sort((a, b) => scorerCounts[b] - scorerCounts[a])[0];
        const topAssistId = Object.keys(assistCounts).sort((a, b) => assistCounts[b] - assistCounts[a])[0];

        const topScorer = topScorerId ? state.players.find(p => p.id === parseInt(topScorerId, 10)) : null;
        const topAssist = topAssistId ? state.players.find(p => p.id === parseInt(topAssistId, 10)) : null;

        elLeaderRankings.innerHTML = `
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem;">
                <i class="fa-solid fa-fire" style="color:#ef4444;"></i> 得点王: <strong>${topScorer ? `${topScorer.name} (${scorerCounts[topScorerId]}点)` : 'なし'}</strong>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
                <i class="fa-solid fa-shoe-prints" style="color:#22c55e;"></i> アシスト王: <strong>${topAssist ? `${topAssist.name} (${assistCounts[topAssistId]}回)` : 'なし'}</strong>
            </div>
        `;
        elLeaderRankings.style.cursor = 'pointer';
        elLeaderRankings.onclick = () => openLeaderRankingModal('all');
    }

    // Dash Card Click Handlers
    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) {
        cardMatches.onclick = () => navigate('matches');
    }

    // Upcoming & Past Schedules
    const todayStr = new Date().toISOString().split('T')[0];

    const upcomingEvents = [];
    state.matches.forEach(m => {
        if (m.date >= todayStr) upcomingEvents.push({ type: 'match', date: m.date, title: `vs ${m.opponent || '未設定'}`, desc: m.type || '試合', raw: m });
    });
    state.practices.forEach(p => {
        if (p.date >= todayStr) upcomingEvents.push({ type: 'practice', date: p.date, title: 'チーム練習', desc: `${p.attendance || '0/0'} 名`, raw: p });
    });
    upcomingEvents.sort((a, b) => a.date.localeCompare(b.date));

    if (elUpcoming) {
        if (upcomingEvents.length === 0) {
            elUpcoming.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">今後の予定はありません</div>';
        } else {
            elUpcoming.innerHTML = upcomingEvents.slice(0, 5).map((ev, idx) => `
                <div class="schedule-item dash-upcoming-item" data-route="${ev.type === 'match' ? 'matches' : 'practices'}" style="padding:0.4rem 0.6rem; cursor:pointer;">
                    <div class="schedule-item-info">
                        <div class="schedule-item-icon-box ${ev.type === 'match' ? 'match' : 'practice'}" style="width:24px; height:24px; font-size:0.7rem;">
                            <i class="fa-solid ${ev.type === 'match' ? 'fa-trophy' : 'fa-calendar-check'}"></i>
                        </div>
                        <div class="schedule-item-details">
                            <div class="schedule-item-meta" style="font-size:0.7rem;"><span>${ev.date}</span></div>
                            <div class="schedule-item-title" style="font-size:0.8rem;">${ev.title}</div>
                        </div>
                    </div>
                </div>
            `).join('');

            elUpcoming.querySelectorAll('.dash-upcoming-item').forEach(item => {
                item.onclick = () => navigate(item.dataset.route);
            });
        }
    }

    const pastEvents = [];
    state.matches.forEach(m => {
        if (m.date < todayStr) pastEvents.push({ type: 'match', date: m.date, title: `vs ${m.opponent || '未設定'}`, desc: m.result || 'スコアなし', raw: m });
    });
    state.practices.forEach(p => {
        if (p.date < todayStr) pastEvents.push({ type: 'practice', date: p.date, title: 'チーム練習', desc: `${p.attendance || '0/0'} 名`, raw: p });
    });
    pastEvents.sort((a, b) => b.date.localeCompare(a.date));

    if (elPast) {
        if (pastEvents.length === 0) {
            elPast.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">過去の履歴はありません</div>';
        } else {
            elPast.innerHTML = pastEvents.slice(0, 3).map((ev, idx) => `
                <div class="schedule-item dash-past-item" data-route="${ev.type === 'match' ? 'matches' : 'practices'}" style="padding:0.4rem 0.6rem; cursor:pointer;">
                    <div class="schedule-item-info">
                        <div class="schedule-item-icon-box ${ev.type === 'match' ? 'match' : 'practice'}" style="width:24px; height:24px; font-size:0.7rem;">
                            <i class="fa-solid ${ev.type === 'match' ? 'fa-trophy' : 'fa-calendar-check'}"></i>
                        </div>
                        <div class="schedule-item-details">
                            <div class="schedule-item-meta" style="font-size:0.7rem;"><span>${ev.date}</span></div>
                            <div class="schedule-item-title" style="font-size:0.8rem;">${ev.title} (${ev.desc})</div>
                        </div>
                    </div>
                </div>
            `).join('');

            elPast.querySelectorAll('.dash-past-item').forEach(item => {
                item.onclick = () => navigate(item.dataset.route);
            });
        }
    }
}
