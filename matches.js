// matches.js
import { state, uiState } from './state.js';
import { escapeHtml, getNendo, showToast, showCustomConfirm } from './utils.js';
import { saveData, navigate, openModal } from './app.js';
import { openPlayerDetail } from './players.js';
import { drawPitchToCtx } from './drawing.js';
import { registerListener, cleanupScope } from './event-manager.js';

let ytPlayer = null;
let currentMatchId = null;
let currentPeriodIndex = 0;
let isResizingWorkspace = false;
let timelineInterval = null;

let periodSideClickOutsideHandler = null;
let periodSideKeyDownHandler = null;
let fieldUndoState = null;
let fieldUndoTimer = null;

function cleanupPeriodSideEvents() {

    cleanupScope('matches.periodSidePanel');
    periodSideClickOutsideHandler = null;
    periodSideKeyDownHandler = null;
}

function ensureFieldPeriod(match) {
    if (!match.formations) match.formations = [];
    if (match.formations.length === 0) {
        match.formations.push({
            id: Date.now(),
            name: '試合中記録',
            system: '',
            scoreUs: 0,
            scoreThem: 0,
            goalRecords: [],
            substitutions: [],
            pkKickerRecords: [],
            videoUrl: '',
            videoUrls: [],
            lineup: [],
            analysisMemos: [],
            summary: '',
            boardData: []
        });
    }
    const period = match.formations[0];
    if (!period.goalRecords) period.goalRecords = [];
    if (!period.substitutions) period.substitutions = [];
    if (!period.analysisMemos) period.analysisMemos = [];
    if (!period.eventHistory) period.eventHistory = [];
    return period;
}

function appendFieldEvent(period, event) {
    if (!period.eventHistory) period.eventHistory = [];
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, recordedAt: new Date().toISOString(), ...event };
    period.eventHistory.push(record);
    return record;
}

function closeFieldQuickAction() {
    const modal = document.getElementById('modal-field-quick-action');
    if (modal) modal.classList.add('hidden');
    if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
        document.body.classList.remove('modal-open');
    }
}

function showFieldUndo(matchId, periodIndex, previous, label) {
    fieldUndoState = { matchId, periodIndex, previous, label };
    const bar = document.getElementById('field-undo-bar');
    const message = document.getElementById('field-undo-message');
    if (message) message.textContent = `${label}を記録しました`;
    if (bar) bar.classList.remove('hidden');
    if (fieldUndoTimer) clearTimeout(fieldUndoTimer);
    fieldUndoTimer = setTimeout(() => {
        fieldUndoState = null;
        if (bar) bar.classList.add('hidden');
    }, 10000);
}

function undoFieldAction() {
    if (!fieldUndoState) return;
    const { matchId, periodIndex, previous } = fieldUndoState;
    const match = state.matches.find(m => Number(m.id) === Number(matchId));
    if (match && match.formations && match.formations[periodIndex]) {
        match.formations[periodIndex] = previous;
        recalculateMatchResult(match);
        saveData();
        showToast('直前の記録を取り消しました');
    }
    fieldUndoState = null;
    if (fieldUndoTimer) clearTimeout(fieldUndoTimer);
    document.getElementById('field-undo-bar')?.classList.add('hidden');
}

function renderFieldQuickAction(matchId, type) {
    const match = state.matches.find(m => Number(m.id) === Number(matchId));
    const content = document.getElementById('field-quick-content');
    const title = document.getElementById('field-quick-title');
    if (!match || !content || !title) return;
    const players = [...(state.players || [])].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
    const playerOptions = players.map(p => `<option value="${p.id}">${escapeHtml(`${p.number || ''} ${p.name}`.trim())}</option>`).join('');
    const playerGrid = players.length ? players.map(p => `
        <button type="button" class="btn btn-secondary field-quick-option" data-player-id="${p.id}">
            <span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.number || '番号なし')}</small></span><i class="fa-solid fa-check"></i>
        </button>`).join('') : '<p class="text-secondary">選手未登録でも記録できます。後から選手を設定できます。</p>';

    if (type === 'score') {
        title.textContent = '得点を記録';
        content.innerHTML = `
            <span class="field-quick-label">得点者（任意）</span>
            <div class="field-quick-grid" id="field-score-players">${playerGrid}</div>
            <input type="hidden" id="field-score-player-id" value="">
            <button type="button" class="btn btn-primary field-quick-submit" id="btn-field-quick-submit"><i class="fa-solid fa-futbol"></i> 得点を記録する</button>`;
        content.querySelectorAll('[data-player-id]').forEach(button => {
            button.onclick = () => {
                content.querySelectorAll('[data-player-id]').forEach(item => item.classList.remove('is-selected'));
                button.classList.add('is-selected');
                document.getElementById('field-score-player-id').value = button.dataset.playerId;
            };
        });
        document.getElementById('btn-field-quick-submit').onclick = () => {
            const period = ensureFieldPeriod(match);
            const previous = JSON.parse(JSON.stringify(period));
            const scorerId = parseInt(document.getElementById('field-score-player-id').value, 10) || null;
            period.scoreUs = (period.scoreUs || 0) + 1;
            const event = appendFieldEvent(period, { type: 'score', scorerId });
            period.goalRecords.push({ scorerId, assistId: null, eventId: event.id });
            recalculateMatchResult(match);
            saveData();
            closeFieldQuickAction();
            showFieldUndo(match.id, 0, previous, '得点');
            showToast('得点を記録しました');
        };
    } else if (type === 'substitution') {
        title.textContent = '交代を記録';
        content.innerHTML = `
            <label class="field-quick-label" for="field-sub-out">OUT選手</label>
            <select id="field-sub-out" class="form-control field-quick-select"><option value="">選択してください</option>${playerOptions}</select>
            <label class="field-quick-label" for="field-sub-in">IN選手</label>
            <select id="field-sub-in" class="form-control field-quick-select"><option value="">選択してください</option>${playerOptions}</select>
            <button type="button" class="btn btn-primary field-quick-submit" id="btn-field-quick-submit"><i class="fa-solid fa-arrows-rotate"></i> 交代を記録する</button>`;
        document.getElementById('btn-field-quick-submit').onclick = () => {
            const outId = parseInt(document.getElementById('field-sub-out').value, 10) || null;
            const inId = parseInt(document.getElementById('field-sub-in').value, 10) || null;
            if (!outId || !inId || outId === inId) {
                showToast('OUT選手とIN選手を選択してください');
                return;
            }
            const period = ensureFieldPeriod(match);
            const previous = JSON.parse(JSON.stringify(period));
            const event = appendFieldEvent(period, { type: 'substitution', playerOutId: outId, playerInId: inId });
            period.substitutions.push({ playerOutId: outId, playerInId: inId, eventId: event.id });
            saveData();
            closeFieldQuickAction();
            showFieldUndo(match.id, 0, previous, '交代');
            showToast('交代を記録しました');
        };
    } else {
        title.textContent = 'メモを記録';
        const tags = ['チャンス', '得点', '失点', 'ビルドアップ', '課題/反省', 'メモ'];
        content.innerHTML = `
            <span class="field-quick-label">タグ</span>
            <div class="field-quick-grid" id="field-note-tags">${tags.map((tag, index) => `<button type="button" class="btn ${index === 0 ? 'btn-primary is-selected' : 'btn-secondary'} field-quick-option" data-tag="${tag}">${tag}</button>`).join('')}</div>
            <input type="hidden" id="field-note-tag" value="${tags[0]}">
            <label class="field-quick-label" for="field-note-text">メモ（任意）</label>
            <textarea id="field-note-text" class="form-control field-quick-input" rows="3" placeholder="例：左サイドからの崩し"></textarea>
            <button type="button" class="btn btn-primary field-quick-submit" id="btn-field-quick-submit"><i class="fa-solid fa-pen"></i> メモを記録する</button>`;
        content.querySelectorAll('[data-tag]').forEach(button => {
            button.onclick = () => {
                content.querySelectorAll('[data-tag]').forEach(item => item.classList.remove('is-selected', 'btn-primary'));
                content.querySelectorAll('[data-tag]').forEach(item => item.classList.add('btn-secondary'));
                button.classList.add('is-selected', 'btn-primary');
                button.classList.remove('btn-secondary');
                document.getElementById('field-note-tag').value = button.dataset.tag;
            };
        });
        document.getElementById('btn-field-quick-submit').onclick = () => {
            const period = ensureFieldPeriod(match);
            const previous = JSON.parse(JSON.stringify(period));
            const tag = document.getElementById('field-note-tag').value;
            const text = document.getElementById('field-note-text').value.trim();
            const event = appendFieldEvent(period, { type: 'memo', tag, text });
            period.analysisMemos.push({
                time: '00:00',
                tag,
                text,
                eventId: event.id,
                recordedAt: event.recordedAt
            });
            saveData();
            closeFieldQuickAction();
            showFieldUndo(match.id, 0, previous, 'メモ');
            showToast('メモを記録しました');
        };
    }
    const modal = document.getElementById('modal-field-quick-action');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        content.querySelector('button, select, textarea')?.focus();
    }
}

