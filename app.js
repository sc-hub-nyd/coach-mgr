// app.js - エントリーポイント
import { state, uiState } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, setupScoreCounters } from './utils.js';
import { initPractices, openPracticeModal, renderPracticeRoster } from './practices.js';
import { initMatches, openMatchModal, openMatchDetail, initMatchDetailView } from './matches.js'; // ★ 1行にまとめる
import { initPlayers, openPlayerDetail } from './players.js';
import { initLibrary } from './library.js';
import { initSettings, initData } from './settings.js';
import { initAnimation, cleanupCanvasEvents, drawPitchToCtx } from './drawing.js';

let lastSyncTimeStr = uiState.lastSyncTimeStr;

// --- ミニピッチアニメーション Observer ---
const miniPitchObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const canvas = entry.target;
        if (entry.isIntersecting) {
            startMiniPitchLoop(canvas);
        } else {
            stopMiniPitchLoop(canvas);
        }
    });
}, { root: null, threshold: 0.1 });

if (!window.miniPitchIntervalsMap) {
    window.miniPitchIntervalsMap = new Map();
}

function startMiniPitchLoop(canvas) {
    if (window.miniPitchIntervalsMap.has(canvas)) return;
    const framesData = canvas._animationFrames;
    const template = canvas._pitchTemplate || 'full';
    if (!framesData || framesData.length <= 1) return;

    let frameIdx = 0;
    const ctx = canvas.getContext('2d');
    drawPitchToCtx(framesData[frameIdx], canvas, ctx, template);

    const intervalId = setInterval(() => {
        frameIdx = (frameIdx + 1) % framesData.length;
        drawPitchToCtx(framesData[frameIdx], canvas, ctx, template);
    }, 1200);

    window.miniPitchIntervalsMap.set(canvas, intervalId);
}

function stopMiniPitchLoop(canvas) {
    if (window.miniPitchIntervalsMap.has(canvas)) {
        clearInterval(window.miniPitchIntervalsMap.get(canvas));
        window.miniPitchIntervalsMap.delete(canvas);
    }
}

export function clearAllMiniPitchIntervals() {
    window.miniPitchIntervalsMap.forEach((intervalId, canvas) => {
        clearInterval(intervalId);
        miniPitchObserver.unobserve(canvas);
    });
    window.miniPitchIntervalsMap.clear();
}

