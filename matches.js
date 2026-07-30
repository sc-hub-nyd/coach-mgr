// matches.js
import { state, uiState } from './state.js';
import { escapeHtml, getNendo, showToast } from './utils.js';
import { saveData, navigate, openModal } from './app.js';
import { openPlayerDetail } from './players.js';
import { drawPitchToCtx } from './drawing.js';

let ytPlayer = null;
let currentMatchId = null;
let currentPeriodIndex = 0;
let isResizingWorkspace = false;
let timelineInterval = null;

let periodSideClickOutsideHandler = null;
let periodSideKeyDownHandler = null;

function cleanupPeriodSideEvents() {
    if (periodSideClickOutsideHandler) {
        document.removeEventListener('click', periodSideClickOutsideHandler);
        document.removeEventListener('touchstart', periodSideClickOutsideHandler);
        periodSideClickOutsideHandler = null;
    }
    if (periodSideKeyDownHandler) {
        document.removeEventListener('keydown', periodSideKeyDownHandler);
        periodSideKeyDownHandler = null;
    }
}

// YouTube URLから11桁のIDを抽出
function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 秒数を 「MM:SS」形式に変換
function formatSeconds(seconds) {
    const sec = Math.floor(seconds || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 「03:45」 などの文字列を 秒数（225）に変換する関数
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
}

// 指定秒数へ動画をジャンプ＆再生させる関数
export function seekToVideoTime(timeStr) {
    const seconds = parseTimeToSeconds(timeStr);
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(seconds, true);
        if (typeof ytPlayer.playVideo === 'function') {
            ytPlayer.playVideo();
        }
        showToast(`${timeStr} へジャンプしました`);
    } else {
        showToast('動画プレーヤーが準備できていません');
    }
}

// YouTubeプレーヤーの読み込み/切り替え
export function loadYouTubePlayer(url, containerId = 'period-yt-player') {
    const videoId = extractYouTubeId(url);
    const playerEl = document.getElementById(containerId);
    if (!playerEl) return;

    if (!videoId) {
        playerEl.innerHTML = '<div style="color:#fff; text-align:center; padding:2rem;">YouTube URLが設定されていません</div>';
        return;
    }

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
        ytPlayer.loadVideoById(videoId);
        return;
    }

    const initPlayer = () => {
        if (window.YT && window.YT.Player) {
            try {
                ytPlayer = new window.YT.Player(containerId, {
                    width: '100%',
                    height: '100%',
                    videoId: videoId,
                    playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1 }
                });
            } catch (e) {
                console.error('YouTube Player initialization error:', e);
                fallbackIframe();
            }
        } else {
            fallbackIframe();
        }
    };

    const fallbackIframe = () => {
        playerEl.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?playsinline=1" frameborder="0" allowfullscreen style="width:100%; height:100%;"></iframe>`;
    };

    setTimeout(initPlayer, 150);
}

const formationCoords = {
    '4-3-3': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LB', top: '70%', left: '15%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '38%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '62%' },
        { role: 'DF', label: 'RB', top: '70%', left: '85%' },
        { role: 'MF', label: 'DM', top: '52%', left: '50%' },
        { role: 'MF', label: 'LCM', top: '42%', left: '30%' },
        { role: 'MF', label: 'RCM', top: '42%', left: '70%' },
        { role: 'FW', label: 'LW', top: '22%', left: '18%' },
        { role: 'FW', label: 'ST', top: '15%', left: '50%' },
        { role: 'FW', label: 'RW', top: '22%', left: '82%' }
    ],
    '4-4-2': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LB', top: '70%', left: '15%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '38%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '62%' },
        { role: 'DF', label: 'RB', top: '70%', left: '85%' },
        { role: 'MF', label: 'LM', top: '45%', left: '15%' },
        { role: 'MF', label: 'LCM', top: '48%', left: '38%' },
        { role: 'MF', label: 'RCM', top: '48%', left: '62%' },
        { role: 'MF', label: 'RM', top: '45%', left: '85%' },
        { role: 'FW', label: 'LST', top: '20%', left: '35%' },
        { role: 'FW', label: 'RST', top: '20%', left: '65%' }
    ],
    '3-5-2': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '25%' },
        { role: 'DF', label: 'CCB', top: '76%', left: '50%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '75%' },
        { role: 'MF', label: 'LDM', top: '55%', left: '35%' },
        { role: 'MF', label: 'RDM', top: '55%', left: '65%' },
        { role: 'MF', label: 'LWB', top: '48%', left: '12%' },
        { role: 'MF', label: 'RWB', top: '48%', left: '88%' },
        { role: 'MF', label: 'AM', top: '35%', left: '50%' },
        { role: 'FW', label: 'LST', top: '18%', left: '35%' },
        { role: 'FW', label: 'RST', top: '18%', left: '65%' }
    ],
    '3-4-3': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '25%' },
        { role: 'DF', label: 'CCB', top: '76%', left: '50%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '75%' },
        { role: 'MF', label: 'LM', top: '50%', left: '15%' },
        { role: 'MF', label: 'LCM', top: '52%', left: '38%' },
        { role: 'MF', label: 'RCM', top: '52%', left: '62%' },
        { role: 'MF', label: 'RM', top: '50%', left: '85%' },
        { role: 'FW', label: 'LW', top: '22%', left: '18%' },
        { role: 'FW', label: 'ST', top: '15%', left: '50%' },
        { role: 'FW', label: 'RW', top: '22%', left: '82%' }
    ]
};

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
    div.style = 'display:flex; gap:0.4rem; align-items:center; width:100%; font-size:0.8rem;';
    div.innerHTML = `
        <span style="min-width:3rem; text-align:right; font-size:0.78rem; color:var(--text-secondary); flex-shrink:0;">得点:</span>
        <select class="form-control goal-scorer-select" style="flex:1; min-width:0; padding:0.25rem 0.4rem; font-size:0.8rem; height:auto;">
            ${scorerOptions}
        </select>
        <span style="min-width:3.6rem; text-align:right; font-size:0.78rem; color:var(--text-secondary); flex-shrink:0;">アシスト:</span>
        <select class="form-control goal-assist-select" style="flex:1; min-width:0; padding:0.25rem 0.4rem; font-size:0.8rem; height:auto;">
            ${assistOptions}
        </select>
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.45rem; font-size:0.8rem; flex-shrink:0;" title="削除"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
}

export function addAnalysisMemoRow(timeStr = '00:00', textVal = '', tagVal = 'ビルドアップ') {
    const container = document.getElementById('formation-analysis-memo-list');
    if (!container) return;

    const rowId = 'memo-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'analysis-memo-row';
    div.style = 'display:flex; gap:0.3rem; align-items:center; width:100%; margin-bottom:0.3rem;';

    const tagOptions = (state.analysisTags || []).map(t => `<option value="${escapeHtml(t)}" ${tagVal === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');

    div.innerHTML = `
        <button type="button" class="btn btn-secondary btn-seek-video" style="padding:0.25rem 0.4rem; font-size:0.75rem; color:var(--primary);" title="このシーンへジャンプ">
            <i class="fa-solid fa-play"></i>
        </button>
        <input type="text" class="form-control memo-time-input" value="${timeStr}" placeholder="00:00" style="width:60px; text-align:center; font-weight:bold; font-size:0.8rem; padding:0.25rem 0.2rem;">
        <select class="form-control memo-tag-select" style="width:100px; font-size:0.75rem; padding:0.25rem 0.3rem;">
            ${tagOptions}
        </select>
        <input type="text" class="form-control memo-text-input" value="${escapeHtml(textVal)}" placeholder="メモ（例: 左展開からクロス）" style="flex:1; font-size:0.8rem; padding:0.25rem 0.4rem;">
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.4rem; font-size:0.8rem;" title="削除"><i class="fa-solid fa-trash-can"></i></button>
    `;

    const btnSeek = div.querySelector('.btn-seek-video');
    if (btnSeek) {
        btnSeek.onclick = () => {
            const currentInputTime = div.querySelector('.memo-time-input')?.value || '00:00';
            seekToVideoTime(currentInputTime);
        };
    }

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
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.5rem; font-size:0.85rem;" title="削除"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function bindPeriodScoreButtons() {
    const modalForm = document.getElementById('modal-formation');
    if (!modalForm) return;

    const usInput = document.getElementById('formation-score-us');
    const usWrapper = usInput ? usInput.closest('.score-counter-wrapper') || usInput.parentElement : null;
    if (usWrapper) {
        const btnPlus = usWrapper.querySelector('.btn-score-plus');
        const btnMinus = usWrapper.querySelector('.btn-score-minus');

        if (btnPlus) {
            btnPlus.onclick = () => {
                let val = parseInt(usInput.value, 10) || 0;
                usInput.value = val + 1;
                addGoalRecordRow(null, null, 'period-goal-records-list');
            };
        }
        if (btnMinus) {
            btnMinus.onclick = () => {
                let val = parseInt(usInput.value, 10) || 0;
                if (val > 0) {
                    usInput.value = val - 1;
                    const container = document.getElementById('period-goal-records-list');
                    if (container && container.lastElementChild) {
                        container.lastElementChild.remove();
                    }
                }
            };
        }
    }
}