function initFieldCompanionActions(matchId, isCoach) {
    const actions = [['btn-field-score', 'score'], ['btn-field-substitution', 'substitution'], ['btn-field-note', 'note']];
    actions.forEach(([id, type]) => {
        const button = document.getElementById(id);
        if (button) button.onclick = () => {
            if (isCoach) renderFieldQuickAction(matchId, type);
        };
    });
    const undoButton = document.getElementById('btn-field-undo');
    if (undoButton) undoButton.onclick = undoFieldAction;
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
        playerEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; gap:1rem; color:#fff; text-align:center; background:#0f172a;">
                <i class="fa-brands fa-youtube" style="font-size:3.2rem; color:#ef4444;"></i>
                <div style="font-weight:700; font-size:1.05rem; color:#f8fafc;">YouTube動画 URLが未設定です</div>
                <p style="font-size:0.8rem; color:#94a3b8; margin:0; max-width:400px; line-height:1.4;">試合動画のURL（YouTube）を入力すると、ここで再生およびタイムライン分析が行えます。（保護者・指導者ともに追加・保存が可能です）</p>
                <div style="display:flex; gap:0.5rem; max-width:480px; width:92%; margin-top:0.3rem;">
                    <input type="url" id="quick-yt-url-input" class="form-control" placeholder="https://www.youtube.com/watch?v=..." style="font-size:0.85rem; background:#1e293b; color:#fff; border-color:#334155;">
                    <button type="button" class="btn btn-primary" id="quick-yt-url-save-btn" style="white-space:nowrap; font-weight:600; padding:0.4rem 0.9rem;"><i class="fa-solid fa-plus"></i> 動画を追加</button>
                </div>
            </div>
        `;

        const btnQuickAdd = playerEl.querySelector('#quick-yt-url-save-btn');
        if (btnQuickAdd) {
            btnQuickAdd.onclick = () => {
                const inputEl = playerEl.querySelector('#quick-yt-url-input');
                const newUrl = inputEl ? inputEl.value.trim() : '';
                if (!newUrl) {
                    showToast('YouTubeのURLを入力してください');
                    return;
                }
                const match = state.matches.find(m => m.id === currentMatchId);
                if (match && match.formations && match.formations[currentPeriodIndex]) {
                    const p = match.formations[currentPeriodIndex];
                    p.videoUrl = newUrl;
                    p.videoUrls = [newUrl];
                    saveData();
                    showToast('YouTube動画を追加しました！');
                    loadYouTubePlayer(newUrl, containerId);
                    const sideInput = document.getElementById('side-form-video') || document.getElementById('side-form-video-parent');
                    if (sideInput) sideInput.value = newUrl;
                }
            };
        }
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
        playerEl.innerHTML = `<iframe class="u-ext-38" width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?playsinline=1" frameborder="0" allowfullscreen ></iframe>`;
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
        <span class="u-ext-39" >得点:</span>
        <select class="u-ext-40 form-control goal-scorer-select" >
            ${scorerOptions}
        </select>
        <span class="u-ext-41" >アシスト:</span>
        <select class="u-ext-40 form-control goal-assist-select" >
            ${assistOptions}
        </select>
        <button type="button" class="u-ext-42 btn btn-danger" onclick="document.getElementById('${rowId}').remove()"  title="削除"><i class="fa-solid fa-trash-can"></i></button>
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
        <button type="button" class="u-ext-43 btn btn-secondary btn-seek-video"  title="このシーンへジャンプ">
            <i class="fa-solid fa-play"></i>
        </button>
        <input type="text" class="u-ext-44 form-control memo-time-input" value="${timeStr}" placeholder="00:00" >
        <select class="u-ext-45 form-control memo-tag-select" >
            ${tagOptions}
        </select>
        <input type="text" class="u-ext-46 form-control memo-text-input" value="${escapeHtml(textVal)}" placeholder="メモ（例: 左展開からクロス）" >
        <button type="button" class="u-ext-47 btn btn-danger" onclick="document.getElementById('${rowId}').remove()"  title="削除"><i class="fa-solid fa-trash-can"></i></button>
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
        <input type="url" class="u-ext-48 form-control formation-video-input" value="${urlVal}" placeholder="https://www.youtube.com/watch?v=... または https://youtu.be/..." >
        <button type="button" class="u-ext-49 btn btn-danger" onclick="document.getElementById('${rowId}').remove()"  title="削除"><i class="fa-solid fa-trash"></i></button>
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

let activeQuickAssignPlayerId = null;

export function renderQuickAssignRoster() {
    const container = document.getElementById('formation-quick-assign-roster');
    if (!container) return;

    const sorted = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));

    container.innerHTML = sorted.map(p => `
        <button type="button" class="btn btn-sm btn-secondary btn-outline-primary btn-quick-assign-player" data-id="${p.id}" style="border-radius:20px; white-space:nowrap; padding:0.25rem 0.6rem; font-size:0.75rem;">
            ${p.number} ${p.name}
        </button>
    `).join('');

    container.querySelectorAll('.btn-quick-assign-player').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const pid = btn.dataset.id;

            // Remove active from all
            container.querySelectorAll('.btn-quick-assign-player').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary', 'btn-outline-primary');
            });

            if (activeQuickAssignPlayerId === pid) {
                // Toggle off
                activeQuickAssignPlayerId = null;
            } else {
                // Toggle on
                activeQuickAssignPlayerId = pid;
                btn.classList.remove('btn-secondary', 'btn-outline-primary');
                btn.classList.add('btn-primary');
            }
        };
    });
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

        const nodeTop = coord.top !== undefined ? (typeof coord.top === 'number' ? `${coord.top}%` : coord.top) : (coord.y !== undefined ? `${coord.y}%` : '50%');
        const nodeLeft = coord.left !== undefined ? (typeof coord.left === 'number' ? `${coord.left}%` : coord.left) : (coord.x !== undefined ? `${coord.x}%` : '50%');

        nodeEl.style.top = nodeTop;
        nodeEl.style.left = nodeLeft;

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
            if (activeQuickAssignPlayerId) {
                const p = state.players.find(pl => pl.id == activeQuickAssignPlayerId);
                if (p) {
                    nodeEl.dataset.playerId = p.id;
                    nodeEl.innerHTML = `
                        <span class="pitch-node-role">${nodeEl.dataset.label}</span>
                        <span class="pitch-node-number">${p.number}</span>
                        <div class="pitch-node-name">${p.number} ${p.name}</div>
                    `;
                    // Reset active quick assign player
                    const activeBtn = document.querySelector(`.btn-quick-assign-player[data-id="${activeQuickAssignPlayerId}"]`);
                    if (activeBtn) {
                        activeBtn.classList.remove('btn-primary');
                        activeBtn.classList.add('btn-secondary', 'btn-outline-primary');
                    }
                    activeQuickAssignPlayerId = null;
                }
            } else {
                openFormationPlayerPicker(nodeEl);
            }
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
        container.innerHTML = '<p class="u-ext-50 text-secondary" >登録されている選手がいません。「選手一覧」から選手を登録してください。</p>';
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
            <label class="u-ext-51" >
                <input class="u-ext-52" type="checkbox" value="${p.id}" ${isChecked} >
                <span class="u-ext-53" >${p.number}. ${escapeHtml(p.name)}</span>
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
            const themeStr = document.getElementById('match-theme').value.trim();
            const summaryStr = document.getElementById('match-summary').value.trim();

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

            const pkUsInput = document.getElementById('match-pk-us');
            const pkThemInput = document.getElementById('match-pk-them');
            const pkUs = (pkUsInput && pkUsInput.value !== '') ? parseInt(pkUsInput.value, 10) : null;
            const pkThem = (pkThemInput && pkThemInput.value !== '') ? parseInt(pkThemInput.value, 10) : null;

            const editId = document.getElementById('match-edit-id').value;
            if (editId) {
                const match = state.matches.find(m => m.id === parseInt(editId, 10));
                if (match) {
                    match.date = document.getElementById('match-date').value;
                    match.opponent = document.getElementById('match-opponent').value;
                    match.type = document.getElementById('match-type').value;
                    match.tournament = document.getElementById('match-tournament').value;
                    match.pkUs = pkUs;
                    match.pkThem = pkThem;
                    match.result = resultStr;
                    match.scorers = scorersStr;
                    match.goalRecords = goalRecords;
                    match.theme = themeStr;
                    match.comments = summaryStr;
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
                    pkUs: pkUs,
                    pkThem: pkThem,
                    scorers: scorersStr,
                    goalRecords: goalRecords,
                    theme: themeStr,
                    comments: summaryStr,
                    playerFeedback: [],
                    formations: [],
                    presentPlayerIds: presentPlayerIds
                };
                state.matches.unshift(newMatch);
                saveData();
                showToast('試合を記録しました');
            }

            document.getElementById('modal-match').classList.add('hidden');
            if (editId) {
                // 既存の編集の場合は、試合詳細に留まって最新データで再描画
                initMatchDetailView(parseInt(editId, 10));
            } else {
                // 新規作成の場合は、一覧へ遷移
                navigate('matches');
            }
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
                const mainScore = m.result.split(' ')[0];
                const scores = mainScore.split('-');
                if (scoreUsEl) scoreUsEl.value = scores[0];
                if (scoreThemEl) scoreThemEl.value = scores[1];
            } else {
                if (scoreUsEl) scoreUsEl.value = m.scoreUs !== undefined ? m.scoreUs : '';
                if (scoreThemEl) scoreThemEl.value = m.scoreThem !== undefined ? m.scoreThem : '';
            }

            const pkUsEl = document.getElementById('match-pk-us');
            const pkThemEl = document.getElementById('match-pk-them');
            if (pkUsEl) pkUsEl.value = (m.pkUs !== undefined && m.pkUs !== null) ? m.pkUs : '';
            if (pkThemEl) pkThemEl.value = (m.pkThem !== undefined && m.pkThem !== null) ? m.pkThem : '';

            if (goalRecordsList && m.goalRecords && m.goalRecords.length > 0) {
                m.goalRecords.forEach(r => {
                    addGoalRecordRow(r.scorerId, r.assistId);
                });
            }

            const themeEl = document.getElementById('match-theme');
            if (themeEl) themeEl.value = m.theme || '';

            const summaryEl = document.getElementById('match-summary');
            if (summaryEl) summaryEl.value = m.comments || '';

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

export function getMatchStatus(m) {
    if (!m || !m.result) return 'upcoming';

    if (m.pkUs !== undefined && m.pkUs !== null && m.pkThem !== undefined && m.pkThem !== null) {
        if (m.pkUs > m.pkThem) return 'win';
        if (m.pkUs < m.pkThem) return 'loss';
    }

    const pkMatch = m.result.match(/\(PK\s*(\d+)\s*-\s*(\d+)\)/i);
    if (pkMatch) {
        const pUs = parseInt(pkMatch[1], 10);
        const pThem = parseInt(pkMatch[2], 10);
        if (pUs > pThem) return 'win';
        if (pUs < pThem) return 'loss';
    }

    const matchScore = m.result.match(/(\d+)\s*-\s*(\d+)/);
    if (!matchScore) return 'upcoming';
    const us = parseInt(matchScore[1], 10);
    const them = parseInt(matchScore[2], 10);
    if (us > them) return 'win';
    if (us < them) return 'loss';
    return 'draw';
}