export async function loadData() {
    try {
        let saved = await localforage.getItem('coachMgrData');
        if (!saved) {
            const oldSaved = localStorage.getItem('coachMgrData');
            if (oldSaved) {
                saved = oldSaved;
                await localforage.setItem('coachMgrData', saved);
                localStorage.removeItem('coachMgrData');
            }
        }

        if (saved) {
            if (typeof saved === 'string' && saved.startsWith('enc:')) {
                saved = decryptData(saved.slice(4));
            }
            let parsed = null;
            try {
                parsed = (typeof saved === 'string') ? JSON.parse(saved) : saved;
            } catch (e) {
                console.error('Failed to parse saved data:', e);
            }
            if (parsed) {
                state.matches = parsed.matches || [];
                state.practices = parsed.practices || [];
                state.players = parsed.players || [];
                state.menuLibrary = parsed.menuLibrary || [];
                state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
                state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
                state.skillMetrics = parsed.skillMetrics || ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
                state.positions = parsed.positions || ['GK', 'DF', 'MF', 'FW'];
                state.positionsCat2 = parsed.positionsCat2 || ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'];
                state.teamInfo = parsed.teamInfo || { name: 'My Team', color: '#f23932', passcode: '7064' };
                if (!state.teamInfo.passcode) state.teamInfo.passcode = '7064';
                state.customFormations = parsed.customFormations || state.customFormations;
            }
        }
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

export async function saveData() {
    const jsonStr = JSON.stringify({
        matches: state.matches,
        practices: state.practices,
        players: state.players,
        menuLibrary: state.menuLibrary,
        matchTypes: state.matchTypes,
        menuCategories: state.menuCategories,
        skillMetrics: state.skillMetrics,
        positions: state.positions,
        positionsCat2: state.positionsCat2,
        teamInfo: state.teamInfo,
        customFormations: state.customFormations
    });

    await localforage.setItem('coachMgrData', 'enc:' + encryptData(jsonStr));

    if (state.currentUserRole === 'coach' && state.teamInfo && state.teamInfo.gasApiUrl) {
        syncPushGasCloud(true);
    }
}

function setSyncStateUI(status) {
    const icon = document.getElementById('sync-status-icon');
    const dot = document.getElementById('sync-status-dot');
    const timeEl = document.getElementById('sync-last-time');
    const textEl = document.getElementById('sync-status-text');
    const isCoach = state.currentUserRole === 'coach';

    if (status === 'syncing') {
        if (icon) icon.className = 'fa-solid fa-rotate fa-spin';
        if (dot) dot.className = 'sync-status-dot syncing';
        if (textEl) textEl.textContent = '通信中...';
    } else if (status === 'success') {
        if (icon) icon.className = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        if (dot) dot.className = 'sync-status-dot';

        const now = new Date();
        lastSyncTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (timeEl) timeEl.textContent = `本日 ${lastSyncTimeStr}`;
        if (textEl) textEl.textContent = '最新状態です';
    } else if (status === 'error') {
        if (icon) icon.className = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        if (dot) dot.className = 'sync-status-dot error';
        if (textEl) textEl.textContent = '同期に失敗しました';
    }
}

export function syncPushGasCloud(isSilent = false) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        if (!isSilent) alert('Google Apps Script の Web API URL が設定されていません。');
        return Promise.reject('No URL');
    }

    const payload = {
        action: 'push',
        sheetName: state.teamInfo.gasSheetName || '',
        authToken: state.teamInfo.gasAuthToken || '',
        data: {
            matches: state.matches,
            practices: state.practices,
            players: state.players,
            menuLibrary: state.menuLibrary,
            matchTypes: state.matchTypes,
            menuCategories: state.menuCategories,
            skillMetrics: state.skillMetrics,
            positions: state.positions,
            positionsCat2: state.positionsCat2,
            teamInfo: state.teamInfo,
            customFormations: state.customFormations
        }
    };

    if (!isSilent) showToast('クラウドへ同期中...');

    return fetch(state.teamInfo.gasApiUrl, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(resData => {
            if (resData && resData.status === 'success') {
                if (!isSilent) showToast('クラウドへの送信が完了しました！');
                setSyncStateUI('success');
                return resData;
            } else {
                setSyncStateUI('error');
                throw new Error(resData.message || '同期エラー');
            }
        })
        .catch(err => {
            console.error('GAS Sync Push Error:', err);
            setSyncStateUI('error');
            if (!isSilent) alert(`クラウド送信に失敗しました:\n${err.message || err}`);
        });
}

export function syncPullGasCloud(isSilent = false) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        if (!isSilent) alert('Google Apps Script の Web API URL が設定されていません。');
        return Promise.reject('No URL');
    }

    if (!isSilent) showToast('クラウドからデータを受信中...');

    const sheetParam = state.teamInfo.gasSheetName ? `&sheetName=${encodeURIComponent(state.teamInfo.gasSheetName)}` : '';
    const authParam = state.teamInfo.gasAuthToken ? `&authToken=${encodeURIComponent(state.teamInfo.gasAuthToken)}` : '';
    const fetchUrl = `${state.teamInfo.gasApiUrl}?action=pull${sheetParam}${authParam}&t=${Date.now()}`;

    return fetch(fetchUrl, { method: 'GET', mode: 'cors', redirect: 'follow' })
        .then(res => res.json())
        .then(resData => {
            if (resData && resData.status === 'success' && resData.data) {
                let remoteData = resData.data;
                if (typeof remoteData === 'string') {
                    try { remoteData = JSON.parse(remoteData); } catch (e) { }
                }
                if (remoteData && typeof remoteData === 'object') {
                    state.matches = remoteData.matches || [];
                    state.practices = remoteData.practices || [];
                    state.players = remoteData.players || [];
                    state.menuLibrary = remoteData.menuLibrary || [];
                    saveData();
                    if (!isSilent) showToast('クラウドから最新データを復元しました！');
                    setSyncStateUI('success');

                    // ★ 修正: すでにユーザーが別の画面（試合詳細など）にいる場合は、勝手に画面を強制遷移させない
                    // 初回ロード時（dashboard）以外ならナビゲートを実行しない、または同期完了のトースト・表示更新のみにする
                    if (!state.currentRoute || state.currentRoute === 'dashboard') {
                        navigate('dashboard');
                    }

                    return remoteData;
                }
            }
            setSyncStateUI('error');
            throw new Error('有効なクラウドデータが見つかりませんでした');
        })
        .catch(err => {
            console.error('GAS Sync Pull Error:', err);
            setSyncStateUI('error');
            if (!isSilent) alert(`クラウドからの復元に失敗しました:\n${err.message || err}`);
        });
}

