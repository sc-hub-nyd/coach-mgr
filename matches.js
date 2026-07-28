// matches.js
import { state, uiState } from './state.js';
import { escapeHtml, getNendo, showToast } from './utils.js';
import { saveData, navigate, openModal } from './app.js';
import { openPlayerDetail } from './players.js';
import { drawPitchToCtx } from './drawing.js';

// matches.js 冒頭の import 群の直下に追加
let ytPlayer = null;

// 追加: 階層2ワークスペースの制御用変数
let currentMatchId = null;
let currentPeriodIndex = 0;
let isResizingWorkspace = false;

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

    if (window.YT && window.YT.Player) {
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
        } else {
            ytPlayer = new window.YT.Player(containerId, {
                width: '100%',
                height: '100%',
                videoId: videoId,
                playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1 }
            });
        }
    } else {
        // APIがまだ読み込まれていない場合のフォールバック
        playerEl.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?playsinline=1" frameborder="0" allowfullscreen style="width:100%; height:100%;"></iframe>`;
    }
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

// ★ 追加: 分析メモ行を動的に追加する関数
export function addAnalysisMemoRow(timeStr = '00:00', textVal = '', tagVal = 'ビルドアップ') {
    const container = document.getElementById('formation-analysis-memo-list');
    if (!container) return;

    const rowId = 'memo-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'analysis-memo-row';
    div.style = 'display:flex; gap:0.3rem; align-items:center; width:100%; margin-bottom:0.3rem;';

    div.innerHTML = `
        <!-- ★ 追加: タップでその時間へジャンプする再生ボタン -->
        <button type="button" class="btn btn-secondary btn-seek-video" style="padding:0.25rem 0.4rem; font-size:0.75rem; color:var(--primary);" title="このシーンへジャンプ">
            <i class="fa-solid fa-play"></i>
        </button>
        <input type="text" class="form-control memo-time-input" value="${timeStr}" placeholder="00:00" style="width:60px; text-align:center; font-weight:bold; font-size:0.8rem; padding:0.25rem 0.2rem;">
        <select class="form-control memo-tag-select" style="width:100px; font-size:0.75rem; padding:0.25rem 0.3rem;">
            <option value="ビルドアップ" ${tagVal === 'ビルドアップ' ? 'selected' : ''}>ビルドアップ</option>
            <option value="チャンス" ${tagVal === 'チャンス' ? 'selected' : ''}>チャンス</option>
            <option value="守備/プレス" ${tagVal === '守備/プレス' ? 'selected' : ''}>守備/プレス</option>
            <option value="セットプレー" ${tagVal === 'セットプレー' ? 'selected' : ''}>セットプレー</option>
            <option value="課題/反省" ${tagVal === '課題/反省' ? 'selected' : ''}>課題/反省</option>
        </select>
        <input type="text" class="form-control memo-text-input" value="${escapeHtml(textVal)}" placeholder="メモ（例: 左展開からクロス）" style="flex:1; font-size:0.8rem; padding:0.25rem 0.4rem;">
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.4rem; font-size:0.8rem;" title="削除"><i class="fa-solid fa-trash-can"></i></button>
    `;

    // ★ 追加: ▶ ボタンを押したら入力欄の時間を取得してジャンプ
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

// ★ ここに追加：ピリオドモーダル（#modal-formation）の＋ーボタン連動用
function bindPeriodScoreButtons() {
    const modalForm = document.getElementById('modal-formation');
    if (!modalForm) return;

    // ★ 追加: スマホ用タブ切り替え制御
    const tabBtnAnalysis = document.getElementById('tab-btn-formation-analysis');
    const tabBtnInfo = document.getElementById('tab-btn-formation-info');
    const colLeft = document.getElementById('formation-tab-col-left');
    const colRight = document.getElementById('formation-tab-col-right');

    if (tabBtnAnalysis && tabBtnInfo && colLeft && colRight) {
        tabBtnAnalysis.onclick = () => {
            tabBtnAnalysis.classList.add('active');
            tabBtnInfo.classList.remove('active');
            colLeft.classList.remove('tab-hidden');
            colRight.classList.add('tab-hidden');
        };
        tabBtnInfo.onclick = () => {
            tabBtnInfo.classList.add('active');
            tabBtnAnalysis.classList.remove('active');
            colRight.classList.remove('tab-hidden');
            colLeft.classList.add('tab-hidden');
        };

        // 初期状態は「動画・分析」タブを表示
        if (window.innerWidth <= 768) {
            tabBtnAnalysis.click();
        } else {
            colLeft.classList.remove('tab-hidden');
            colRight.classList.remove('tab-hidden');
        }
    }

    // 既存のスコア・キャプチャ・動画URL監視処理...
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

    // ★ 追加: キャプチャボタンのイベント登録
    const btnCapture = document.getElementById('btn-capture-timestamp');
    if (btnCapture) {
        btnCapture.onclick = () => {
            if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
                showToast('動画が再生準備できていません');
                return;
            }
            const timeSec = ytPlayer.getCurrentTime();
            const formatted = formatSeconds(timeSec);

            // 専用の分析メモリストに行を新規追加
            addAnalysisMemoRow(formatted, '');
            showToast(`再生時間 (${formatted}) をキャプチャしました`);
        };
    }

    // ★ 追加: 手動で分析メモを追加するボタンのイベント
    const btnAddMemo = document.getElementById('btn-add-analysis-memo');
    if (btnAddMemo) {
        btnAddMemo.onclick = () => {
            addAnalysisMemoRow('00:00', '');
        };
    }

    // ★ 追加: 動画URL入力欄の変化を監視してプレーヤーを読み込み
    const vList = document.getElementById('formation-video-list');
    if (vList) {
        const firstInput = vList.querySelector('.formation-video-input');
        if (firstInput && firstInput.value) {
            loadYouTubePlayer(firstInput.value);
        }
        vList.oninput = (e) => {
            if (e.target && e.target.classList.contains('formation-video-input')) {
                loadYouTubePlayer(e.target.value.trim());
            }
        };
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

        // ★ フルコート座標 (top: 0%~100%) をハーフコート (上がセンターライン: 12%, 下がゴール: 88%) へマッピング
        const rawTop = parseFloat(coord.top) || 50;
        // 0% (相手ゴール側) -> 12% (センターライン付近), 100% (自陣ゴール側) -> 88% (自陣ゴール前)
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

export function openMatchModal(matchId = null) {
    const form = document.getElementById('form-match');
    if (form) form.reset();

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
        }
    }

    // ★ プラス・マイナスボタンと「得点・アシスト記録行」の連動登録
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

/**
 * 階層1: 試合詳細画面（画面ビューとしての初期化）
 */
export function initMatchDetailView(matchId) {
    if (!matchId) {
        navigate('matches');
        return;
    }

    // ★ Number() に変換して型不一致による find エラーを防止
    const m = state.matches.find(match => Number(match.id) === Number(matchId));
    if (!m) {
        showToast('該当する試合データが見つかりません');
        navigate('matches');
        return;
    }

    currentMatchId = m.id;

    // ヘッダー情報（日付・種別・スコア）の反映
    const metaEl = document.getElementById('match-detail-meta');
    if (metaEl) metaEl.textContent = `${m.date} | ${m.type}${m.tournament ? ` (${m.tournament})` : ''}`;

    const titleEl = document.getElementById('match-detail-title');
    if (titleEl) titleEl.innerHTML = `vs ${escapeHtml(m.opponent)} <span id="match-detail-score" style="color:var(--text-primary); font-weight:bold; margin-left:0.5rem;">${m.result ? `(${m.result})` : ''}</span>`;

    const themeEl = document.getElementById('match-detail-theme');
    if (themeEl) themeEl.textContent = m.theme || '未設定';

    const summaryEl = document.getElementById('match-detail-summary');
    if (summaryEl) summaryEl.textContent = m.comments || m.summary || '記録なし';

    // 「試合一覧に戻る」ボタン
    const btnBack = document.getElementById('btn-back-to-matches');
    if (btnBack) {
        btnBack.onclick = () => navigate('matches');
    }

    // ピリオドカードグリッドを描画
    renderPeriodGrid(m);

    // 編集・追加ボタンのイベント登録
    const btnEditMatch = document.getElementById('btn-edit-match');
    if (btnEditMatch) btnEditMatch.onclick = () => openMatchModal(m.id);

    const btnAddFormation = document.getElementById('btn-add-formation');
    if (btnAddFormation) btnAddFormation.onclick = () => {
        if (typeof window.editFormation === 'function') {
            window.editFormation(m.id, null);
        }
    };
}

// 互換性のため、従来呼んでいた openMatchDetail を画面遷移ルーティングに置き換え
export function openMatchDetail(id) {
    navigate('match-detail', { matchId: id });
}

// 階層1: ピリオドカード（2行×3列対応グリッド）レンダリング処理
function renderPeriodGrid(m) {
    const grid = document.getElementById('match-period-grid');
    if (!grid) return;

    if (!m.formations || m.formations.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-secondary); background:rgba(0,0,0,0.02); border-radius:8px; border:1px dashed var(--surface-border);">ピリオドが登録されていません。「＋ ピリオド追加」から作成してください。</div>';
        return;
    }

    grid.innerHTML = m.formations.map((f, idx) => {
        const scoreUs = f.scoreUs !== undefined ? f.scoreUs : 0;
        const scoreThem = f.scoreThem !== undefined ? f.scoreThem : 0;
        const videoBadge = (f.videoUrls?.length || f.videoUrl) ? '<i class="fa-brands fa-youtube" style="color:#ef4444;" title="動画あり"></i>' : '';

        // 得失点・重要イベント抽出
        const goalsHtml = (f.analysisMemos || []).filter(memo => memo.tag === '得点' || memo.tag === '失点' || memo.tag === 'チャンス').map(memo => {
            const icon = memo.tag === '得点' ? '⚽' : (memo.tag === '失点' ? '⚠️' : '💡');
            return `<div style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${icon} ${memo.time} ${escapeHtml(memo.text)}</div>`;
        }).join('') || '<div style="font-size:0.75rem; color:var(--text-secondary);">イベント記録なし</div>';

        return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:0.6rem; padding:0.8rem; margin:0; border:1px solid var(--surface-border);">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                        <strong style="font-size:0.95rem; color:var(--primary);">${escapeHtml(f.name || `${idx + 1}本目`)}</strong>
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            ${videoBadge}
                            <span class="badge" style="background:var(--primary); color:#fff; font-weight:bold;">${scoreUs} - ${scoreThem}</span>
                        </div>
                    </div>
                    
                    <!-- 得失点サマリー -->
                    <div style="background:rgba(0,0,0,0.02); padding:0.4rem; border-radius:4px; margin-bottom:0.5rem; display:flex; flex-direction:column; gap:0.15rem;">
                        ${goalsHtml}
                    </div>

                    <!-- ミニフォーメーションピッチ -->
                    <div style="width:100%; height:110px; background:#1e293b; border-radius:6px; overflow:hidden; position:relative; margin-bottom:0.5rem;">
                        <canvas id="period-card-pitch-${f.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                        <span style="position:absolute; bottom:4px; right:6px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:0.1rem 0.3rem; border-radius:3px;">${f.system || '陣形未設定'}</span>
                    </div>

                    <!-- ピリオド総括（ワンラインハイライト） -->
                    <div style="font-size:0.78rem; color:var(--text-primary); font-weight:500; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                        💡 ${escapeHtml(f.summary || f.reflection || '総括コメント未入力')}
                    </div>
                </div>

                <!-- アクションボタン -->
                <div style="display:flex; gap:0.3rem; margin-top:0.4rem;">
                    <button class="btn btn-primary btn-sm btn-open-analysis" data-index="${idx}" style="flex:1; justify-content:center; font-size:0.78rem; padding:0.3rem;"><i class="fa-solid fa-film"></i> ${idx + 1}本目を大画面分析 ➔</button>
                    <button class="btn btn-secondary btn-sm btn-edit-period-card" data-id="${f.id}" style="padding:0.3rem 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // ミニフォーメーションキャンバス描画
    setTimeout(() => {
        m.formations.forEach(f => {
            const canvas = document.getElementById(`period-card-pitch-${f.id}`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                drawPitchToCtx(f.boardData || [], canvas, ctx, 'full');
            }
        });
    }, 50);

    // イベントバインド
    grid.querySelectorAll('.btn-open-analysis').forEach(btn => {
        btn.onclick = (e) => {
            const periodIdx = parseInt(e.currentTarget.dataset.index, 10);
            if (typeof openPeriodAnalysis === 'function') {
                openPeriodAnalysis(m.id, periodIdx);
            }
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

// ★ 追加: YouTubeプレーヤーを完全に停止・リセットするグローバル関数
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

export function openPeriodAnalysis(matchId, periodIndex) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match || !match.formations || !match.formations[periodIndex]) return;

    currentMatchId = matchId;
    currentPeriodIndex = periodIndex;
    const period = match.formations[periodIndex];

    // 1. 階層1（試合詳細モーダル）を一旦隠す
    const matchDetailModal = document.getElementById('modal-match-detail');
    if (matchDetailModal) matchDetailModal.classList.add('hidden');

    // 2. 全画面分析ワークスペースを表示
    const periodAnalysisModal = document.getElementById('modal-period-analysis');
    if (periodAnalysisModal) {
        periodAnalysisModal.classList.remove('hidden');
    }

    // ヘッダータイトル・スコアの反映
    const titleEl = document.getElementById('period-analysis-title');
    if (titleEl) {
        titleEl.textContent = `vs ${escapeHtml(match.opponent)} - ${period.name || `${periodIndex + 1}本目`} (${period.scoreUs || 0} - ${period.scoreThem || 0})`;
    }

    // 「前へ / 次へ」ピリオド切替ボタン制御
    const btnPrev = document.getElementById('btn-period-prev');
    const btnNext = document.getElementById('btn-period-next');
    if (btnPrev) {
        btnPrev.disabled = periodIndex <= 0;
        btnPrev.style.opacity = periodIndex <= 0 ? '0.5' : '1';
        btnPrev.onclick = () => openPeriodAnalysis(matchId, periodIndex - 1);
    }
    if (btnNext) {
        btnNext.disabled = periodIndex >= match.formations.length - 1;
        btnNext.style.opacity = periodIndex >= match.formations.length - 1 ? '0.5' : '1';
        btnNext.onclick = () => openPeriodAnalysis(matchId, periodIndex + 1);
    }

    // 「編集」ボタン制御
    const btnEdit = document.getElementById('btn-edit-period');
    if (btnEdit) {
        btnEdit.onclick = () => {
            if (typeof window.editFormation === 'function') {
                window.editFormation(matchId, period.id);
            }
        };
    }

    // 「戻る」ボタン制御：全画面ワークスペースを隠し、YouTubeを停止し、階層1へ復元
    const btnBack = document.getElementById('btn-back-to-match-detail');
    if (btnBack) {
        btnBack.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // ★ 追加: 音声が鳴り続けるのを防ぐためYouTubeを停止
            if (typeof window.stopAndCleanupYouTube === 'function') {
                window.stopAndCleanupYouTube();
            }

            if (periodAnalysisModal) {
                periodAnalysisModal.classList.add('hidden');
            }

            openMatchDetail(matchId);
        };
    }
    /// 「イベント追加」ボタンのクリックイベント
    const btnAddTimelineEvent = document.getElementById('btn-add-timeline-event');
    if (btnAddTimelineEvent) {
        btnAddTimelineEvent.onclick = () => {
            let currentTimeStr = '00:00';
            if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                currentTimeStr = formatSeconds(ytPlayer.getCurrentTime());
            }

            // 1. データの配列（period.analysisMemos）に新しいイベントを追加
            if (!period.analysisMemos) {
                period.analysisMemos = [];
            }
            period.analysisMemos.push({
                time: currentTimeStr,
                tag: 'チャンス',
                text: ''
            });

            // 2. ローカルストレージ等へ即座に保存
            saveData();

            // 3. タイムラインリストの表示を再描画して画面に反映させる
            renderPeriodTimelineList(period);

            showToast('タイムラインイベントを追加しました');
        };
    }

    // タイムライン描画 & YouTubeプレイヤー設定 & リサイザー初期化
    renderPeriodTimelineList(period);
    const mainVideoUrl = (period.videoUrls && period.videoUrls.length > 0) ? period.videoUrls[0] : (period.videoUrl || '');
    loadYouTubePlayer(mainVideoUrl, 'period-yt-player');
    setupPeriodInfoResponsive(period);
    initPeriodWorkspaceResizer();
}

/**
 * ピリオド編集モーダルを開く処理 (グローバル関数 - 重複を削除して一本化)
 */
window.editFormation = function (matchId, formationId = null) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const formFormation = document.getElementById('form-formation');
    if (formFormation) formFormation.reset();

    document.getElementById('formation-match-id').value = matchId;
    document.getElementById('formation-id').value = formationId || '';

    const sysSelect = document.getElementById('formation-system-select');
    if (sysSelect) {
        sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');
    }

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

    openModal('modal-formation');
};

/**
 * タイムライン（イベント・メモ一覧）描画
 */
function renderPeriodTimelineList(period) {
    const container = document.getElementById('period-timeline-list');
    if (!container) return;

    const memos = period.analysisMemos || [];
    if (memos.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:var(--text-secondary); padding:2rem 1rem; font-size:0.85rem;">
                <i class="fa-regular fa-clock" style="font-size:1.5rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                タイムライン記録がありません。<br>「イベント追加」からメモを追加できます。
            </div>`;
        return;
    }

    container.innerHTML = memos.map((m, idx) => {
        const currentTag = m.tag || 'チャンス';
        return `
            <div class="timeline-edit-row" data-index="${idx}" style="display:flex; flex-direction:column; gap:0.3rem; background:rgba(0,0,0,0.02); padding:0.5rem 0.6rem; border-radius:6px; border:1px solid var(--surface-border);">
                <div style="display:flex; align-items:center; gap:0.4rem; width:100%;">
                    <button type="button" class="btn btn-secondary btn-sm btn-seek-timestamp" data-time="${m.time || '00:00'}" style="padding:0.15rem 0.4rem; font-size:0.75rem; font-weight:bold; color:var(--primary); flex-shrink:0;">
                        <i class="fa-solid fa-play"></i> ${escapeHtml(m.time || '00:00')}
                    </button>
                    <input type="text" class="form-control memo-time-val" value="${escapeHtml(m.time || '00:00')}" style="width:65px; font-size:0.75rem; text-align:center; padding:0.2rem;" placeholder="00:00">
                    <select class="form-control memo-tag-val" style="width:105px; font-size:0.75rem; padding:0.2rem; height:auto;">
                        <option value="得点" ${currentTag === '得点' ? 'selected' : ''}>⚽得点</option>
                        <option value="失点" ${currentTag === '失点' ? 'selected' : ''}>🥅失点</option>
                        <option value="攻撃Good" ${currentTag === '攻撃Good' ? 'selected' : ''}>👌攻撃Good</option>
                        <option value="攻撃修正" ${currentTag === '攻撃修正' ? 'selected' : ''}>⚠️攻撃修正</option>
                        <option value="守備Good" ${currentTag === '守備Good' ? 'selected' : ''}>👌守備Good</option>
                        <option value="守備修正" ${currentTag === '守備修正' ? 'selected' : ''}>⚠️守備修正</option>
                        <option value="個人Good" ${currentTag === '個人Good' ? 'selected' : ''}>👌個人Good</option>
                        <option value="個人修正" ${currentTag === '個人修正' ? 'selected' : ''}>⚠️個人修正</option>
                    </select>
                    <button type="button" class="btn btn-danger btn-sm btn-delete-memo" style="margin-left:auto; padding:0.15rem 0.4rem; font-size:0.75rem;" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div>
                    <input type="text" class="form-control memo-text-val" value="${escapeHtml(m.text || '')}" placeholder="メモ（例: 左サイドからの崩し）" style="width:100%; font-size:0.8rem; padding:0.25rem 0.4rem;">
                </div>
            </div>
        `;
    }).join('');

    // 各種入力変更イベントのバインド（入力するたびに自動保存されるようにする）
    container.querySelectorAll('.timeline-edit-row').forEach(row => {
        const idx = parseInt(row.dataset.index, 10);
        const timeInput = row.querySelector('.memo-time-val');
        const tagSelect = row.querySelector('.memo-tag-val');
        const textInput = row.querySelector('.memo-text-val');
        const btnDelete = row.querySelector('.btn-delete-memo');
        const btnSeek = row.querySelector('.btn-seek-timestamp');

        const updateData = () => {
            if (period.analysisMemos[idx]) {
                period.analysisMemos[idx].time = timeInput.value.trim();
                period.analysisMemos[idx].tag = tagSelect.value;
                period.analysisMemos[idx].text = textInput.value;
                saveData(); // 変更を即時自動保存
            }
        };

        if (timeInput) timeInput.oninput = updateData;
        if (tagSelect) tagSelect.onchange = updateData;
        if (textInput) textInput.oninput = updateData;

        if (btnSeek) {
            btnSeek.onclick = () => seekToVideoTime(timeInput.value);
        }

        if (btnDelete) {
            btnDelete.onclick = () => {
                period.analysisMemos.splice(idx, 1);
                saveData();
                renderPeriodTimelineList(period); // リストを再描画して削除を反映
                showToast('イベントを削除しました');
            };
        }
    });
}

/**
 * 可変スプリットバー（ドラッグでの左右比率調整）制御
 */
function initPeriodWorkspaceResizer() {
    const resizer = document.getElementById('period-workspace-resizer');
    const videoCol = document.getElementById('period-workspace-video');
    const container = document.getElementById('period-workspace-container');

    if (!resizer || !videoCol || !container) return;

    resizer.onmousedown = () => {
        isResizingWorkspace = true;
        document.body.style.cursor = 'col-resize';
        resizer.style.background = 'var(--primary)';
    };

    window.onmousemove = (e) => {
        if (!isResizingWorkspace) return;
        const containerRect = container.getBoundingClientRect();
        let newWidth = e.clientX - containerRect.left;
        let percentage = (newWidth / containerRect.width) * 100;

        // 30% 〜 80% の範囲で動画エリア幅を可変
        if (percentage >= 30 && percentage <= 80) {
            videoCol.style.flex = `0 0 ${percentage}%`;
        }
    };

    window.onmouseup = () => {
        if (isResizingWorkspace) {
            isResizingWorkspace = false;
            document.body.style.cursor = 'default';
            resizer.style.background = 'var(--surface-border)';
        }
    };
}

/**
 * レスポンシブ表示制御（PC: ポップオーバー / スマホ: アコーディオン）
 */
function setupPeriodInfoResponsive(period) {
    const isMobile = window.innerWidth <= 768;
    const btnPopover = document.getElementById('btn-period-info-popover');
    const accordion = document.getElementById('period-info-accordion');
    const accordionContent = document.getElementById('period-info-accordion-content');
    const popoverContent = document.getElementById('period-info-popover-content');

    const infoHtml = `
        <div style="font-size:0.85rem; margin-bottom:0.5rem;">
            <strong style="color:var(--text-secondary);"><i class="fa-solid fa-chess-board"></i> システム:</strong>
            <span class="badge" style="margin-left:0.3rem;">${escapeHtml(period.system || '未設定')}</span>
        </div>
        <div style="font-size:0.85rem;">
            <strong style="color:var(--text-secondary); display:block; margin-bottom:0.2rem;"><i class="fa-solid fa-comment-dots"></i> ピリオド総括:</strong>
            <div style="background:rgba(0,0,0,0.03); padding:0.5rem; border-radius:6px; border-left:3px solid var(--primary); white-space:pre-wrap; line-height:1.4;">${escapeHtml(period.summary || period.reflection || '総括コメントはありません。')}</div>
        </div>
    `;

    if (isMobile) {
        if (btnPopover) btnPopover.style.display = 'none';
        if (popoverContent) popoverContent.style.display = 'none';
        if (accordion) {
            accordion.style.display = 'block';
            if (accordionContent) accordionContent.innerHTML = infoHtml;
        }
    } else {
        if (accordion) accordion.style.display = 'none';
        if (btnPopover) {
            btnPopover.style.display = 'inline-flex';
            if (popoverContent) popoverContent.innerHTML = infoHtml;

            btnPopover.onclick = (e) => {
                e.stopPropagation();
                const isHidden = popoverContent.style.display === 'none' || !popoverContent.style.display;
                popoverContent.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    const rect = btnPopover.getBoundingClientRect();
                    popoverContent.style.top = `${rect.bottom + 8}px`;
                    popoverContent.style.right = `${window.innerWidth - rect.right}px`;
                }
            };

            // 外側クリックでポップオーバーを閉じる
            document.addEventListener('click', function closePopover(e) {
                if (popoverContent && !popoverContent.contains(e.target) && e.target !== btnPopover) {
                    popoverContent.style.display = 'none';
                }
            });
        }
    }
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
                            </div>
                            <div class="match-card-result">${resultText}</div>
                        </div>
                        <div class="match-card-actions">
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

    const formMatch = document.getElementById('form-match');
    if (formMatch) {
        formMatch.onsubmit = (e) => {
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
                const scorerVal = row.querySelector('.goal-scorer-select').value;
                const assistVal = row.querySelector('.goal-assist-select').value;
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

            const matchId = document.getElementById('match-edit-id').value;
            if (matchId) {
                const match = state.matches.find(m => m.id === parseInt(matchId, 10));
                if (match) {
                    match.date = document.getElementById('match-date').value;
                    match.opponent = document.getElementById('match-opponent').value;
                    match.type = document.getElementById('match-type').value;
                    match.tournament = document.getElementById('match-tournament').value;
                    match.result = resultStr;
                    match.scorers = scorersStr;
                    match.goalRecords = goalRecords;
                    match.comments = commentsStr;
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
                    formations: []
                };
                state.matches.unshift(newMatch);
                saveData();
                showToast('試合を記録しました');
            }

            document.getElementById('modal-match').classList.add('hidden');
            navigate('matches');
        };
    }

    // =================================------------------
    // ステップ5: ピリオド編集モーダルの呼び出し ＆ 保存処理の強化
    // =================================------------------

    /**
     * ピリオド編集モーダルを開く処理 (グローバル関数)
     */
    window.editFormation = function (matchId, formationId = null) {
        const match = state.matches.find(m => m.id === matchId);
        if (!match) return;

        /**
         * ピリオド編集モーダルを開く処理 (グローバル関数)
         */
        window.editFormation = function (matchId, formationId = null) {
            const match = state.matches.find(m => m.id === matchId);
            if (!match) return;

            const formFormation = document.getElementById('form-formation');
            if (formFormation) formFormation.reset();

            // IDの保持
            document.getElementById('formation-match-id').value = matchId;
            document.getElementById('formation-id').value = formationId || '';

            // システム（陣形）の選択肢を生成
            const sysSelect = document.getElementById('formation-system-select');
            if (sysSelect) {
                sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');
            }

            let existingLineup = [];
            if (formationId) {
                // 既存ピリオドの編集時：元のデータをフォームにセット
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
                }
            } else {
                // 新規ピリオド追加時：初期値を自動セット（例: 2本目）
                const nextIndex = (match.formations ? match.formations.length : 0) + 1;
                document.getElementById('formation-name').value = `${nextIndex}本目`;
                document.getElementById('formation-score-us').value = 0;
                document.getElementById('formation-score-them').value = 0;
            }

            // ハーフコート配置ピッチの描画
            const selectedSys = (sysSelect && sysSelect.value) ? sysSelect.value : (state.customFormations[0]?.name || '3-3-1');
            renderFormationPitch(selectedSys, existingLineup);

            if (sysSelect) {
                sysSelect.onchange = (e) => renderFormationPitch(e.target.value, []);
            }

            // モーダルを表示
            openModal('modal-formation');
        };

        const formFormation = document.getElementById('form-formation');
        if (formFormation) formFormation.reset();

        document.getElementById('formation-match-id').value = matchId;
        document.getElementById('formation-id').value = formationId || '';

        // システム（陣形）の選択肢を生成
        const sysSelect = document.getElementById('formation-system-select');
        if (sysSelect) {
            sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');
        }

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
            }
        } else {
            // 新規作成時の初期値設定
            const nextIndex = (match.formations ? match.formations.length : 0) + 1;
            document.getElementById('formation-name').value = `${nextIndex}本目`;
            document.getElementById('formation-score-us').value = 0;
            document.getElementById('formation-score-them').value = 0;
        }

        // ハーフコート配置ピッチの描画
        const selectedSys = (sysSelect && sysSelect.value) ? sysSelect.value : (state.customFormations[0]?.name || '3-3-1');
        renderFormationPitch(selectedSys, existingLineup);

        if (sysSelect) {
            sysSelect.onchange = (e) => renderFormationPitch(e.target.value, []);
        }

        openModal('modal-formation');
    };

    // フォーム送信（保存）イベント
    const formFormation = document.getElementById('form-formation');
    if (formFormation) {
        formFormation.onsubmit = (e) => {
            e.preventDefault();
            const matchId = parseInt(document.getElementById('formation-match-id').value, 10);
            const formationId = document.getElementById('formation-id').value;
            const match = state.matches.find(m => m.id === matchId);

            if (match) {
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
                    const scorerVal = row.querySelector('.goal-scorer-select').value;
                    const assistVal = row.querySelector('.goal-assist-select').value;
                    const scorerId = scorerVal ? parseInt(scorerVal, 10) : null;
                    const assistId = assistVal ? parseInt(assistVal, 10) : null;
                    goalRecords.push({ scorerId, assistId });
                });

                // 分析メモ一覧の取得
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

                if (formationId) {
                    // 既存のピリオドを更新
                    const fIndex = match.formations.findIndex(f => f.id === parseInt(formationId, 10));
                    if (fIndex !== -1) {
                        targetPeriodIndex = fIndex;
                        const formObj = match.formations[fIndex];
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
                    // 新規ピリオドを追加
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
                    match.formations.push(newPeriod);
                    targetPeriodIndex = match.formations.length - 1;
                }

                // 試合全体スコアの自動計算
                let totalUs = 0;
                let totalThem = 0;
                const allMatchGoalRecords = [];

                match.formations.forEach(f => {
                    totalUs += (f.scoreUs !== undefined ? f.scoreUs : 0);
                    totalThem += (f.scoreThem !== undefined ? f.scoreThem : 0);
                    if (f.goalRecords && f.goalRecords.length > 0) {
                        allMatchGoalRecords.push(...f.goalRecords);
                    }
                });

                match.goalRecords = allMatchGoalRecords;
                match.result = `${totalUs}-${totalThem}`;

                // 保存およびモーダルの閉じる処理
                saveData();
                showToast('ピリオド情報を保存しました');
                document.getElementById('modal-formation').classList.add('hidden');

                const periodAnalysisModal = document.getElementById('modal-period-analysis');
                const isAnalysisOpen = periodAnalysisModal && !periodAnalysisModal.classList.contains('hidden');

                if (isAnalysisOpen) {
                    // 階層2（大画面分析）が開いている場合は該当ピリオドを更新
                    openPeriodAnalysis(matchId, targetPeriodIndex);
                } else {
                    // 階層1（試合詳細画面）を再描画
                    initMatchDetailView(matchId);
                }
            }
        };
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