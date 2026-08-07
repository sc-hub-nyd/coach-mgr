// app.js - エントリーポイント
import { state, uiState } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, setupScoreCounters, getNendo } from './utils.js';
import { initPractices, openPracticeModal, renderPracticeRoster } from './practices.js';
import { initMatches, openMatchModal, openMatchDetail, initMatchDetailView, getMatchStatus, copyMatchShareText } from './matches.js';
import { initPlayers, openPlayerDetail } from './players.js';
import { initLibrary } from './library.js';
import { initTactics } from './tactics.js';
import { initSettings, initData } from './settings.js';
import { initAnimation, cleanupCanvasEvents, drawPitchToCtx } from './drawing.js';
import { cleanupScope } from './event-manager.js';
import { APP_VERSION, RELEASE_DATE, RELEASE_NOTES } from './version.js';

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
                state.matches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
                state.practices.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
                state.players = parsed.players || [];
                state.menuLibrary = parsed.menuLibrary || [];
                state.tactics = parsed.tactics || [];
                state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
                state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
                const newTacticsDefaults = ['攻撃：ビルドアップ（自陣）', '攻撃：前進・崩し（中盤〜敵陣）', '守備：ハイプレス（前線）', '守備：ブロック・ゴール前（自陣）', '切り替え：攻→守（奪われたとき）', '切り替え：守→攻（奪ったとき）', 'セットプレー', 'その他'];
                const loadedTacticsCat = parsed.tacticsCategories || [];
                const isOldTacticsCat = loadedTacticsCat.length === 0 || 
                    loadedTacticsCat.includes('トランジション') || 
                    loadedTacticsCat.includes('プレッシング') ||
                    (loadedTacticsCat.includes('攻撃') && !loadedTacticsCat.includes('攻撃：ビルドアップ（自陣）'));

                if (isOldTacticsCat) {
                    state.tacticsCategories = [...newTacticsDefaults];
                    const catMap = {
                        'ビルドアップ': '攻撃：ビルドアップ（自陣）',
                        '攻撃': '攻撃：前進・崩し（中盤〜敵陣）',
                        'プレッシング': '守備：ハイプレス（前線）',
                        '守備': '守備：ブロック・ゴール前（自陣）',
                        'トランジション': '切り替え：攻→守（奪われたとき）',
                        'セットプレー': 'セットプレー'
                    };
                    if (state.tactics) {
                        state.tactics.forEach(t => {
                            if (t.category && catMap[t.category]) {
                                t.category = catMap[t.category];
                            } else if (t.category && !newTacticsDefaults.includes(t.category)) {
                                t.category = 'その他';
                            }
                        });
                    }
                } else {
                    state.tacticsCategories = loadedTacticsCat;
                }

                state.analysisTags = parsed.analysisTags || ['チャンス', '得点', '失点', 'ビルドアップ', '課題/反省', 'メモ'];
                state.skillMetrics = parsed.skillMetrics || ['止める・蹴る', '運ぶ・駆け引き', '認知・スキャニング', '判断・ポジショニング', '切り替え・連続性', 'チャレンジ姿勢'];
                state.positions = parsed.positions || ['GK', 'DF', 'MF', 'FW'];
                state.positionsCat2 = parsed.positionsCat2 || ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'];
                state.teamInfo = parsed.teamInfo || { name: 'My Team', color: '#f23932', passcode: '7064' };
                if (!state.teamInfo.passcode) state.teamInfo.passcode = '7064';
                state.customFormations = parsed.customFormations || state.customFormations;
                state.teamFocus = parsed.teamFocus || {}; // ★【追加】チーム強化テーマの読み込み
            }
        }
        // 起動時はセキュリティと誤操作防止のため、常に保護者モード（閲覧専用）で初期化
        state.currentUserRole = 'parent';
        localStorage.removeItem('currentUserRole');
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

