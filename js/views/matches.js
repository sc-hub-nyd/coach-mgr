// Matches View Module

import { state, saveData, getNendo, filters } from '../state.js?v=25';
import { showToast, openModal } from '../ui.js';
import { navigate } from '../router.js';

export function addGoalRecordRow(scorerId = null, assistId = null, targetContainerId = 'goal-records-list') {
    const container = document.getElementById(targetContainerId);
    if (!container) return;
    
    const rowId = 'goal-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const sortedPlayers = [...state.players].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
    });

    const scorerOptions = `<option value="">得点者なし/OG</option>` + 
        sortedPlayers.map(p => `<option value="${p.id}" ${p.id === scorerId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
        
    const assistOptions = `<option value="">アシストなし</option>` + 
        sortedPlayers.map(p => `<option value="${p.id}" ${p.id === assistId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
        
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'goal-record-row';
    div.style = 'display:flex; gap:0.5rem; align-items:center; width:100%;';
    div.innerHTML = `
        <select class="form-control goal-scorer-select" style="flex:1; padding:0.3rem; font-size:0.85rem;">
            ${scorerOptions}
        </select>
        <span style="font-size:0.8rem; color:var(--text-secondary);">アシ:</span>
        <select class="form-control goal-assist-select" style="flex:1; padding:0.3rem; font-size:0.85rem;">
            ${assistOptions}
        </select>
        <button type="button" class="btn btn-danger btn-delete-goal-row" style="padding:0.25rem 0.5rem; font-size:0.85rem;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    const delBtn = div.querySelector('.btn-delete-goal-row');
    if (delBtn) delBtn.onclick = () => div.remove();

    container.appendChild(div);
}

export function addFormationVideoRow(urlVal = '') {
    const container = document.getElementById('formation-video-list');
    if (!container) return;
    const rowId = 'video-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'formation-video-row';
    div.style = 'display:flex; gap:0.5rem; align-items:center; width:100%;';
    div.innerHTML = `
        <input type="url" class="form-control formation-video-input" value="${urlVal}" placeholder="https://www.youtube.com/watch?v=... または https://youtu.be/..." style="flex:1; font-size:0.85rem; padding:0.3rem 0.6rem;">
        <button type="button" class="btn btn-danger btn-delete-video-row" style="padding:0.25rem 0.5rem; font-size:0.85rem;" title="削除"><i class="fa-solid fa-trash"></i></button>
    `;
    const delBtn = div.querySelector('.btn-delete-video-row');
    if (delBtn) delBtn.onclick = () => div.remove();

    container.appendChild(div);
}

export function openMatchModal(matchId = null) {
    const formMatch = document.getElementById('form-match');
    if (formMatch) formMatch.reset();
    
    const editIdInp = document.getElementById('match-edit-id');
    if (editIdInp) editIdInp.value = '';

    const goalRecordsList = document.getElementById('goal-records-list');
    if (goalRecordsList) goalRecordsList.innerHTML = '';

    const title = document.querySelector('#modal-match h2');
    if (title) title.textContent = '試合を追加';

    const select = document.getElementById('match-type');
    if (select) {
        select.innerHTML = state.matchTypes.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    if (matchId) {
        const m = state.matches.find(match => match.id === matchId);
        if (m) {
            if (editIdInp) editIdInp.value = m.id;
            document.getElementById('match-date').value = m.date;
            document.getElementById('match-opponent').value = m.opponent;
            if (select) select.value = m.type;
            document.getElementById('match-tournament').value = m.tournament || '';
            
            if (m.result && m.result.includes('-')) {
                const scores = m.result.split('-');
                document.getElementById('match-score-us').value = scores[0];
                document.getElementById('match-score-them').value = scores[1];
            } else {
                document.getElementById('match-score-us').value = '';
                document.getElementById('match-score-them').value = '';
            }
            
            if (goalRecordsList && m.goalRecords && m.goalRecords.length > 0) {
                m.goalRecords.forEach(r => {
                    addGoalRecordRow(r.scorerId, r.assistId);
                });
            }
            
            let good = '';
            let improve = '';
            if (m.comments) {
                const parts = m.comments.split('【ネクストステップ】');
                if (parts.length > 1) {
                    good = parts[0].replace('【ポジティブ】', '').trim();
                    improve = parts[1].trim();
                } else {
                    good = m.comments.replace('【ポジティブ】', '').trim();
                }
            }
            document.getElementById('match-comments-good').value = good;
            document.getElementById('match-comments-improve').value = improve;
            
            if (title) title.textContent = '試合情報を編集';
        }
    }
    
    const matchDetailModal = document.getElementById('modal-match-detail');
    if (matchDetailModal) matchDetailModal.classList.add('hidden');
    
    openModal('modal-match');
}

export function openMatchDetail(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const modal = document.getElementById('modal-match-detail');
    if (!modal) return;

    document.getElementById('md-opponent').textContent = `vs ${match.opponent}`;
    document.getElementById('md-meta').textContent = `${match.date} | ${match.type}${match.tournament ? ` (${match.tournament})` : ''}`;
    document.getElementById('md-score').textContent = match.result || 'スコア未登録';
    document.getElementById('md-scorers').textContent = match.scorers ? `得点者: ${match.scorers}` : '得点記録なし';
    
    const commentsGoodEl = document.getElementById('md-comments-good');
    const commentsImproveEl = document.getElementById('md-comments-improve');
    
    let goodStr = '';
    let improveStr = '';
    if (match.comments) {
        const parts = match.comments.split('【ネクストステップ】');
        if (parts.length > 1) {
            goodStr = parts[0].replace('【ポジティブ】', '').trim();
            improveStr = parts[1].trim();
        } else {
            goodStr = match.comments.replace('【ポジティブ】', '').trim();
        }
    }

    if (commentsGoodEl) commentsGoodEl.textContent = goodStr || '特になし';
    if (commentsImproveEl) commentsImproveEl.textContent = improveStr || '特になし';

    const btnEditMatch = document.getElementById('btn-edit-match');
    if (btnEditMatch) {
        btnEditMatch.onclick = () => openMatchModal(match.id);
    }

    openModal('modal-match-detail');
}

let displayedMatchCount = 10;

export function initMatches() {
    const filterSelect = document.getElementById('filter-nendo-match');
    if (filterSelect) {
        const nendos = Array.from(new Set(state.matches.map(m => getNendo(m.date)))).sort((a, b) => b - a);
        filterSelect.innerHTML = '<option value="all">すべての年度</option>' + nendos.map(n => `<option value="${n}">${n}年度</option>`).join('');
        filterSelect.value = filters.currentMatchNendo;
        
        filterSelect.onchange = (e) => {
            filters.currentMatchNendo = e.target.value;
            displayedMatchCount = 10; // Reset display count on filter change
            initMatches();
        };
    }

    const filteredMatches = filters.currentMatchNendo === 'all'
        ? state.matches
        : state.matches.filter(m => getNendo(m.date) == filters.currentMatchNendo);

    const matchList = document.getElementById('match-list');
    if (!matchList) return;

    if (filteredMatches.length === 0) {
        matchList.innerHTML = '<div class="text-secondary" style="text-align:center; padding:2rem; font-style:italic;">試合記録が登録されていません</div>';
        return;
    }

    const sortedMatches = [...filteredMatches].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalCount = sortedMatches.length;
    const itemsToDisplay = sortedMatches.slice(0, displayedMatchCount);

    let html = itemsToDisplay.map(m => `
        <div class="card" style="padding:1.25rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                <div>
                    <span class="badge" style="background:rgba(242,57,50,0.1); color:var(--primary); font-weight:bold;">${m.type}</span>
                    <h3 style="font-size:1.1rem; margin:0.4rem 0 0.2rem 0; font-weight:bold; color:var(--text-primary);">vs ${m.opponent}</h3>
                    <span style="font-size:0.8rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} ${m.tournament ? `(${m.tournament})` : ''}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.4rem; font-weight:800; color:var(--primary);">${m.result || '-'}</div>
                </div>
            </div>
            
            ${m.scorers ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.75rem;"><i class="fa-solid fa-futbol"></i> ${m.scorers}</div>` : ''}
            
            <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                <button class="btn btn-secondary btn-sm btn-detail-match" data-id="${m.id}"><i class="fa-solid fa-circle-info"></i> 詳細</button>
                <button class="btn btn-secondary btn-sm btn-edit-match" data-id="${m.id}"><i class="fa-solid fa-pen"></i> 編集</button>
                <button class="btn btn-danger btn-sm btn-delete-match" data-id="${m.id}"><i class="fa-solid fa-trash"></i> 削除</button>
            </div>
        </div>
    `).join('');

    if (totalCount > 10) {
        const currentlyShowing = Math.min(displayedMatchCount, totalCount);
        const hasMore = currentlyShowing < totalCount;

        html += `
            <div class="pagination-container">
                <div class="pagination-info">
                    ${currentlyShowing} / ${totalCount} 件を表示中
                </div>
                <div class="pagination-actions">
                    ${hasMore ? `<button class="btn btn-secondary btn-sm" id="btn-load-more-matches"><i class="fa-solid fa-angles-down"></i> さらに10件読み込む</button>` : ''}
                    ${hasMore ? `<button class="btn btn-secondary btn-sm" id="btn-show-all-matches"><i class="fa-solid fa-list-check"></i> 全件表示</button>` : ''}
                </div>
            </div>
        `;
    }

    matchList.innerHTML = html;

    // Bind item action listeners
    document.querySelectorAll('.btn-detail-match').forEach(btn => {
        btn.onclick = () => openMatchDetail(parseInt(btn.dataset.id, 10));
    });
    document.querySelectorAll('.btn-edit-match').forEach(btn => {
        btn.onclick = () => openMatchModal(parseInt(btn.dataset.id, 10));
    });
    document.querySelectorAll('.btn-delete-match').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.id, 10);
            if (confirm('この試合記録を削除しますか？')) {
                state.matches = state.matches.filter(m => m.id !== id);
                saveData();
                showToast('試合記録を削除しました');
                initMatches();
            }
        };
    });

    const btnLoadMore = document.getElementById('btn-load-more-matches');
    if (btnLoadMore) {
        btnLoadMore.onclick = () => {
            displayedMatchCount += 10;
            initMatches();
        };
    }

    const btnShowAll = document.getElementById('btn-show-all-matches');
    if (btnShowAll) {
        btnShowAll.onclick = () => {
            displayedMatchCount = totalCount;
            initMatches();
        };
    }

    const btnAddMatch = document.getElementById('btn-add-match');
    if (btnAddMatch) {
        btnAddMatch.onclick = () => openMatchModal();
    }
}