export function openModal(id) {
    if (id === 'modal-menu') {
        const catSel = document.getElementById('menu-category');
        if (catSel) {
            const currentVal = catSel.value;
            catSel.innerHTML = state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
            if (state.menuCategories.includes(currentVal)) catSel.value = currentVal;
            else if (state.menuCategories.length > 0) catSel.value = state.menuCategories[0];
        }
    }
    const modalEl = document.getElementById(id);
    if (modalEl) {
        modalEl.classList.remove('hidden');
        document.body.classList.add('modal-open');

        // ★ 修正: select() を除外し、完全にフォーカスのみにする
        setTimeout(() => {
            const firstInput = modalEl.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput && typeof firstInput.focus === 'function') {
                firstInput.focus();
            }
        }, 100);
    }
}

function openLeaderRankingModal() {
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

    const allScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)));

    const allAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)));

    const renderRankingItem = (item, idx) => {
        return `
            <div style="display:flex; align-items:baseline; margin-bottom:0.3rem; cursor:pointer;" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                <span style="width:1.6rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.4rem; flex-shrink:0;">${idx + 1}.</span>
                <span style="flex:1;"><strong>${item.p.number} ${item.p.name}</strong> (${item.count})</span>
            </div>
        `;
    };

    const elRankingScorers = document.getElementById('ranking-scorers-list');
    if (elRankingScorers) {
        elRankingScorers.innerHTML = allScorers.length > 0
            ? allScorers.map((item, idx) => renderRankingItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">得点記録がありません。</div>';
    }

    const elRankingAssists = document.getElementById('ranking-assists-list');
    if (elRankingAssists) {
        elRankingAssists.innerHTML = allAssists.length > 0
            ? allAssists.map((item, idx) => renderRankingItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">アシスト記録がありません。</div>';
    }

    openModal('modal-leader-ranking');
}

function setupModals() {
    const closeBtns = document.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
            if (openModals.length > 0) {
                openModals[openModals.length - 1].classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        }
    });

    setupScoreCounters();
}