export function openFormationPlayerPicker(nodeEl) {
    const picker = document.getElementById('formation-player-picker');
    const select = document.getElementById('formation-picker-select');
    if (!picker || !select) return;

    const sorted = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
    select.innerHTML = '<option value="">-- 未選択 --</option>' + sorted.map(p => `
        <option value="${p.id}">${p.number} ${p.name} (${(Array.isArray(p.position) ? p.position : [p.position]).join('/')})</option>
    `).join('');

    select.value = nodeEl.dataset.playerId || '';

    picker.style.display = 'block';
    picker.style.top = `calc(${nodeEl.style.top} + 25px)`;
    picker.style.left = `calc(${nodeEl.style.left} - 70px)`;

    document.getElementById('btn-formation-picker-ok').onclick = () => {
        const val = select.value;
        if (val) {
            const playerId = parseInt(val, 10);
            const p = state.players.find(pl => pl.id === playerId);
            if (p) {
                nodeEl.dataset.playerId = p.id;
                nodeEl.innerHTML = `
                    <span class="pitch-node-role">${nodeEl.dataset.label}</span>
                    <span class="pitch-node-number">${p.number}</span>
                    <div class="pitch-node-name">${p.number} ${p.name}</div>
                `;
            }
        } else {
            nodeEl.removeAttribute('data-player-id');
            nodeEl.innerHTML = `
                <span class="pitch-node-role">${nodeEl.dataset.label}</span>
                <span class="pitch-node-number">${nodeEl.dataset.label}</span>
            `;
        }
        picker.style.display = 'none';
    };

    document.getElementById('btn-formation-picker-clear').onclick = () => {
        nodeEl.removeAttribute('data-player-id');
        nodeEl.innerHTML = `
            <span class="pitch-node-role">${nodeEl.dataset.label}</span>
            <span class="pitch-node-number">${nodeEl.dataset.label}</span>
        `;
        picker.style.display = 'none';
    };
}

export function renderFormationPitch(systemName, existingLineup = []) {
    const pitch = document.getElementById('tactical-formation-pitch');
    if (!pitch) return;

    const oldNodes = pitch.querySelectorAll('.pitch-node');
    oldNodes.forEach(node => node.remove());

    const customForm = state.customFormations.find(cf => cf.name === systemName);
    const coords = customForm ? customForm.coords : (formationCoords[systemName] || (state.customFormations.length > 0 ? state.customFormations[0].coords : []));

    coords.forEach((coord, index) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'pitch-node';

        const rawTop = parseFloat(coord.top) || 50;
        const halfTop = 12 + (rawTop * 0.76);

        nodeEl.style.top = `${halfTop}%`;
        nodeEl.style.left = coord.left;

        nodeEl.dataset.index = index;
        nodeEl.dataset.role = coord.role;
        nodeEl.dataset.label = coord.label;

        const assigned = existingLineup.find(l => l.roleLabel === coord.label || (existingLineup.length === coords.length && l.roleIndex === index));
        let playerText = '';
        let numberText = coord.label;

        if (assigned) {
            const p = state.players.find(pl => pl.id === assigned.playerId);
            if (p) {
                playerText = `<div class="pitch-node-name">${p.number} ${p.name}</div>`;
                numberText = p.number;
                nodeEl.dataset.playerId = p.id;
            }
        }

        nodeEl.innerHTML = `
            <span class="pitch-node-role">${coord.label}</span>
            <span class="pitch-node-number">${numberText}</span>
            ${playerText}
        `;

        nodeEl.onclick = (e) => {
            e.stopPropagation();
            openFormationPlayerPicker(nodeEl);
        };

        pitch.appendChild(nodeEl);
    });

    pitch.onclick = () => {
        const picker = document.getElementById('formation-player-picker');
        if (picker) picker.style.display = 'none';
    };
}

export function renderMatchRoster(selectedPlayerIds = []) {
    const container = document.getElementById('match-attendance-roster');
    if (!container) return;

    if (!state.players || state.players.length === 0) {
        container.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; margin:0;">登録されている選手がいません。「選手一覧」から選手を登録してください。</p>';
        return;
    }

    const sortedPlayers = [...state.players].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
    });

    container.innerHTML = sortedPlayers.map(p => {
        const isChecked = (selectedPlayerIds && selectedPlayerIds.includes(p.id)) ? 'checked' : '';
        return `
            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; cursor:pointer; padding:0.3rem 0; user-select:none;">
                <input type="checkbox" value="${p.id}" ${isChecked} style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer; margin:0; display:inline-block; opacity:1; visibility:visible;">
                <span style="color:var(--text-primary); font-weight:500;">${p.number}. ${escapeHtml(p.name)}</span>
            </label>
        `;
    }).join('');
}