export function renderMatchScoreHeaderBadge(m) {
    const status = getMatchStatus(m);
    let badgeHtml = '';
    if (status === 'win') {
        badgeHtml = '<span class="badge" style="background:var(--primary); color:#fff; font-size:0.75rem; padding:0.2rem 0.5rem; font-weight:700; border-radius:4px;"><i class="fa-solid fa-trophy"></i> WIN</span>';
    } else if (status === 'loss') {
        badgeHtml = '<span class="badge" style="background:#64748b; color:#fff; font-size:0.75rem; padding:0.2rem 0.5rem; font-weight:700; border-radius:4px;"><i class="fa-solid fa-xmark"></i> LOSE</span>';
    } else if (status === 'draw') {
        badgeHtml = '<span class="badge" style="background:#f59e0b; color:#fff; font-size:0.75rem; padding:0.2rem 0.5rem; font-weight:700; border-radius:4px;"><i class="fa-solid fa-handshake"></i> DRAW</span>';
    }

    const resultStr = m.result || `${m.scoreUs || 0}-${m.scoreThem || 0}`;

    return `
        <div style="display:inline-flex; align-items:center; gap:0.5rem;">
            ${badgeHtml}
            <span style="font-size:1.2rem; font-weight:800; color:var(--text-primary);">${escapeHtml(resultStr)}</span>
        </div>
    `;
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

    const dateInput = document.getElementById('match-detail-date-input');
    const opponentInput = document.getElementById('match-detail-opponent-input');
    const typeSelect = document.getElementById('match-detail-type-select');
    const tournamentInput = document.getElementById('match-detail-tournament-input');

    if (dateInput) dateInput.value = m.date || '';
    if (opponentInput) opponentInput.value = m.opponent || '';
    if (tournamentInput) tournamentInput.value = m.tournament || '';

    if (typeSelect) {
        typeSelect.innerHTML = state.matchTypes.map(t => `<option value="${t}" ${m.type === t ? 'selected' : ''}>${t}</option>`).join('');
    }

    // 保護者モード用のテキスト表示更新
    const metaEl = document.getElementById('match-detail-meta');
    if (metaEl) {
        metaEl.textContent = `${m.date || ''} | ${m.type || ''}${m.tournament ? ` (${m.tournament})` : ''}`;
    }

    const titleEl = document.getElementById('match-detail-title');
    if (titleEl) {
        titleEl.textContent = `vs ${m.opponent || '対戦相手'}`;
    }

    const scoreBox = document.getElementById('match-detail-score-box');
    if (scoreBox) {
        scoreBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem;">
            ${renderMatchScoreHeaderBadge(m)}
            <button type="button" class="btn btn-secondary btn-sm" onclick="copyMatchShareText(${m.id})" title="LINE共有用テキストをコピー" style="padding:0.35rem 0.6rem; font-size:0.8rem;">
                <i class="fa-solid fa-share-nodes" style="color:var(--primary);"></i> 共有
            </button>
        </div>
    `;
    }

    // P1 Field Companion: 専用Bottom sheetへ接続
    initFieldCompanionActions(m.id, isCoach);

    // ★【追加】マイ選手出場要約の描写実行 ★

    const summaryContainer = document.getElementById('my-player-summary-container');
    if (summaryContainer) {
        summaryContainer.innerHTML = renderMyPlayerSummaryCard(m);
    }

    const themeText = document.getElementById('match-detail-theme-text');
    const themeInput = document.getElementById('match-detail-theme-input');
    const summaryText = document.getElementById('match-detail-summary-text');
    const summaryInput = document.getElementById('match-detail-summary-input');

    if (themeText) themeText.textContent = m.theme || '未設定';
    if (themeInput) themeInput.value = m.theme || '';

    let goodStr = '';
    let improveStr = '';
    if (m.comments) {
        const parts = m.comments.split('【ネクストステップ】');
        if (parts.length > 1) {
            goodStr = parts[0].replace('【ポジティブ】', '').trim();
            improveStr = parts[1].trim();
        } else {
            goodStr = m.comments.replace('【ポジティブ】', '').trim();
        }
    }

    if (summaryText) summaryText.textContent = m.comments || '記録なし';
    if (summaryInput) summaryInput.value = m.comments || '';

    // 出欠表示とインライン編集
    const detailRosterDisplay = document.getElementById('match-detail-attendance-roster-display');
    const detailRosterEdit = document.getElementById('match-detail-attendance-roster-edit');
    const detailAttendanceSummary = document.getElementById('match-detail-attendance-summary');

    if (detailAttendanceSummary) {
        detailAttendanceSummary.textContent = `参加者 (${m.presentPlayerIds ? `${m.presentPlayerIds.length}/${state.players.length}` : `0/${state.players.length}`})`;
    }

    if (detailRosterDisplay) {
        const attendeesHtml = m.presentPlayerIds && m.presentPlayerIds.length > 0
            ? state.players.filter(pl => m.presentPlayerIds.includes(pl.id)).map(pl => `
                <span class="u-ext-54" >
                    ${pl.number ? `<span class="u-ext-55" >${pl.number}</span>` : ''}
                    <span class="u-ext-56" >${escapeHtml(pl.name)}</span>
                </span>
            `).join('')
            : '<span class="u-ext-57" >メンバー登録がありません</span>';

        detailRosterDisplay.innerHTML = attendeesHtml;
    }

    // コーチ用出欠チェックボックス一覧の描画
    if (detailRosterEdit) {
        const activeIds = m.presentPlayerIds || [];
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        detailRosterEdit.innerHTML = sortedPlayers.map(p => {
            const isChecked = activeIds.includes(p.id) ? 'checked' : '';
            return `
                <label class="u-ext-58" >
                    <input type="checkbox" class="u-ext-59 inline-match-attendance-checkbox" value="${p.id}" ${isChecked} >
                    <span class="u-ext-5" >${p.number || '—'}</span>
                    <span class="u-ext-60"  title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                </label>
            `;
        }).join('');
    }

    // インラインフォームの送信（保存）イベント
    const formInline = document.getElementById('form-match-detail-inline');
    if (formInline) {
        formInline.onsubmit = (e) => {
            e.preventDefault();
            if (state.currentUserRole !== 'coach') {
                showToast('保護者モードでは保存できません');
                return;
            }

            // 出欠チェックボックスの収集
            const checkedBoxes = formInline.querySelectorAll('.inline-match-attendance-checkbox:checked');
            const presentPlayerIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));

            // テーマと総括・基本情報の更新
            m.date = dateInput ? dateInput.value : m.date;
            m.opponent = opponentInput ? opponentInput.value.trim() : m.opponent;
            m.type = typeSelect ? typeSelect.value : m.type;
            m.tournament = tournamentInput ? tournamentInput.value.trim() : m.tournament;
            m.theme = themeInput ? themeInput.value.trim() : '';
            m.comments = summaryInput ? summaryInput.value.trim() : '';
            m.presentPlayerIds = presentPlayerIds;

            saveData();
            showToast('試合基本情報・テーマ・総括・出欠情報を保存しました');
            initMatchDetailView(m.id);
        };
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

export function recalculateMatchResult(match) {
    if (!match) return;
    if (!match.formations) match.formations = [];

    let totalUs = 0;
    let totalThem = 0;
    let pkUs = null;
    let pkThem = null;

    const allMatchGoalRecords = [];
    const scorersList = [];

    match.formations.forEach(f => {
        const isPkPeriod = f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'));
        if (isPkPeriod) {
            pkUs = (f.scoreUs !== undefined && f.scoreUs !== null) ? parseInt(f.scoreUs, 10) : 0;
            pkThem = (f.scoreThem !== undefined && f.scoreThem !== null) ? parseInt(f.scoreThem, 10) : 0;
        } else {
            totalUs += (f.scoreUs || 0);
            totalThem += (f.scoreThem || 0);
        }

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
    match.scoreUs = totalUs;
    match.scoreThem = totalThem;
    match.pkUs = pkUs;
    match.pkThem = pkThem;

    if (pkUs !== null && pkThem !== null && !isNaN(pkUs) && !isNaN(pkThem)) {
        match.result = `${totalUs}-${totalThem} (PK ${pkUs}-${pkThem})`;
    } else {
        match.result = `${totalUs}-${totalThem}`;
    }
}

export async function deletePeriod(matchId, periodId) {
    if (state.currentUserRole !== 'coach') {
        showToast('保護者モードでは削除できません');
        return;
    }
    const match = state.matches.find(m => m.id === matchId);
    if (!match || !match.formations) return;

    const targetIndex = match.formations.findIndex(f => f.id === periodId);
    if (targetIndex === -1) return;

    const periodName = match.formations[targetIndex].name || `${targetIndex + 1}本目`;

    const proceed = await showCustomConfirm(
        `ピリオド「${periodName}」を削除してもよろしいですか？`,
        'ピリオドの削除',
        { okText: '削除する', type: 'danger' }
    );
    if (!proceed) return;

    match.formations.splice(targetIndex, 1);

    recalculateMatchResult(match);

    saveData();
    showToast(`「${periodName}」を削除しました`);

    const modalFormation = document.getElementById('modal-formation');
    if (modalFormation && !modalFormation.classList.contains('hidden')) {
        modalFormation.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    initMatchDetailView(matchId);

    const periodAnalysisModal = document.getElementById('modal-period-analysis');
    if (periodAnalysisModal && !periodAnalysisModal.classList.contains('hidden')) {
        if (match.formations.length > 0) {
            const nextIdx = Math.min(targetIndex, match.formations.length - 1);
            openPeriodAnalysis(matchId, nextIdx);
        } else {
            periodAnalysisModal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    }
}
window.deletePeriod = deletePeriod;

export function openMatchDetail(id) {
    navigate('match-detail', { matchId: id });
}

function renderPeriodGrid(m) {
    const grid = document.getElementById('match-period-grid');
    const isCoach = state.currentUserRole === 'coach';
    if (!grid) return;

    if (!m.formations || m.formations.length === 0) {
        grid.innerHTML = '<div class="u-ext-61" >ピリオドが登録されていません。「＋ ピリオド追加」から作成してください。</div>';
        return;
    }

    grid.innerHTML = m.formations.map((f, idx) => {
        const scoreUs = f.scoreUs !== undefined ? f.scoreUs : 0;
        const scoreThem = f.scoreThem !== undefined ? f.scoreThem : 0;
        const videoBadge = (f.videoUrls?.length || f.videoUrl) ? '<i class="u-ext-16 fa-brands fa-youtube" title="動画あり"></i>' : '';
        const isPkPeriod = f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'));

        let goalDetailsHtml = '';
        if (isPkPeriod && f.pkKickerRecords && f.pkKickerRecords.length > 0) {
            goalDetailsHtml = f.pkKickerRecords.map((k, kIdx) => {
                const p = state.players.find(pl => pl.id === k.kickerId);
                const nameStr = p ? `${p.number ? `${p.number}. ` : ''}${escapeHtml(p.name)}` : 'キッカー未登録';
                const usMark = k.isUsGoal === true ? '<b style="color:var(--success);">○</b>' : (k.isUsGoal === false ? '<b style="color:var(--danger);">✕</b>' : '-');
                const themMark = k.isThemGoal === true ? '<b style="color:var(--success);">○</b>' : (k.isThemGoal === false ? '<b style="color:var(--danger);">✕</b>' : '-');
                return `<div class="u-ext-62" style="display:flex; justify-content:space-between; font-size:0.8rem;">
                    <span>${kIdx + 1}本目: ${nameStr} (${usMark})</span>
                    <span>相手: (${themMark})</span>
                </div>`;
            }).join('');
        } else if (f.goalRecords && f.goalRecords.length > 0) {
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
                return `<div class="u-ext-62" >⚽ ${escapeHtml(text)}</div>`;
            }).join('');
        }

        const memoList = f.analysisMemos || [];
        const memosHtml = memoList.length > 0
            ? memoList.slice(0, 2).map(memo => {
                let icon = '💡';
                if (memo.tag === '得点') icon = '⚽';
                else if (memo.tag === '失点') icon = '⚠️';
                else if (memo.tag === '課題/反省') icon = '📌';
                return `<div class="u-ext-63" >${icon} ${escapeHtml(memo.time || '00:00')} ${escapeHtml(memo.text || memo.tag)}</div>`;
            }).join('')
            : '';

        const goalsHtml = (goalDetailsHtml || memosHtml)
            ? `${goalDetailsHtml}${memosHtml}`
            : '<div class="u-ext-64" >記録なし</div>';

        const systemBadge = isPkPeriod
            ? `<span class="badge" style="background:var(--primary); color:#fff;">PK戦 (キッカー順)</span>`
            : `<span class="u-ext-71 badge">陣形: ${escapeHtml(f.system || '未設定')}</span>`;

        // ★【追加】途中交代（OUT ➔ IN）の表示用HTML生成
        // ★ 途中交代（OUT ➔ IN）の表示用HTML生成
        let subsHtml = '';
        if (f.substitutions && f.substitutions.length > 0) {
            subsHtml = f.substitutions.map(sub => {
                const pOut = state.players.find(p => p.id === sub.playerOutId);
                const pIn = state.players.find(p => p.id === sub.playerInId);
                const outName = pOut ? `${pOut.number ? `#${pOut.number} ` : ''}${pOut.name}` : 'OUT未設定';
                const inName = pIn ? `${pIn.number ? `#${pIn.number} ` : ''}${pIn.name}` : 'IN未設定';
                return `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;"><i class="fa-solid fa-arrows-rotate" style="color:#eab308;"></i> 交代: ${escapeHtml(outName)} ➔ <strong style="color:var(--text-primary);">${escapeHtml(inName)}</strong> (0.5P)</div>`;
            }).join('');
        }

        return `
            <div class="u-ext-65 card" >
                <div>
                    <div class="u-ext-66" >
                        <strong class="u-ext-67" >${escapeHtml(f.name || `${idx + 1}本目`)}</strong>
                        <div class="u-ext-68" >
                            ${videoBadge}
                            <span class="u-ext-69 badge" >${isPkPeriod ? 'PK ' : ''}${scoreUs} - ${scoreThem}</span>
                        </div>
                    </div>

                    <div class="u-ext-70" >
                        ${systemBadge}
                        ${subsHtml}
                    </div>

                    <div class="u-ext-72" >
                        ${goalsHtml}
                    </div>

                    <div class="u-ext-73" >
                        💬 ${escapeHtml(f.summary || f.reflection || '総括コメント未入力')}
                    </div>
                </div>

                <div class="u-ext-74" >
                    <button class="u-ext-75 btn btn-primary btn-sm btn-open-analysis" data-index="${idx}" ><i class="fa-solid fa-film"></i> 動画分析 ➔</button>
                    ${isCoach ? `
                        <button class="u-ext-76 btn btn-secondary btn-sm btn-edit-period-card" data-id="${f.id}" title="ピリオド編集"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger btn-sm btn-delete-period-card" data-id="${f.id}" title="ピリオド削除"><i class="fa-solid fa-trash"></i></button>
                    ` : ''}
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

    grid.querySelectorAll('.btn-delete-period-card').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const formId = parseInt(e.currentTarget.dataset.id, 10);
            deletePeriod(m.id, formId);
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

        const isPkPeriod = checkIsPkPeriod(period.name);

        if (isPkPeriod) {
            if (isCoach) {
                if (sideHeading) sideHeading.innerHTML = '<i class="fa-solid fa-bullseye" style="color:var(--primary);"></i> PK戦情報編集';

                let sidePkKickers = period.pkKickerRecords ? JSON.parse(JSON.stringify(period.pkKickerRecords)) : [];
                if (sidePkKickers.length === 0) {
                    sidePkKickers = [
                        { index: 1, kickerId: null, isUsGoal: null, isThemGoal: null },
                        { index: 2, kickerId: null, isUsGoal: null, isThemGoal: null },
                        { index: 3, kickerId: null, isUsGoal: null, isThemGoal: null }
                    ];
                }

                const renderSidePkRows = () => {
                    let usCount = 0;
                    let themCount = 0;
                    const playerOptionsHtml = '<option value="">(キッカーを選択)</option>' +
                        state.players.map(p => `<option value="${p.id}">${p.number ? `${p.number}. ` : ''}${escapeHtml(p.name)}</option>`).join('');

                    const rowsHtml = sidePkKickers.map((k, idx) => {
                        if (k.isUsGoal === true) usCount++;
                        if (k.isThemGoal === true) themCount++;
                        const isSudden = idx >= 3;
                        const labelText = isSudden ? `${idx + 1}本目 (サドンデス)` : `${idx + 1}本目`;

                        return `
                            <div class="side-pk-row" data-idx="${idx}">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.75rem; font-weight:bold;">${labelText}</span>
                                    ${isSudden ? `<button type="button" class="btn-side-remove-pk" data-idx="${idx}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.7rem;"><i class="fa-solid fa-trash"></i></button>` : ''}
                                </div>
                                <select class="form-control form-control-sm side-pk-kicker-select" data-idx="${idx}" style="font-size:0.75rem; margin-bottom:0.2rem;">
                                    ${playerOptionsHtml}
                                </select>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:0.2rem;">
                                        <span style="font-size:0.7rem; color:var(--text-secondary);">自:</span>
                                        <button type="button" class="btn btn-xs side-pk-btn-us ${k.isUsGoal === true ? 'btn-success' : 'btn-outline'}" data-idx="${idx}" data-val="true" style="padding:0.1rem 0.3rem; font-size:0.7rem;">○</button>
                                        <button type="button" class="btn btn-xs side-pk-btn-us ${k.isUsGoal === false ? 'btn-danger' : 'btn-outline'}" data-idx="${idx}" data-val="false" style="padding:0.1rem 0.3rem; font-size:0.7rem;">✕</button>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.2rem;">
                                        <span style="font-size:0.7rem; color:var(--text-secondary);">相:</span>
                                        <button type="button" class="btn btn-xs side-pk-btn-them ${k.isThemGoal === true ? 'btn-success' : 'btn-outline'}" data-idx="${idx}" data-val="true" style="padding:0.1rem 0.3rem; font-size:0.7rem;">○</button>
                                        <button type="button" class="btn btn-xs side-pk-btn-them ${k.isThemGoal === false ? 'btn-danger' : 'btn-outline'}" data-idx="${idx}" data-val="false" style="padding:0.1rem 0.3rem; font-size:0.7rem;">✕</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    const containerEl = document.getElementById('side-pk-rows-container');
                    if (containerEl) {
                        containerEl.innerHTML = rowsHtml;
                        containerEl.querySelectorAll('.side-pk-kicker-select').forEach(sel => {
                            const idx = parseInt(sel.dataset.idx, 10);
                            if (sidePkKickers[idx] && sidePkKickers[idx].kickerId) sel.value = sidePkKickers[idx].kickerId;
                            sel.onchange = (e) => { sidePkKickers[idx].kickerId = e.target.value ? parseInt(e.target.value, 10) : null; };
                        });
                        containerEl.querySelectorAll('.side-pk-btn-us').forEach(btn => {
                            btn.onclick = () => {
                                const idx = parseInt(btn.dataset.idx, 10);
                                const val = btn.dataset.val === 'true';
                                sidePkKickers[idx].isUsGoal = (sidePkKickers[idx].isUsGoal === val) ? null : val;
                                renderSidePkRows();
                            };
                        });
                        containerEl.querySelectorAll('.side-pk-btn-them').forEach(btn => {
                            btn.onclick = () => {
                                const idx = parseInt(btn.dataset.idx, 10);
                                const val = btn.dataset.val === 'true';
                                sidePkKickers[idx].isThemGoal = (sidePkKickers[idx].isThemGoal === val) ? null : val;
                                renderSidePkRows();
                            };
                        });
                        containerEl.querySelectorAll('.btn-side-remove-pk').forEach(btn => {
                            btn.onclick = () => {
                                const idx = parseInt(btn.dataset.idx, 10);
                                sidePkKickers.splice(idx, 1);
                                renderSidePkRows();
                            };
                        });
                    }

                    const badgeEl = document.getElementById('side-pk-score-badge');
                    if (badgeEl) badgeEl.textContent = `PK ${usCount} - ${themCount}`;
                };

                sideBody.innerHTML = `
                    <div class="side-info-card">
                        <span class="side-info-label">ピリオド名</span>
                        <input type="text" id="side-form-name" class="form-control form-control-sm" value="${escapeHtml(period.name || 'PK戦')}">
                    </div>
                    <div class="side-info-card">
                        <span class="side-info-label">YouTube動画 URL</span>
                        <input type="url" id="side-form-video" class="form-control form-control-sm" value="${escapeHtml((period.videoUrls && period.videoUrls[0]) || period.videoUrl || '')}" placeholder="https://youtu.be/...">
                    </div>
                    <div class="side-info-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                            <span class="side-info-label" style="margin:0;"><i class="fa-solid fa-bullseye"></i> PKキッカー記録</span>
                            <span id="side-pk-score-badge" class="badge" style="background:var(--primary); color:#fff; font-size:0.75rem;">PK 0 - 0</span>
                        </div>
                        <div id="side-pk-rows-container" style="max-height:220px; overflow-y:auto; margin-bottom:0.4rem;"></div>
                        <button type="button" class="btn btn-secondary btn-xs" id="btn-side-add-pk" style="width:100%;">
                            <i class="fa-solid fa-plus"></i> サドンデス枠を追加
                        </button>
                    </div>
                    <div class="side-info-card">
                        <span class="side-info-label">ピリオド総括</span>
                        <textarea id="side-form-summary" class="form-control form-control-sm" rows="3">${escapeHtml(period.summary || period.reflection || '')}</textarea>
                    </div>
                    <div style="margin-top:0.6rem;">
                        <button type="button" class="btn btn-primary btn-sm" id="btn-side-save-period" style="width:100%; margin:0;">
                            <i class="fa-solid fa-save"></i> 変更を保存
                        </button>
                    </div>
                `;

                renderSidePkRows();

                document.getElementById('btn-side-add-pk').onclick = () => {
                    sidePkKickers.push({
                        index: sidePkKickers.length + 1,
                        kickerId: null,
                        isUsGoal: null,
                        isThemGoal: null
                    });
                    renderSidePkRows();
                };

                document.getElementById('btn-side-save-period').onclick = () => {
                    let usCount = 0;
                    let themCount = 0;
                    sidePkKickers.forEach(k => {
                        if (k.isUsGoal === true) usCount++;
                        if (k.isThemGoal === true) themCount++;
                    });

                    period.name = document.getElementById('side-form-name').value.trim();
                    period.system = 'PK戦';
                    period.scoreUs = usCount;
                    period.scoreThem = themCount;
                    period.pkKickerRecords = JSON.parse(JSON.stringify(sidePkKickers));
                    period.summary = document.getElementById('side-form-summary').value.trim();

                    const videoUrlVal = document.getElementById('side-form-video').value.trim();
                    period.videoUrl = videoUrlVal;
                    period.videoUrls = videoUrlVal ? [videoUrlVal] : [];

                    recalculateMatchResult(match);
                    saveData();
                    showToast('PK戦情報を保存しました');

                    const titleEl = document.getElementById('period-analysis-title');
                    if (titleEl) {
                        titleEl.textContent = `vs ${escapeHtml(match.opponent)} - ${period.name} (PK ${period.scoreUs} - ${period.scoreThem})`;
                    }
                };

                return;
            } else {
                // 保護者モード: PK戦閲覧
                if (sideHeading) sideHeading.innerHTML = '<i class="fa-solid fa-bullseye" style="color:var(--primary);"></i> PK戦情報';
                const pkRows = period.pkKickerRecords || [];
                const rowsHtml = pkRows.map((k, idx) => {
                    const p = state.players.find(pl => pl.id === k.kickerId);
                    const nameStr = p ? `${p.number ? `${p.number}. ` : ''}${escapeHtml(p.name)}` : '未登録';
                    const usMark = k.isUsGoal === true ? '<b style="color:var(--success);">○</b>' : (k.isUsGoal === false ? '<b style="color:var(--danger);">✕</b>' : '-');
                    const themMark = k.isThemGoal === true ? '<b style="color:var(--success);">○</b>' : (k.isThemGoal === false ? '<b style="color:var(--danger);">✕</b>' : '-');
                    return `<div style="display:flex; justify-content:space-between; font-size:0.8rem; padding:0.25rem 0; border-bottom:1px dashed var(--surface-border);">
                        <span>${idx + 1}本目: ${nameStr} (${usMark})</span>
                        <span>相手: (${themMark})</span>
                    </div>`;
                }).join('') || '<div style="font-size:0.8rem; color:var(--text-secondary);">記録なし</div>';

                sideBody.innerHTML = `
                    <div class="side-info-card">
                        <span class="side-info-label">ピリオド名</span>
                        <div style="font-size:0.9rem; font-weight:bold;">${escapeHtml(period.name || 'PK戦')}</div>
                    </div>
                    <div class="side-info-card">
                        <span class="side-info-label">スコア</span>
                        <div style="font-size:1.1rem; font-weight:bold; color:var(--primary);">PK ${period.scoreUs || 0} - ${period.scoreThem || 0}</div>
                    </div>
                    <div class="side-info-card">
                        <span class="side-info-label"><i class="fa-solid fa-bullseye"></i> キッカー記録</span>
                        <div style="margin-top:0.4rem;">${rowsHtml}</div>
                    </div>
                    <div class="side-info-card">
                        <span class="side-info-label">ピリオド総括</span>
                        <div style="font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap;">${escapeHtml(period.summary || period.reflection || 'コメントなし')}</div>
                    </div>
                `;
                return;
            }
        }

        if (isCoach) {
            // コーチモード：編集フォーム（ミニピッチ付き）
            if (sideHeading) sideHeading.innerHTML = '<i class="u-ext-77 fa-solid fa-pen" ></i> ピリオド情報編集';

            const systemOptions = state.customFormations.map(cf => `<option value="${cf.name}" ${period.system === cf.name ? 'selected' : ''}>${cf.name} (${cf.coords.length}人制)</option>`).join('');

            // 1. 得点記録の行HTML生成
            let goalRowsHtml = '';
            if (period.goalRecords && period.goalRecords.length > 0) {
                goalRowsHtml = period.goalRecords.map((r, rIdx) => {
                    const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
                    const scorerOpts = `<option value="">得点者なし/OG</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id === r.scorerId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
                    const assistOpts = `<option value="">アシストなし</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id === r.assistId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');

                    return `
                        <div class="u-ext-78 side-goal-row" data-index="${rIdx}" >
                            <div class="u-ext-79" >
                                <span class="u-ext-80" >#${rIdx + 1}</span>
                                <select class="u-ext-81 form-control form-control-sm side-scorer-select" >${scorerOpts}</select>
                                <button type="button" class="u-ext-82 btn btn-danger btn-xs btn-remove-side-goal"  title="この得点記録を削除"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            <div class="u-ext-83" >
                                <select class="u-ext-81 form-control form-control-sm side-assist-select" >${assistOpts}</select>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            let sideSubRowsHtml = '';
            if (!period.substitutions) period.substitutions = [];
            const sortedPlayersForSub = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));

            if (period.substitutions.length > 0) {
                sideSubRowsHtml = period.substitutions.map((sub, sIdx) => {
                    const outOpts = `<option value="">OUT選手を選択</option>` + sortedPlayersForSub.map(p => `<option value="${p.id}" ${p.id === sub.playerOutId ? 'selected' : ''}>${p.number ? `#${p.number} ` : ''}${p.name}</option>`).join('');
                    const inOpts = `<option value="">IN選手を選択</option>` + sortedPlayersForSub.map(p => `<option value="${p.id}" ${p.id === sub.playerInId ? 'selected' : ''}>${p.number ? `#${p.number} ` : ''}${p.name}</option>`).join('');

                    return `
                        <div class="side-sub-row" data-index="${sIdx}" style="display:flex; flex-direction:column; gap:0.2rem; padding:0.4rem; background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; margin-bottom:0.4rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.72rem; font-weight:bold; color:var(--text-secondary);">交代 #${sIdx + 1} (0.5P)</span>
                                <button type="button" class="btn btn-danger btn-xs btn-remove-side-sub" style="padding:0.1rem 0.3rem;" title="削除"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            <div style="display:flex; gap:0.3rem; align-items:center;">
                                <select class="form-control form-control-sm side-sub-out-select" style="font-size:0.75rem; flex:1;">${outOpts}</select>
                                <span style="font-size:0.75rem;">➔</span>
                                <select class="form-control form-control-sm side-sub-in-select" style="font-size:0.75rem; flex:1;">${inOpts}</select>
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

                    // ★ lineup と positions の両方から選手IDを復元検索
                    let assignedPlayerId = '';
                    if (period.lineup && Array.isArray(period.lineup)) {
                        const found = period.lineup.find(l => l.roleLabel === c.label || l.roleIndex === pIdx || l.role === c.role);
                        if (found) assignedPlayerId = found.playerId;
                    }
                    if (!assignedPlayerId && period.positions) {
                        assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    }

                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const labelText = assignedPlayer ? (assignedPlayer.number ? `#${assignedPlayer.number}` : assignedPlayer.name.slice(0, 3)) : (c.role ? c.role.slice(0, 3) : `P${pIdx + 1}`);

                    const rawLeft = c.left !== undefined ? c.left : (c.x !== undefined ? `${c.x}%` : '50%');
                    const rawTop = c.top !== undefined ? c.top : (c.y !== undefined ? `${c.y}%` : '50%');
                    const leftStr = typeof rawLeft === 'number' ? `${rawLeft}%` : rawLeft;
                    const topStr = typeof rawTop === 'number' ? `${rawTop}%` : rawTop;

                    return `
                        <div class="side-pitch-pin" data-pos-key="${posKey}" style="position:absolute; left:${leftStr}; top:${topStr}; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:5;" title="${c.role || `ポジション${pIdx + 1}`}">
                            <div class="u-ext-84" >
                                ${labelText}
                            </div>
                        </div>
                    `;
                }).join('');

                posListHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;

                    // ★ lineup と positions の両方から選手IDを復元検索
                    let assignedPlayerId = '';
                    if (period.lineup && Array.isArray(period.lineup)) {
                        const found = period.lineup.find(l => l.roleLabel === c.label || l.roleIndex === pIdx || l.role === c.role);
                        if (found) assignedPlayerId = found.playerId;
                    }
                    if (!assignedPlayerId && period.positions) {
                        assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    }

                    const playerOpts = `<option value="">未割当</option>` + sortedPlayers.map(p => `<option value="${p.id}" ${p.id == assignedPlayerId ? 'selected' : ''}>${p.number ? `#${p.number}` : ''} ${p.name}</option>`).join('');

                    return `
                        <div class="u-ext-85 side-position-row" data-pos-key="${posKey}" >
                            <span class="u-ext-86"  title="${c.role || `P${pIdx + 1}`}">${c.role || `${pIdx + 1}`}</span>
                            <select class="u-ext-87 form-control form-control-sm side-pos-player-select" >${playerOpts}</select>
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
                    <div class="u-ext-88" >
                        <div class="u-ext-89" >
                            <span class="u-ext-90" >自</span>
                            <button type="button" class="u-ext-91 btn btn-secondary btn-xs" id="btn-side-us-minus" ><i class="fa-solid fa-minus"></i></button>
                            <span class="u-ext-92" id="side-score-us-display" >${period.scoreUs || 0}</span>
                            <button type="button" class="u-ext-91 btn btn-secondary btn-xs" id="btn-side-us-plus" ><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <span class="u-ext-93" >-</span>
                        <div class="u-ext-89" >
                            <button type="button" class="u-ext-91 btn btn-secondary btn-xs" id="btn-side-them-minus" ><i class="fa-solid fa-minus"></i></button>
                            <span class="u-ext-92" id="side-score-them-display" >${period.scoreThem || 0}</span>
                            <button type="button" class="u-ext-91 btn btn-secondary btn-xs" id="btn-side-them-plus" ><i class="fa-solid fa-plus"></i></button>
                            <span class="u-ext-90" >相</span>
                        </div>
                    </div>
                </div>
                <div class="side-info-card">
                    <div class="u-ext-94" >
                        <span class="u-ext-95 side-info-label" >得点者・アシスト記録</span>
                        <button type="button" class="u-ext-96 btn btn-primary btn-xs" id="btn-add-side-goal" ><i class="fa-solid fa-plus"></i> 追加</button>
                    </div>
                    <div class="u-ext-97" id="side-goal-records-container" >
                        ${goalRowsHtml || '<div class="u-ext-57" >得点記録なし</div>'}
                    </div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド総括</span>
                    <textarea id="side-form-summary" class="form-control form-control-sm" rows="3">${escapeHtml(period.summary || period.reflection || '')}</textarea>
                </div>
                <!-- ★【追加】途中交代カード -->
                <div class="side-info-card">
                    <div class="u-ext-94" style="margin-bottom:0.4rem;">
                        <span class="u-ext-95 side-info-label" style="margin:0;"><i class="fa-solid fa-arrows-rotate" style="color:#eab308;"></i> 途中交代 (1人につき 0.5P)</span>
                        <button type="button" class="u-ext-96 btn btn-primary btn-xs" id="btn-add-side-sub"><i class="fa-solid fa-plus"></i> 追加</button>
                    </div>
                    <div id="side-substitutions-container">
                        ${sideSubRowsHtml || '<div class="u-ext-57">途中交代の記録なし</div>'}
                    </div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">システム (陣形)</span>
                    <select id="side-form-system" class="form-control form-control-sm">${systemOptions}</select>
                </div>
                <div class="side-info-card">
                    <span class="u-ext-98 side-info-label" >ポジション配置（ミニピッチ図）</span>
                    <div class="tactical-pitch pitch-half-bottom" id="side-mini-pitch" style="max-width: 320px; width: 100%; margin: 0 auto 0.5rem;">
                        <div class="penalty-area-bottom"></div>
                        <div class="goal-area-bottom"></div>
                        <div class="penalty-arc-bottom"></div>
                        <div class="penalty-spot-bottom"></div>
                        <div class="corner-arc-bl"></div>
                        <div class="corner-arc-br"></div>
                        ${pitchPinsHtml}
                    </div>
                    <div class="u-ext-104" id="side-positions-container" >
                        ${posListHtml || '<div class="u-ext-57" >ポジション設定がありません</div>'}
                    </div>
                </div>
                <div style="margin-top:0.6rem;">
                    <button type="button" class="u-ext-105 btn btn-primary btn-sm" id="btn-side-save-period" style="width:100%; margin:0;">
                        <i class="fa-solid fa-save"></i> 変更を保存
                    </button>
                </div>
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

                // ★【追加】交代データの収集
                const substitutions = [];
                sideBody.querySelectorAll('.side-sub-row').forEach(row => {
                    const outVal = row.querySelector('.side-sub-out-select').value;
                    const inVal = row.querySelector('.side-sub-in-select').value;
                    if (outVal || inVal) {
                        substitutions.push({
                            playerOutId: outVal ? parseInt(outVal, 10) : null,
                            playerInId: inVal ? parseInt(inVal, 10) : null
                        });
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
                    positions: positions,
                    substitutions: substitutions // ★ 追加
                };
            };

            // ★【追加】交代追加ボタン
            const btnAddSub = document.getElementById('btn-add-side-sub');
            if (btnAddSub) {
                btnAddSub.onclick = () => {
                    if (!period.substitutions) period.substitutions = [];
                    period.substitutions.push({ playerOutId: null, playerInId: null });
                    renderSidePanelContent();
                };
            }

            // ★【追加】交代削除ボタン
            sideBody.querySelectorAll('.btn-remove-side-sub').forEach(btn => {
                btn.onclick = (e) => {
                    const sIdx = parseInt(e.currentTarget.closest('.side-sub-row').dataset.index, 10);
                    if (period.substitutions) {
                        period.substitutions.splice(sIdx, 1);
                        renderSidePanelContent();
                    }
                };
            });

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
                    period.substitutions = finalData.substitutions; // ★ 追加

                    recalculateMatchResult(match);

                    saveData();
                    showToast('ピリオド情報とポジション配置を保存しました');
                    openPeriodAnalysis(matchId, periodIndex);
                };
            }
        } else {
            // 保護者モード：閲覧専用プレビュー（コーチモードと同じすべての情報を網羅）
            if (sideHeading) sideHeading.innerHTML = '<i class="u-ext-77 fa-solid fa-circle-info" ></i> ピリオド情報';

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
                    return `<div class="u-ext-106" >⚽ ${escapeHtml(text)}</div>`;
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

                    // ★【修正】lineup と positions の両方から選手IDを復元検索
                    let assignedPlayerId = '';
                    if (period.lineup && Array.isArray(period.lineup)) {
                        const found = period.lineup.find(l => l.roleLabel === c.label || l.roleIndex === pIdx || l.role === c.role);
                        if (found) assignedPlayerId = found.playerId;
                    }
                    if (!assignedPlayerId && period.positions) {
                        assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    }

                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const labelText = assignedPlayer ? (assignedPlayer.number ? `#${assignedPlayer.number}` : assignedPlayer.name.slice(0, 3)) : (c.role ? c.role.slice(0, 3) : `P${pIdx + 1}`);

                    const leftPercent = (c.x !== undefined && !isNaN(c.x)) ? c.x : 50;
                    const topPercent = (c.y !== undefined && !isNaN(c.y)) ? c.y : 50;

                    return `
                        <div class="side-pitch-pin" data-pos-key="${posKey}" style="position:absolute; left:${leftPercent}%; top:${topPercent}%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; cursor:pointer; z-index:5;" title="${c.role || `ポジション${pIdx + 1}`}">
                            <div class="u-ext-84" >
                                ${labelText}
                            </div>
                        </div>
                    `;
                }).join('');

                posListHtml = currentCustomForm.coords.map((c, pIdx) => {
                    const posKey = `pos_${pIdx}_${c.role || 'pos'}`;

                    // ★【修正】lineup と positions の両方から選手IDを復元検索
                    let assignedPlayerId = '';
                    if (period.lineup && Array.isArray(period.lineup)) {
                        const found = period.lineup.find(l => l.roleLabel === c.label || l.roleIndex === pIdx || l.role === c.role);
                        if (found) assignedPlayerId = found.playerId;
                    }
                    if (!assignedPlayerId && period.positions) {
                        assignedPlayerId = period.positions[posKey] || period.positions[pIdx] || '';
                    }

                    const assignedPlayer = state.players.find(p => p.id == assignedPlayerId);
                    const playerName = assignedPlayer ? `${assignedPlayer.number ? `#${assignedPlayer.number} ` : ''}${assignedPlayer.name}` : '未割当';

                    return `
                        <div class="u-ext-107 side-position-row" data-pos-key="${posKey}" >
                            <span class="u-ext-93" >${escapeHtml(c.role || `${pIdx + 1}`)}</span>
                            <span class="u-ext-108" >${escapeHtml(playerName)}</span>
                        </div>
                    `;
                }).join('');
            }

            sideBody.innerHTML = `
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド名</span>
                    <div class="u-ext-109 side-info-val" >${escapeHtml(period.name || '未設定')}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> YouTube動画 URL</span>
                    <div style="display:flex; gap:0.4rem; align-items:center; margin-top:0.3rem;">
                        <input type="url" id="side-form-video-parent" class="form-control form-control-sm" value="${escapeHtml(videoUrl)}" placeholder="https://youtu.be/..." style="flex:1;">
                        <button type="button" class="btn btn-primary btn-xs" id="btn-save-video-parent" style="padding:0.25rem 0.55rem; font-size:0.75rem; white-space:nowrap; font-weight:600;"><i class="fa-solid fa-save"></i> 保存</button>
                    </div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">スコア (自 - 相手)</span>
                    <div class="u-ext-112 side-info-val" >${period.scoreUs || 0} - ${period.scoreThem || 0}</div>
                </div>
                <div class="side-info-card">
                    <span class="u-ext-98 side-info-label" >得点者・アシスト記録</span>
                    ${goalDetailsHtml ? `<div class="u-ext-113" >${goalDetailsHtml}</div>` : '<div class="u-ext-64" >得点記録なし</div>'}
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">ピリオド総括</span>
                    <div class="u-ext-114 side-info-val" >${escapeHtml(period.summary || period.reflection || '総括コメントはありません。')}</div>
                </div>
                <div class="side-info-card">
                    <span class="side-info-label">システム (陣形)</span>
                    <div class="u-ext-109 side-info-val" >${escapeHtml(period.system || '未設定')}</div>
                </div>
                <div class="side-info-card">
                    <span class="u-ext-98 side-info-label" >ポジション配置（ミニピッチ図）</span>
                    <div class="tactical-pitch pitch-half-bottom" id="side-mini-pitch-parent" style="max-width: 320px; width: 100%; margin: 0 auto 0.5rem;">
                        <div class="penalty-area-bottom"></div>
                        <div class="goal-area-bottom"></div>
                        <div class="penalty-arc-bottom"></div>
                        <div class="penalty-spot-bottom"></div>
                        <div class="corner-arc-bl"></div>
                        <div class="corner-arc-br"></div>
                        ${pitchPinsHtml}
                    </div>
                    <div class="u-ext-104" >
                        ${posListHtml || '<div class="u-ext-57" >ポジション設定がありません</div>'}
                    </div>
                </div>
            `;

            const btnSaveParentVideo = sideBody.querySelector('#btn-save-video-parent');
            if (btnSaveParentVideo) {
                btnSaveParentVideo.onclick = () => {
                    const inputEl = sideBody.querySelector('#side-form-video-parent');
                    const newUrl = inputEl ? inputEl.value.trim() : '';
                    period.videoUrl = newUrl;
                    period.videoUrls = newUrl ? [newUrl] : [];
                    saveData();
                    showToast('YouTube動画URLを保存しました');
                    loadYouTubePlayer(newUrl, 'period-yt-player');
                };
            }

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
                // DOM変更で要素が接続解除された場合（+ - ボタンクリック等で再描画された場合）は閉じない
                if (!e.target || !e.target.isConnected) return;

                // セレクトボックスの選択肢などをクリックした際に閉じないよう、いくつかの要素を除外
                const isInsideSidebar = sidePanel.contains(e.target);
                const isToggleBtn = sideToggleBtn.contains(e.target);
                const isOptionOrPicker = e.target.closest('#formation-player-picker') || e.target.closest('.modal-overlay') || e.target.tagName === 'OPTION';
                if (!isInsideSidebar && !isToggleBtn && !isOptionOrPicker) {
                    sidePanel.classList.remove('open');
                    sidePanel.classList.add('collapsed');
                }
            }
        };
        setTimeout(() => {
            if (periodSideClickOutsideHandler) {
                registerListener('matches.periodSidePanel', document, 'click', periodSideClickOutsideHandler);
                registerListener('matches.periodSidePanel', document, 'touchstart', periodSideClickOutsideHandler);
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
        registerListener('matches.periodSidePanel', document, 'keydown', periodSideKeyDownHandler);
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

function suggestNextPeriodName(prevName, defaultIndex) {
    if (!prevName) return `${defaultIndex}本目`;
    const trimmed = prevName.trim();

    if (trimmed === '前半') return '後半';
    if (trimmed === '後半') return 'PK戦';

    const matchHon = trimmed.match(/^(\d+)本目$/);
    if (matchHon) {
        return `${parseInt(matchHon[1], 10) + 1}本目`;
    }

    const matchQ = trimmed.match(/^(.*?)(\d+)(Q|クォーター)$/i);
    if (matchQ) {
        return `${matchQ[1]}${parseInt(matchQ[2], 10) + 1}${matchQ[3]}`;
    }

    const matchTrailingNum = trimmed.match(/^(.*?)(\d+)$/);
    if (matchTrailingNum) {
        return `${matchTrailingNum[1]}${parseInt(matchTrailingNum[2], 10) + 1}`;
    }

    return `${defaultIndex}本目`;
}

let currentPkKickers = [];

function checkIsPkPeriod(name) {
    return !!(name && (name.trim() === 'PK戦' || name.toLowerCase().includes('pk')));
}

function renderPkShootoutEditor() {
    const listEl = document.getElementById('pk-kickers-list');
    const badgeEl = document.getElementById('pk-summary-badge');
    if (!listEl) return;

    let usGoalCount = 0;
    let themGoalCount = 0;

    const playerOptionsHtml = '<option value="">(キッカーを選択)</option>' +
        state.players.map(p => `<option value="${p.id}">${p.number ? `${p.number}. ` : ''}${escapeHtml(p.name)}</option>`).join('');

    listEl.innerHTML = currentPkKickers.map((k, idx) => {
        if (k.isUsGoal === true) usGoalCount++;
        if (k.isThemGoal === true) themGoalCount++;

        const isSuddenDeath = idx >= 3;
        const labelText = isSuddenDeath ? `${idx + 1}本目 (サドンデス)` : `${idx + 1}本目`;

        return `
            <div class="pk-kicker-row" data-idx="${idx}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; font-weight:bold; color:var(--text-primary);">${labelText}</span>
                    ${isSuddenDeath ? `<button type="button" class="btn-remove-pk-row" data-idx="${idx}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.75rem;"><i class="fa-solid fa-trash"></i> 削除</button>` : ''}
                </div>
                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1.5; min-width:140px;">
                        <select class="form-control form-control-sm pk-kicker-select" data-idx="${idx}" style="font-size:0.78rem;">
                            ${playerOptionsHtml}
                        </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">自:</span>
                        <button type="button" class="btn btn-sm pk-btn-us ${k.isUsGoal === true ? 'btn-success' : 'btn-outline'}" data-idx="${idx}" data-val="true" style="padding:0.15rem 0.4rem; font-size:0.75rem;">○ 成功</button>
                        <button type="button" class="btn btn-sm pk-btn-us ${k.isUsGoal === false ? 'btn-danger' : 'btn-outline'}" data-idx="${idx}" data-val="false" style="padding:0.15rem 0.4rem; font-size:0.75rem;">✕ 失敗</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        <span style="font-size:0.75rem; color:var(--text-secondary);">相手:</span>
                        <button type="button" class="btn btn-sm pk-btn-them ${k.isThemGoal === true ? 'btn-success' : 'btn-outline'}" data-idx="${idx}" data-val="true" style="padding:0.15rem 0.4rem; font-size:0.75rem;">○ 成功</button>
                        <button type="button" class="btn btn-sm pk-btn-them ${k.isThemGoal === false ? 'btn-danger' : 'btn-outline'}" data-idx="${idx}" data-val="false" style="padding:0.15rem 0.4rem; font-size:0.75rem;">✕ 失敗</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.pk-kicker-select').forEach(sel => {
        const idx = parseInt(sel.dataset.idx, 10);
        if (currentPkKickers[idx] && currentPkKickers[idx].kickerId) {
            sel.value = currentPkKickers[idx].kickerId;
        }
        sel.onchange = (e) => {
            currentPkKickers[idx].kickerId = e.target.value ? parseInt(e.target.value, 10) : null;
        };
    });

    listEl.querySelectorAll('.pk-btn-us').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const val = btn.dataset.val === 'true';
            currentPkKickers[idx].isUsGoal = (currentPkKickers[idx].isUsGoal === val) ? null : val;
            renderPkShootoutEditor();
        };
    });

    listEl.querySelectorAll('.pk-btn-them').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const val = btn.dataset.val === 'true';
            currentPkKickers[idx].isThemGoal = (currentPkKickers[idx].isThemGoal === val) ? null : val;
            renderPkShootoutEditor();
        };
    });

    listEl.querySelectorAll('.btn-remove-pk-row').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx, 10);
            currentPkKickers.splice(idx, 1);
            renderPkShootoutEditor();
        };
    });

    if (badgeEl) {
        badgeEl.textContent = `PK ${usGoalCount} - ${themGoalCount}`;
    }
}

function updatePeriodModalMode() {
    const nameVal = document.getElementById('formation-name')?.value || '';
    const isPk = checkIsPkPeriod(nameVal);

    const pitchContainer = document.getElementById('modal-formation-pitch-container');
    const sysSelect = document.getElementById('formation-system-select');
    const sysGroup = sysSelect ? sysSelect.closest('.form-group') : null;
    const pkContainer = document.getElementById('pk-shootout-container');

    if (isPk) {
        if (pitchContainer) pitchContainer.style.display = 'none';
        if (sysGroup) sysGroup.style.display = 'none';
        if (pkContainer) pkContainer.style.display = 'block';

        if (!currentPkKickers || currentPkKickers.length === 0) {
            currentPkKickers = [
                { index: 1, kickerId: null, isUsGoal: null, isThemGoal: null },
                { index: 2, kickerId: null, isUsGoal: null, isThemGoal: null },
                { index: 3, kickerId: null, isUsGoal: null, isThemGoal: null }
            ];
        }
        renderPkShootoutEditor();
    } else {
        if (pitchContainer) pitchContainer.style.display = 'block';
        if (sysGroup) sysGroup.style.display = 'block';
        if (pkContainer) pkContainer.style.display = 'none';
    }
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
            const isPk = checkIsPkPeriod(name);

            let scoreUs = 0;
            let scoreThem = 0;
            let lineup = [];
            let pkKickerRecords = [];

            if (isPk) {
                currentPkKickers.forEach(k => {
                    if (k.isUsGoal === true) scoreUs++;
                    if (k.isThemGoal === true) scoreThem++;
                });
                pkKickerRecords = JSON.parse(JSON.stringify(currentPkKickers));
            } else {
                const nodes = document.querySelectorAll('#tactical-formation-pitch .pitch-node');
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
            }

            let targetPeriodIndex = 0;

            if (targetFormationId) {
                const fIndex = targetMatch.formations.findIndex(f => f.id === parseInt(targetFormationId, 10));
                if (fIndex !== -1) {
                    targetPeriodIndex = fIndex;
                    const formObj = targetMatch.formations[fIndex];
                    formObj.name = name;
                    formObj.system = isPk ? 'PK戦' : system;
                    formObj.lineup = lineup;
                    if (isPk) {
                        formObj.scoreUs = scoreUs;
                        formObj.scoreThem = scoreThem;
                        formObj.pkKickerRecords = pkKickerRecords;
                    }
                }
            } else {
                const newPeriod = {
                    id: Date.now(),
                    name,
                    system: isPk ? 'PK戦' : system,
                    scoreUs: isPk ? scoreUs : 0,
                    scoreThem: isPk ? scoreThem : 0,
                    goalRecords: [],
                    pkKickerRecords: isPk ? pkKickerRecords : [],
                    videoUrl: '',
                    videoUrls: [],
                    lineup,
                    analysisMemos: [],
                    summary: '',
                    boardData: []
                };
                if (!targetMatch.formations) targetMatch.formations = [];
                targetMatch.formations.push(newPeriod);
                targetPeriodIndex = targetMatch.formations.length - 1;
            }

            recalculateMatchResult(targetMatch);

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

    const nameInput = document.getElementById('formation-name');
    if (nameInput) {
        nameInput.oninput = updatePeriodModalMode;
    }

    const btnAddPk = document.getElementById('btn-add-pk-kicker');
    if (btnAddPk) {
        btnAddPk.onclick = () => {
            currentPkKickers.push({
                index: currentPkKickers.length + 1,
                kickerId: null,
                isUsGoal: null,
                isThemGoal: null
            });
            renderPkShootoutEditor();
        };
    }

    const sysSelect = document.getElementById('formation-system-select');
    if (sysSelect) {
        sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');
    }

    let existingLineup = [];
    const btnCopy = document.getElementById('btn-copy-prev-period');
    const btnDeleteModal = document.getElementById('btn-delete-formation-modal');

    if (formationId) {
        if (btnCopy) btnCopy.style.display = 'none';
        if (btnDeleteModal) {
            btnDeleteModal.style.display = 'inline-flex';
            btnDeleteModal.onclick = () => deletePeriod(matchId, formationId);
        }
        const f = match.formations.find(item => item.id === formationId);
        if (f) {
            document.getElementById('formation-name').value = f.name || '';
            if (sysSelect) sysSelect.value = f.system || '';
            existingLineup = f.lineup || [];
            currentPkKickers = f.pkKickerRecords ? JSON.parse(JSON.stringify(f.pkKickerRecords)) : [];
        }
    } else {
        if (btnDeleteModal) btnDeleteModal.style.display = 'none';
        const lastPeriod = (match.formations && match.formations.length > 0) ? match.formations[match.formations.length - 1] : null;
        const nextIndex = (match.formations ? match.formations.length : 0) + 1;
        document.getElementById('formation-name').value = suggestNextPeriodName(lastPeriod ? lastPeriod.name : '', nextIndex);
        currentPkKickers = [];

        if (btnCopy) {
            if (lastPeriod) {
                btnCopy.style.display = 'block';
                btnCopy.onclick = () => {
                    const prevPeriod = match.formations[match.formations.length - 1];
                    if (sysSelect) sysSelect.value = prevPeriod.system || '';
                    existingLineup = prevPeriod.lineup ? JSON.parse(JSON.stringify(prevPeriod.lineup)) : [];
                    renderFormationPitch(sysSelect ? sysSelect.value : prevPeriod.system, existingLineup);
                    showToast('前ピリオドの配置をコピーしました');
                };
            } else {
                btnCopy.style.display = 'none';
            }
        }
    }

    updatePeriodModalMode();

    const selectedSys = (sysSelect && sysSelect.value) ? sysSelect.value : (state.customFormations[0]?.name || '3-3-1');
    renderFormationPitch(selectedSys, existingLineup);

    if (sysSelect) {
        sysSelect.onchange = (e) => renderFormationPitch(e.target.value, []);
    }

    activeQuickAssignPlayerId = null;
    renderQuickAssignRoster();

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
            <div class="u-ext-115" >
                <i class="u-ext-116 fa-regular fa-clock" ></i>
                タイムライン記録がありません。
            </div>`;
        return;
    }

    container.innerHTML = memos.map((m, idx) => {
        const currentTag = m.tag || (state.analysisTags && state.analysisTags[0]) || 'メモ';
        const disabledAttr = isCoach ? '' : 'disabled';
        const deleteBtnHtml = isCoach
            ? `<button type="button" class="u-ext-117 btn btn-danger btn-sm btn-delete-memo"  title="削除"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const tagOptionHtml = (state.analysisTags || []).map(t => `<option value="${escapeHtml(t)}" ${currentTag === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');

        return `
            <div class="u-ext-118 timeline-edit-row" data-index="${idx}" >
                <div class="u-ext-119" >
                    <button type="button" class="u-ext-120 btn btn-secondary btn-sm btn-seek-timestamp" data-time="${escapeHtml(m.time || '00:00')}" >
                        <i class="fa-solid fa-play"></i> ${escapeHtml(m.time || '00:00')}
                    </button>

                    <select class="u-ext-121 form-control memo-tag-val" ${disabledAttr} >
                        ${tagOptionHtml}
                    </select>

                    ${deleteBtnHtml}
                </div>
                <div>
                    <input type="text" class="u-ext-122 form-control memo-text-val" value="${escapeHtml(m.text || '')}" ${disabledAttr} placeholder="${isCoach ? 'メモ（例: 左サイドからの崩し）' : 'メモなし'}" >
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
    state.matches.forEach(m => recalculateMatchResult(m));

    let currentMatchNendo = uiState.currentMatchNendo || 'all';
    let currentMatchOpponent = uiState.currentMatchOpponent || 'all';
    let currentMatchType = uiState.currentMatchType || 'all';
    let currentMatchResult = uiState.currentMatchResult || 'all';
    let currentMatchSearch = (uiState.currentMatchSearch || '').toLowerCase().trim();
    let matchSortOrder = uiState.matchSortOrder || 'desc';
    let currentMatchPage = uiState.currentMatchPage;
    const ITEMS_PER_PAGE = uiState.ITEMS_PER_PAGE;
    const isCoach = state.currentUserRole === 'coach';

    // ── Search Input ──
    const searchInput = document.getElementById('input-match-search');
    if (searchInput) {
        searchInput.value = uiState.currentMatchSearch || '';
        searchInput.oninput = (e) => {
            uiState.currentMatchSearch = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    // ── Populate Accordion Selects ──
    const matchNendos = [...new Set(state.matches.map(m => getNendo(m.date)))].sort((a, b) => b - a);
    const filterNendoSelect = document.getElementById('filter-nendo-match');
    if (filterNendoSelect) {
        let options = '<option value="all">すべての年度</option>';
        matchNendos.forEach(y => { options += `<option value="${y}" ${currentMatchNendo === String(y) ? 'selected' : ''}>${y}年度</option>`; });
        filterNendoSelect.innerHTML = options;
        filterNendoSelect.onchange = (e) => {
            uiState.currentMatchNendo = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const availableTypes = [...new Set([...(state.matchTypes || []), ...state.matches.map(m => m.type).filter(Boolean)])];
    const filterTypeSelect = document.getElementById('filter-type-match');
    if (filterTypeSelect) {
        let options = '<option value="all">すべての種別</option>';
        availableTypes.forEach(t => { options += `<option value="${escapeHtml(t)}" ${currentMatchType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`; });
        filterTypeSelect.innerHTML = options;
        filterTypeSelect.onchange = (e) => {
            uiState.currentMatchType = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const opponents = [...new Set(state.matches.map(m => m.opponent).filter(Boolean))].sort();
    const filterOpponentSelect = document.getElementById('filter-opponent-match');
    if (filterOpponentSelect) {
        let options = '<option value="all">すべての対戦相手</option>';
        opponents.forEach(opp => { options += `<option value="${escapeHtml(opp)}" ${currentMatchOpponent === opp ? 'selected' : ''}>${escapeHtml(opp)}</option>`; });
        filterOpponentSelect.innerHTML = options;
        filterOpponentSelect.onchange = (e) => {
            uiState.currentMatchOpponent = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const filterResultSelect = document.getElementById('filter-result-match');
    if (filterResultSelect) {
        filterResultSelect.value = currentMatchResult;
        filterResultSelect.onchange = (e) => {
            uiState.currentMatchResult = e.target.value;
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    // ── Active Filter Badge, Button State & Tag Chips ──
    let activeFilterCount = 0;
    const activeTagsContainer = document.getElementById('active-tags-matches');
    let activeTagsHtml = '<span class="active-tag-label">絞り込み中:</span>';

    if (currentMatchNendo !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="nendo">${currentMatchNendo}年度 <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentMatchType !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="type">${escapeHtml(currentMatchType)} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentMatchOpponent !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="opponent">vs ${escapeHtml(currentMatchOpponent)} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentMatchResult !== 'all') {
        activeFilterCount++;
        const resultMap = { win: '勝利', loss: '敗北', draw: '引き分け', upcoming: '試合予定' };
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="result">${resultMap[currentMatchResult] || currentMatchResult} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }

    if (activeTagsContainer) {
        if (activeFilterCount > 0) {
            activeTagsContainer.innerHTML = activeTagsHtml;
            activeTagsContainer.classList.remove('hidden');
            activeTagsContainer.querySelectorAll('.active-tag-chip').forEach(chip => {
                chip.onclick = () => {
                    const key = chip.dataset.clearKey;
                    if (key === 'nendo') uiState.currentMatchNendo = 'all';
                    if (key === 'type') uiState.currentMatchType = 'all';
                    if (key === 'opponent') uiState.currentMatchOpponent = 'all';
                    if (key === 'result') uiState.currentMatchResult = 'all';
                    uiState.currentMatchPage = 1;
                    initMatches();
                };
            });
        } else {
            activeTagsContainer.innerHTML = '';
            activeTagsContainer.classList.add('hidden');
        }
    }

    const btnToggle = document.getElementById('btn-toggle-filter-matches');
    const badgeEl = document.getElementById('badge-filter-matches');
    if (btnToggle) {
        btnToggle.classList.toggle('active-filter', activeFilterCount > 0);
        btnToggle.onclick = () => {
            const accordion = document.getElementById('filter-accordion-matches');
            if (accordion) accordion.classList.toggle('hidden');
        };
    }
    if (badgeEl) {
        badgeEl.textContent = activeFilterCount;
        badgeEl.classList.toggle('hidden', activeFilterCount === 0);
    }

    const btnReset = document.getElementById('btn-reset-filter-matches');
    if (btnReset) {
        btnReset.onclick = () => {
            uiState.currentMatchNendo = 'all';
            uiState.currentMatchType = 'all';
            uiState.currentMatchOpponent = 'all';
            uiState.currentMatchResult = 'all';
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const btnSort = document.getElementById('btn-sort-match');
    if (btnSort) {
        const isDesc = matchSortOrder === 'desc';
        btnSort.innerHTML = `<i class="fa-solid ${isDesc ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>`;
        btnSort.title = isDesc ? '新しい順 (クリックで古い順へ)' : '古い順 (クリックで新しい順へ)';
        btnSort.onclick = () => {
            uiState.matchSortOrder = matchSortOrder === 'desc' ? 'asc' : 'desc';
            uiState.currentMatchPage = 1;
            initMatches();
        };
    }

    const getMatchStatus = (m) => {
        if (!m || !m.result) return 'upcoming';

        if (m.pkUs !== undefined && m.pkUs !== null && m.pkThem !== undefined && m.pkThem !== null) {
            if (m.pkUs > m.pkThem) return 'win';
            if (m.pkUs < m.pkThem) return 'loss';
        }

        const pkMatch = m.result.match(/\(PK\s*(\d+)\s*-\s*(\d+)\)/i);
        if (pkMatch) {
            const pUs = parseInt(pkMatch[1], 10);
            const pThem = parseInt(pkMatch[2], 10);
            if (pUs > pThem) return 'win';
            if (pUs < pThem) return 'loss';
        }

        const matchScore = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (!matchScore) return 'upcoming';
        const us = parseInt(matchScore[1], 10);
        const them = parseInt(matchScore[2], 10);
        if (us > them) return 'win';
        if (us < them) return 'loss';
        return 'draw';
    };

    const filteredMatches = state.matches.filter(m => {
        const matchNendo = currentMatchNendo === 'all' || String(getNendo(m.date)) === currentMatchNendo;
        const matchOpponent = currentMatchOpponent === 'all' || m.opponent === currentMatchOpponent;
        const matchType = currentMatchType === 'all' || m.type === currentMatchType;

        let matchResult = true;
        if (currentMatchResult !== 'all') {
            matchResult = getMatchStatus(m) === currentMatchResult;
        }

        let matchKeyword = true;
        if (currentMatchSearch) {
            const attendeeNames = (m.presentPlayerIds || []).map(id => {
                const p = state.players.find(pl => pl.id === id);
                return p ? p.name : '';
            }).join(' ');

            const targetText = [
                m.opponent,
                m.tournament,
                m.type,
                m.theme,
                m.summary,
                m.date,
                m.result,
                attendeeNames
            ].filter(Boolean).join(' ').toLowerCase();

            matchKeyword = targetText.includes(currentMatchSearch);
        }

        return matchNendo && matchOpponent && matchType && matchResult && matchKeyword;
    }).sort((a, b) => {
        return matchSortOrder === 'asc'
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date);
    });

    const displayedMatches = filteredMatches.slice(0, currentMatchPage * ITEMS_PER_PAGE);

    const matchList = document.getElementById('match-list');
    if (matchList) {
        let h2hHtml = '';
        if (currentMatchOpponent !== 'all') {
            const allMatchesAgainstOpp = state.matches.filter(m => m.opponent === currentMatchOpponent);
            let wins = 0, losses = 0, draws = 0, gf = 0, ga = 0;

            allMatchesAgainstOpp.forEach(m => {
                const matchScore = m.result ? m.result.match(/(\d+)\s*-\s*(\d+)/) : null;
                if (matchScore) {
                    const us = parseInt(matchScore[1], 10);
                    const them = parseInt(matchScore[2], 10);
                    gf += us;
                    ga += them;
                    if (us > them) wins++;
                    else if (us < them) losses++;
                    else draws++;
                }
            });

            const diff = gf - ga;
            const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

            h2hHtml = `
                <div class="u-ext-123 card opponent-h2h-card" >
                    <div class="u-ext-124" >
                        <div class="u-ext-125" >
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <div class="u-ext-126" >対戦相手 通算成績</div>
                            <div class="u-ext-127" >vs ${escapeHtml(currentMatchOpponent)}</div>
                        </div>
                    </div>
                    <div class="u-ext-128" >
                        <div class="u-ext-129" >
                            <div class="u-ext-30" >通算対戦</div>
                            <div class="u-ext-130" >${allMatchesAgainstOpp.length}試合</div>
                        </div>
                        <div class="u-ext-129" >
                            <div class="u-ext-30" >勝敗内訳</div>
                            <div class="u-ext-130" >
                                <span class="u-ext-131" >${wins}勝</span>
                                <span class="u-ext-16" >${losses}敗</span>
                                <span class="u-ext-132" >${draws}分</span>
                            </div>
                        </div>
                        <div class="u-ext-129" >
                            <div class="u-ext-30" >総得失点</div>
                            <div class="u-ext-130" >
                                <span class="u-ext-77" >${gf}</span> / <span class="u-ext-133" >${ga}</span>
                                <span class="u-ext-134" >(${diffStr})</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        const grouped = {};
        displayedMatches.forEach(m => {
            const ym = m.date.substring(0, 7).replace('-', '年') + '月';
            if (!grouped[ym]) grouped[ym] = [];
            grouped[ym].push(m);
        });

        const sortedMonths = matchSortOrder === 'asc'
            ? Object.keys(grouped).sort()
            : Object.keys(grouped).sort().reverse();
        let html = '';
        sortedMonths.forEach(month => {
            html += `
                <div class="month-section">
                    <h3>${month}</h3>
                    <div class="library-grid">
            `;
            grouped[month].forEach(m => {
                const isCompleted = !!(m.result && m.result.trim());
                const resultText = isCompleted ? escapeHtml(m.result) : '<span class="u-ext-135" >試合予定</span>';

                const attendeesHtml = m.presentPlayerIds && m.presentPlayerIds.length > 0
                    ? state.players.filter(pl => m.presentPlayerIds.includes(pl.id)).map(pl => `
                        <span class="u-ext-54" >
                            ${pl.number ? `<span class="u-ext-55" >${pl.number}</span>` : ''}
                            <span class="u-ext-56" >${escapeHtml(pl.name)}</span>
                        </span>
                    `).join('')
                    : '<span class="u-ext-57" >メンバー登録がありません</span>';

                const actionBtns = `
                    <button class="btn btn-secondary btn-share-match" data-id="${m.id}" title="LINE共有用テキストをコピー"><i class="fa-solid fa-share-nodes" style="color:var(--primary);"></i> 共有</button>
                    <button class="btn btn-secondary btn-detail-match" data-id="${m.id}"><i class="fa-solid fa-circle-info"></i> 詳細</button>
                    ${isCoach ? `<button class="btn btn-danger btn-delete-match" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
                `;

                html += `
                    <div class="card match-card">
                        <div class="match-card-header">
                            <div>
                                <div class="match-card-date"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}${m.tournament ? ` (${m.tournament})` : ''}</div>
                                <div class="match-card-opponent">vs ${escapeHtml(m.opponent)}</div>
                                <div class="u-ext-136 text-secondary" >
                                    <details class="u-ext-137 practice-attendance-details" >
                                        <summary class="u-ext-138" >
                                            <i class="u-ext-139 fa-solid fa-chevron-down" ></i>
                                            <span>参加者 (${m.presentPlayerIds ? `${m.presentPlayerIds.length}/${state.players.length}` : `0/${state.players.length}`})</span>
                                        </summary>
                                        <div class="u-ext-140" >
                                            ${attendeesHtml}
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </div>
                        <div class="match-card-bottom-row">
                            <div class="match-card-result">${resultText}</div>
                            <div class="match-card-actions">
                                ${actionBtns}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        });

        if (filteredMatches.length > displayedMatches.length) {
            const remaining = filteredMatches.length - displayedMatches.length;
            html += `
                <div class="u-ext-142" >
                    <button class="u-ext-143 btn btn-secondary" id="btn-load-more-matches" >
                        <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredMatches.length} 件)
                    </button>
                </div>
            `;
        }

        const emptyHtml = `
            <div class="u-ext-144 card" >
                <div class="u-ext-145" ><i class="fa-solid fa-trophy"></i></div>
                <h3 class="u-ext-146" >該当する試合記録がありません</h3>
                <button class="btn btn-primary" id="btn-empty-add-match" style="margin-top:0.5rem; display:${isCoach ? 'inline-block' : 'none'};"><i class="fa-solid fa-plus"></i> 最初の試合を追加</button>
            </div>
        `;

        matchList.innerHTML = h2hHtml + (html || emptyHtml);

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
        btn.onclick = async (e) => {
            // ★ await の前に ID を取得しておく
            const id = parseInt(e.currentTarget.dataset.id, 10);
            const proceed = await showCustomConfirm('この試合記録を削除しますか？', '試合記録の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.matches = state.matches.filter(m => m.id !== id);
                saveData();
                showToast('削除しました');
                initMatches();
            }
        };
    });

    document.querySelectorAll('.btn-share-match').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id, 10);
            copyMatchShareText(id);
        };
    });
}

/**
 * マイ選手（我が子）の出場要約カード生成（ダッシュボード最新フィードバック同等デザイン）
 */
function renderMyPlayerSummaryCard(match) {
    // ★【修正】コーチモードの場合はマイ選手要約カードを表示しない
    if (state.currentUserRole === 'coach') return '';

    // localStorage または state から マイ選手ID を取得
    const myPlayerId = localStorage.getItem('coachMgrMyPlayerId') || state.settings?.myPlayerId;
    if (!myPlayerId) return '';

    const myPlayer = state.players?.find(p => String(p.id) === String(myPlayerId));
    if (!myPlayer) return '';

    const appearances = [];
    if (match.formations && Array.isArray(match.formations)) {
        match.formations.forEach((period, index) => {
            const periodName = period.name || `${index + 1}本目`;
            let posName = '';

            // 1. lineup 配列からの検索
            if (period.lineup && Array.isArray(period.lineup)) {
                const found = period.lineup.find(l => String(l.playerId) === String(myPlayerId));
                if (found) {
                    posName = found.roleLabel || found.role || '出場';
                }
            }

            // 2. positions オブジェクト/配列からの検索（未検出の場合）
            if (!posName && period.positions) {
                if (Array.isArray(period.positions)) {
                    const found = period.positions.find(p => String(p.playerId) === String(myPlayerId));
                    if (found) posName = found.position || '出場';
                } else {
                    for (const [posKey, pid] of Object.entries(period.positions)) {
                        if (String(pid) === String(myPlayerId)) {
                            const parts = posKey.split('_');
                            posName = parts.length >= 3 ? parts[2] : '出場';
                            break;
                        }
                    }
                }
            }

            if (posName) {
                appearances.push(`${escapeHtml(periodName)}（${escapeHtml(posName)}）`);
            }
        });
    }

    const summaryText = appearances.length > 0
        ? `本試合は <strong>${appearances.join('・')}</strong> に出場しました！`
        : `本試合の出場記録（配置設定）はありません。`;

    return `
        <div class="my-player-summary-card" style="margin-top:0.2rem; margin-bottom:0.8rem; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08)); border-left:4px solid var(--primary); border-radius:8px; padding:0.8rem 1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.78rem; font-weight:700; color:var(--primary); display:flex; align-items:center; gap:0.35rem;">
                    <i class="fa-solid fa-star"></i> ${escapeHtml(myPlayer.name)} 選手の出場記録
                </span>
                <span style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">マイ選手</span>
            </div>
            <p style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin:0; line-height:1.4;">
                ${summaryText}
            </p>
        </div>
    `;
}

// 試合情報を共有用テキストに整形してクリップボードにコピーする関数
export function copyMatchShareText(matchId) {
    const match = state.matches.find(m => Number(m.id) === Number(matchId));
    if (!match) {
        showToast('試合データが見つかりません');
        return;
    }

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    let dateStr = match.date || '';
    if (dateStr) {
        const d = new Date(dateStr.replace(/-/g, '/'));
        dateStr = `${match.date.replace(/-/g, '/')} (${dayNames[d.getDay()]})`;
    }

    const lines = [];

    // 1. ヘッダー情報
    if (match.result) {
        lines.push(`⚽ 【試合結果報告】`);
    } else {
        lines.push(`📢 【試合案内】`);
    }
    lines.push(`------------------------`);
    lines.push(`📅 日付: ${dateStr}`);
    if (match.tournament || match.type) {
        lines.push(`🏆 大会/種別: ${match.tournament ? `${match.tournament} ` : ''}${match.type ? `(${match.type})` : ''}`);
    }
    lines.push(`🆚 対戦: vs ${match.opponent || '未定'}`);

    if (match.result) {
        lines.push(`📊 結果: ${match.result}`);
    }

    // 2. ピリオド一覧（ピリオドごとの得点者 ＆ YouTube動画URL）
    if (match.formations && match.formations.length > 0) {
        lines.push(``);
        lines.push(`🎬 ピリオド詳細・動画:`);

        match.formations.forEach(f => {
            const pName = f.name || 'ピリオド';
            const scoreStr = (f.scoreUs !== undefined && f.scoreThem !== undefined)
                ? ` (${f.scoreUs} - ${f.scoreThem})`
                : '';

            lines.push(``);
            lines.push(`▪️ ${pName}${scoreStr}`);

            // ★ ピリオドごとの得点者集計
            if (f.goalRecords && f.goalRecords.length > 0) {
                const scorerCounts = {};
                f.goalRecords.forEach(r => {
                    if (r.scorerId) {
                        const player = state.players.find(p => p.id === r.scorerId);
                        const pName = player ? player.name : '不明';
                        scorerCounts[pName] = (scorerCounts[pName] || 0) + 1;
                    } else {
                        scorerCounts['OG/その他'] = (scorerCounts['OG/その他'] || 0) + 1;
                    }
                });

                const scorerTexts = Object.entries(scorerCounts).map(([name, count]) =>
                    count > 1 ? `${name}(${count})` : name
                );

                if (scorerTexts.length > 0) {
                    lines.push(`   ⚽ 得点: ${scorerTexts.join(', ')}`);
                }
            }

            // ピリオドごとの動画URL
            const videoUrl = (f.videoUrls && f.videoUrls[0]) || f.videoUrl || '';
            if (videoUrl) {
                lines.push(videoUrl.trim());
            }
        });
    } else if (match.videoUrl) {
        lines.push(``);
        lines.push(`🎬 試合動画:`);
        lines.push(match.videoUrl.trim());

        // ピリオドなし・全体得点記録がある場合のフォールバック
        if (match.goalRecords && match.goalRecords.length > 0) {
            const scorerCounts = {};
            match.goalRecords.forEach(r => {
                if (r.scorerId) {
                    const player = state.players.find(p => p.id === r.scorerId);
                    const pName = player ? player.name : '不明';
                    scorerCounts[pName] = (scorerCounts[pName] || 0) + 1;
                }
            });

            const scorerTexts = Object.entries(scorerCounts).map(([name, count]) =>
                count > 1 ? `${name}(${count})` : name
            );

            if (scorerTexts.length > 0) {
                lines.push(``);
                lines.push(`⚽ 得点: ${scorerTexts.join(', ')}`);
            }
        }
    }

    // 3. 試合テーマ・総括
    if (match.theme) {
        lines.push(``);
        lines.push(`🎯 試合テーマ: ${match.theme}`);
    }
    if (match.comments) {
        lines.push(``);
        lines.push(`💬 コーチ総括:`);
        lines.push(match.comments.trim());
    }

    const shareText = lines.join('\n');

    // クリップボードへコピー
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(() => {
            showToast('共有用テキストをコピーしました！');
        }).catch(err => {
            console.error('Copy failed:', err);
            fallbackCopyText(shareText);
        });
    } else {
        fallbackCopyText(shareText);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('共有用テキストをコピーしました！');
    } catch (err) {
        alert('テキストのコピーに失敗しました。');
    }
    document.body.removeChild(textArea);
}

window.copyMatchShareText = copyMatchShareText;