function initDashboard() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // ★ 修正: スコアが存在し、かつ日付が必ず「今日（todayStr）以前」であるものだけに厳格に絞り込む
    const completedMatches = state.matches.filter(m => {
        if (!m.result || !/(\d+)\s*-\s*(\d+)/.test(m.result)) return false;
        // 日付文字列を比較（YYYY-MM-DD形式なので文字列比較で正確に判定可能）
        return m.date <= todayStr;
    });

    let wins = 0, losses = 0, draws = 0;
    completedMatches.forEach(m => {
        const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            const us = parseInt(match[1], 10);
            const them = parseInt(match[2], 10);
            if (us > them) wins++;
            else if (us < them) losses++;
            else draws++;
        }
    });

    const dbRecord = document.getElementById('dash-db-record');
    const dbRecordBar = document.getElementById('dash-db-record-bar');
    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;

    if (dbRecord) dbRecord.innerHTML = `${wins}勝 ${losses}敗 ${draws}分 <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary); margin-left:0.25rem;">(勝率:${winRate}%)</span>`;
    if (dbRecordBar) dbRecordBar.style.width = `${winRate}%`;

    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) cardMatches.onclick = () => navigate('matches');

    const btnGoMatches = document.getElementById('dash-btn-go-matches');
    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');

    const btnGoPlayers = document.getElementById('dash-btn-go-players');
    if (btnGoPlayers) btnGoPlayers.onclick = () => openLeaderRankingModal();

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

    const topScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)))
        .slice(0, 3);

    const topAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)))
        .slice(0, 3);

    const renderDashLeaderItem = (item, idx) => `
        <div style="display:flex; align-items:baseline; margin-bottom:0.25rem; cursor:pointer;" onclick="openPlayerDetail(${item.p.id})">
            <span style="width:1.1rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.25rem; flex-shrink:0; font-size:0.7rem;">${idx + 1}.</span>
            <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${item.p.number} ${item.p.name}</strong> (${item.count})</span>
        </div>
    `;

    const elTopScorers = document.getElementById('dash-top-scorers');
    if (elTopScorers) {
        elTopScorers.innerHTML = topScorers.length > 0
            ? topScorers.map((item, idx) => renderDashLeaderItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.72rem; padding:0.25rem 0;">得点記録なし</div>';
    }

    const elTopAssists = document.getElementById('dash-top-assists');
    if (elTopAssists) {
        elTopAssists.innerHTML = topAssists.length > 0
            ? topAssists.map((item, idx) => renderDashLeaderItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.72rem; padding:0.25rem 0;">アシスト記録なし</div>';
    }

    const matchesContent = document.getElementById('dash-matches-content');
    if (matchesContent) {
        if (completedMatches.length > 0) {
            const sortedMatches = [...completedMatches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            matchesContent.innerHTML = sortedMatches.map(m => {
                const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
                let us = 0, them = 0;
                if (match) {
                    us = parseInt(match[1], 10);
                    them = parseInt(match[2], 10);
                }
                let resultLabel = '引分';
                let badgeClass = 'draw';
                let bgStyle = 'rgba(100,116,139,0.15)';
                let colorStyle = '#475569';
                if (us > them) {
                    resultLabel = '勝ち';
                    badgeClass = 'win';
                    bgStyle = 'var(--primary)';
                    colorStyle = '#ffffff';
                } else if (us < them) {
                    resultLabel = '負け';
                    badgeClass = 'loss';
                }

                const displayScore = match ? `${us} - ${them}` : m.result;

                return `
                    <div class="glass" style="display:flex; flex-direction:column; justify-content:space-between; padding:0.8rem 1rem; border-radius:12px; cursor:pointer; min-height:115px;" onclick="openMatchDetail(${m.id})">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.3rem;">
                            <span class="schedule-badge ${badgeClass}" style="background:${bgStyle}; color:${colorStyle}; font-weight:bold;">${resultLabel}</span>
                            <span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date}</span>
                        </div>
                        <div style="font-size:0.9rem; font-weight:bold; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">vs ${m.opponent}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${m.type}</div>
                        <div style="font-size:1.25rem; font-weight:bold; color:var(--primary); text-align:right;">${displayScore}</div>
                    </div>
                `;
            }).join('');
        } else {
            matchesContent.innerHTML = `
                <div class="text-secondary" style="text-align:center; padding:1.5rem; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--surface-border); grid-column: 1 / -1; width: 100%;">
                    試合記録がありません。<br>
                    <button class="btn btn-primary" id="dash-btn-add-first-match" style="margin-top:0.8rem; font-size:0.8rem; padding:0.4rem 0.8rem;"><i class="fa-solid fa-plus"></i> 最初の試合を記録</button>
                </div>
            `;
            const btnAddFirst = document.getElementById('dash-btn-add-first-match');
            if (btnAddFirst) {
                btnAddFirst.onclick = () => {
                    navigate('matches');
                    setTimeout(() => {
                        const btnAdd = document.getElementById('btn-add-match');
                        if (btnAdd) btnAdd.click();
                    }, 50);
                };
            }
        }
    }

    const allEvents = [];
    state.practices.forEach(p => {
        allEvents.push({
            type: 'practice',
            date: p.date,
            id: p.id,
            title: '練習日',
            desc: p.menus && p.menus.length > 0 ? p.menus.map(m => m.focus).join(', ') : 'メニュー未登録',
            attendance: p.presentPlayerIds ? `${p.presentPlayerIds.length}/${state.players.length}` : p.attendance
        });
    });

    state.matches.forEach(m => {
        const hasResult = m.result && /(\d+)\s*-\s*(\d+)/.test(m.result);
        allEvents.push({
            type: 'match',
            date: m.date,
            id: m.id,
            title: `vs ${m.opponent}`,
            desc: `${m.type}${m.tournament ? ` (${m.tournament})` : ''}`,
            hasResult: hasResult,
            result: m.result
        });
    });

    const upcomingEvents = allEvents.filter(e => e.date >= todayStr).sort((a, b) => new Date(a.date) - new Date(b.date));
    const pastEvents = allEvents.filter(e => e.date < todayStr).sort((a, b) => new Date(b.date) - new Date(a.date));

    const upcomingContent = document.getElementById('dash-upcoming-schedule-content');
    if (upcomingContent) {
        if (upcomingEvents.length > 0) {
            upcomingContent.innerHTML = upcomingEvents.map(e => {
                if (e.type === 'practice') {
                    return `
                        <div class="schedule-item">
                            <div class="schedule-item-info">
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta"><span class="schedule-badge practice">練習</span> <span>${e.date}</span></div>
                                    <div class="schedule-item-title">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <button class="btn btn-secondary btn-sm btn-dash-edit-prac" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-pen"></i> 編集</button>
                                <button class="btn btn-secondary btn-sm" onclick="navigate('practices')" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-chevron-right"></i> 詳細</button>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="schedule-item">
                            <div class="schedule-item-info">
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta"><span class="schedule-badge match">試合予定</span> <span>${e.date}</span></div>
                                    <div class="schedule-item-title">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <button class="btn btn-primary btn-sm btn-dash-score-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-square-poll-horizontal"></i> 結果入力</button>
                                <button class="btn btn-secondary btn-sm btn-dash-edit-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-pen"></i> 編集</button>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        } else {
            upcomingContent.innerHTML = `<div style="text-align:center; padding:1rem; color:var(--text-secondary); font-size:0.85rem;">今後の予定はありません。</div>`;
        }
    }

    const pastContent = document.getElementById('dash-past-schedule-content');
    if (pastContent) {
        const recentPast = pastEvents.slice(0, 3);
        if (recentPast.length > 0) {
            pastContent.innerHTML = recentPast.map(e => {
                if (e.type === 'practice') {
                    return `
                        <div class="schedule-item" style="opacity:0.95;">
                            <div class="schedule-item-info">
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta"><span class="schedule-badge practice" style="opacity:0.8;">練習日履歴</span> <span>${e.date}</span></div>
                                    <div class="schedule-item-title" style="color:var(--text-secondary);">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <span style="font-size:0.75rem; color:var(--text-secondary); margin-right:0.3rem;"><i class="fa-solid fa-users"></i> ${e.attendance || ''}</span>
                                <button class="btn btn-secondary btn-sm" onclick="navigate('practices')" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-chevron-right"></i> 詳細</button>
                            </div>
                        </div>
                    `;
                } else {
                    const resultText = e.hasResult ? `<span style="font-weight:bold; color:var(--primary); font-size:0.85rem;">${e.result}</span>` : `<span style="color:#f59e0b; font-size:0.75rem; font-weight:bold;">結果未入力</span>`;
                    const actionBtn = e.hasResult
                        ? `<button class="btn btn-secondary btn-sm" onclick="openMatchDetail(${e.id})" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i> 詳細</button>`
                        : `<button class="btn btn-primary btn-sm btn-dash-score-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;"><i class="fa-solid fa-square-poll-horizontal"></i> 結果入力</button>`;

                    return `
                        <div class="schedule-item" style="opacity:0.95;">
                            <div class="schedule-item-info">
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta"><span class="schedule-badge match" style="opacity:0.8;">試合履歴</span> <span>${e.date}</span></div>
                                    <div class="schedule-item-title" style="color:var(--text-secondary);">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <div style="margin-right:0.4rem; text-align:right;">${resultText}</div>
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                }
            }).join('');
        } else {
            pastContent.innerHTML = `<div style="text-align:center; padding:1rem; color:var(--text-secondary); font-size:0.85rem;">過去の履歴はありません。</div>`;
        }
    }

    const btnDashAddPrac = document.getElementById('dash-btn-add-practice');
    if (btnDashAddPrac) btnDashAddPrac.onclick = () => openPracticeModal(null);

    const btnDashAddMatch = document.getElementById('dash-btn-add-match');
    if (btnDashAddMatch) btnDashAddMatch.onclick = () => openMatchModal(null);

    document.querySelectorAll('.btn-dash-edit-prac').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openPracticeModal(parseInt(btn.dataset.id, 10));
        };
    });
    document.querySelectorAll('.btn-dash-edit-match').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openMatchModal(parseInt(btn.dataset.id, 10));
        };
    });
    // ★ 修正: ダッシュボードの結果入力ボタンはモーダルではなく試合詳細モーダルを開く
    document.querySelectorAll('.btn-dash-score-match').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openMatchDetail(parseInt(btn.dataset.id, 10));
        };
    });
}