export function openMatchModal(matchId = null) {
    const form = document.getElementById('form-match');
    if (form) {
        form.reset();
        form.onsubmit = (e) => {
            e.preventDefault();
            const scoreUs = document.getElementById('match-score-us').value;
            const scoreThem = document.getElementById('match-score-them').value;
            let goodStr = document.getElementById('match-comments-good').value.trim();
            let improveStr = document.getElementById('match-comments-improve').value.trim();
            let commentsStr = '';
            if (goodStr || improveStr) {
                commentsStr = '【ポジティブ】\n' + goodStr + '\n\n【ネクストステップ】\n' + improveStr;
            }

            let resultStr = "";
            if (scoreUs !== "" && scoreThem !== "") {
                resultStr = `${scoreUs}-${scoreThem}`;
            }

            const goalRecords = [];
            const rows = document.querySelectorAll('#goal-records-list .goal-record-row');
            const scorersList = [];

            rows.forEach(row => {
                const scorerVal = row.querySelector('.goal-scorer-select')?.value;
                const assistVal = row.querySelector('.goal-assist-select')?.value;
                const scorerId = scorerVal ? parseInt(scorerVal, 10) : null;
                const assistId = assistVal ? parseInt(assistVal, 10) : null;

                goalRecords.push({ scorerId, assistId });

                let text = '';
                if (scorerId) {
                    const sPlayer = state.players.find(p => p.id === scorerId);
                    text += sPlayer ? `${sPlayer.name}` : '不明な選手';
                } else {
                    text += 'オウンゴール/その他';
                }
                if (assistId) {
                    const aPlayer = state.players.find(p => p.id === assistId);
                    text += aPlayer ? ` (アシスト:${aPlayer.name})` : '';
                }
                scorersList.push(text);
            });
            const scorersStr = scorersList.join(', ');

            const presentPlayerIds = Array.from(document.querySelectorAll('#match-attendance-roster input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));

            const editId = document.getElementById('match-edit-id').value;
            if (editId) {
                const match = state.matches.find(m => m.id === parseInt(editId, 10));
                if (match) {
                    match.date = document.getElementById('match-date').value;
                    match.opponent = document.getElementById('match-opponent').value;
                    match.type = document.getElementById('match-type').value;
                    match.tournament = document.getElementById('match-tournament').value;
                    match.result = resultStr;
                    match.scorers = scorersStr;
                    match.goalRecords = goalRecords;
                    match.comments = commentsStr;
                    match.presentPlayerIds = presentPlayerIds;
                    saveData();
                    showToast('試合情報を更新しました');
                }
            } else {
                const newMatch = {
                    id: Date.now(),
                    date: document.getElementById('match-date').value,
                    opponent: document.getElementById('match-opponent').value,
                    type: document.getElementById('match-type').value,
                    tournament: document.getElementById('match-tournament').value,
                    result: resultStr,
                    scorers: scorersStr,
                    goalRecords: goalRecords,
                    comments: commentsStr,
                    playerFeedback: [],
                    formations: [],
                    presentPlayerIds: presentPlayerIds
                };
                state.matches.unshift(newMatch);
                saveData();
                showToast('試合を記録しました');
            }

            document.getElementById('modal-match').classList.add('hidden');
            navigate('matches');
        };
    }

    const editIdEl = document.getElementById('match-edit-id');
    if (editIdEl) editIdEl.value = '';

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
            if (editIdEl) editIdEl.value = m.id;
            const dateEl = document.getElementById('match-date');
            if (dateEl) dateEl.value = m.date;

            const oppEl = document.getElementById('match-opponent');
            if (oppEl) oppEl.value = m.opponent;

            if (select) select.value = m.type;

            const tourEl = document.getElementById('match-tournament');
            if (tourEl) tourEl.value = m.tournament || '';

            const scoreUsEl = document.getElementById('match-score-us');
            const scoreThemEl = document.getElementById('match-score-them');

            if (m.result && m.result.includes('-')) {
                const scores = m.result.split('-');
                if (scoreUsEl) scoreUsEl.value = scores[0];
                if (scoreThemEl) scoreThemEl.value = scores[1];
            } else {
                if (scoreUsEl) scoreUsEl.value = '';
                if (scoreThemEl) scoreThemEl.value = '';
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
            const goodEl = document.getElementById('match-comments-good');
            if (goodEl) goodEl.value = good;

            const impEl = document.getElementById('match-comments-improve');
            if (impEl) impEl.value = improve;

            if (title) title.textContent = '試合情報を編集';

            const activeIds = m.presentPlayerIds || [];
            renderMatchRoster(activeIds);
        }
    } else {
        const allPlayerIds = state.players.map(p => p.id);
        renderMatchRoster(allPlayerIds);
    }

    const modalMatch = document.getElementById('modal-match');
    if (modalMatch) {
        const btnPlus = modalMatch.querySelector('.score-counter-wrapper .btn-score-plus');
        const btnMinus = modalMatch.querySelector('.score-counter-wrapper .btn-score-minus');

        if (btnPlus) {
            btnPlus.onclick = (e) => {
                const input = modalMatch.querySelector('#match-score-us');
                if (input) {
                    let val = parseInt(input.value, 10) || 0;
                    input.value = val + 1;
                    addGoalRecordRow(null, null, 'goal-records-list');
                }
            };
        }
        if (btnMinus) {
            btnMinus.onclick = (e) => {
                const input = modalMatch.querySelector('#match-score-us');
                if (input) {
                    let val = parseInt(input.value, 10) || 0;
                    if (val > 0) {
                        input.value = val - 1;
                        const container = document.getElementById('goal-records-list');
                        if (container && container.lastElementChild) {
                            container.lastElementChild.remove();
                        }
                    }
                }
            };
        }
    }

    const matchDetailModal = document.getElementById('modal-match-detail');
    if (matchDetailModal) matchDetailModal.classList.add('hidden');

    openModal('modal-match');
}

export function initMatchDetailView(matchId) {
    if (!matchId) {
        const urlParams = new URLSearchParams(window.location.search);
        const paramId = urlParams.get('matchId');
        if (paramId) {
            matchId = parseInt(paramId, 10);
        }
    }

    if (!matchId && state.matches.length > 0) {
        matchId = state.matches[0].id;
    }

    const m = state.matches.find(match => Number(match.id) === Number(matchId));
    if (!m) {
        if (state.matches.length === 0) {
            setTimeout(() => initMatchDetailView(matchId), 100);
            return;
        }
        showToast('該当する試合データが見つかりません');
        navigate('matches');
        return;
    }

    currentMatchId = m.id;
    const isCoach = state.currentUserRole === 'coach';

    const btnBackToMatches = document.getElementById('btn-back-to-matches');
    if (btnBackToMatches) {
        btnBackToMatches.onclick = (e) => {
            e.preventDefault();
            if (typeof window.stopAndCleanupYouTube === 'function') {
                window.stopAndCleanupYouTube();
            }
            navigate('matches');
        };
    }

    const metaEl = document.getElementById('match-detail-meta');
    if (metaEl) {
        metaEl.textContent = `${m.date || ''} | ${m.type || ''}${m.tournament ? ` (${m.tournament})` : ''}`;
    }

    const titleEl = document.getElementById('match-detail-title');
    if (titleEl) {
        titleEl.textContent = `vs ${m.opponent || '対戦相手'}`;
    }

    const themeEl = document.getElementById('match-detail-theme');
    if (themeEl) themeEl.textContent = m.theme || '未設定';

    const summaryEl = document.getElementById('match-detail-summary');
    if (summaryEl) summaryEl.textContent = m.comments || '記録なし';

    const detailRosterDisplay = document.getElementById('match-detail-attendance-roster-display');
    const detailAttendanceSummary = document.getElementById('match-detail-attendance-summary');
    if (detailRosterDisplay && detailAttendanceSummary) {
        const attendeesHtml = m.presentPlayerIds && m.presentPlayerIds.length > 0
            ? state.players.filter(pl => m.presentPlayerIds.includes(pl.id)).map(pl => `
                <span style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; font-size:0.7rem; font-weight:600; padding:0.15rem 0.4rem; border-radius:9999px; gap:0.25rem; white-space:nowrap;">
                    ${pl.number ? `<span style="background:var(--primary); color:#ffffff; font-size:0.55rem; width:14px; height:14px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0;">${pl.number}</span>` : ''}
                    <span style="flex-shrink:0;">${escapeHtml(pl.name)}</span>
                </span>
            `).join('')
            : '<span style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">メンバー登録がありません</span>';
        
        detailRosterDisplay.innerHTML = attendeesHtml;
        detailAttendanceSummary.textContent = `参加者 (${m.presentPlayerIds ? `${m.presentPlayerIds.length}/${state.players.length}` : `0/${state.players.length}`})`;
    }

    const btnEditMatch = document.getElementById('btn-edit-match');
    if (btnEditMatch) {
        btnEditMatch.style.display = isCoach ? 'inline-flex' : 'none';
        btnEditMatch.onclick = () => openMatchModal(m.id);
    }

    const btnAddFormation = document.getElementById('btn-add-formation');
    if (btnAddFormation) {
        btnAddFormation.style.display = isCoach ? 'inline-flex' : 'none';
        btnAddFormation.onclick = () => {
            if (typeof window.editFormation === 'function') {
                window.editFormation(m.id, null);
            }
        };
    }

    renderPeriodGrid(m);
}

export function openMatchDetail(id) {
    navigate('match-detail', { matchId: id });
}

function renderPeriodGrid(m) {
    const grid = document.getElementById('match-period-grid');
    const isCoach = state.currentUserRole === 'coach';
    if (!grid) return;

    if (!m.formations || m.formations.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-secondary); background:rgba(0,0,0,0.02); border-radius:8px; border:1px dashed var(--surface-border);">ピリオドが登録されていません。「＋ ピリオド追加」から作成してください。</div>';
        return;
    }

    grid.innerHTML = m.formations.map((f, idx) => {
        const scoreUs = f.scoreUs !== undefined ? f.scoreUs : 0;
        const scoreThem = f.scoreThem !== undefined ? f.scoreThem : 0;
        const videoBadge = (f.videoUrls?.length || f.videoUrl) ? '<i class="fa-brands fa-youtube" style="color:#ef4444;" title="動画あり"></i>' : '';

        let goalDetailsHtml = '';
        if (f.goalRecords && f.goalRecords.length > 0) {
            goalDetailsHtml = f.goalRecords.map(r => {
                let text = '';
                if (r.scorerId) {
                    const sPlayer = state.players.find(p => p.id === r.scorerId);
                    text += sPlayer ? `${sPlayer.name}` : '選手';
                } else {
                    text += 'OG/その他';
                }
                if (r.assistId) {
                    const aPlayer = state.players.find(p => p.id === r.assistId);
                    text += aPlayer ? ` (A: ${aPlayer.name})` : '';
                }
                return `<div style="font-size:0.78rem; color:var(--text-primary); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">⚽ ${escapeHtml(text)}</div>`;
            }).join('');
        }

        const memoList = f.analysisMemos || [];
        const memosHtml = memoList.length > 0
            ? memoList.slice(0, 2).map(memo => {
                let icon = '💡';
                if (memo.tag === '得点') icon = '⚽';
                else if (memo.tag === '失点') icon = '⚠️';
                else if (memo.tag === '課題/反省') icon = '📌';
                return `<div style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${icon} ${escapeHtml(memo.time || '00:00')} ${escapeHtml(memo.text || memo.tag)}</div>`;
            }).join('')
            : '';

        const goalsHtml = (goalDetailsHtml || memosHtml)
            ? `${goalDetailsHtml}${memosHtml}`
            : '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">記録なし</div>';

        return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:0.8rem; padding:1rem; margin:0; border:1px solid var(--surface-border);">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; border-bottom:1px solid var(--surface-border); padding-bottom:0.4rem;">
                        <strong style="font-size:1rem; color:var(--primary);">${escapeHtml(f.name || `${idx + 1}本目`)}</strong>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            ${videoBadge}
                            <span class="badge" style="background:var(--primary); color:#fff; font-weight:bold; font-size:0.85rem;">${scoreUs} - ${scoreThem}</span>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:0.4rem; margin-bottom:0.6rem;">
                        <span class="badge" style="background:rgba(0,0,0,0.05); color:var(--text-primary); font-size:0.72rem;">陣形: ${escapeHtml(f.system || '未設定')}</span>
                    </div>

                    <div style="background:rgba(0,0,0,0.02); padding:0.5rem; border-radius:6px; margin-bottom:0.6rem; display:flex; flex-direction:column; gap:0.25rem;">
                        ${goalsHtml}
                    </div>

                    <div style="font-size:0.8rem; color:var(--text-primary); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                        💬 ${escapeHtml(f.summary || f.reflection || '総括コメント未入力')}
                    </div>
                </div>

                <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                    <button class="btn btn-primary btn-sm btn-open-analysis" data-index="${idx}" style="flex:1; justify-content:center; font-size:0.8rem; padding:0.4rem;"><i class="fa-solid fa-film"></i> 動画分析 ➔</button>
                    ${isCoach ? `<button class="btn btn-secondary btn-sm btn-edit-period-card" data-id="${f.id}" style="padding:0.4rem 0.6rem;" title="ピリオド編集"><i class="fa-solid fa-pen"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.btn-open-analysis').forEach(btn => {
        btn.onclick = (e) => {
            const periodIdx = parseInt(e.currentTarget.dataset.index, 10);
            openPeriodAnalysis(m.id, periodIdx);
        };
    });

    grid.querySelectorAll('.btn-edit-period-card').forEach(btn => {
        btn.onclick = (e) => {
            const formId = parseInt(e.currentTarget.dataset.id, 10);
            if (typeof window.editFormation === 'function') {
                window.editFormation(m.id, formId);
            }
        };
    });
}

window.stopAndCleanupYouTube = function () {
    if (ytPlayer) {
        try {
            if (typeof ytPlayer.stopVideo === 'function') {
                ytPlayer.stopVideo();
            }
            if (typeof ytPlayer.destroy === 'function') {
                ytPlayer.destroy();
            }
        } catch (e) {
            console.error('YouTube cleanup error:', e);
        }
        ytPlayer = null;
    }
};

// 階層2: 大画面分析の初期化
export function openPeriodAnalysis(matchId, periodIndex) {
    cleanupPeriodSideEvents();

    const match = state.matches.find(m => m.id === matchId);
    const isCoach = state.currentUserRole === 'coach';
    if (!match || !match.formations || !match.formations[periodIndex]) return;

    currentMatchId = matchId;
    currentPeriodIndex = periodIndex;
    const period = match.formations[periodIndex];

    const periodAnalysisModal = document.getElementById('modal-period-analysis');
    if (periodAnalysisModal) {
        periodAnalysisModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    const titleEl = document.getElementById('period-analysis-title');
    if (titleEl) {
        titleEl.textContent = `vs ${escapeHtml(match.opponent)} - ${period.name || `${periodIndex + 1}本目`} (${period.scoreUs || 0} - ${period.scoreThem || 0})`;
        titleEl.title = titleEl.textContent;
        titleEl.style.cursor = 'pointer';
        titleEl.onclick = () => showToast(titleEl.textContent);
    }

    // --- サイドパネルおよび要素の取得 ---
    const sidePanel = document.getElementById('period-info-side-panel');
    const sideToggleBtn = document.getElementById('period-info-side-toggle-btn');
    const sideHeading = document.getElementById('period-side-panel-heading');
    const sideBody = document.getElementById('period-side-panel-body');

    // 画面を開き直したときは、サイドパネルを必ず「閉じた状態」に初期化
    if (sidePanel) {
        sidePanel.classList.add('collapsed');
        sidePanel.classList.remove('open');
    }

    // 既存のタイムライン監視タイマーをクリア
    if (timelineInterval) {
        clearInterval(timelineInterval);
        timelineInterval = null;
    }

    // --- サイドパネル内のコンテンツを描画する関数 ---
    const renderSidePanelContent = () => {
        if (!sideBody) return;

        if (isCoach) {
            // コーチモード：編集フォーム（ミニピッチ付き）
            if (sideHeading) sideHeading.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--primary);"></i> ピリオド情報編集';

            const systemOptions = state.customFormations.map(cf => `<option value="${cf.name}" ${period.system === cf.name ? 'selected' : ''}>${cf.name} (${cf.coords.length}人制)</option>`).join('');

            // 1. 得点記録の行HTML生成
            let goalRowsHtml = '';
            if (period.goalRecords && period.goalRecords.length > 0) {
                goalRowsHtml = period.goalRecords.map((r, rIdx) => {
                    const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
                    const scorerOpts = `<option value="">得点者なし/OG</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id === r.scorerId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
                    const assistOpts = `<option value="">アシストなし</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id === r.assistId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');

                    return `
                        <div class="side-goal-row" data-index="${rIdx}" style="display:flex; flex-direction:column; gap:0.25rem; background:rgba(0,0,0,0.02); padding:0.4rem; border-radius:6px; border:1px solid var(--surface-border); margin-bottom:0.3rem;">
                            <div style="display:flex; gap:0.3rem; align-items:center;">
                                <span style="font-size:0.7rem; font-weight:bold; color:var(--text-secondary); width:20px;">#${rIdx + 1}</span>
                                <select class="form-control form-control-sm side-scorer-select" style="font-size:0.75rem; padding:0.2rem; flex:1;">${scorerOpts}</select>
                                <button type="button" class="btn btn-danger btn-xs btn-remove-side-goal" style="padding:0.1rem 0.3rem; font-size:0.7rem;" title="この得点記録を削除"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            <div style="display:flex; gap:0.3rem; align-items:center; padding-left:20px;">
                                <select class="form-control form-control-sm side-assist-select" style="font-size:0.75rem; padding:0.2rem; flex:1;">${assistOpts}</select>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 2. ミニピッチ図 ＆ ポジション配置ピン
            const currentCustomForm = state.customFormations.find(cf => cf.name === period.system) || state.customFormations[0];
            let pitchPinsHtml = '';
            let posListHtml = '';

            if (currentCustomForm && currentCustomForm.coords) {
                if (!period.positions) period.positions = {};
                const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));

                pitchPinsHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;
                    const assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const labelText = assignedPlayer ? (assignedPlayer.number ? `#${assignedPlayer.number}` : assignedPlayer.name.slice(0, 3)) : (c.role ? c.role.slice(0, 3) : `P${pIdx + 1}`);

                    const leftPercent = (c.x !== undefined && !isNaN(c.x)) ? c.x : 50;
                    const topPercent = (c.y !== undefined && !isNaN(c.y)) ? c.y : 50;

                    return `
                        <div class="side-pitch-pin" data-pos-key="${posKey}" style="position:absolute; left:${leftPercent}%; top:${topPercent}%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:5;" title="${c.role || `ポジション${pIdx + 1}`}">
                            <div style="width:26px; height:26px; background:var(--primary); color:#fff; border-radius:50%; font-size:0.65rem; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.4); border:1.5px solid #fff;">
                                ${labelText}
                            </div>
                        </div>
                    `;
                }).join('');

                posListHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;
                    const assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    const playerOpts = `<option value="">未割当</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id == assignedPlayerId ? 'selected' : ''}>${p.number ? `#${p.number}` : ''} ${p.name}</option>`).join('');

                    return `
                        <div class="side-position-row" data-pos-key="${posKey}" style="display:flex; align-items:center; gap:0.4rem; background:rgba(0,0,0,0.02); padding:0.3rem 0.4rem; border-radius:6px; border:1px solid var(--surface-border); margin-bottom:0.25rem;">
                            <span style="font-size:0.72rem; font-weight:bold; color:var(--text-secondary); width:55px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.role || `P${pIdx + 1}`}">${c.role || `${pIdx + 1}`}</span>
                            <select class="form-control form-control-sm side-pos-player-select" style="font-size:0.75rem; padding:0.15rem; flex:1;">${playerOpts}</select>
                        </div>
                    `;
                }).join('');
            }

            sideBody.innerHTML = `
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド名</span>
                    <input type="text" id="side-form-name" class="form-control form-control-sm" value="${escapeHtml(period.name || '')}">
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">YouTube動画 URL</span>
                    <input type="url" id="side-form-video" class="form-control form-control-sm" value="${escapeHtml((period.videoUrls && period.videoUrls[0]) || period.videoUrl || '')}" placeholder="https://youtu.be/...">
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">スコア (自 - 相手)</span>
                    <div style="display:flex; align-items:center; justify-content:space-between; background:var(--card-bg); padding:0.3rem 0.5rem; border:1px solid var(--surface-border); border-radius:6px;">
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            <span style="font-size:0.8rem; font-weight:bold; color:var(--text-secondary);">自</span>
                            <button type="button" class="btn btn-secondary btn-xs" id="btn-side-us-minus" style="padding:0.15rem 0.4rem;"><i class="fa-solid fa-minus"></i></button>
                            <span id="side-score-us-display" style="font-weight:700; font-size:1.1rem; min-width:24px; text-align:center;">${period.scoreUs || 0}</span>
                            <button type="button" class="btn btn-secondary btn-xs" id="btn-side-us-plus" style="padding:0.15rem 0.4rem;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <span style="font-weight:bold; color:var(--text-secondary);">-</span>
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            <button type="button" class="btn btn-secondary btn-xs" id="btn-side-them-minus" style="padding:0.15rem 0.4rem;"><i class="fa-solid fa-minus"></i></button>
                            <span id="side-score-them-display" style="font-weight:700; font-size:1.1rem; min-width:24px; text-align:center;">${period.scoreThem || 0}</span>
                            <button type="button" class="btn btn-secondary btn-xs" id="btn-side-them-plus" style="padding:0.15rem 0.4rem;"><i class="fa-solid fa-plus"></i></button>
                            <span style="font-size:0.8rem; font-weight:bold; color:var(--text-secondary);">相</span>
                        </div>
                    </div>
                </div>
                <div class="side-info-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                        <span class="side-info-label" style="margin:0;">得点者・アシスト記録</span>
                        <button type="button" class="btn btn-primary btn-xs" id="btn-add-side-goal" style="font-size:0.68rem; padding:0.15rem 0.4rem;"><i class="fa-solid fa-plus"></i> 追加</button>
                    </div>
                    <div id="side-goal-records-container" style="display:flex; flex-direction:column; max-height:150px; overflow-y:auto;">
                        ${goalRowsHtml || '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">得点記録なし</div>'}
                    </div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド総括</span>
                    <textarea id="side-form-summary" class="form-control form-control-sm" rows="3">${escapeHtml(period.summary || period.reflection || '')}</textarea>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">システム (陣形)</span>
                    <select id="side-form-system" class="form-control form-control-sm">${systemOptions}</select>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label" style="margin-bottom:0.3rem;">ポジション配置（ミニピッチ図）</span>
                    <div id="side-mini-pitch" style="position:relative; width:100%; height:260px; background: linear-gradient(to bottom, #2e7d32, #388e3c); border-radius:6px; border:1px solid var(--surface-border); overflow:hidden; margin-bottom:0.5rem; box-shadow:inset 0 0 10px rgba(0,0,0,0.2);">
                        <div style="position:absolute; top:50%; left:0; width:100%; height:1px; background:rgba(255,255,255,0.4);"></div>
                        <div style="position:absolute; top:50%; left:50%; width:60px; height:60px; border:1px solid rgba(255,255,255,0.4); border-radius:50%; transform:translate(-50%, -50%);"></div>
                        <div style="position:absolute; top:0; left:30%; width:40%; height:12%; border:1px solid rgba(255,255,255,0.4); border-top:none;"></div>
                        <div style="position:absolute; bottom:0; left:30%; width:40%; height:12%; border:1px solid rgba(255,255,255,0.4); border-bottom:none;"></div>
                        ${pitchPinsHtml}
                    </div>
                    <div id="side-positions-container" style="display:flex; flex-direction:column; max-height:180px; overflow-y:auto;">
                        ${posListHtml || '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">ポジション設定がありません</div>'}
                    </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" id="btn-side-save-period" style="width:100%; justify-content:center; margin-top:0.4rem;">
                    <i class="fa-solid fa-save"></i> 変更を保存
                </button>
            `;

            // --- 入力値の収集用ヘルパー関数 ---
            const collectCurrentFormValues = () => {
                const goalRecords = [];
                sideBody.querySelectorAll('.side-goal-row').forEach(row => {
                    const sVal = row.querySelector('.side-scorer-select').value;
                    const aVal = row.querySelector('.side-assist-select').value;
                    goalRecords.push({
                        scorerId: sVal ? parseInt(sVal, 10) : null,
                        assistId: aVal ? parseInt(aVal, 10) : null
                    });
                });

                const positions = {};
                sideBody.querySelectorAll('.side-position-row').forEach(row => {
                    const posKey = row.dataset.posKey;
                    const pVal = row.querySelector('.side-pos-player-select').value;
                    if (pVal) {
                        positions[posKey] = parseInt(pVal, 10);
                    }
                });

                return {
                    name: document.getElementById('side-form-name').value.trim(),
                    system: document.getElementById('side-form-system').value,
                    videoUrl: document.getElementById('side-form-video').value.trim(),
                    scoreUs: period.scoreUs || 0,
                    scoreThem: period.scoreThem || 0,
                    summary: document.getElementById('side-form-summary').value.trim(),
                    goalRecords: goalRecords,
                    positions: positions
                };
            };

            // ピンをクリックした際のフォーカス挙動
            sideBody.querySelectorAll('.side-pitch-pin').forEach(pin => {
                pin.onclick = (e) => {
                    e.stopPropagation();
                    const key = pin.dataset.posKey;
                    const targetRow = sideBody.querySelector(`.side-position-row[data-pos-key="${key}"]`);
                    if (targetRow) {
                        const selectEl = targetRow.querySelector('.side-pos-player-select');
                        if (selectEl) {
                            selectEl.focus();
                        }
                        targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        targetRow.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
                        setTimeout(() => { targetRow.style.backgroundColor = 'rgba(0,0,0,0.02)'; }, 1000);
                    }
                };
            });

            // システム変更時に再描画
            const systemSelect = document.getElementById('side-form-system');
            if (systemSelect) {
                systemSelect.onchange = (e) => {
                    period.system = e.target.value;
                    renderSidePanelContent();
                };
            }

            // スコアカウンター等のイベント
            const btnUsMinus = document.getElementById('btn-side-us-minus');
            if (btnUsMinus) {
                btnUsMinus.onclick = () => {
                    if (period.scoreUs > 0) {
                        period.scoreUs--;
                        if (period.goalRecords && period.goalRecords.length > period.scoreUs) {
                            period.goalRecords.pop();
                        }
                        renderSidePanelContent();
                    }
                };
            }

            const btnUsPlus = document.getElementById('btn-side-us-plus');
            if (btnUsPlus) {
                btnUsPlus.onclick = () => {
                    period.scoreUs = (period.scoreUs || 0) + 1;
                    if (!period.goalRecords) period.goalRecords = [];
                    period.goalRecords.push({ scorerId: null, assistId: null });
                    renderSidePanelContent();
                };
            }

            const btnThemMinus = document.getElementById('btn-side-them-minus');
            if (btnThemMinus) {
                btnThemMinus.onclick = () => {
                    if (period.scoreThem > 0) {
                        period.scoreThem--;
                        renderSidePanelContent();
                    }
                };
            }

            const btnThemPlus = document.getElementById('btn-side-them-plus');
            if (btnThemPlus) {
                btnThemPlus.onclick = () => {
                    if (!period.scoreThem) period.scoreThem = 0;
                    period.scoreThem++;
                    renderSidePanelContent();
                };
            }

            const btnAddGoal = document.getElementById('btn-add-side-goal');
            if (btnAddGoal) {
                btnAddGoal.onclick = () => {
                    period.scoreUs = (period.scoreUs || 0) + 1;
                    if (!period.goalRecords) period.goalRecords = [];
                    period.goalRecords.push({ scorerId: null, assistId: null });
                    renderSidePanelContent();
                };
            }

            sideBody.querySelectorAll('.btn-remove-side-goal').forEach(btn => {
                btn.onclick = (e) => {
                    const rIdx = parseInt(e.currentTarget.closest('.side-goal-row').dataset.index, 10);
                    if (period.goalRecords) {
                        period.goalRecords.splice(rIdx, 1);
                        period.scoreUs = Math.max(0, (period.scoreUs || 0) - 1);
                        renderSidePanelContent();
                    }
                };
            });

            const btnSave = document.getElementById('btn-side-save-period');
            if (btnSave) {
                btnSave.onclick = () => {
                    const finalData = collectCurrentFormValues();
                    period.name = finalData.name;
                    period.system = finalData.system;
                    period.videoUrl = finalData.videoUrl;
                    period.videoUrls = finalData.videoUrl ? [finalData.videoUrl] : [];
                    period.scoreUs = finalData.scoreUs;
                    period.scoreThem = finalData.scoreThem;
                    period.summary = finalData.summary;
                    period.goalRecords = finalData.goalRecords;
                    period.positions = finalData.positions;

                    let totalUs = 0, totalThem = 0;
                    const allMatchGoalRecords = [];
                    const scorersList = [];

                    match.formations.forEach(f => {
                        totalUs += (f.scoreUs || 0);
                        totalThem += (f.scoreThem || 0);
                        if (f.goalRecords) {
                            allMatchGoalRecords.push(...f.goalRecords);
                            f.goalRecords.forEach(r => {
                                let txt = '';
                                if (r.scorerId) {
                                    const sp = state.players.find(p => p.id === r.scorerId);
                                    txt += sp ? sp.name : '選手';
                                } else {
                                    txt += 'OG/その他';
                                }
                                if (r.assistId) {
                                    const ap = state.players.find(p => p.id === r.assistId);
                                    txt += ap ? ` (A:${ap.name})` : '';
                                }
                                scorersList.push(txt);
                            });
                        }
                    });

                    match.goalRecords = allMatchGoalRecords;
                    match.scorers = scorersList.join(', ');
                    match.result = `${totalUs}-${totalThem}`;

                    saveData();
                    showToast('ピリオド情報とポジション配置を保存しました');
                    openPeriodAnalysis(matchId, periodIndex);
                };
            }
        } else {
            // 保護者モード：閲覧専用プレビュー（コーチモードと同じすべての情報を網羅）
            if (sideHeading) sideHeading.innerHTML = '<i class="fa-solid fa-circle-info" style="color:var(--primary);"></i> ピリオド情報';

            const videoUrl = (period.videoUrls && period.videoUrls[0]) || period.videoUrl || '';

            let goalDetailsHtml = '';
            if (period.goalRecords && period.goalRecords.length > 0) {
                goalDetailsHtml = period.goalRecords.map(r => {
                    let text = '';
                    if (r.scorerId) {
                        const sPlayer = state.players.find(p => p.id === r.scorerId);
                        text += sPlayer ? `${sPlayer.name}` : '選手';
                    } else {
                        text += 'OG/その他';
                    }
                    if (r.assistId) {
                        const aPlayer = state.players.find(p => p.id === r.assistId);
                        text += aPlayer ? ` (A: ${aPlayer.name})` : '';
                    }
                    return `<div style="font-size:0.8rem; color:var(--text-primary); font-weight:500;">⚽ ${escapeHtml(text)}</div>`;
                }).join('');
            }

            // ミニピッチ図 ＆ ポジション配置の閲覧用HTML生成
            const currentCustomForm = state.customFormations.find(cf => cf.name === period.system) || state.customFormations[0];
            let pitchPinsHtml = '';
            let posListHtml = '';

            if (currentCustomForm && currentCustomForm.coords) {
                if (!period.positions) period.positions = {};

                pitchPinsHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;
                    const assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const labelText = assignedPlayer ? (assignedPlayer.number ? `#${assignedPlayer.number}` : assignedPlayer.name.slice(0, 3)) : (c.role ? c.role.slice(0, 3) : `P${pIdx + 1}`);

                    const leftPercent = (c.x !== undefined && !isNaN(c.x)) ? c.x : 50;
                    const topPercent = (c.y !== undefined && !isNaN(c.y)) ? c.y : 50;

                    return `
                        <div class="side-pitch-pin" data-pos-key="${posKey}" style="position:absolute; left:${leftPercent}%; top:${topPercent}%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:5;" title="${c.role || `ポジション${pIdx + 1}`}">
                            <div style="width:26px; height:26px; background:var(--primary); color:#fff; border-radius:50%; font-size:0.65rem; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.4); border:1.5px solid #fff;">
                                ${labelText}
                            </div>
                        </div>
                    `;
                }).join('');
 
                posListHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;
                    const assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const playerName = assignedPlayer ? `${assignedPlayer.number ? `#${assignedPlayer.number} ` : ''}${assignedPlayer.name}` : '未割当';
 
                    return `
                        <div class="side-position-row" data-pos-key="${posKey}" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.02); padding:0.3rem 0.5rem; border-radius:6px; border:1px solid var(--surface-border); margin-bottom:0.25rem; font-size:0.8rem;">
                            <span style="font-weight:bold; color:var(--text-secondary);">${escapeHtml(c.role || `${pIdx + 1}`)}</span>
                            <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(playerName)}</span>
                        </div>
                    `;
                }).join('');
            }

            sideBody.innerHTML = `
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド名</span>
                    <div class="side-info-val" style="font-weight:700;">${escapeHtml(period.name || '未設定')}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">YouTube動画 URL</span>
                    <div class="side-info-val">
                        ${videoUrl ? `<a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:underline; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> ${escapeHtml(videoUrl)}</a>` : '<span style="color:var(--text-secondary); font-style:italic;">URLなし</span>'}
                    </div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">スコア (自 - 相手)</span>
                    <div class="side-info-val" style="font-weight:700; color:var(--primary); font-size:1.1rem;">${period.scoreUs || 0} - ${period.scoreThem || 0}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label" style="margin-bottom:0.3rem;">得点者・アシスト記録</span>
                    ${goalDetailsHtml ? `<div style="display:flex; flex-direction:column; gap:0.2rem;">${goalDetailsHtml}</div>` : '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">得点記録なし</div>'}
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド総括</span>
                    <div class="side-info-val" style="white-space:pre-wrap;">${escapeHtml(period.summary || period.reflection || '総括コメントはありません。')}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">システム (陣形)</span>
                    <div class="side-info-val" style="font-weight:700;">${escapeHtml(period.system || '未設定')}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label" style="margin-bottom:0.3rem;">ポジション配置（ミニピッチ図）</span>
                    <div style="position:relative; width:100%; height:260px; background: linear-gradient(to bottom, #2e7d32, #388e3c); border-radius:6px; border:1px solid var(--surface-border); overflow:hidden; margin-bottom:0.5rem; box-shadow:inset 0 0 10px rgba(0,0,0,0.2);">
                        <div style="position:absolute; top:50%; left:0; width:100%; height:1px; background:rgba(255,255,255,0.4);"></div>
                        <div style="position:absolute; top:50%; left:50%; width:60px; height:60px; border:1px solid rgba(255,255,255,0.4); border-radius:50%; transform:translate(-50%, -50%);"></div>
                        <div style="position:absolute; top:0; left:30%; width:40%; height:12%; border:1px solid rgba(255,255,255,0.4); border-top:none;"></div>
                        <div style="position:absolute; bottom:0; left:30%; width:40%; height:12%; border:1px solid rgba(255,255,255,0.4); border-bottom:none;"></div>
                        ${pitchPinsHtml}
                    </div>
                    <div style="display:flex; flex-direction:column; max-height:180px; overflow-y:auto;">
                        ${posListHtml || '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">ポジション設定がありません</div>'}
                    </div>
                </div>
            `;

            // ピンをクリックした際のフォーカス・ハイライト挙動
            sideBody.querySelectorAll('.side-pitch-pin').forEach(pin => {
                pin.onclick = (e) => {
                    e.stopPropagation();
                    const key = pin.dataset.posKey;
                    const targetRow = sideBody.querySelector(`.side-position-row[data-pos-key="${key}"]`);
                    if (targetRow) {
                        targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        targetRow.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
                        setTimeout(() => { targetRow.style.backgroundColor = 'rgba(0,0,0,0.02)'; }, 1000);
                    }
                };
            });
        }
    };

    renderSidePanelContent();

    // サイドパネル開閉トグル
    if (sideToggleBtn && sidePanel) {
        sideToggleBtn.onclick = (e) => {
            e.stopPropagation();
            renderSidePanelContent();
            const isOpen = sidePanel.classList.toggle('open');
            sidePanel.classList.toggle('collapsed', !isOpen);
        };

        // click / touch outside to close sidebar
        periodSideClickOutsideHandler = (e) => {
            if (sidePanel.classList.contains('open')) {
                if (!sidePanel.contains(e.target) && !sideToggleBtn.contains(e.target)) {
                    sidePanel.classList.remove('open');
                    sidePanel.classList.add('collapsed');
                }
            }
        };
        setTimeout(() => {
            if (periodSideClickOutsideHandler) {
                document.addEventListener('click', periodSideClickOutsideHandler);
                document.addEventListener('touchstart', periodSideClickOutsideHandler);
            }
        }, 0);

        // Escape key to close sidebar
        periodSideKeyDownHandler = (e) => {
            if (e.key === 'Escape') {
                if (sidePanel.classList.contains('open')) {
                    sidePanel.classList.remove('open');
                    sidePanel.classList.add('collapsed');
                }
            }
        };
        document.addEventListener('keydown', periodSideKeyDownHandler);
    }

    // --- ピリオド遷移ナビ ---
    const periodNameInd = document.getElementById('current-period-name-indicator');
    if (periodNameInd) {
        periodNameInd.textContent = period.name || `${periodIndex + 1}本目`;
    }

    const btnPrev = document.getElementById('btn-period-prev');
    const btnNext = document.getElementById('btn-period-next');
    if (btnPrev) {
        btnPrev.disabled = periodIndex <= 0;
        btnPrev.onclick = () => openPeriodAnalysis(matchId, periodIndex - 1);
    }
    if (btnNext) {
        btnNext.disabled = periodIndex >= match.formations.length - 1;
        btnNext.onclick = () => openPeriodAnalysis(matchId, periodIndex + 1);
    }

    const btnBack = document.getElementById('btn-back-to-match-detail');
    if (btnBack) {
        btnBack.onclick = (e) => {
            e.preventDefault();
            cleanupPeriodSideEvents();
            if (typeof window.stopAndCleanupYouTube === 'function') {
                window.stopAndCleanupYouTube();
            }
            if (timelineInterval) {
                clearInterval(timelineInterval);
                timelineInterval = null;
            }
            if (sidePanel) {
                sidePanel.classList.add('collapsed');
                sidePanel.classList.remove('open');
            }
            if (periodAnalysisModal) {
                periodAnalysisModal.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
            openMatchDetail(matchId);
        };
    }

    const btnAddTimelineEvent = document.getElementById('btn-add-timeline-event');
    if (btnAddTimelineEvent) {
        btnAddTimelineEvent.style.display = isCoach ? 'inline-flex' : 'none';
        btnAddTimelineEvent.onclick = () => {
            let currentTimeStr = '00:00';
            if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                currentTimeStr = formatSeconds(ytPlayer.getCurrentTime());
            }
            if (!period.analysisMemos) period.analysisMemos = [];
            const defaultTag = (state.analysisTags && state.analysisTags.length > 0) ? state.analysisTags[0] : 'メモ';
            period.analysisMemos.push({ time: currentTimeStr, tag: defaultTag, text: '' });
            saveData();
            renderPeriodTimelineList(period);
            showToast('タイムラインイベントを追加しました');
        };
    }

    renderPeriodTimelineList(period);
    const mainVideoUrl = (period.videoUrls && period.videoUrls.length > 0) ? period.videoUrls[0] : (period.videoUrl || '');

    setTimeout(() => {
        loadYouTubePlayer(mainVideoUrl, 'period-yt-player');
        initPeriodWorkspaceResizer();
    }, 50);

    // --- タイムライン再生連動・点滅ハイライト監視 ---
    timelineInterval = setInterval(() => {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        const currentTimeSec = ytPlayer.getCurrentTime();

        document.querySelectorAll('.timeline-edit-row').forEach(row => {
            const timeBtn = row.querySelector('.btn-seek-timestamp');
            if (!timeBtn) return;
            const targetSec = parseTimeToSeconds(timeBtn.dataset.time);

            if (currentTimeSec >= targetSec && currentTimeSec <= targetSec + 2.5) {
                row.classList.add('timeline-highlight-active');
            } else {
                row.classList.remove('timeline-highlight-active');
            }
        });
    }, 500);
}

