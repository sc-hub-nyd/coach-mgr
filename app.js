// app.js - エントリーポイント
import { state, uiState } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, setupScoreCounters, getNendo } from './utils.js';
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
                // 日付の新しい順 (降順) に並び替え
                state.matches.sort((a, b) => b.date.localeCompare(a.date));
                state.practices.sort((a, b) => b.date.localeCompare(a.date));
                state.players = parsed.players || [];
                state.menuLibrary = parsed.menuLibrary || [];
                state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
                state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
                state.analysisTags = parsed.analysisTags || ['チャンス', '得点', '失点', 'ビルドアップ', '課題/反省', 'メモ'];
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
    // 保存前に日付の新しい順（降順）にソートを確定する
    state.matches.sort((a, b) => b.date.localeCompare(a.date));
    state.practices.sort((a, b) => b.date.localeCompare(a.date));

    const jsonStr = JSON.stringify({
        matches: state.matches,
        practices: state.practices,
        players: state.players,
        menuLibrary: state.menuLibrary,
        matchTypes: state.matchTypes,
        menuCategories: state.menuCategories,
        analysisTags: state.analysisTags,
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

export function openLeaderRankingModal() {
    window.openLeaderRankingModal = openLeaderRankingModal;
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
        // ピリオド別（formations）の得点記録がある場合はそちらを優先（重複集計防止）
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                if (f.goalRecords) {
                    f.goalRecords.forEach(r => {
                        if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                        if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                    });
                }
            });
        } else if (m.goalRecords) {
            // フォーメーションが無い古い試合データ等のためのフォールバック
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

    const renderRankingItem = (item, idx, unit = '') => {
        return `
            <div style="display:flex; align-items:baseline; margin-bottom:0.3rem; cursor:pointer;" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                <span style="width:1.6rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.4rem; flex-shrink:0;">${idx + 1}.</span>
                <span style="flex:1;"><strong>${item.p.number} ${item.p.name}</strong> (${item.count}${unit})</span>
            </div>
        `;
    };


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 出席率の集計 (過去1ヶ月間)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const recentPractices = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
    const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
    const totalRecentEvents = recentPractices.length + recentMatches.length;

    const attendanceCount = {};
    recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id]||0)+1; }));
    recentMatches.forEach(m   => (m.presentPlayerIds  || []).forEach(id => { attendanceCount[id] = (attendanceCount[id]||0)+1; }));

    const allAttendance = state.players.map(p => {
        const count = attendanceCount[p.id] || 0;
        const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
        return { p, count, pct };
    }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number,10)||0) - (parseInt(b.p.number,10)||0));

    // UIパーツ取得
    const elRankingScorers = document.getElementById('ranking-scorers-list');
    if (elRankingScorers) {
        elRankingScorers.innerHTML = allScorers.length > 0
            ? allScorers.map((item, idx) => renderRankingItem(item, idx, '')).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">得点記録がありません。</div>';
    }

    const elRankingAssists = document.getElementById('ranking-assists-list');
    if (elRankingAssists) {
        elRankingAssists.innerHTML = allAssists.length > 0
            ? allAssists.map((item, idx) => renderRankingItem(item, idx, '')).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">アシスト記録がありません。</div>';
    }

    const elRankingAttendance = document.getElementById('ranking-attendance-list');
    if (elRankingAttendance) {
        elRankingAttendance.innerHTML = totalRecentEvents > 0 && allAttendance.some(item => item.count > 0)
            ? allAttendance.map((item, idx) => `
                <div style="display:flex; align-items:baseline; margin-bottom:0.3rem; cursor:pointer;" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                    <span style="width:1.6rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.4rem; flex-shrink:0;">${idx + 1}.</span>
                    <span style="flex:1;"><strong>${item.p.number} ${item.p.name}</strong></span>
                    <span style="font-weight:700; color:var(--primary);">${item.pct}%</span>
                </div>
            `).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">過去1ヶ月の出席データがありません。</div>';
    }

    // 保護者モードかコーチモードかに応じてモーダルの表示カラム数を制御
    const gridCols = document.getElementById('leader-ranking-grid-cols');
    if (gridCols) {
        const isCoach = state.currentUserRole === 'coach';
        if (isCoach) {
            gridCols.style.gridTemplateColumns = '1fr 1fr 1fr';
            // 出席率カラムコンテナを表示する
            if (gridCols.children[2]) gridCols.children[2].style.display = 'block';
        } else {
            gridCols.style.gridTemplateColumns = '1fr 1fr';
            // 出席率カラムコンテナを非表示にする
            if (gridCols.children[2]) gridCols.children[2].style.display = 'none';
        }
    }

    openModal('modal-leader-ranking');
}