function setupEventListeners() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelectorAll('.nav-links li');
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            navigate(route);
            closeSidebar();
        });
    });

    bottomNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = e.currentTarget.dataset.route;
            navigate(route);
        });
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (sidebar) {
                const isOpen = sidebar.classList.toggle('open');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('open', isOpen);
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    const btnToggleRole = document.getElementById('btn-toggle-role');
    const modalPasscode = document.getElementById('modal-coach-passcode');
    const formPasscode = document.getElementById('form-coach-passcode');
    const inputPasscode = document.getElementById('input-coach-passcode');
    const errorMsg = document.getElementById('passcode-error-msg');

    if (btnToggleRole) {
        // 既存のEventListenerの影響を受けないよう onclick で上書き設定
        btnToggleRole.onclick = (e) => {
            e.preventDefault();

            // 現在がコーチモードの場合：パスコード不要で保護者モードへ
            if (state.currentUserRole === 'coach') {
                state.currentUserRole = 'parent';

                // UIのバッジやボタン状態を更新する関数（プロジェクト内の既存関数）
                if (typeof updateRoleUI === 'function') {
                    updateRoleUI();
                } else {
                    // 手動での表示切り替え（フォールバック）
                    const badge = document.getElementById('user-role-badge');
                    if (badge) {
                        badge.style.background = 'rgba(34, 197, 94, 0.15)';
                        badge.style.color = '#15803d';
                        badge.innerHTML = '<i class="fa-solid fa-eye"></i><span>保護者モード</span>';
                    }
                }

                // 画面表示を再描画
                if (typeof renderCurrentView === 'function') {
                    renderCurrentView();
                } else if (typeof navigate === 'function' && uiState.currentRoute) {
                    navigate(uiState.currentRoute);
                }

                showToast('保護者モード（閲覧専用）に切り替えました');
            }
            // 現在が保護者モードの場合：パスコードモーダルを開く
            else {
                const errorMsg = document.getElementById('passcode-error-msg');
                const inputPass = document.getElementById('input-coach-passcode');

                if (errorMsg) errorMsg.style.display = 'none';
                if (inputPass) inputPass.value = '';

                openModal('modal-coach-passcode');
            }
        };
    }

    if (formPasscode) {
        formPasscode.onsubmit = (e) => {
            e.preventDefault();
            e.stopPropagation(); // ★ 追加: イベント伝播を停止

            const val = inputPasscode ? inputPasscode.value.trim() : '';
            const targetPass = (state.teamInfo && state.teamInfo.passcode) ? state.teamInfo.passcode : '7064';

            // 空文字での誤送信時は何もせずモーダルを維持
            if (!val) {
                return false;
            }

            if (val === targetPass) {
                state.currentUserRole = 'coach';
                if (modalPasscode) modalPasscode.classList.add('hidden');
                document.body.classList.remove('modal-open');
                updateRoleUI();
                navigate('dashboard');
                showToast('コーチモード（編集可能）に切り替えました');
            } else {
                if (errorMsg) errorMsg.style.display = 'block';
                if (inputPasscode) {
                    inputPasscode.focus();
                }
            }
            return false;
        };
    }
}