/**
 * ピリオド編集モーダルを開く処理
 */
window.editFormation = function (matchId, formationId = null) {
    if (state.currentUserRole !== 'coach') {
        showToast('保護者モードでは編集できません');
        return;
    }

    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const formFormation = document.getElementById('form-formation');
    if (formFormation) {
        formFormation.reset();
        formFormation.onsubmit = (e) => {
            e.preventDefault();

            if (state.currentUserRole !== 'coach') {
                showToast('保護者モードでは保存できません');
                return;
            }

            const matchIdInput = document.getElementById('formation-match-id');
            const rawMatchId = matchIdInput ? matchIdInput.value : null;
            const targetMatchId = rawMatchId ? parseInt(rawMatchId, 10) : null;
            const targetFormationId = document.getElementById('formation-id').value;
            const targetMatch = state.matches.find(m => m.id === targetMatchId);

            if (!targetMatch) {
                showToast('エラー: 試合データが見つかりません');
                return;
            }

            const name = document.getElementById('formation-name').value.trim();
            const system = document.getElementById('formation-system-select').value;

            const videoUrlInput = document.getElementById('formation-video-url');
            const videoUrl = videoUrlInput ? videoUrlInput.value.trim() : '';

            const nodes = document.querySelectorAll('#tactical-formation-pitch .pitch-node');
            const lineup = [];
            nodes.forEach(node => {
                const playerId = node.dataset.playerId ? parseInt(node.dataset.playerId, 10) : null;
                if (playerId) {
                    lineup.push({
                        playerId,
                        role: node.dataset.role,
                        roleLabel: node.dataset.label,
                        roleIndex: parseInt(node.dataset.index, 10)
                    });
                }
            });

            const scoreUs = parseInt(document.getElementById('formation-score-us').value, 10) || 0;
            const scoreThem = parseInt(document.getElementById('formation-score-them').value, 10) || 0;

            const goalRecords = [];
            const goalRows = document.querySelectorAll('#period-goal-records-list .goal-record-row');
            goalRows.forEach(row => {
                const scorerVal = row.querySelector('.goal-scorer-select')?.value;
                const assistVal = row.querySelector('.goal-assist-select')?.value;
                const scorerId = scorerVal ? parseInt(scorerVal, 10) : null;
                const assistId = assistVal ? parseInt(assistVal, 10) : null;
                goalRecords.push({ scorerId, assistId });
            });

            const analysisMemos = [];
            const memoRows = document.querySelectorAll('#formation-analysis-memo-list .analysis-memo-row');
            memoRows.forEach(row => {
                const time = row.querySelector('.memo-time-input')?.value.trim() || '00:00';
                const tag = row.querySelector('.memo-tag-select')?.value || 'チャンス';
                const text = row.querySelector('.memo-text-input')?.value.trim() || '';
                analysisMemos.push({ time, tag, text });
            });

            const summaryVal = document.getElementById('formation-summary-text')?.value.trim() || '';

            let targetPeriodIndex = 0;

            if (targetFormationId) {
                const fIndex = targetMatch.formations.findIndex(f => f.id === parseInt(targetFormationId, 10));
                if (fIndex !== -1) {
                    targetPeriodIndex = fIndex;
                    const formObj = targetMatch.formations[fIndex];
                    formObj.name = name;
                    formObj.system = system;
                    formObj.scoreUs = scoreUs;
                    formObj.scoreThem = scoreThem;
                    formObj.goalRecords = goalRecords;
                    formObj.videoUrl = videoUrl;
                    formObj.videoUrls = videoUrl ? [videoUrl] : [];
                    formObj.lineup = lineup;
                    formObj.analysisMemos = analysisMemos;
                    formObj.summary = summaryVal;
                }
            } else {
                const newPeriod = {
                    id: Date.now(),
                    name,
                    system,
                    scoreUs,
                    scoreThem,
                    goalRecords,
                    videoUrl,
                    videoUrls: videoUrl ? [videoUrl] : [],
                    lineup,
                    analysisMemos,
                    summary: summaryVal,
                    boardData: []
                };
                if (!targetMatch.formations) targetMatch.formations = [];
                targetMatch.formations.push(newPeriod);
                targetPeriodIndex = targetMatch.formations.length - 1;
            }

            let totalUs = 0;
            let totalThem = 0;
            const allMatchGoalRecords = [];
            const scorersList = [];

            targetMatch.formations.forEach(f => {
                totalUs += (f.scoreUs !== undefined ? f.scoreUs : 0);
                totalThem += (f.scoreThem !== undefined ? f.scoreThem : 0);
                if (f.goalRecords && f.goalRecords.length > 0) {
                    allMatchGoalRecords.push(...f.goalRecords);

                    f.goalRecords.forEach(r => {
                        let text = '';
                        if (r.scorerId) {
                            const sPlayer = state.players.find(p => p.id === r.scorerId);
                            text += sPlayer ? `${sPlayer.name}` : '不明な選手';
                        } else {
                            text += 'オウンゴール/その他';
                        }
                        if (r.assistId) {
                            const aPlayer = state.players.find(p => p.id === r.assistId);
                            text += aPlayer ? ` (アシスト:${aPlayer.name})` : '';
                        }
                        scorersList.push(text);
                    });
                }
            });

            targetMatch.goalRecords = allMatchGoalRecords;
            targetMatch.scorers = scorersList.join(', ');
            targetMatch.result = `${totalUs}-${totalThem}`;

            saveData();
            showToast('ピリオド情報を保存しました');

            const modalFormation = document.getElementById('modal-formation');
            if (modalFormation) modalFormation.classList.add('hidden');
            document.body.classList.remove('modal-open');

            const periodAnalysisModal = document.getElementById('modal-period-analysis');
            const isAnalysisOpen = periodAnalysisModal && !periodAnalysisModal.classList.contains('hidden');

            if (isAnalysisOpen) {
                openPeriodAnalysis(targetMatch.id, targetPeriodIndex);
            } else {
                initMatchDetailView(targetMatch.id);
            }
        };
    }

    document.getElementById('formation-match-id').value = matchId;
    document.getElementById('formation-id').value = formationId || '';

    const sysSelect = document.getElementById('formation-system-select');
    if (sysSelect) {
        sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');
    }

    const periodGoalRecordsList = document.getElementById('period-goal-records-list');
    if (periodGoalRecordsList) periodGoalRecordsList.innerHTML = '';

    let existingLineup = [];
    if (formationId) {
        const f = match.formations.find(item => item.id === formationId);
        if (f) {
            document.getElementById('formation-name').value = f.name || '';
            if (sysSelect) sysSelect.value = f.system || '';

            const vUrlInput = document.getElementById('formation-video-url');
            if (vUrlInput) vUrlInput.value = (f.videoUrls && f.videoUrls.length > 0) ? f.videoUrls[0] : (f.videoUrl || '');

            document.getElementById('formation-score-us').value = f.scoreUs !== undefined ? f.scoreUs : 0;
            document.getElementById('formation-score-them').value = f.scoreThem !== undefined ? f.scoreThem : 0;

            const summaryInput = document.getElementById('formation-summary-text');
            if (summaryInput) summaryInput.value = f.summary || f.reflection || '';

            existingLineup = f.lineup || [];

            if (periodGoalRecordsList && f.goalRecords && f.goalRecords.length > 0) {
                f.goalRecords.forEach(r => {
                    addGoalRecordRow(r.scorerId, r.assistId, 'period-goal-records-list');
                });
            }
        }
    } else {
        const nextIndex = (match.formations ? match.formations.length : 0) + 1;
        document.getElementById('formation-name').value = `${nextIndex}本目`;
        document.getElementById('formation-score-us').value = 0;
        document.getElementById('formation-score-them').value = 0;
    }

    const selectedSys = (sysSelect && sysSelect.value) ? sysSelect.value : (state.customFormations[0]?.name || '3-3-1');
    renderFormationPitch(selectedSys, existingLineup);

    if (sysSelect) {
        sysSelect.onchange = (e) => renderFormationPitch(e.target.value, []);
    }

    bindPeriodScoreButtons();
    openModal('modal-formation');
};