export function openSeasonRecordModal() {
    window.openSeasonRecordModal = openSeasonRecordModal;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentNendo = getNendo(todayStr);

    // 有効なスコアがある完了した全試合
    const completedMatches = state.matches.filter(m => {
        return m.result && /([\d]+)\s*-\s*([\d]+)/.test(m.result) && m.date <= todayStr;
    });

    // ── 1. 試合種別ごとの成績 (今年度) ──
    const thisYearMatches = completedMatches.filter(m => getNendo(m.date) === currentNendo);
    const typeStats = {}; // { 公式戦: { win, loss, draw, goals, concede } }

    thisYearMatches.forEach(m => {
        const type = m.type || '未分類';
        if (!typeStats[type]) {
            typeStats[type] = { win: 0, loss: 0, draw: 0, goals: 0, concede: 0 };
        }
        const mt = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
        if (mt) {
            const us = parseInt(mt[1], 10);
            const them = parseInt(mt[2], 10);
            typeStats[type].goals += us;
            typeStats[type].concede += them;
            if (us > them) typeStats[type].win++;
            else if (us < them) typeStats[type].loss++;
            else typeStats[type].draw++;
        }
    });

    const elTypesList = document.getElementById('season-detail-types-list');
    if (elTypesList) {
        const typeKeys = Object.keys(typeStats);
        elTypesList.innerHTML = typeKeys.length > 0
            ? typeKeys.map(type => {
                const stat = typeStats[type];
                const total = stat.win + stat.loss + stat.draw;
                const winRate = total > 0 ? Math.round((stat.win / total) * 100) : 0;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); padding:0.4rem 0.6rem; border-radius:6px; font-size:0.8rem; border:1px solid var(--surface-border);">
                        <span style="font-weight:700; color:var(--text-primary);">${escapeHtml(type)}</span>
                        <div style="text-align:right;">
                            <span style="font-weight:600; color:var(--primary);">${stat.win}勝</span>
                            <span style="color:var(--text-secondary); margin-left:0.2rem;">${stat.loss}敗 ${stat.draw}分</span>
                            <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:0.4rem;">(得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%)</span>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="color:var(--text-secondary); font-size:0.8rem; font-style:italic;">今年度の試合データがありません。</div>';
    }

    // ── 2. 過去年度の成績推移 ──
    const yearStats = {}; // { 2025: { win, loss, draw, goals, concede } }
    completedMatches.forEach(m => {
        const year = getNendo(m.date);
        if (!yearStats[year]) {
            yearStats[year] = { win: 0, loss: 0, draw: 0, goals: 0, concede: 0 };
        }
        const mt = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
        if (mt) {
            const us = parseInt(mt[1], 10);
            const them = parseInt(mt[2], 10);
            yearStats[year].goals += us;
            yearStats[year].concede += them;
            if (us > them) yearStats[year].win++;
            else if (us < them) yearStats[year].loss++;
            else yearStats[year].draw++;
        }
    });

    const elYearsList = document.getElementById('season-detail-years-list');
    if (elYearsList) {
        const sortedYears = Object.keys(yearStats).sort((a, b) => b - a); // 降順
        elYearsList.innerHTML = sortedYears.length > 0
            ? sortedYears.map(year => {
                const stat = yearStats[year];
                const total = stat.win + stat.loss + stat.draw;
                const winRate = total > 0 ? Math.round((stat.win / total) * 100) : 0;
                const isCurrent = parseInt(year, 10) === currentNendo;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:${isCurrent ? 'rgba(242,57,50,0.04)' : 'rgba(0,0,0,0.01)'}; padding:0.4rem 0.6rem; border-radius:6px; font-size:0.8rem; border:1px solid ${isCurrent ? 'var(--primary)' : 'var(--surface-border)'};">
                        <span style="font-weight:700; color:${isCurrent ? 'var(--primary)' : 'var(--text-primary)'};">${year}年度 ${isCurrent ? '<span style="font-size:0.7rem; font-weight:normal;">(今年度)</span>' : ''}</span>
                        <div style="text-align:right;">
                            <span style="font-weight:600; color:${isCurrent ? 'var(--primary)' : 'var(--text-primary)'};">${stat.win}勝</span>
                            <span style="color:var(--text-secondary); margin-left:0.2rem;">${stat.loss}敗 ${stat.draw}分</span>
                            <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:0.4rem;">(得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%)</span>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="color:var(--text-secondary); font-size:0.8rem; font-style:italic;">試合履歴データがありません。</div>';
    }

    openModal('modal-season-record-detail');
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
    const isCoach = state.currentUserRole === 'coach';

    // ── コーチ専用要素の表示制御 ──
    document.querySelectorAll('.coach-only').forEach(el => {
        if (isCoach) {
            el.style.removeProperty('display');
        } else {
            el.style.setProperty('display', 'none', 'important');
        }
    });

    // ── 保護者専用要素の表示制御と「マイ選手」ロジック ──
    const myPlayerBanner = document.getElementById('dash-myplayer-banner');
    const myPlayerSelect = document.getElementById('dash-myplayer-select');
    const myPlayerContent = document.getElementById('dash-myplayer-content');

    if (!isCoach && myPlayerBanner) {
        myPlayerBanner.style.removeProperty('display');

        // セレクトボックスに選手一覧をセット
        if (myPlayerSelect) {
            const savedPlayerId = localStorage.getItem('coachMgrMyPlayerId') || '';
            myPlayerSelect.innerHTML = '<option value="">-- 我が子を選択 --</option>' + 
                state.players.map(p => `<option value="${p.id}" ${savedPlayerId === String(p.id) ? 'selected' : ''}>${p.number} ${escapeHtml(p.name)}</option>`).join('');

            const renderMyPlayerStats = (playerId) => {
                if (!playerId || !myPlayerContent) {
                    myPlayerContent.innerHTML = '<div class="dash-no-data">上のセレクトボックスからマイ選手を設定してください</div>';
                    return;
                }
                const player = state.players.find(p => p.id === parseInt(playerId, 10));
                if (!player) {
                    myPlayerContent.innerHTML = '<div class="dash-no-data">選手が見つかりません</div>';
                    return;
                }

                // 過去1ヶ月の出席率
                const oneMonthAgo = new Date();
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

                const recentPracs = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
                const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
                const totalEvents = recentPracs.length + recentMatches.length;

                let presentCount = 0;
                recentPracs.forEach(p => { if ((p.presentPlayerIds || []).includes(player.id)) presentCount++; });
                recentMatches.forEach(m => { if ((m.presentPlayerIds || []).includes(player.id)) presentCount++; });
                const attendancePct = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0;

                // 通算得点・アシスト
                let goals = 0;
                let assists = 0;
                state.matches.forEach(m => {
                    if (m.formations && m.formations.length > 0) {
                        m.formations.forEach(f => {
                            (f.goalRecords || []).forEach(r => {
                                if (r.scorerId === player.id) goals++;
                                if (r.assistId === player.id) assists++;
                            });
                        });
                    } else {
                        (m.goalRecords || []).forEach(r => {
                            if (r.scorerId === player.id) goals++;
                            if (r.assistId === player.id) assists++;
                        });
                    }
                });

                // 直近のポジティブ評価 (1on1評価やフィードバック)
                let latestFeedback = '登録された直近の評価コメントはありません';
                if (player.oneOnOnes && player.oneOnOnes.length > 0) {
                    const sortedOneOnOnes = [...player.oneOnOnes].sort((a,b) => b.date.localeCompare(a.date));
                    latestFeedback = sortedOneOnOnes[0].note || latestFeedback;
                }

                myPlayerContent.innerHTML = `
                    <div class="dash-myplayer-metric-box">
                        <span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-solid fa-users"></i> 過去1ヶ月の出席率</span>
                        <div class="dash-myplayer-metric-val">${attendancePct}% <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary);">(${presentCount}/${totalEvents}回)</span></div>
                    </div>
                    <div class="dash-myplayer-metric-box">
                        <span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-solid fa-fire" style="color:#ef4444;"></i> 通算スタッツ</span>
                        <div class="dash-myplayer-metric-val">${goals} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary);">得点</span> / ${assists} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary);">アシスト</span></div>
                    </div>
                    <div class="dash-myplayer-comment-box">
                        <strong><i class="fa-solid fa-comment-dots"></i> 指導者からの最新フィードバック・成長記録:</strong>
                        <div style="margin-top:0.3rem; color:var(--text-primary); font-style:italic;">"${latestFeedback}"</div>
                    </div>
                `;
            };

            myPlayerSelect.onchange = (e) => {
                const pid = e.target.value;
                localStorage.setItem('coachMgrMyPlayerId', pid);
                renderMyPlayerStats(pid);
            };

            // 初回ロード表示
            renderMyPlayerStats(savedPlayerId);
        }
    } else if (myPlayerBanner) {
        myPlayerBanner.style.setProperty('display', 'none', 'important');
    }

    // ── 練習＆試合「相関分析」ロジック ──
    const correlationContent = document.getElementById('dash-correlation-content');
    if (correlationContent) {
        // 過去の試合データ(結果あり)
        const scoredMatches = state.matches.filter(m => m.result && /([\d]+)\s*-\s*([\d]+)/.test(m.result));
        if (scoredMatches.length > 0) {
            // テーマごとの試合成績を集計
            // 練習メニューでフォーカスされたカテゴリ
            const themeResults = {}; // { 'ポゼッション': { win: 0, total: 0 } }
            
            // 直近の練習メニューとその日付をマッピング
            const pracMap = {}; // { 'YYYY-MM-DD': [focuses] }
            state.practices.forEach(p => {
                if (p.menus && p.menus.length > 0) {
                    pracMap[p.date] = p.menus.map(mn => mn.focus).filter(Boolean);
                }
            });

            scoredMatches.forEach(m => {
                const mt = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
                if (mt) {
                    const us = parseInt(mt[1], 10), them = parseInt(mt[2], 10);
                    const isWin = us > them;
                    
                    // 試合日以前の直近1週間の練習テーマを探す
                    const matchDate = new Date(m.date);
                    const themesSeen = new Set();
                    
                    for (let i = 1; i <= 7; i++) {
                        const checkDate = new Date(matchDate);
                        checkDate.setDate(checkDate.getDate() - i);
                        const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                        if (pracMap[checkDateStr]) {
                            pracMap[checkDateStr].forEach(t => themesSeen.add(t));
                        }
                    }

                    themesSeen.forEach(theme => {
                        if (!themeResults[theme]) themeResults[theme] = { win: 0, total: 0 };
                        themeResults[theme].total++;
                        if (isWin) themeResults[theme].win++;
                    });
                }
            });

            const correlationItems = Object.entries(themeResults)
                .map(([theme, data]) => {
                    const winPct = data.total > 0 ? Math.round((data.win / data.total) * 100) : 0;
                    return { theme, winPct, total: data.total };
                })
                .sort((a, b) => b.winPct - a.winPct)
                .slice(0, 3);

            if (correlationItems.length > 0) {
                correlationContent.innerHTML = correlationItems.map(item => {
                    let trendClass = 'neutral';
                    let trendIcon = 'fa-minus';
                    let trendLabel = '普通';
                    if (item.winPct >= 65) {
                        trendClass = 'up';
                        trendIcon = 'fa-trending-up';
                        trendLabel = '相関高(好調)';
                    } else if (item.winPct <= 35) {
                        trendClass = 'down';
                        trendIcon = 'fa-trending-down';
                        trendLabel = '改善必要';
                    }
                    return `
                        <div class="dash-correlation-row">
                            <div style="font-weight:600;">${escapeHtml(item.theme)} <span style="font-weight:normal; font-size:0.7rem; color:var(--text-secondary);">(${item.total}試合前練習)</span></div>
                            <div class="dash-correlation-trend ${trendClass}">
                                <i class="fa-solid ${trendIcon}"></i> 勝率 ${item.winPct}% (${trendLabel})
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                correlationContent.innerHTML = '<div class="dash-no-data" style="padding:0.5rem 0;">直前1週間にテーマ練習のある試合履歴が不足しています</div>';
            }
        } else {
            correlationContent.innerHTML = '<div class="dash-no-data" style="padding:0.5rem 0;">相関分析に必要な試合データがありません</div>';
        }
    }

    // ── 選手コンディション・出場時間平準化アラート ──
    const playtimeContent = document.getElementById('dash-playtime-content');
    if (playtimeContent) {
        // 直近5試合を抽出
        const recent5Matches = state.matches
            .filter(m => m.date <= todayStr && m.result)
            .sort((a,b) => b.date.localeCompare(a.date))
            .slice(0, 5);

        if (recent5Matches.length > 0) {
            // 各選手の出場ピリオド数を集計する
            const playerPlayTimes = {}; // { playerId: count }
            state.players.forEach(p => { playerPlayTimes[p.id] = 0; });

            let totalPeriods = 0;
            recent5Matches.forEach(m => {
                if (m.formations && m.formations.length > 0) {
                    m.formations.forEach(f => {
                        totalPeriods++;
                        // 該当ピリオドに配置されているメンバーをチェック
                        if (f.coords) {
                            f.coords.forEach(coord => {
                                if (coord.playerId) {
                                    playerPlayTimes[coord.playerId] = (playerPlayTimes[coord.playerId] || 0) + 1;
                                }
                            });
                        }
                    });
                }
            });

            // プレイヤーごとの出場割合を算出
            const playRateList = state.players.map(p => {
                const count = playerPlayTimes[p.id] || 0;
                const pct = totalPeriods > 0 ? Math.round((count / totalPeriods) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => a.pct - b.pct); // 低い順(アラート対象)

            // 出場時間が特に少ない（20%以下）選手、または下位3名を表示
            const alertPlayers = playRateList.slice(0, 3);
            if (alertPlayers.length > 0 && totalPeriods > 0) {
                playtimeContent.innerHTML = alertPlayers.map(item => `
                    <div class="dash-playtime-row">
                        <div style="font-weight:600; width:5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.p.number} ${escapeHtml(item.p.name)}</div>
                        <div class="dash-playtime-bar-outer">
                            <div class="dash-playtime-bar-inner" style="width: ${item.pct}%;"></div>
                        </div>
                        <div style="font-weight:700; color:${item.pct} < 30 ? 'var(--primary)' : 'var(--text-secondary)';">${item.pct}% <span style="font-size:0.68rem; font-weight:normal;">(${item.count}/${totalPeriods}P)</span></div>
                    </div>
                `).join('');
            } else {
                playtimeContent.innerHTML = '<div class="dash-no-data" style="padding:0.5rem 0;">フォーメーション登録データがありません</div>';
            }
        } else {
            playtimeContent.innerHTML = '<div class="dash-no-data" style="padding:0.5rem 0;">出場時間の集計対象となる最近の試合データがありません</div>';
        }
    }


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 1: アラートバナー（コーチ専用）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const alertBanner = document.getElementById('dash-alert-banner');
    const alertText   = document.getElementById('dash-alert-text');
    const alertAction = document.getElementById('dash-alert-action');
    if (isCoach && alertBanner) {
        // ピリオド（formations）が未登録の過去試合を検出
        const pendingMatches = state.matches.filter(m => {
            if (!m.date || m.date > todayStr) return false; // 未来の試合は対象外
            return !m.formations || m.formations.length === 0; // ピリオド未登録
        });
        if (pendingMatches.length > 0) {
            alertBanner.style.removeProperty('display'); // coach-only で表示されるよう inline style を除去
            if (alertText) alertText.textContent = `ピリオドが未登録の試合が ${pendingMatches.length} 件あります`;
            if (alertAction) {
                alertAction.onclick = () => {
                    // 最初の未登録試合の詳細を開く
                    const firstPending = pendingMatches.sort((a, b) => b.date.localeCompare(a.date))[0];
                    if (firstPending) openMatchDetail(firstPending.id);
                    else navigate('matches');
                };
            }
        } else {
            alertBanner.style.setProperty('display', 'none', 'important');
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 2-left: 次の予定カード
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allFutureEvents = [];
    state.practices.forEach(p => allFutureEvents.push({
        type: 'practice', date: p.date, id: p.id, title: '練習'
    }));
    state.matches.forEach(m => allFutureEvents.push({
        type: 'match', date: m.date, id: m.id,
        title: `vs ${m.opponent || '対戦相手'}`,
        subType: m.type, tournament: m.tournament
    }));

    const nextEvent = allFutureEvents
        .filter(e => e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))[0];

    const nextEventContent = document.getElementById('dash-next-event-content');
    const nextEventCard    = document.getElementById('dash-next-event-card');
    if (nextEventContent) {
        if (nextEvent) {
            const dateObj    = new Date(nextEvent.date + 'T00:00:00');
            const dayNames   = ['日', '月', '火', '水', '木', '金', '土'];
            const dateLabel  = `${nextEvent.date.replace(/-/g, '/')} (${dayNames[dateObj.getDay()]})`;
            const todayObj   = new Date(todayStr + 'T00:00:00');
            const diffDays   = Math.round((dateObj - todayObj) / (1000 * 60 * 60 * 24));
            const countdownLabel = diffDays === 0 ? '今日！' : diffDays === 1 ? '明日' : `あと${diffDays}日`;
            const typeClass  = nextEvent.type === 'match' ? 'match' : 'practice';
            const typeLabel  = nextEvent.type === 'match' ? '試合' : '練習';
            const subLine    = nextEvent.subType
                ? nextEvent.subType + (nextEvent.tournament ? ` (${nextEvent.tournament})` : '')
                : '';

            nextEventContent.innerHTML = `
                <span class="dash-next-event-type ${typeClass}">${typeLabel}</span>
                <div class="dash-next-event-title">${escapeHtml(nextEvent.title)}</div>
                <div class="dash-next-event-date">${dateLabel}${subLine ? ' · ' + escapeHtml(subLine) : ''}</div>
                <span class="dash-next-event-countdown">${countdownLabel}</span>
            `;
            if (nextEventCard) {
                nextEventCard.style.cursor = 'pointer';
                nextEventCard.onclick = () => nextEvent.type === 'match'
                    ? openMatchDetail(nextEvent.id)
                    : navigate('practices', { date: nextEvent.date });
            }
        } else {
            nextEventContent.innerHTML = '<div class="dash-no-data">予定はありません</div>';
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 2-right: 今季成績カード
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 今年度（今日の日付基準の年度）を求める
    const currentNendo = getNendo(todayStr);

    const completedMatches = state.matches.filter(m => {
        if (!m.result || !(/([\d]+)\s*-\s*([\d]+)/.test(m.result))) return false;
        return m.date <= todayStr;
    });

    // 今年度の試合のみ抽出
    const thisYearMatches = completedMatches.filter(m => getNendo(m.date) === currentNendo);

    let wins = 0, losses = 0, draws = 0, totalGoals = 0, totalConceded = 0;
    thisYearMatches.forEach(m => {
        const mt = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
        if (mt) {
            const us = parseInt(mt[1], 10), them = parseInt(mt[2], 10);
            totalGoals += us; totalConceded += them;
            if (us > them) wins++;
            else if (us < them) losses++;
            else draws++;
        }
    });


    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    const setEl   = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML  = val; };

    setEl('dash-record-win',   wins);
    setEl('dash-record-loss',  losses);
    setEl('dash-record-draw',  draws);
    setHtml('dash-record-goals',   `<i class="fa-solid fa-futbol"></i> 得点: ${totalGoals}`);
    setHtml('dash-record-concede', `<i class="fa-solid fa-shield-halved"></i> 失点: ${totalConceded}`);
    setEl('dash-db-record', `勝率 ${winRate}%`);
    const elBar = document.getElementById('dash-db-record-bar');
    if (elBar) elBar.style.width = `${winRate}%`;
    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) cardMatches.onclick = () => openSeasonRecordModal();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 3: 直近フォームバー
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const formBar = document.getElementById('dash-form-bar');
    if (formBar) {
        const recentMatches = [...completedMatches]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 7);
        if (recentMatches.length > 0) {
            formBar.innerHTML = recentMatches.map(m => {
                const mt   = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
                const us   = mt ? parseInt(mt[1], 10) : 0;
                const them = mt ? parseInt(mt[2], 10) : 0;
                let cls = 'draw', label = '分';
                if (us > them)      { cls = 'win';  label = '勝'; }
                else if (us < them) { cls = 'loss'; label = '負'; }
                const oppShort = (m.opponent || '').replace(/AFC|SFC|FC|SC/gi, '').trim().slice(0, 4) || 'vs';
                return `
                    <div class="dash-form-item" title="${escapeHtml(m.opponent)} ${m.result}" onclick="openMatchDetail(${m.id})">
                        <div class="dash-form-badge-lg ${cls}">${label}</div>
                        <div class="dash-form-score">${us}-${them}</div>
                        <div class="dash-form-opponent">${escapeHtml(oppShort)}</div>
                    </div>
                `;
            }).join('');
        } else {
            formBar.innerHTML = '<div class="dash-no-data">試合記録がありません</div>';
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 4: 得点 / アシストランキング
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                (f.goalRecords || []).forEach(r => {
                    if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                    if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                });
            });
        } else {
            (m.goalRecords || []).forEach(r => {
                if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
            });
        }
    });

    const medals = ['🥇', '🥈', '🥉'];
    const renderRankList = (counts, unit, containerId) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        const top = Object.entries(counts)
            .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
            .filter(x => x.p)
            .sort((a, b) => b.count - a.count || (parseInt(a.p.number,10)||0) - (parseInt(b.p.number,10)||0))
            .slice(0, 3);
        el.innerHTML = top.length > 0
            ? top.map((item, idx) => `
                <div class="dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                    <span class="dash-rank-medal">${medals[idx] || (idx+1)+'.'}</span>
                    <span class="dash-rank-name">${item.p.number} ${escapeHtml(item.p.name)}</span>
                    <span class="dash-rank-count">${item.count}<span class="dash-rank-count-unit">${unit}</span></span>
                </div>
            `).join('')
            : '<div class="dash-no-data">記録なし</div>';
    };
    renderRankList(scorerCounts, '得点', 'dash-top-scorers');
    renderRankList(assistCounts, 'A',   'dash-top-assists');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 5: スケジュールリスト
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scheduleList = document.getElementById('dash-schedule-list');
    if (scheduleList) {
        const allEvents = [];
        state.practices.forEach(p => allEvents.push({
            type: 'practice', date: p.date, id: p.id, title: '練習',
            sub: p.menus && p.menus.length > 0 ? p.menus.map(mn => mn.focus).join(', ') : '',
            attendance: p.presentPlayerIds ? `${p.presentPlayerIds.length}/${state.players.length}名` : null
        }));
        state.matches.forEach(m => {
            const hasResult = m.result && /([\d]+)\s*-\s*([\d]+)/.test(m.result);
            let resultCls = 'tbd', resultLabel = '未入力';
            if (hasResult) {
                const mt = m.result.match(/([\d]+)\s*-\s*([\d]+)/);
                const us = parseInt(mt[1],10), them = parseInt(mt[2],10);
                if (us > them)      { resultCls = 'win';  resultLabel = `${us}-${them} 勝`; }
                else if (us < them) { resultCls = 'loss'; resultLabel = `${us}-${them} 負`; }
                else                { resultCls = 'draw'; resultLabel = `${us}-${them} 分`; }
            }
            allEvents.push({
                type: 'match', date: m.date, id: m.id,
                title: `vs ${m.opponent || '対戦相手'}`,
                sub: m.type + (m.tournament ? ` (${m.tournament})` : ''),
                hasResult, resultCls, resultLabel
            });
        });

        const futureEvents  = allEvents.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);
        const pastEvents    = allEvents.filter(e => e.date  < todayStr).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
        const displayEvents = [...futureEvents, ...pastEvents];

        if (displayEvents.length > 0) {
            const dayNames = ['日','月','火','水','木','金','土'];
            scheduleList.innerHTML = displayEvents.map(e => {
                const isPast    = e.date < todayStr;
                const dateObj   = new Date(e.date + 'T00:00:00');
                const dateLabel = `${e.date.replace(/-/g,'/')} (${dayNames[dateObj.getDay()]})`;

                const rightHtml = e.type === 'match'
                    ? `<span class="dash-schedule-result-badge ${e.resultCls}">${escapeHtml(e.resultLabel)}</span>`
                    : (e.attendance ? `<span style="font-size:0.7rem; color:var(--text-secondary);"><i class="fa-solid fa-users"></i> ${e.attendance}</span>` : '');

                let actionsHtml = '';
                if (isCoach) {
                    if (e.type === 'practice') {
                        actionsHtml = `
                            <button class="btn btn-secondary btn-sm dash-sch-edit-prac" data-id="${e.id}" style="padding:0.1rem 0.3rem; font-size:0.62rem; height:20px;" title="編集"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-secondary btn-sm" onclick="navigate('practices', { date: '${e.date}' })" style="padding:0.1rem 0.3rem; font-size:0.62rem; height:20px;"><i class="fa-solid fa-chevron-right"></i></button>
                        `;
                    } else {
                        actionsHtml = `
                            <button class="btn btn-secondary btn-sm dash-sch-edit-match" data-id="${e.id}" style="padding:0.1rem 0.3rem; font-size:0.62rem; height:20px;" title="編集"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-secondary btn-sm" onclick="openMatchDetail(${e.id})" style="padding:0.1rem 0.3rem; font-size:0.62rem; height:20px;"><i class="fa-solid fa-circle-info"></i></button>
                        `;
                    }
                } else {
                    const dest = e.type === 'match' ? `openMatchDetail(${e.id})` : `navigate('practices', { date: '${e.date}' })`;
                    actionsHtml = `<button class="btn btn-secondary btn-sm" onclick="${dest}" style="padding:0.1rem 0.3rem; font-size:0.62rem; height:20px;"><i class="fa-solid fa-chevron-right"></i></button>`;
                }

                return `
                    <div class="dash-schedule-row${isPast ? ' past' : ''}">
                        <div class="dash-schedule-icon ${e.type}">
                            <i class="fa-solid ${e.type === 'match' ? 'fa-futbol' : 'fa-whistle'}"></i>
                        </div>
                        <div class="dash-schedule-info">
                            <div class="dash-schedule-row-title">${escapeHtml(e.title)}</div>
                            <div class="dash-schedule-row-sub">${dateLabel}${e.sub ? ' · ' + escapeHtml(e.sub) : ''}</div>
                        </div>
                        <div class="dash-schedule-row-right">
                            ${rightHtml}
                            <div class="dash-schedule-row-actions">${actionsHtml}</div>
                        </div>
                    </div>
                `;
            }).join('');

            scheduleList.querySelectorAll('.dash-sch-edit-prac').forEach(btn => {
                btn.onclick = ev => { ev.stopPropagation(); openPracticeModal(parseInt(btn.dataset.id, 10)); };
            });
            scheduleList.querySelectorAll('.dash-sch-edit-match').forEach(btn => {
                btn.onclick = ev => { ev.stopPropagation(); openMatchModal(parseInt(btn.dataset.id, 10)); };
            });
        } else {
            scheduleList.innerHTML = '<div class="dash-no-data" style="text-align:center; padding:1rem 0;">練習・試合の予定がありません</div>';
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 5: コーチ専用 — 出席率ランキング & 練習テーマ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (isCoach) {
        // 過去1ヶ月（30日前まで）の基準日を計算
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

        const recentPractices = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
        const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
        const totalRecentEvents = recentPractices.length + recentMatches.length;

        const attendanceCount = {};
        recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id]||0)+1; }));
        recentMatches.forEach(m   => (m.presentPlayerIds  || []).forEach(id => { attendanceCount[id] = (attendanceCount[id]||0)+1; }));

        const attendanceRankEl = document.getElementById('dash-attendance-rank');
        if (attendanceRankEl) {
            const top = state.players.map(p => {
                const count = attendanceCount[p.id] || 0;
                const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number,10)||0) - (parseInt(b.p.number,10)||0))
              .slice(0, 3);

            attendanceRankEl.innerHTML = totalRecentEvents > 0 && top.some(item => item.count > 0)
                ? top.map((item, idx) => `
                    <div class="dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                        <span class="dash-rank-medal">${medals[idx]||(idx+1)+'.'}</span>
                        <span class="dash-rank-name">${item.p.number} ${escapeHtml(item.p.name)}</span>
                        <span class="dash-rank-count">${item.pct}<span class="dash-rank-count-unit">%</span></span>
                    </div>
                `).join('')
                : '<div class="dash-no-data">過去1ヶ月の出席記録なし</div>';
        }

        const practiceFocusEl = document.getElementById('dash-recent-practice-focus');
        if (practiceFocusEl) {
            const displayPractices = [...state.practices]
                .filter(p => p.date <= todayStr)
                .sort((a,b) => b.date.localeCompare(a.date))
                .slice(0, 3);
            practiceFocusEl.innerHTML = displayPractices.length > 0
                ? displayPractices.map(p => {
                    const focuses = p.menus && p.menus.length > 0
                        ? p.menus.map(mn => escapeHtml(mn.focus)).join(' / ')
                        : 'メニュー未記録';
                    return `
                        <div class="dash-rank-item" onclick="event.stopPropagation(); navigate('practices', { date: '${p.date}' })">
                            <span class="dash-rank-medal" style="font-size:0.75rem;">📅</span>
                            <div style="flex:1; min-width:0;">
                                <div style="font-size:0.72rem; color:var(--text-secondary);">${p.date}</div>
                                <div style="font-size:0.78rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${focuses}</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<div class="dash-no-data">練習記録なし</div>';
        }
    }


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ボタンイベント設定
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const btnGoMatches = document.getElementById('dash-btn-go-matches');
    const btnGoPlayers = document.getElementById('dash-btn-go-players');
    const btnAddPrac   = document.getElementById('dash-btn-add-practice');
    const btnAddMatch  = document.getElementById('dash-btn-add-match');

    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');
    if (btnGoPlayers) btnGoPlayers.onclick = () => openLeaderRankingModal();
    if (btnAddPrac)   btnAddPrac.onclick   = () => openPracticeModal(null);
    if (btnAddMatch)  btnAddMatch.onclick  = () => openMatchModal(null);
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

        // ポップオーバーの外側をクリックしたら閉じる（一度だけ登録）
        const wrapper = document.querySelector('.sync-status-wrapper');
        if (wrapper && !wrapper._outsideClickBound) {
            wrapper._outsideClickBound = true;
            document.addEventListener('click', (e) => {
                if (syncPopover && !syncPopover.classList.contains('hidden')) {
                    if (!wrapper.contains(e.target)) {
                        syncPopover.classList.add('hidden');
                    }
                }
            });
        }
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

    // ロール切り替え完了後、現在ダッシュボード表示中なら即時再描画（ウィジェット切り替え）
    if (uiState.currentRoute === 'dashboard') {
        initDashboard();
    }
}

export function navigate(route, params = null) {
    cleanupCanvasEvents();
    // 画面遷移時にYouTube音声を停止・破棄する
    if (typeof window.stopAndCleanupYouTube === 'function') {
        window.stopAndCleanupYouTube();
    }
    // 画面遷移時にクラウド同期ポップオーバーを閉じる
    const syncPopoverOnNav = document.getElementById('sync-popover');
    if (syncPopoverOnNav) syncPopoverOnNav.classList.add('hidden');

    state.currentRoute = route;
    uiState.currentRoute = route;

    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    document.body.classList.remove('modal-open');

    const topbarTitle = document.getElementById('topbar-title');
    const topbarBack = document.getElementById('topbar-back');
    const navLinks = document.querySelectorAll('.nav-links li');
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');

    if (topbarBack) {
        if (route === 'match-detail') {
            topbarBack.classList.remove('hidden');
            topbarBack.onclick = () => navigate('matches');
        } else {
            topbarBack.classList.add('hidden');
            topbarBack.onclick = null;
        }
    }

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

        // 画面遷移時はスクロール位置をトップにリセット
        viewContainer.scrollTop = 0;
        window.scrollTo(0, 0);

        // 画面遷移のたびに各フィルタリング情報を初期状態にリセット
        uiState.currentMatchNendo = 'all';
        uiState.currentMatchPage = 1;
        uiState.currentPracticeNendo = 'all';
        uiState.currentPracticeMonth = 'all';
        uiState.currentPracticePage = 1;
        uiState.currentLibraryCategory = 'all';

        if (route === 'dashboard') initDashboard();
        if (route === 'practices') {
            if (params && params.date) {
                const parts = params.date.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const monthNum = parseInt(parts[1], 10);
                    const nendo = (monthNum >= 4) ? year : year - 1;
                    uiState.currentPracticeNendo = String(nendo);
                    uiState.currentPracticeMonth = parts[1];
                }
            }
            initPractices(miniPitchObserver);
        }
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
    window.openLeaderRankingModal = openLeaderRankingModal;
    window.openSeasonRecordModal = openSeasonRecordModal;
    window.openPlayerDetail = openPlayerDetail;
    window.navigate = navigate;
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