export function updateRoleUI() {
    const badge = document.getElementById('user-role-badge');
    const btnToggle = document.getElementById('btn-toggle-role');
    const isCoach = state.currentUserRole === 'coach';

    if (badge) {
        if (isCoach) {
            badge.style.background = 'rgba(242, 57, 50, 0.15)';
            badge.style.color = '#ef4444';
            badge.innerHTML = '<i class="fa-solid fa-user-shield"></i> <span>コーチモード</span>';
        } else {
            badge.style.background = 'rgba(34, 197, 94, 0.15)';
            badge.style.color = '#15803d';
            badge.innerHTML = '<i class="fa-solid fa-eye"></i> <span>保護者モード</span>';
        }
    }

    if (btnToggle) {
        btnToggle.innerHTML = '<i class="fa-solid fa-right-left"></i> <span>モード切替</span>';
    }

    const btnSyncStatus = document.getElementById('btn-topbar-sync-status');
    const syncPopover = document.getElementById('sync-popover');
    const btnSyncNow = document.getElementById('btn-popover-sync-now');
    const icon = document.getElementById('sync-status-icon');
    const hasUrl = state.teamInfo && state.teamInfo.gasApiUrl;

    if (btnSyncStatus) {
        btnSyncStatus.style.display = hasUrl ? 'inline-flex' : 'none';
        if (icon && !icon.classList.contains('fa-spin')) {
            icon.className = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        }
        btnSyncStatus.onclick = (e) => {
            e.stopPropagation();
            if (syncPopover) syncPopover.classList.toggle('hidden');
        };
    }

    if (btnSyncNow) {
        btnSyncNow.onclick = () => {
            setSyncStateUI('syncing');
            if (isCoach) {
                syncPushGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            } else {
                syncPullGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            }
        };
    }

    // PCサイドバーのリンク制御
    const settingsLink = document.querySelector('.nav-links li[data-route="settings"]');
    if (settingsLink) settingsLink.style.display = isCoach ? 'flex' : 'none';

    const libraryLink = document.querySelector('.nav-links li[data-route="library"]');
    if (libraryLink) libraryLink.style.display = isCoach ? 'flex' : 'none';

    const dataLink = document.querySelector('.nav-links li[data-route="data"]');
    if (dataLink) dataLink.style.display = isCoach ? 'flex' : 'none';

    // ★ 修正: スマホ下部ナビゲーションのリンク制御（メニュー・設定はコーチ専用）
    const bottomLibrary = document.querySelector('.bottom-nav .nav-item[data-route="library"]');
    const bottomSettings = document.querySelector('.bottom-nav .nav-item[data-route="settings"]');
    if (bottomLibrary) bottomLibrary.style.display = isCoach ? 'flex' : 'none';
    if (bottomSettings) bottomSettings.style.display = isCoach ? 'flex' : 'none';

    const goalShort = document.getElementById('player-goal-short');
    const goalLong = document.getElementById('player-goal-long');
    if (goalShort) {
        if (isCoach) goalShort.removeAttribute('readonly');
        else goalShort.setAttribute('readonly', 'true');
    }
    if (goalLong) {
        if (isCoach) goalLong.removeAttribute('readonly');
        else goalLong.setAttribute('readonly', 'true');
    }

    if (isCoach) {
        document.body.classList.remove('role-read-only');
    } else {
        document.body.classList.add('role-read-only');
    }
}