function renderPeriodTimelineList(period) {
    const container = document.getElementById('period-timeline-list');
    if (!container) return;

    const isCoach = state.currentUserRole === 'coach';
    const memos = period.analysisMemos || [];

    if (memos.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:2rem 1rem; font-size:0.85rem;">
                <i class="fa-regular fa-clock" style="font-size:1.5rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                タイムライン記録がありません。
            </div>`;
        return;
    }

    container.innerHTML = memos.map((m, idx) => {
        const currentTag = m.tag || (state.analysisTags && state.analysisTags[0]) || 'メモ';
        const disabledAttr = isCoach ? '' : 'disabled';
        const deleteBtnHtml = isCoach
            ? `<button type="button" class="btn btn-danger btn-sm btn-delete-memo" style="margin-left:auto; padding:0.15rem 0.4rem; font-size:0.75rem;" title="削除"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const tagOptionHtml = (state.analysisTags || []).map(t => `<option value="${escapeHtml(t)}" ${currentTag === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');

        return `
            <div class="timeline-edit-row" data-index="${idx}" style="display:flex; flex-direction:column; gap:0.3rem; background:rgba(0,0,0,0.02); padding:0.5rem 0.6rem; border-radius:6px; border:1px solid var(--surface-border); transition: all 0.3s ease;">
                <div style="display:flex; align-items:center; gap:0.4rem; width:100%;">
                    <button type="button" class="btn btn-secondary btn-sm btn-seek-timestamp" data-time="${escapeHtml(m.time || '00:00')}" style="padding:0.2rem 0.5rem; font-size:0.75rem; font-weight:bold; color:var(--primary); flex-shrink:0;">
                        <i class="fa-solid fa-play"></i> ${escapeHtml(m.time || '00:00')}
                    </button>

                    <select class="form-control memo-tag-val" ${disabledAttr} style="width:110px; font-size:0.75rem; padding:0.2rem; height:auto;">
                        ${tagOptionHtml}
                    </select>

                    ${deleteBtnHtml}
                </div>
                <div>
                    <input type="text" class="form-control memo-text-val" value="${escapeHtml(m.text || '')}" ${disabledAttr} placeholder="${isCoach ? 'メモ（例: 左サイドからの崩し）' : 'メモなし'}" style="width:100%; font-size:0.8rem; padding:0.25rem 0.4rem;">
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.timeline-edit-row').forEach(row => {
        const idx = parseInt(row.dataset.index, 10);
        const tagSelect = row.querySelector('.memo-tag-val');
        const textInput = row.querySelector('.memo-text-val');
        const btnDelete = row.querySelector('.btn-delete-memo');
        const btnSeek = row.querySelector('.btn-seek-timestamp');

        const updateData = () => {
            if (period.analysisMemos[idx]) {
                period.analysisMemos[idx].tag = tagSelect.value;
                period.analysisMemos[idx].text = textInput.value;
                saveData();
            }
        };

        if (tagSelect && isCoach) tagSelect.onchange = updateData;
        if (textInput && isCoach) textInput.oninput = updateData;

        if (btnSeek) {
            btnSeek.onclick = () => seekToVideoTime(btnSeek.dataset.time);
        }

        if (btnDelete && isCoach) {
            btnDelete.onclick = () => {
                period.analysisMemos.splice(idx, 1);
                saveData();
                renderPeriodTimelineList(period);
                showToast('イベントを削除しました');
            };
        }
    });
}