export async function saveData() {
    state.matches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
    state.practices.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));

    const jsonStr = JSON.stringify({
        matches: state.matches,
        practices: state.practices,
        players: state.players,
        menuLibrary: state.menuLibrary,
        tactics: state.tactics,
        matchTypes: state.matchTypes,
        menuCategories: state.menuCategories,
        tacticsCategories: state.tacticsCategories,
        analysisTags: state.analysisTags,
        skillMetrics: state.skillMetrics,
        positions: state.positions,
        positionsCat2: state.positionsCat2,
        teamInfo: state.teamInfo,
        customFormations: state.customFormations,
        teamFocus: state.teamFocus || {} // ★【追加】チーム強化テーマの保存
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
            tactics: state.tactics || [],
            matchTypes: state.matchTypes,
            menuCategories: state.menuCategories,
            tacticsCategories: state.tacticsCategories,
            analysisTags: state.analysisTags, // ★【追加】動画分析タグ
            skillMetrics: state.skillMetrics,
            positions: state.positions,
            positionsCat2: state.positionsCat2,
            teamInfo: state.teamInfo,
            customFormations: state.customFormations,
            teamFocus: state.teamFocus || {} // ★【追加】チーム強化テーマ
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
                    if (remoteData.matches) state.matches = remoteData.matches;
                    if (remoteData.practices) state.practices = remoteData.practices;
                    if (remoteData.players) state.players = remoteData.players;
                    if (remoteData.menuLibrary) state.menuLibrary = remoteData.menuLibrary;
                    if (remoteData.tactics) state.tactics = remoteData.tactics;

                    // ★【追加】マスタ・設定データの受信展開
                    if (remoteData.matchTypes) state.matchTypes = remoteData.matchTypes;
                    if (remoteData.menuCategories) state.menuCategories = remoteData.menuCategories;
                    if (remoteData.tacticsCategories) state.tacticsCategories = remoteData.tacticsCategories;

                    const newTacticsDefaults = ['攻撃：ビルドアップ（自陣）', '攻撃：前進・崩し（中盤〜敵陣）', '守備：ハイプレス（前線）', '守備：ブロック・ゴール前（自陣）', '切り替え：攻→守（奪われたとき）', '切り替え：守→攻（奪ったとき）', 'セットプレー', 'その他'];
                    const loadedTacticsCat = state.tacticsCategories || [];
                    const isOldTacticsCat = loadedTacticsCat.length === 0 || 
                        loadedTacticsCat.includes('トランジション') || 
                        loadedTacticsCat.includes('プレッシング') ||
                        (loadedTacticsCat.includes('攻撃') && !loadedTacticsCat.includes('攻撃：ビルドアップ（自陣）'));

                    if (isOldTacticsCat) {
                        state.tacticsCategories = [...newTacticsDefaults];
                        const catMap = {
                            'ビルドアップ': '攻撃：ビルドアップ（自陣）',
                            '攻撃': '攻撃：前進・崩し（中盤〜敵陣）',
                            'プレッシング': '守備：ハイプレス（前線）',
                            '守備': '守備：ブロック・ゴール前（自陣）',
                            'トランジション': '切り替え：攻→守（奪われたとき）',
                            'セットプレー': 'セットプレー'
                        };
                        if (state.tactics) {
                            state.tactics.forEach(t => {
                                if (t.category && catMap[t.category]) {
                                    t.category = catMap[t.category];
                                } else if (t.category && !newTacticsDefaults.includes(t.category)) {
                                    t.category = 'その他';
                                }
                            });
                        }
                    }

                    if (remoteData.analysisTags) state.analysisTags = remoteData.analysisTags;
                    if (remoteData.skillMetrics) state.skillMetrics = remoteData.skillMetrics;
                    if (remoteData.positions) state.positions = remoteData.positions;
                    if (remoteData.positionsCat2) state.positionsCat2 = remoteData.positionsCat2;
                    if (remoteData.customFormations) state.customFormations = remoteData.customFormations;
                    if (remoteData.teamFocus) state.teamFocus = remoteData.teamFocus;
                    if (remoteData.teamInfo) {
                        state.teamInfo = { ...state.teamInfo, ...remoteData.teamInfo };
                    }

                    saveData();
                    if (!isSilent) showToast('クラウドから最新データを復元しました！');
                    setSyncStateUI('success');

                    if (!state.currentRoute || state.currentRoute === 'dashboard') {
                        navigate('dashboard');
                    } else {
                        navigate(state.currentRoute);
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

export function openLeaderRankingModal(type = 'all') {
    window.openLeaderRankingModal = openLeaderRankingModal;
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
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
            m.goalRecords.forEach(r => {
                if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
            });
        }
    });

    const allScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)));

    const allAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)));

    const renderRankingItem = (item, idx, unit = '') => {
        const numStr = item.p.number ? `#${item.p.number}` : '';
        return `
            <div class="u-ext-1" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                <span class="u-ext-2">${idx + 1}.</span>
                <span class="u-ext-3">
                    <span class="rank-player-num">${numStr}</span>
                    <span class="rank-player-name">${escapeHtml(item.p.name)}</span>
                    <span class="rank-player-count">(${item.count}${unit})</span>
                </span>
            </div>
        `;
    };

    // 1. 出席率集計 (過去1ヶ月間)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const recentPractices = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
    const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
    const totalRecentEvents = recentPractices.length + recentMatches.length;

    const attendanceCount = {};
    recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));
    recentMatches.forEach(m => (m.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));

    const allAttendance = state.players.map(p => {
        const count = attendanceCount[p.id] || 0;
        const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
        return { p, count, pct };
    }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0));

    // 2. 出場時間集計 (直近5試合)
    const recent5Matches = state.matches
        .filter(m => m && m.date && m.date <= todayStr && m.result)
        .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
        .slice(0, 5);

    const playerPlayTimes = {};
    state.players.forEach(p => { playerPlayTimes[p.id] = 0; });
    let totalPeriods = 0;

    recent5Matches.forEach(m => {
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                if (f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'))) return;
                totalPeriods++;

                const starterPlayerIds = new Set();
                if (f.lineup && Array.isArray(f.lineup)) {
                    f.lineup.forEach(l => { if (l.playerId) starterPlayerIds.add(parseInt(l.playerId, 10)); });
                } else if (f.positions) {
                    Object.values(f.positions).forEach(pid => { if (pid) starterPlayerIds.add(parseInt(pid, 10)); });
                }

                const outPlayerIds = new Set();
                const inPlayerIds = new Set();
                if (f.substitutions && Array.isArray(f.substitutions)) {
                    f.substitutions.forEach(sub => {
                        if (sub.playerOutId) outPlayerIds.add(parseInt(sub.playerOutId, 10));
                        if (sub.playerInId) inPlayerIds.add(parseInt(sub.playerInId, 10));
                    });
                }

                state.players.forEach(p => {
                    const isStarter = starterPlayerIds.has(p.id);
                    const isOut = outPlayerIds.has(p.id);
                    const isIn = inPlayerIds.has(p.id);

                    if (isStarter && isOut) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                    } else if (isStarter) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 1.0;
                    } else if (isIn) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                    }
                });
            });
        }
    });

    const allPlaytimes = state.players.map(p => {
        const count = playerPlayTimes[p.id] || 0;
        const pct = totalPeriods > 0 ? Math.round((count / totalPeriods) * 100) : 0;
        return { p, count, pct };
    }).sort((a, b) => a.pct - b.pct || a.count - b.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)); // 少ない順(ケア対象が上)

    // UI描画
    const elRankingScorers = document.getElementById('ranking-scorers-list');
    if (elRankingScorers) {
        elRankingScorers.innerHTML = allScorers.length > 0
            ? allScorers.map((item, idx) => renderRankingItem(item, idx, '')).join('')
            : '<div class="u-ext-4">得点記録がありません。</div>';
    }

    const elRankingAssists = document.getElementById('ranking-assists-list');
    if (elRankingAssists) {
        elRankingAssists.innerHTML = allAssists.length > 0
            ? allAssists.map((item, idx) => renderRankingItem(item, idx, '')).join('')
            : '<div class="u-ext-4">アシスト記録がありません。</div>';
    }

    const elRankingAttendance = document.getElementById('ranking-attendance-list');
    if (elRankingAttendance) {
        elRankingAttendance.innerHTML = totalRecentEvents > 0 && allAttendance.some(item => item.count > 0)
            ? allAttendance.map((item, idx) => `
                <div class="u-ext-1" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                    <span class="u-ext-2">${idx + 1}.</span>
                    <span class="u-ext-3">
                        <span class="rank-player-num">${item.p.number ? '#' + item.p.number : ''}</span>
                        <span class="rank-player-name">${escapeHtml(item.p.name)}</span>
                        <span class="rank-player-count" style="color:var(--primary); font-weight:700;">${item.pct}%</span>
                    </span>
                </div>
            `).join('')
            : '<div class="u-ext-4">過去1ヶ月の出席データがありません。</div>';
    }

    const elRankingPlaytime = document.getElementById('ranking-playtime-list');
    if (elRankingPlaytime) {
        elRankingPlaytime.innerHTML = totalPeriods > 0
            ? allPlaytimes.map((item, idx) => `
                <div class="u-ext-1" style="flex-direction:column; align-items:stretch; gap:0.25rem; padding:0.4rem 0.6rem;" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                        <span><strong style="color:var(--text-secondary); margin-right:0.3rem;">${idx + 1}.</strong> <strong>${item.p.number ? '#' + item.p.number : ''} ${escapeHtml(item.p.name)}</strong></span>
                        <span style="font-weight:700; color:${item.pct < 30 ? 'var(--primary)' : 'var(--text-primary)'};">${item.pct}% <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:normal;">(${item.count}P / ${totalPeriods}P)</span></span>
                    </div>
                    <div class="dash-playtime-bar-outer" style="height:5px;">
                        <div class="dash-playtime-bar-inner" style="width: ${item.pct}%; background:${item.pct < 30 ? 'var(--primary)' : '#3b82f6'};"></div>
                    </div>
                </div>
            `).join('')
            : '<div class="u-ext-4">直近5試合のピリオド記録がありません。</div>';
    }

    // 表示ターゲットに応じた表示切り替え ＆ 縦並び2列（マルチカラム）化
    const gridCols = document.getElementById('leader-ranking-grid-cols');
    const modalTitle = document.querySelector('#modal-leader-ranking h2');

    if (gridCols && gridCols.children.length >= 4) {
        const colScorers = gridCols.children[0];
        const colAssists = gridCols.children[1];
        const colAttendance = gridCols.children[2];
        const colPlaytime = gridCols.children[3];

        const listScorers = document.getElementById('ranking-scorers-list');
        const listAssists = document.getElementById('ranking-assists-list');
        const listAttendance = document.getElementById('ranking-attendance-list');
        const listPlaytime = document.getElementById('ranking-playtime-list');

        // 各項目の見出し（h4）取得
        const h4Scorers = colScorers.querySelector('h4');
        const h4Assists = colAssists.querySelector('h4');
        const h4Attendance = colAttendance.querySelector('h4');
        const h4Playtime = colPlaytime.querySelector('h4');

        // スタイルリセット
        [colScorers, colAssists, colAttendance, colPlaytime].forEach(col => col.style.display = 'none');
        [h4Scorers, h4Assists, h4Attendance, h4Playtime].forEach(h => { if (h) h.style.display = 'block'; });
        [listScorers, listAssists, listAttendance, listPlaytime].forEach(list => {
            if (list) {
                list.style.display = 'block';
                list.style.columnCount = 'auto';
            }
        });
        gridCols.style.display = 'block';

        // 共通の2列マルチカラム設定関数（縦順並び）
        const applyColumnStyle = (listEl) => {
            if (listEl) {
                listEl.style.display = 'block';
                listEl.style.columnCount = '2';
                listEl.style.columnGap = '1.5rem';
            }
        };

        // 選択されたランキングのみを表示し、上から下への縦並び2列化
        if (type === 'scorers') {
            colScorers.style.display = 'block';
            if (h4Scorers) h4Scorers.style.display = 'none';
            applyColumnStyle(listScorers);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-fire" style="color:#ef4444;"></i> 得点ランキング詳細';
        } else if (type === 'assists') {
            colAssists.style.display = 'block';
            if (h4Assists) h4Assists.style.display = 'none';
            applyColumnStyle(listAssists);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-shoe-prints" style="color:#22c55e;"></i> アシストランキング詳細';
        } else if (type === 'attendance') {
            colAttendance.style.display = 'block';
            if (h4Attendance) h4Attendance.style.display = 'none';
            applyColumnStyle(listAttendance);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-users" style="color:#3b82f6;"></i> 出席率ランキング詳細 (過去1ヶ月)';
        } else if (type === 'playtime') {
            colPlaytime.style.display = 'block';
            if (h4Playtime) h4Playtime.style.display = 'none';
            applyColumnStyle(listPlaytime);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-stopwatch" style="color:#eab308;"></i> 出場時間・出場率詳細 (直近5試合)';
        } else {
            // 全項目一覧モード
            [colScorers, colAssists, colAttendance, colPlaytime].forEach(col => col.style.display = 'block');
            gridCols.style.display = 'grid';
            gridCols.style.gridTemplateColumns = 'repeat(2, 1fr)';
            gridCols.style.gap = '1rem';
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-trophy" style="color:var(--primary);"></i> 個人ランキング一覧';
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
        const status = getMatchStatus(m);
        if (status === 'win') typeStats[type].win++;
        else if (status === 'loss') typeStats[type].loss++;
        else if (status === 'draw') typeStats[type].draw++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            typeStats[type].goals += parseInt(mt[1], 10);
            typeStats[type].concede += parseInt(mt[2], 10);
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
                    <div class="u-ext-6" >
                        <span class="u-ext-7" >${escapeHtml(type)}</span>
                        <div class="u-ext-8" >
                            <span class="u-ext-9" >${stat.win}勝</span>
                            <span class="u-ext-10" >${stat.loss}敗 ${stat.draw}分</span>
                            <span class="u-ext-11" >(得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%)</span>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div class="u-ext-12" >今年度の試合データがありません。</div>';
    }

    // ── 2. 過去年度の成績推移 ──
    const yearStats = {}; // { 2025: { win, loss, draw, goals, concede } }
    completedMatches.forEach(m => {
        const year = getNendo(m.date);
        if (!yearStats[year]) {
            yearStats[year] = { win: 0, loss: 0, draw: 0, goals: 0, concede: 0 };
        }
        const status = getMatchStatus(m);
        if (status === 'win') yearStats[year].win++;
        else if (status === 'loss') yearStats[year].loss++;
        else if (status === 'draw') yearStats[year].draw++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            yearStats[year].goals += parseInt(mt[1], 10);
            yearStats[year].concede += parseInt(mt[2], 10);
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
                        <span style="font-weight:700; color:${isCurrent ? 'var(--primary)' : 'var(--text-primary)'};">${year}年度 ${isCurrent ? '<span class="u-ext-13" >(今年度)</span>' : ''}</span>
                        <div class="u-ext-8" >
                            <span style="font-weight:600; color:${isCurrent ? 'var(--primary)' : 'var(--text-primary)'};">${stat.win}勝</span>
                            <span class="u-ext-10" >${stat.loss}敗 ${stat.draw}分</span>
                            <span class="u-ext-11" >(得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%)</span>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div class="u-ext-12" >試合履歴データがありません。</div>';
    }

    openModal('modal-season-record-detail');
}

export function openTeamFocusModal() {
    const focus = state.teamFocus || {};
    const inputMain = document.getElementById('input-focus-main-theme');
    const inputPt1 = document.getElementById('input-focus-point-1');
    const inputPt2 = document.getElementById('input-focus-point-2');
    const inputPt3 = document.getElementById('input-focus-point-3');
    const inputNote = document.getElementById('input-focus-note');

    if (inputMain) inputMain.value = focus.mainTheme || '';
    if (inputPt1) inputPt1.value = (focus.points && focus.points[0]) || '';
    if (inputPt2) inputPt2.value = (focus.points && focus.points[1]) || '';
    if (inputPt3) inputPt3.value = (focus.points && focus.points[2]) || '';
    if (inputNote) inputNote.value = focus.note || '';

    openModal('modal-edit-team-focus');
}

// ★ 保護者向けマイ選手選択モーダルの起動（windowにグローバル公開）
export function openMyPlayerSelectModal() {
    const pmlTitle = document.getElementById('pml-title');
    const pmlContent = document.getElementById('pml-content');
    if (!pmlTitle || !pmlContent) return;

    pmlTitle.innerHTML = '<i class="fa-solid fa-user-gear"></i> マイ選手の選択';

    const currentId = localStorage.getItem('coachMgrMyPlayerId') || '';

    if (!state.players || state.players.length === 0) {
        pmlContent.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">選択可能な選手が登録されていません。</p>';
    } else {
        pmlContent.innerHTML = `
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.8rem;">
                表示対象の選手（お子様）を選択してください。この設定は端末に保存されます。
            </p>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
                ${state.players.map(p => `
                    <button type="button" class="btn ${p.id.toString() === currentId ? 'btn-primary' : 'btn-secondary'}" 
                        style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; text-align:left;"
                        onclick="selectMyPlayer(${p.id})">
                        <span><strong>${escapeHtml(p.name)}</strong> (${p.number})</span>
                        ${p.id.toString() === currentId ? '<i class="fa-solid fa-check"></i>' : ''}
                    </button>
                `).join('')}
            </div>
        `;
    }

    openModal('modal-player-matches-list');
}
window.openMyPlayerSelectModal = openMyPlayerSelectModal;

// マイ選手選択確定処理
window.selectMyPlayer = function (playerId) {
    localStorage.setItem('coachMgrMyPlayerId', playerId.toString());
    const modal = document.getElementById('modal-player-matches-list');
    if (modal) modal.classList.add('hidden');
    if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
        document.body.classList.remove('modal-open');
    }
    initDashboard();
};

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

    const formFocus = document.getElementById('form-edit-team-focus');
    if (formFocus) {
        formFocus.onsubmit = (e) => {
            e.preventDefault();
            const mainTheme = document.getElementById('input-focus-main-theme')?.value.trim() || '';
            const pt1 = document.getElementById('input-focus-point-1')?.value.trim() || '';
            const pt2 = document.getElementById('input-focus-point-2')?.value.trim() || '';
            const pt3 = document.getElementById('input-focus-point-3')?.value.trim() || '';
            const note = document.getElementById('input-focus-note')?.value.trim() || '';

            const points = [pt1, pt2, pt3].filter(Boolean);

            state.teamFocus = {
                mainTheme,
                points,
                note,
                updatedAt: new Date().toISOString()
            };

            saveData();
            document.getElementById('modal-edit-team-focus')?.classList.add('hidden');
            if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                document.body.classList.remove('modal-open');
            }
            showToast('チーム強化テーマを保存しました！');
            initDashboard();
        };
    }

    const btnClearFocus = document.getElementById('btn-clear-team-focus');
    if (btnClearFocus) {
        btnClearFocus.onclick = () => {
            state.teamFocus = { mainTheme: '', points: [], note: '', updatedAt: '' };
            saveData();
            document.getElementById('modal-edit-team-focus')?.classList.add('hidden');
            if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                document.body.classList.remove('modal-open');
            }
            showToast('チーム重点テーマをクリアしました');
            initDashboard();
        };
    }

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

    // ── 保護者専用要素の表示制御と「マイ選手」ロジック（案1：未選択スタート＋端末固定） ──
    const myPlayerBanner = document.getElementById('dash-myplayer-banner');
    const myPlayerContent = document.getElementById('dash-myplayer-content');

    if (!isCoach && myPlayerBanner) {
        myPlayerBanner.style.removeProperty('display');

        // 保存済みのマイ選手IDを取得（※初回は自動補完せず空文字のままにする）
        const savedPlayerId = localStorage.getItem('coachMgrMyPlayerId') || '';

        const renderMyPlayerStats = (playerId) => {
            // 1. 選手データが1件も未登録の場合
            if (state.players.length === 0) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1.2rem 0; text-align:center;">
                        <p style="margin-bottom:0.6rem; color:var(--text-secondary); font-size:0.85rem;">チームに選手が登録されていません。</p>
                        <p style="font-size:0.75rem; color:var(--text-secondary);">※コーチモードに切り替えて「選手管理」から選手を登録してください。</p>
                    </div>
                `;
                return;
            }

            // 2. 選手は登録されているが、マイ選手が「未選択」の場合
            if (!playerId) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1.2rem 0; text-align:center;">
                        <p style="margin-bottom:0.6rem; color:var(--text-primary); font-weight:700; font-size:0.9rem;">表示するマイ選手が未設定です</p>
                        <button type="button" class="btn btn-primary btn-sm" onclick="openMyPlayerSelectModal()" style="padding:0.4rem 1rem; font-size:0.82rem;">
                            <i class="fa-solid fa-user-check"></i> マイ選手（我が子）を選択する
                        </button>
                    </div>
                `;
                return;
            }

            // 3. 選択された選手IDに対応する選手データを検索
            const player = state.players.find(p => p.id === parseInt(playerId, 10));
            if (!player) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1rem 0; text-align:center;">
                        <p style="margin-bottom:0.5rem; color:var(--text-secondary);">該当する選手が見つかりません。</p>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openMyPlayerSelectModal()">
                            <i class="fa-solid fa-rotate"></i> 別の選手を選択する
                        </button>
                    </div>
                `;
                return;
            }

            // ── 以下、選手が正しく選択されている場合の描画処理 ──
            const currentNendo = getNendo(todayStr);

            // 今年度の全試合・全練習
            const thisYearMatches = state.matches.filter(m => getNendo(m.date) === currentNendo);
            const thisYearPractices = state.practices.filter(p => getNendo(p.date) === currentNendo);
            const totalThisYearEvents = thisYearMatches.length + thisYearPractices.length;

            // 今年度の参加記録
            const attendedMatches = thisYearMatches.filter(m => (m.presentPlayerIds || []).includes(player.id));
            const attendedPractices = thisYearPractices.filter(p => (p.presentPlayerIds || []).includes(player.id));
            const attendedThisYearCount = attendedMatches.length + attendedPractices.length;

            // 出席率の算出
            const attendancePct = totalThisYearEvents > 0
                ? Math.round((attendedThisYearCount / totalThisYearEvents) * 100)
                : 0;

            // 通算（全期間）得点・アシストの集計
            let playerGoals = 0;
            let playerAssists = 0;
            state.matches.forEach(m => {
                if (m.goalRecords) {
                    m.goalRecords.forEach(r => {
                        if (r.scorerId === player.id) playerGoals++;
                        if (r.assistId === player.id) playerAssists++;
                    });
                }
            });

            // 最新フィードバックの抽出
            let timeline = [];
            if (player.history) {
                player.history.forEach(h => {
                    timeline.push({ type: 'assessment', date: h.date, comment: h.comment, data: h });
                });
            }
            state.matches.forEach(m => {
                if (m.playerFeedback) {
                    m.playerFeedback.forEach(fb => {
                        if (fb.playerId === player.id) {
                            timeline.push({
                                type: 'match',
                                date: m.date,
                                matchDetails: `${m.type}${m.tournament ? ` (${m.tournament})` : ''} vs ${m.opponent}`,
                                comment: fb.comment,
                                matchId: m.id
                            });
                        }
                    });
                }
            });
            timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

            const latestFeedbackItem = timeline.find(t => t.type === 'match' || t.type === 'assessment');
            let latestFeedbackHTML = '';
            if (latestFeedbackItem) {
                const labelStr = latestFeedbackItem.type === 'match' ? '試合評価' : '観察メモ';
                latestFeedbackHTML = `
                    <div style="margin-top:0.2rem; margin-bottom:0.2rem; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08)); border-left:4px solid var(--primary); border-radius:8px; padding:0.6rem 0.8rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                            <span style="font-size:0.75rem; font-weight:700; color:var(--primary);"><i class="fa-solid fa-comment-dots"></i> コーチからの最新フィードバック</span>
                            <span style="font-size:0.68rem; color:var(--text-secondary);">${latestFeedbackItem.date} (${labelStr})</span>
                        </div>
                        <p style="font-size:0.8rem; font-weight:600; color:var(--text-primary); margin:0; line-height:1.35;">
                            ${escapeHtml(latestFeedbackItem.comment)
                        .trim()
                        .replace(/\n\s*\n/g, '\n')
                        .replace(/\n/g, '<br>')
                    }
                        </p>
                    </div>
                `;
            }

            // ストロングポイントのHTML生成
            const strongPointsHtml = player.strongPoints && player.strongPoints.length > 0
                ? player.strongPoints.map(sp => `
                    <div style="margin-bottom:0.2rem;">
                        <span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; font-size:0.65rem; padding:0.08rem 0.28rem; display:inline-block;">
                            <i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}
                        </span>
                        <div style="font-size:0.75rem; color:var(--text-primary); line-height:1.2; margin-top:0.1rem;">${escapeHtml(sp.text)}</div>
                    </div>
                `).join('')
                : '<span style="font-size:0.75rem; color:var(--text-secondary);">未設定</span>';

            // UI生成
            myPlayerContent.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.6rem; padding:0.2rem 0;">
                    
                    <!-- ヘッダー（名前・背番号・ポジション・変更ボタン） -->
                    <div class="dash-myplayer-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.1rem 0;">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <div class="player-number" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--primary), #e83029);color:white;border-radius:50%;font-weight:900;font-size:0.9rem;">
                                ${player.number}
                            </div>
                            <div style="display:flex; align-items:baseline; gap:0.4rem;">
                                <h2 style="margin:0; font-size:1.05rem; color:var(--text-primary); font-weight:800; letter-spacing:-0.02em;">
                                    ${escapeHtml(player.name)}
                                </h2>
                                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">
                                    (${(Array.isArray(player.position) ? player.position : [player.position]).join(', ')})
                                </span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-change-myplayer" style="font-size:0.72rem; padding:0.2rem 0.55rem;">
                            <i class="fa-solid fa-rotate"></i> 選手変更
                        </button>
                    </div>

                    <!-- コーチからの最新フィードバック -->
                    ${latestFeedbackHTML}

                    <!-- スタッツボタンエリア -->
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem;">
                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-att" 
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-user-check" style="color:#3b82f6;"></i> 出席率
                            </span>
                            <div style="display:flex; align-items:baseline; gap:0.2rem;">
                                <strong style="font-size:0.88rem; color:var(--text-primary);">${attendancePct}%</strong>
                                <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:normal;">(${attendedThisYearCount}/${totalThisYearEvents})</span>
                            </div>
                        </button>

                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-goals" 
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-futbol" style="color:var(--primary);"></i> 通算得点
                            </span>
                            <strong style="font-size:0.88rem; color:var(--primary);">${playerGoals}<span style="font-size:0.65rem; font-weight:normal;">点</span></strong>
                        </button>

                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-assists" 
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-shoe-prints" style="color:#22c55e; transform:rotate(45deg);"></i> 通算アシスト
                            </span>
                            <strong style="font-size:0.88rem; color:#22c55e;">${playerAssists}<span style="font-size:0.65rem; font-weight:normal;">回</span></strong>
                        </button>
                    </div>

                    <!-- プロファイルアコーディオン -->
                    <details style="background:rgba(0,0,0,0.015); border:1px solid var(--surface-border); border-radius:6px; padding:0.3rem 0.6rem;">
                        <summary style="cursor:pointer; font-size:0.78rem; font-weight:700; display:flex; align-items:center; justify-content:space-between; outline:none; user-select:none;">
                            <span><i class="fa-solid fa-sliders" style="color:var(--primary);"></i> 選手詳細プロファイル (スタイル / 強み / IDP)</span>
                        </summary>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem; margin-top:0.4rem; padding-top:0.2rem;">
                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-tag"></i> プレースタイル
                                </strong>
                                <div style="font-size:0.78rem; font-weight:700; color:var(--text-primary); line-height:1.3;">
                                    ${escapeHtml(player.playStyle || '未設定')}
                                </div>
                            </div>

                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-shield-halved"></i> ストロングポイント
                                </strong>
                                ${strongPointsHtml}
                            </div>

                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-bullseye"></i> 個人目標 (IDP)
                                </strong>
                                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                                    <div>
                                        <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:bold;">[短期]</span>
                                        <span style="font-size:0.75rem; color:var(--text-primary); line-height:1.2;">${player.goals && player.goals.short ? escapeHtml(player.goals.short) : '未設定'}</span>
                                    </div>
                                    <div>
                                        <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:bold;">[長期]</span>
                                        <span style="font-size:0.75rem; color:var(--text-primary); line-height:1.2;">${player.goals && player.goals.long ? escapeHtml(player.goals.long) : '未設定'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            `;

            // イベントバインド
            const btnChange = document.getElementById('btn-change-myplayer');
            if (btnChange) btnChange.onclick = () => openMyPlayerSelectModal();

            const btnAtt = document.getElementById('dash-btn-myplayer-att');
            if (btnAtt) {
                btnAtt.onclick = () => {
                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<i class="fa-solid fa-user-check" style="color:#3b82f6;"></i> ${escapeHtml(player.name)} の参加記録 (${currentNendo}年度)`;

                    let html = '';
                    if (attendedMatches.length === 0 && attendedPractices.length === 0) {
                        html = '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">今年度の参加記録はありません。</p>';
                    } else {
                        attendedMatches.forEach(m => {
                            html += `
                                <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;" 
                                    onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                                    <div>
                                        <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                        <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | 試合 ${m.type ? `(${escapeHtml(m.type)})` : ''}</div>
                                    </div>
                                    <div style="font-size:0.85rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                                </div>
                            `;
                        });
                        attendedPractices.forEach(p => {
                            html += `
                                <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;" 
                                    onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('practices', { date: '${p.date}' });">
                                    <div>
                                        <strong>練習 ${p.location ? `(${escapeHtml(p.location)})` : ''}</strong>
                                        <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${p.date}</div>
                                    </div>
                                    <div style="font-size:0.85rem; font-weight:bold; color:var(--text-secondary);">練習記録 <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                                </div>
                            `;
                        });
                    }

                    pmlContent.innerHTML = html;
                    openModal('modal-player-matches-list');
                };
            }

            const btnGoals = document.getElementById('dash-btn-myplayer-goals');
            if (btnGoals) {
                btnGoals.onclick = () => {
                    const matchesWithGoals = state.matches.filter(m =>
                        m.goalRecords && m.goalRecords.some(r => r.scorerId === player.id)
                    );

                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<i class="fa-solid fa-futbol" style="color:var(--primary);"></i> ${escapeHtml(player.name)} の得点した試合 (通算)`;
                    pmlContent.innerHTML = matchesWithGoals.length > 0 ? matchesWithGoals.map(m => `
                        <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;" 
                            onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                            <div>
                                <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${escapeHtml(m.type || '')}</div>
                            </div>
                            <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                        </div>
                    `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">得点した試合はありません。</p>';

                    openModal('modal-player-matches-list');
                };
            }

            const btnAssists = document.getElementById('dash-btn-myplayer-assists');
            if (btnAssists) {
                btnAssists.onclick = () => {
                    const matchesWithAssists = state.matches.filter(m =>
                        m.goalRecords && m.goalRecords.some(r => r.assistId === player.id)
                    );

                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<span style="display:inline-block; transform:rotate(45deg); color:#22c55e;"><i class="fa-solid fa-shoe-prints"></i></span> ${escapeHtml(player.name)} のアシストした試合 (通算)`;
                    pmlContent.innerHTML = matchesWithAssists.length > 0 ? matchesWithAssists.map(m => `
                        <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;" 
                            onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                            <div>
                                <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${escapeHtml(m.type || '')}</div>
                            </div>
                            <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                        </div>
                    `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">アシストした試合はありません。</p>';

                    openModal('modal-player-matches-list');
                };
            }
        };

        // ロード描画（※保存されているIDがあればその選手を表示、なければ「未選択」状態の画面を描画）
        renderMyPlayerStats(savedPlayerId);
    } else if (myPlayerBanner) {
        myPlayerBanner.style.setProperty('display', 'none', 'important');
    }

    // ── チーム重点課題・強化テーマ ロジック ──
    const teamFocusContent = document.getElementById('dash-team-focus-content');
    const btnEditFocus = document.getElementById('dash-btn-edit-focus');

    if (teamFocusContent) {
        const focus = state.teamFocus || {};
        if (focus.mainTheme) {
            let pointsHtml = '';
            if (focus.points && focus.points.filter(Boolean).length > 0) {
                pointsHtml = `
                    <div class="u-ext-18" >
                        ${focus.points.filter(Boolean).map((pt, idx) => `
                            <div class="u-ext-19" >
                                <span class="u-ext-20" >${idx + 1}</span>
                                <span>${escapeHtml(pt)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            teamFocusContent.innerHTML = `
                <div class="u-ext-21" >
                    <div class="u-ext-22" >🔥 強化テーマ</div>
                    <div class="u-ext-23" >${escapeHtml(focus.mainTheme)}</div>
                </div>
                ${pointsHtml}
                ${focus.note ? `<div class="u-ext-24" ><i class="fa-solid fa-clock"></i> ${escapeHtml(focus.note)}</div>` : ''}
            `;
        } else {
            teamFocusContent.innerHTML = `
                <div class="u-ext-25 dash-no-data" >
                    チーム強化テーマが未設定です<br>
                    <button class="u-ext-26 btn btn-secondary btn-sm coach-only" id="dash-btn-set-focus-empty" onclick="openTeamFocusModal()" >
                        <i class="fa-solid fa-plus"></i> テーマを設定する
                    </button>
                </div>
            `;
            const btnEmpty = document.getElementById('dash-btn-set-focus-empty');
            if (btnEmpty) btnEmpty.onclick = () => openTeamFocusModal();
        }
    }

    if (btnEditFocus) {
        btnEditFocus.onclick = () => openTeamFocusModal();
    }

    // ── 選手コンディション・出場時間平準化アラート ──
    const playtimeContent = document.getElementById('dash-playtime-content');
    if (playtimeContent) {
        // 直近5試合を抽出
        const recent5Matches = state.matches
            .filter(m => m && m.date && m.date <= todayStr && m.result)
            .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
            .slice(0, 5);

        if (recent5Matches.length > 0) {
            // 各選手の出場ピリオド数を集計する
            const playerPlayTimes = {};
            state.players.forEach(p => { playerPlayTimes[p.id] = 0; });

            let totalPeriods = 0;
            recent5Matches.forEach(m => {
                if (m.formations && m.formations.length > 0) {
                    m.formations.forEach(f => {
                        if (f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'))) return;

                        totalPeriods++;

                        const starterPlayerIds = new Set();
                        if (f.lineup && Array.isArray(f.lineup)) {
                            f.lineup.forEach(l => { if (l.playerId) starterPlayerIds.add(parseInt(l.playerId, 10)); });
                        } else if (f.positions) {
                            Object.values(f.positions).forEach(pid => { if (pid) starterPlayerIds.add(parseInt(pid, 10)); });
                        }

                        const outPlayerIds = new Set();
                        const inPlayerIds = new Set();
                        if (f.substitutions && Array.isArray(f.substitutions)) {
                            f.substitutions.forEach(sub => {
                                if (sub.playerOutId) outPlayerIds.add(parseInt(sub.playerOutId, 10));
                                if (sub.playerInId) inPlayerIds.add(parseInt(sub.playerInId, 10));
                            });
                        }

                        state.players.forEach(p => {
                            const isStarter = starterPlayerIds.has(p.id);
                            const isOut = outPlayerIds.has(p.id);
                            const isIn = inPlayerIds.has(p.id);

                            if (isStarter && isOut) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                            } else if (isStarter) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 1.0;
                            } else if (isIn) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                            }
                        });
                    });
                }
            });

            const playRateList = state.players.map(p => {
                const count = playerPlayTimes[p.id] || 0;
                const pct = totalPeriods > 0 ? Math.round((count / totalPeriods) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => a.pct - b.pct);

            // 出場時間が特に少ない下位3名を表示（他ランキングと100%構造・高さを統一）
            const alertPlayers = playRateList.slice(0, 3);
            if (alertPlayers.length > 0 && totalPeriods > 0) {
                playtimeContent.className = 'dash-rank-list';
                playtimeContent.innerHTML = alertPlayers.map((item, idx) => `
                    <div class="dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                        <span class="dash-rank-medal" style="margin-right: 0.5rem; display: inline-flex; align-items: center; justify-content: center; width: 22px;">⚠️</span>
                        <span class="dash-rank-name">${item.p.number} ${escapeHtml(item.p.name)}</span>
                        <span class="dash-rank-count" style="color:${item.pct < 30 ? 'var(--primary)' : 'var(--text-primary)'};">
                            ${item.pct}<span class="dash-rank-count-unit">%</span>
                        </span>
                    </div>
                `).join('');
            } else {
                playtimeContent.innerHTML = '<div class="u-ext-29 dash-no-data">フォーメーション登録データがありません</div>';
            }
        } else {
            playtimeContent.innerHTML = '<div class="u-ext-29 dash-no-data">出場時間の集計対象となる最近の試合データがありません</div>';
        }
    }


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 1: アラートバナー（コーチ専用）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const alertBanner = document.getElementById('dash-alert-banner');
    const alertText = document.getElementById('dash-alert-text');
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
                    const firstPending = pendingMatches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))[0];
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
        .filter(e => e && e.date && e.date >= todayStr)
        .sort((a, b) => ((a && a.date) || '').localeCompare((b && b.date) || ''))[0];

    const nextEventContent = document.getElementById('dash-next-event-content');
    const nextEventCard = document.getElementById('dash-next-event-card');
    if (nextEventContent) {
        if (nextEvent) {
            const dateObj = new Date(nextEvent.date + 'T00:00:00');
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const dateLabel = `${nextEvent.date.replace(/-/g, '/')} (${dayNames[dateObj.getDay()]})`;
            const todayObj = new Date(todayStr + 'T00:00:00');
            const diffDays = Math.round((dateObj - todayObj) / (1000 * 60 * 60 * 24));
            const countdownLabel = diffDays === 0 ? '今日！' : diffDays === 1 ? '明日' : `あと${diffDays}日`;
            const typeClass = nextEvent.type === 'match' ? 'match' : 'practice';
            const typeLabel = nextEvent.type === 'match' ? '試合' : '練習';
            const subLine = nextEvent.subType
                ? nextEvent.subType + (nextEvent.tournament ? ` (${nextEvent.tournament})` : '')
                : '';

            nextEventContent.innerHTML = `
                <span class="dash-next-event-type ${typeClass}">${typeLabel}</span>
                <div class="dash-next-event-title">${escapeHtml(nextEvent.title)}</div>
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.1rem;">
                    <span class="dash-next-event-date">${dateLabel}${subLine ? ' · ' + escapeHtml(subLine) : ''}</span>
                    <span class="dash-next-event-countdown">${countdownLabel}</span>
                </div>
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
        const status = getMatchStatus(m);
        if (status === 'win') wins++;
        else if (status === 'loss') losses++;
        else if (status === 'draw') draws++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            totalGoals += parseInt(mt[1], 10);
            totalConceded += parseInt(mt[2], 10);
        }
    });

    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    setEl('dash-record-win', wins);
    setEl('dash-record-loss', losses);
    setEl('dash-record-draw', draws);
    setHtml('dash-record-goals', `<i class="fa-solid fa-futbol"></i> 得点: ${totalGoals}`);
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
                const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
                const us = mt ? parseInt(mt[1], 10) : 0;
                const them = mt ? parseInt(mt[2], 10) : 0;
                const status = getMatchStatus(m);
                let cls = 'draw', label = '分';
                if (status === 'win') { cls = 'win'; label = '勝'; }
                else if (status === 'loss') { cls = 'loss'; label = '負'; }
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
            .sort((a, b) => b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0))
            .slice(0, 3);
        el.innerHTML = top.length > 0
            ? top.map((item, idx) => `
                <div class="dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                    <span class="dash-rank-medal">${medals[idx] || (idx + 1) + '.'}</span>
                    <span class="dash-rank-name">${item.p.number} ${escapeHtml(item.p.name)}</span>
                    <span class="dash-rank-count">${item.count}<span class="dash-rank-count-unit">${unit}</span></span>
                </div>
            `).join('')
            : '<div class="dash-no-data">記録なし</div>';
    };
    renderRankList(scorerCounts, '得点', 'dash-top-scorers');
    renderRankList(assistCounts, 'A', 'dash-top-assists');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 5: 直近の予定・実績 (降順・最大7件・直近の試合と完全同一サイズ)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scheduleList = document.getElementById('dash-schedule-list');
    if (scheduleList) {
        const allEvents = [];

        // 1. 練習イベントの収集
        state.practices.forEach(p => allEvents.push({
            type: 'practice',
            date: p.date,
            id: p.id,
            subText: p.location || '場所未設定' // 2行目: 練習場所
        }));

        // 2. 試合イベントの収集
        state.matches.forEach(m => allEvents.push({
            type: 'match',
            date: m.date,
            id: m.id,
            subText: m.opponent ? `vs ${m.opponent}` : '対戦相手未定' // 2行目: 対戦相手
        }));

        // 3. 全イベントを日付の【降順】でソートし、最大7件に制限
        const sortedEvents = allEvents
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 7); // ★ 7個まで表示

        if (sortedEvents.length > 0) {
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

            const formatDateLabel = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr.replace(/-/g, '/'));
                const m = d.getMonth() + 1;
                const day = d.getDate();
                return `${m}/${day}(${dayNames[d.getDay()]})`;
            };

            // 「直近の試合」と全く同じ dash-form-item 構造・クラスでHTMLを出力
            scheduleList.innerHTML = sortedEvents.map(e => {
                const isMatch = e.type === 'match';
                const badgeClass = isMatch ? 'dash-circle-match' : 'dash-circle-practice';
                const badgeText = isMatch ? '試' : '練';
                const clickAction = isMatch
                    ? `openMatchDetail(${e.id})`
                    : `navigate('practices', { date: '${e.date}' })`;

                return `
                    <div class="dash-form-item" onclick="${clickAction}" style="cursor: pointer;">
                        <div class="dash-form-badge-lg ${badgeClass}">${badgeText}</div>
                        <div class="dash-form-score">${formatDateLabel(e.date)}</div>
                        <div class="dash-form-opponent" title="${escapeHtml(e.subText)}">${escapeHtml(e.subText)}</div>
                    </div>
                `;
            }).join('');
        } else {
            scheduleList.innerHTML = '<div class="dash-no-data">予定・実績はありません</div>';
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
        recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));
        recentMatches.forEach(m => (m.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));

        const attendanceRankEl = document.getElementById('dash-attendance-rank');
        if (attendanceRankEl) {
            const top = state.players.map(p => {
                const count = attendanceCount[p.id] || 0;
                const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0))
                .slice(0, 3);

            attendanceRankEl.innerHTML = totalRecentEvents > 0 && top.some(item => item.count > 0)
                ? top.map((item, idx) => `
                    <div class="dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                        <span class="dash-rank-medal">${medals[idx] || (idx + 1) + '.'}</span>
                        <span class="dash-rank-name">${item.p.number} ${escapeHtml(item.p.name)}</span>
                        <span class="dash-rank-count">${item.pct}<span class="dash-rank-count-unit">%</span></span>
                    </div>
                `).join('')
                : '<div class="dash-no-data">過去1ヶ月の出席記録なし</div>';
        }

        const practiceFocusEl = document.getElementById('dash-recent-practice-focus');
        if (practiceFocusEl) {
            const displayPractices = [...state.practices]
                .filter(p => p && p.date && p.date <= todayStr)
                .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
                .slice(0, 3);
            practiceFocusEl.innerHTML = displayPractices.length > 0
                ? displayPractices.map(p => {
                    const focuses = p.menus && p.menus.length > 0
                        ? p.menus.map(mn => escapeHtml(mn.focus)).join(' / ')
                        : 'メニュー未記録';
                    return `
                        <div class="dash-rank-item" onclick="event.stopPropagation(); navigate('practices', { date: '${p.date}' })">
                            <span class="u-ext-33 dash-rank-medal" >📅</span>
                            <div class="u-ext-34" >
                                <div class="u-ext-35" >${p.date}</div>
                                <div class="u-ext-36" >${focuses}</div>
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
    const btnAddPrac = document.getElementById('dash-btn-add-practice');
    const btnAddMatch = document.getElementById('dash-btn-add-match');

    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');
    if (btnGoPlayers) btnGoPlayers.onclick = () => openLeaderRankingModal();
    if (btnAddPrac) btnAddPrac.onclick = () => openPracticeModal(null);
    if (btnAddMatch) btnAddMatch.onclick = () => openMatchModal(null);
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
                localStorage.removeItem('currentUserRole');

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
                localStorage.removeItem('currentUserRole');
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PCサイドバーのリンク制御（コーチ専用画面を非表示）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const playersLink = document.querySelector('.nav-links li[data-route="players"]');
    if (playersLink) playersLink.style.display = isCoach ? 'flex' : 'none'; // ★ 追加: 選手管理を非表示

    const settingsLink = document.querySelector('.nav-links li[data-route="settings"]');
    if (settingsLink) settingsLink.style.display = isCoach ? 'flex' : 'none';

    const libraryLink = document.querySelector('.nav-links li[data-route="library"]');
    if (libraryLink) libraryLink.style.display = isCoach ? 'flex' : 'none';

    const tacticsLink = document.querySelector('.nav-links li[data-route="tactics"]');
    if (tacticsLink) tacticsLink.style.display = isCoach ? 'flex' : 'none';

    const dataLink = document.querySelector('.nav-links li[data-route="data"]');
    if (dataLink) dataLink.style.display = isCoach ? 'flex' : 'none';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // スマホ下部ナビゲーションのリンク制御（コーチ専用画面を非表示）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const bottomPlayers = document.querySelector('.bottom-nav .nav-item[data-route="players"]');
    if (bottomPlayers) bottomPlayers.style.display = isCoach ? 'flex' : 'none'; // ★ 追加: 選手管理を非表示

    const bottomLibrary = document.querySelector('.bottom-nav .nav-item[data-route="library"]');
    const bottomTactics = document.querySelector('.bottom-nav .nav-item[data-route="tactics"]');
    const bottomSettings = document.querySelector('.bottom-nav .nav-item[data-route="settings"]');
    if (bottomLibrary) bottomLibrary.style.display = isCoach ? 'flex' : 'none';
    if (bottomTactics) bottomTactics.style.display = isCoach ? 'flex' : 'none';
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

        // ★ 追加: 保護者モード切り替え時に選手管理画面を開いていた場合はダッシュボードへ退避
        if (uiState.currentRoute === 'players') {
            navigate('dashboard');
            return;
        }
    }

    // ロール切り替え完了後、現在ダッシュボード表示中なら即時再描画（ウィジェット切り替え）
    if (uiState.currentRoute === 'dashboard') {
        initDashboard();
    }
}

export function navigate(route, params = null) {
    cleanupCanvasEvents();
    // Cleanup scoped event listeners from the previous view
    if (uiState.currentRoute) {
        cleanupScope(uiState.currentRoute);
    }
    // 画面遷移時にYouTube音声を停止・破棄する
    if (typeof window.stopAndCleanupYouTube === 'function') {
        window.stopAndCleanupYouTube();
    }
    // 画面遷移時にクラウド同期ポップオーバーを閉じる
    const syncPopoverOnNav = document.getElementById('sync-popover');
    if (syncPopoverOnNav) syncPopoverOnNav.classList.add('hidden');

    if (state.currentUserRole !== 'coach') {
        const coachOnlyRoutes = ['tactics', 'library', 'settings', 'players'];
        if (coachOnlyRoutes.includes(route)) {
            route = 'dashboard';
        }
    }

    state.currentRoute = route;
    uiState.currentRoute = route;

    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    document.body.classList.remove('modal-open');
    document.body.setAttribute('data-route', route);

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
        uiState.currentTacticsCategory = 'all';
        uiState.currentTacticsPage = 1;
        uiState.currentTacticsSearch = '';

        if (route === 'dashboard') {
            try {
                initDashboard();
            } catch (err) {
                console.error('initDashboard error:', err);
            }
        }
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
        if (route === 'tactics') initTactics(miniPitchObserver);
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
    try {
        window.openLeaderRankingModal = openLeaderRankingModal;
        window.openSeasonRecordModal = openSeasonRecordModal;
        window.openPlayerDetail = openPlayerDetail;
        window.openTeamFocusModal = openTeamFocusModal;
        window.openMyPlayerSelectModal = openMyPlayerSelectModal;
        window.navigate = navigate;
        await loadData();
    } catch (e) {
        console.error('loadData error in init:', e);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paramApiUrl = urlParams.get('apiUrl');
    const paramAuthToken = urlParams.get('authToken');
    const paramSheetName = urlParams.get('sheetName');

    let isFromInviteLink = false;
    if (paramApiUrl) {
        if (!state.teamInfo) state.teamInfo = {};
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

    // ★【追加】屋外高コントラストモードの初期化と切り替え処理 ★
    const isHighContrast = localStorage.getItem('high_contrast_mode') === 'true';
    if (isHighContrast) {
        document.body.classList.add('high-contrast-mode');
    }

    const toggleContrastBtn = document.getElementById('btn-toggle-contrast');
    if (toggleContrastBtn) {
        toggleContrastBtn.onclick = () => {
            document.body.classList.toggle('high-contrast-mode');
            const active = document.body.classList.contains('high-contrast-mode');
            localStorage.setItem('high_contrast_mode', active);
            showToast(active ? '屋外用高コントラストモードに切り替えました' : '通常モードに戻しました');
        };
    }

    if (state.teamInfo && state.teamInfo.color) {
        document.documentElement.style.setProperty('--primary', state.teamInfo.color);
    }
    const sidebarTitle = document.querySelector('.sidebar-header h2');
    if (sidebarTitle && state.teamInfo) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${escapeHtml(state.teamInfo.name || 'My Team')}`;

    // ★ バージョン表示とリリースノートモーダル初期化
    const sidebarVersionText = document.getElementById('sidebar-version-text');
    if (sidebarVersionText) sidebarVersionText.textContent = `CoachMgr ${APP_VERSION}`;

    const sidebarVersionBadge = document.getElementById('sidebar-version-badge');
    if (sidebarVersionBadge) sidebarVersionBadge.onclick = () => openReleaseNotesModal();

    window.openReleaseNotesModal = openReleaseNotesModal;

    navigate('dashboard');

    if (state.teamInfo && state.teamInfo.gasApiUrl) {
        if (isFromInviteLink) showToast('招待リンクよりクラウド設定を適用しました！同期中...');
        syncPullGasCloud(true).catch(() => { });
    }
}

export function openReleaseNotesModal() {
    const modal = document.getElementById('modal-release-notes');
    const container = document.getElementById('release-notes-content');
    if (!modal || !container) return;

    container.innerHTML = RELEASE_NOTES.map(item => `
        <div style="margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span class="badge" style="background:rgba(16,185,129,0.15); color:var(--primary); font-size:0.85rem; font-weight:700;">${item.version}</span>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${item.date}</span>
            </div>
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.4rem; color:var(--text-primary);">${escapeHtml(item.title)}</div>
            <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                ${item.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    modal.classList.remove('hidden');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.saveData = saveData;
window.navigate = navigate;
window.openMatchDetail = openMatchDetail;
window.openPlayerDetail = openPlayerDetail;
window.openPracticeModal = openPracticeModal;
window.openMatchModal = openMatchModal;
window.openModal = openModal;
window.renderPracticeRoster = renderPracticeRoster;
window.initMatchDetailView = initMatchDetailView;
window.openTeamFocusModal = openTeamFocusModal;
window.openMyPlayerSelectModal = openMyPlayerSelectModal;
window.copyMatchShareText = copyMatchShareText;