export function navigate(route, params = null) {
    cleanupCanvasEvents();
    // ★ 追加: 画面遷移時にYouTube音声を停止・破棄する
    if (typeof window.stopAndCleanupYouTube === 'function') {
        window.stopAndCleanupYouTube();
    }
    state.currentRoute = route;

    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    document.body.classList.remove('modal-open');

    const topbarTitle = document.getElementById('topbar-title');
    const navLinks = document.querySelectorAll('.nav-links li');
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');

    navLinks.forEach(link => {
        const isActive = link.dataset.route === route || (route === 'match-detail' && link.dataset.route === 'matches');
        link.classList.toggle('active', isActive);
        if (isActive && topbarTitle) {
            topbarTitle.textContent = (route === 'match-detail') ? '試合詳細' : link.textContent.trim();
        }
    });

    bottomNavLinks.forEach(link => {
        const isActive = link.dataset.route === route || (route === 'match-detail' && link.dataset.route === 'matches');
        link.classList.toggle('active', isActive);
    });

    const viewContainer = document.getElementById('view-container');

    // ★ match-detail の場合は専用テンプレートを参照
    const templateId = (route === 'match-detail') ? 'tpl-match-detail' : `tpl-${route}`;
    const template = document.getElementById(templateId);

    if (template && viewContainer) {
        viewContainer.innerHTML = '';
        viewContainer.appendChild(template.content.cloneNode(true));

        if (route === 'dashboard') initDashboard();
        if (route === 'practices') initPractices(miniPitchObserver);
        if (route === 'matches') initMatches();
        // ★ IDを数値型(parseInt)にキャストして確実に渡す
        if (route === 'match-detail') {
            const rawId = params ? (params.matchId || params.id) : null;
            const matchId = rawId ? parseInt(rawId, 10) : null;
            initMatchDetailView(matchId);
        }
        if (route === 'players') initPlayers();
        if (route === 'library') initLibrary(miniPitchObserver);
        if (route === 'settings') initSettings();
        if (route === 'data') initData();
        if (route === 'animation') initAnimation(params, navigate, openModal);
    }
    updateRoleUI();
}