function initPeriodWorkspaceResizer() {
    const resizer = document.getElementById('period-workspace-resizer');
    const videoCol = document.getElementById('period-workspace-video');
    const container = document.getElementById('period-workspace-container');

    if (!resizer || !videoCol || !container) return;

    const startResize = (e) => {
        isResizingWorkspace = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        resizer.style.background = 'var(--primary)';

        if (videoCol) videoCol.style.pointerEvents = 'none';
    };

    const doResize = (e) => {
        if (!isResizingWorkspace) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const containerRect = container.getBoundingClientRect();
        let newWidth = clientX - containerRect.left;
        let percentage = (newWidth / containerRect.width) * 100;

        if (percentage >= 50 && percentage <= 92) {
            videoCol.style.flex = `0 0 ${percentage}%`;
        }
    };

    const stopResize = () => {
        if (isResizingWorkspace) {
            isResizingWorkspace = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
            resizer.style.background = 'var(--surface-border)';

            if (videoCol) videoCol.style.pointerEvents = 'auto';
        }
    };

    resizer.onmousedown = startResize;
    window.onmousemove = doResize;
    window.onmouseup = stopResize;

    resizer.ontouchstart = startResize;
    window.ontouchmove = doResize;
    window.ontouchend = stopResize;
}

export function initMatches() {
    let currentMatchNendo = uiState.currentMatchNendo;
    let currentMatchPage = uiState.currentMatchPage;
    const ITEMS_PER_PAGE = uiState.ITEMS_PER_PAGE;
    const isCoach = state.currentUserRole === 'coach';

    const matchNendos = [...new Set(state.matches.map(m => getNendo(m.date)))].sort((a, b) => b - a);
    const filterSelect = document.getElementById('filter-nendo-match');
    if (filterSelect) {
        let options = '<option value="all">すべての年度</option>';
        matchNendos.forEach(y => {
            options += `<option value="${y}" ${currentMatchNendo === String(y) ? 'selected' : ''}>${y}年度</option>`;
        });
        filterSelect.innerHTML = options;

        filterSelect.onchange = (e) => {
            uiState.currentMatchNendo = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const filteredMatches = currentMatchNendo === 'all'
        ? state.matches
        : state.matches.filter(m => String(getNendo(m.date)) === currentMatchNendo);

    const displayedMatches = filteredMatches.slice(0, currentMatchPage * ITEMS_PER_PAGE);

    const matchList = document.getElementById('match-list');
    if (matchList) {
        const grouped = {};
        displayedMatches.forEach(m => {
            const ym = m.date.substring(0, 7).replace('-', '年') + '月';
            if (!grouped[ym]) grouped[ym] = [];
            grouped[ym].push(m);
        });

        const sortedMonths = Object.keys(grouped).sort().reverse();
        let html = '';
        sortedMonths.forEach(month => {
            html += `
                <div class="month-section">
                    <h3>${month}</h3>
                    <div class="library-grid">
            `;
            grouped[month].forEach(m => {
                const matchScore = m.result ? m.result.match(/(\d+)\s*-\s*(\d+)/) : null;
                const isCompleted = !!matchScore;
                const resultText = isCompleted ? `${matchScore[1]}-${matchScore[2]}` : '<span style="font-weight:normal; color:var(--text-secondary); font-size:0.9rem;">試合予定</span>';

                const attendeesHtml = m.presentPlayerIds && m.presentPlayerIds.length > 0
                    ? state.players.filter(pl => m.presentPlayerIds.includes(pl.id)).map(pl => `
                        <span style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; font-size:0.7rem; font-weight:600; padding:0.15rem 0.4rem; border-radius:9999px; gap:0.25rem; white-space:nowrap;">
                            ${pl.number ? `<span style="background:var(--primary); color:#ffffff; font-size:0.55rem; width:14px; height:14px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0;">${pl.number}</span>` : ''}
                            <span style="flex-shrink:0;">${escapeHtml(pl.name)}</span>
                        </span>
                    `).join('')
                    : '<span style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">メンバー登録がありません</span>';

                const actionBtns = isCoach ? `
                    <button class="btn btn-secondary btn-detail-match" data-id="${m.id}"><i class="fa-solid fa-circle-info"></i> 詳細</button>
                    <button class="btn btn-danger btn-delete-match" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>
                ` : `
                    <button class="btn btn-secondary btn-detail-match" data-id="${m.id}"><i class="fa-solid fa-circle-info"></i> 詳細</button>
                `;

                html += `
                    <div class="card match-card">
                        <div class="match-card-header">
                            <div>
                                <div class="match-card-date"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}${m.tournament ? ` (${m.tournament})` : ''}</div>
                                <div class="match-card-opponent">vs ${escapeHtml(m.opponent)}</div>
                                <div class="text-secondary" style="font-size:0.8rem; margin-top:0.4rem;">
                                    <details class="practice-attendance-details" style="width: 100%; cursor: pointer;">
                                        <summary style="font-weight:600; font-size:0.8rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.3rem; outline:none; list-style:none; user-select:none;">
                                            <i class="fa-solid fa-chevron-down" style="font-size:0.7rem; color:var(--text-secondary); transition:transform 0.2s;"></i>
                                            <span>参加者 (${m.presentPlayerIds ? `${m.presentPlayerIds.length}/${state.players.length}` : `0/${state.players.length}`})</span>
                                        </summary>
                                        <div style="display:flex; flex-wrap:wrap; gap:0.25rem; padding:0.4rem; border-radius:8px; background:rgba(0,0,0,0.02); margin-top:0.25rem; max-height:100px; overflow-y:auto; box-sizing:border-box;">
                                            ${attendeesHtml}
                                        </div>
                                    </details>
                                </div>
                            </div>
                            <div class="match-card-result">${resultText}</div>
                        </div>
                        <div class="match-card-actions" style="margin-top:0.8rem;">
                            ${actionBtns}
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        });

        if (filteredMatches.length > displayedMatches.length) {
            const remaining = filteredMatches.length - displayedMatches.length;
            html += `
                <div style="text-align:center; margin: 1.5rem 0 1rem 0;">
                    <button class="btn btn-secondary" id="btn-load-more-matches" style="padding: 0.6rem 2rem; font-size: 0.9rem; border-radius: 9999px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredMatches.length} 件)
                    </button>
                </div>
            `;
        }

        matchList.innerHTML = html || `
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-trophy"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">まだ試合記録がありません</h3>
                <button class="btn btn-primary" id="btn-empty-add-match" style="margin-top:0.5rem; display:${isCoach ? 'inline-block' : 'none'};"><i class="fa-solid fa-plus"></i> 最初の試合を追加</button>
            </div>
        `;

        const btnLoadMoreMatches = document.getElementById('btn-load-more-matches');
        if (btnLoadMoreMatches) {
            btnLoadMoreMatches.onclick = () => {
                uiState.currentMatchPage++;
                initMatches();
            };
        }
    }

    const formMatchFeedback = document.getElementById('form-match-feedback');
    if (formMatchFeedback) {
        formMatchFeedback.onsubmit = (e) => {
            e.preventDefault();
            const matchId = parseInt(document.getElementById('feedback-match-id').value, 10);
            const match = state.matches.find(m => m.id === matchId);
            if (match) {
                const inputs = document.querySelectorAll('.bulk-feed-good, .bulk-feedback-good');
                let addedCount = 0;

                inputs.forEach(inputGood => {
                    const playerId = parseInt(inputGood.dataset.playerId, 10);
                    const inputImprove = document.querySelector(`.bulk-feed-improve[data-player-id="${playerId}"], .bulk-feedback-improve[data-player-id="${playerId}"]`);
                    const good = inputGood.value.trim();
                    const improve = inputImprove ? inputImprove.value.trim() : '';

                    if (good || improve) {
                        const comment = '【ポジティブ】\n' + good + '\n\n【ネクストステップ】\n' + improve;
                        const existingFb = match.playerFeedback.find(fb => fb.playerId === playerId);
                        if (existingFb) {
                            existingFb.comment = comment;
                        } else {
                            match.playerFeedback.push({ id: Date.now() + addedCount, playerId, comment });
                        }
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    saveData();
                    showToast(`${addedCount}件のフィードバックを保存しました`);
                    document.getElementById('modal-match-feedback').classList.add('hidden');
                    openMatchDetail(matchId);
                } else {
                    showToast('コメントが入力されていません');
                }
            }
        };
    }

    const btnAddMatch = document.getElementById('btn-add-match');
    if (btnAddMatch) {
        btnAddMatch.style.display = isCoach ? 'inline-flex' : 'none';
        btnAddMatch.onclick = () => openMatchModal(null);
    }

    const btnEmptyAddMatch = document.getElementById('btn-empty-add-match');
    if (btnEmptyAddMatch) {
        btnEmptyAddMatch.style.display = isCoach ? 'inline-block' : 'none';
        btnEmptyAddMatch.onclick = () => openMatchModal(null);
    }

    document.querySelectorAll('.btn-detail-match').forEach(btn => {
        btn.onclick = (e) => {
            const id = parseInt(e.currentTarget.dataset.id, 10);
            openMatchDetail(id);
        };
    });

    document.querySelectorAll('.btn-delete-match').forEach(btn => {
        btn.onclick = (e) => {
            if (confirm('この試合記録を削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                state.matches = state.matches.filter(m => m.id !== id);
                saveData();
                showToast('削除しました');
                initMatches();
            }
        };
    });
}