async function init() {
    await loadData();

    const urlParams = new URLSearchParams(window.location.search);
    const paramApiUrl = urlParams.get('apiUrl');
    const paramAuthToken = urlParams.get('authToken');
    const paramSheetName = urlParams.get('sheetName');

    let isFromInviteLink = false;
    if (paramApiUrl) {
        state.teamInfo.gasApiUrl = paramApiUrl;
        if (paramAuthToken) state.teamInfo.gasAuthToken = paramAuthToken;
        if (paramSheetName) state.teamInfo.gasSheetName = paramSheetName;
        isFromInviteLink = true;

        try {
            const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) { }
    }

    setupEventListeners();
    setupModals();

    document.documentElement.style.setProperty('--primary', state.teamInfo.color);
    const sidebarTitle = document.querySelector('.sidebar-header h2');
    if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${escapeHtml(state.teamInfo.name)}`;

    navigate('dashboard');

    if (state.teamInfo && state.teamInfo.gasApiUrl) {
        if (isFromInviteLink) showToast('招待リンクよりクラウド設定を適用しました！同期中...');
        syncPullGasCloud(true).catch(() => { });
    }
}

document.addEventListener('DOMContentLoaded', init);

window.saveData = saveData;
window.navigate = navigate;
window.openMatchDetail = openMatchDetail;
window.openPlayerDetail = openPlayerDetail;
window.openPracticeModal = openPracticeModal;
window.openMatchModal = openMatchModal;
window.renderPracticeRoster = renderPracticeRoster;
window.initMatchDetailView = initMatchDetailView;