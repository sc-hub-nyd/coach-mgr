import { state } from './state.js';
import { showToast, showCustomConfirm, escapeHtml } from './utils.js';
import { getFormationPlayerList } from './formation-defs.js';
import { registerListener, cleanupScope } from './event-manager.js';
import { tacticsStore } from './store.js';
import { commandStack, SetObjectsCommand } from './command-stack.js';

let canvas, ctx;
let bgCanvas, bgCtx;
let uiCanvas, uiCtx;
let currentBgTemplate = null;
let objects = [];
let currentTool = 'select';
let isDrawing = false;
let draggedObject = null;
let startX, startY;
let objectIdCounter = 1;
let selectedObject = null;
let historyStack = [];
let redoStack = [];
let isResizing = false;
let resizeHandle = null;

let frames = [];
let isPlaying = false;
let animReqId = null;
let currentFrameIndex = -1;

let currentPracticeId = null;
let currentMenuId = null;
let currentMatchId = null;
let currentFormationId = null;
let currentLibraryId = null;

let isDirty = false;

// We now rely on event-manager.js for listener storage and cleanup
let boundListeners = {}; // Keeping an empty object for backwards compatibility if needed internally, but no longer used for management.

export function cleanupCanvasEvents() {
    cleanupScope('drawing.canvas');
}

function syncCurrentFrameObjects() {
    if (!frames || frames.length === 0) {
        frames = [{ objects: JSON.parse(JSON.stringify(objects)), title: '', caption: '', pauseDuration: 0 }];
        currentFrameIndex = 0;
        return;
    }
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        currentFrameIndex = Math.max(0, frames.length - 1);
    }
    const curFrame = frames[currentFrameIndex];
    if (Array.isArray(curFrame)) {
        frames[currentFrameIndex] = {
            objects: JSON.parse(JSON.stringify(objects)),
            title: '',
            caption: '',
            pauseDuration: 0
        };
    } else if (typeof curFrame === 'object' && curFrame !== null) {
        curFrame.objects = JSON.parse(JSON.stringify(objects));
    }
}

function saveHistory() {
    if (isPlaying) return;
    isDirty = true;
    tacticsStore.setObjects(objects, false);
    const prevObjects = commandStack.undoStack.length > 0
        ? commandStack.undoStack[commandStack.undoStack.length - 1].newObjects
        : [];
    commandStack.execute(new SetObjectsCommand(tacticsStore, objects, prevObjects));
    updateUndoRedoButtons();
    syncCurrentFrameObjects();
}

function undoHistory() {
    if (isPlaying) return;
    if (commandStack.undo()) {
        objects = JSON.parse(JSON.stringify(tacticsStore.objects));
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
    syncCurrentFrameObjects();
}

function redoHistory() {
    if (isPlaying) return;
    if (commandStack.redo()) {
        objects = JSON.parse(JSON.stringify(tacticsStore.objects));
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
    syncCurrentFrameObjects();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('tool-undo');
    const btnRedo = document.getElementById('tool-redo');
    if (btnUndo) {
        btnUndo.disabled = !commandStack.canUndo();
        btnUndo.style.opacity = commandStack.canUndo() ? '1' : '0.5';
    }
    if (btnRedo) {
        btnRedo.disabled = !commandStack.canRedo();
        btnRedo.style.opacity = commandStack.canRedo() ? '1' : '0.5';
    }
}

function updateToolDockActive() {
    const dockBtns = document.querySelectorAll('.anim-tool-dock .tool-btn, .canvas-toolbar .tool-btn');
    dockBtns.forEach(btn => {
        if (btn.dataset.tool === currentTool) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateCanvasToolbar() {
    updateContextPopover();
    updateToolDockActive();
}

// --- シーン管理 ---
function updateFrameCount() {
    const el = document.getElementById('frame-count');
    if (el) el.textContent = frames.length;

    const selectEl = document.getElementById('anim-frame-select');
    const btnPrev = document.getElementById('anim-prev-frame');
    const btnNext = document.getElementById('anim-next-frame');
    const btnDelete = document.getElementById('anim-delete-frame');

    if (!selectEl) return;

    if (frames.length === 0) {
        selectEl.innerHTML = '<option value="-1">1: </option>';
        selectEl.disabled = true;
        if (btnPrev) { btnPrev.disabled = true; btnPrev.style.opacity = '0.5'; }
        if (btnNext) { btnNext.disabled = true; btnNext.style.opacity = '0.5'; }
        if (btnDelete) { btnDelete.disabled = true; btnDelete.style.opacity = '0.5'; }
        return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = frames.map((f, idx) => {
        const titlePart = (f && typeof f === 'object' && f.title) ? f.title : '';
        return `<option value="${idx}" ${idx === currentFrameIndex ? 'selected' : ''}>${idx + 1}: ${titlePart}</option>`;
    }).join('');

    // Item 08: Render Filmstrip Timeline Cards with Drag & Drop (DND) and Inline Badges
    const filmstripContainer = document.getElementById('filmstrip-cards-container');
    if (filmstripContainer) {
        filmstripContainer.innerHTML = frames.map((f, idx) => {
            const isObj = (typeof f === 'object' && f !== null && !Array.isArray(f));
            const titleStr = isObj && f.title ? f.title : `シーン${idx + 1}`;
            const pauseVal = isObj && typeof f.pauseDuration !== 'undefined' ? f.pauseDuration : 0;
            const captionStr = isObj && f.caption ? f.caption : '';

            return `
                <div class="filmstrip-card ${idx === currentFrameIndex ? 'active' : ''}" data-frame-index="${idx}" draggable="true">
                    <div class="filmstrip-card-header">
                        <span class="filmstrip-frame-num">S${idx + 1}</span>
                        <div style="display:flex; gap:3px;">
                            ${pauseVal > 0 ? `<span class="filmstrip-badge pause-badge" title="停止時間 ${pauseVal}秒"><i class="fa-solid fa-clock"></i> ${pauseVal}s</span>` : ''}
                            ${captionStr ? `<span class="filmstrip-badge caption-badge" title="${escapeHtml(captionStr)}"><i class="fa-solid fa-comment-dots"></i></span>` : ''}
                        </div>
                    </div>
                    <div class="filmstrip-card-title">${escapeHtml(titleStr)}</div>
                    <div class="filmstrip-card-actions">
                        <button type="button" class="btn-card-delete" data-idx="${idx}" title="削除"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        const cards = filmstripContainer.querySelectorAll('.filmstrip-card');
        cards.forEach(card => {
            const delBtn = card.querySelector('.btn-card-delete');
            if (delBtn) {
                const handleDelete = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const idx = parseInt(delBtn.dataset.idx, 10);
                    if (!isNaN(idx) && idx >= 0) {
                        deleteFrame(idx);
                    }
                };
                delBtn.onclick = handleDelete;
            }

            card.onclick = () => {
                const idx = parseInt(card.dataset.frameIndex, 10);
                if (idx >= 0) selectFrame(idx);
            };

            card.ondblclick = () => {
                const idx = parseInt(card.dataset.frameIndex, 10);
                if (idx >= 0) openQuickDrawer(idx);
            };

            card.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.frameIndex);
                card.classList.add('dragging');
            };

            card.ondragover = (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            };

            card.ondragleave = () => {
                card.classList.remove('drag-over');
            };

            card.ondrop = (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIdx = parseInt(card.dataset.frameIndex, 10);
                if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                    const movedFrame = frames.splice(fromIdx, 1)[0];
                    frames.splice(toIdx, 0, movedFrame);
                    currentFrameIndex = toIdx;
                    saveHistory();
                    updateFrameCount();
                    drawPitch(objects);
                    showToast(`シーン ${fromIdx + 1} を シーン ${toIdx + 1} へ移動しました`);
                }
            };
        });
    }

    if (btnPrev) {
        btnPrev.disabled = currentFrameIndex <= 0;
        btnPrev.style.opacity = currentFrameIndex > 0 ? '1' : '0.5';
    }
    if (btnNext) {
        btnNext.disabled = currentFrameIndex < 0 || currentFrameIndex >= frames.length - 1;
        btnNext.style.opacity = (currentFrameIndex >= 0 && currentFrameIndex < frames.length - 1) ? '1' : '0.5';
    }
    if (btnDelete) {
        btnDelete.disabled = currentFrameIndex < 0 || currentFrameIndex >= frames.length;
        btnDelete.style.opacity = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? '1' : '0.5';
    }
}

function selectFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        currentFrameIndex = index;
        const frameData = frames[index];
        objects = JSON.parse(JSON.stringify(Array.isArray(frameData) ? frameData : (frameData.objects || [])));
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        openQuickDrawer(index);
        showToast(`シーン ${index + 1} を表示中`);
    }
}

function deleteFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        isDirty = true;
        frames.splice(index, 1);
        if (frames.length > 0) {
            currentFrameIndex = Math.min(index, frames.length - 1);
            const frameData = frames[currentFrameIndex];
            objects = JSON.parse(JSON.stringify(Array.isArray(frameData) ? frameData : (frameData.objects || [])));
        } else {
            currentFrameIndex = -1;
            objects = [];
        }
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        showToast(`シーン ${index + 1} を削除しました`);
    }
}

function addFrame() {
    isDirty = true;
    const insertIdx = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? currentFrameIndex + 1 : frames.length;
    frames.splice(insertIdx, 0, { objects: JSON.parse(JSON.stringify(objects)), title: '', caption: '', pauseDuration: 0 });
    currentFrameIndex = insertIdx;
    updateFrameCount();
    drawPitch(objects);
    openQuickDrawer(insertIdx);
    showToast(`シーン ${insertIdx + 1} を追加しました`);
}

export function openQuickDrawer(index) {
    if (index < 0 || index >= frames.length) return;
    const curFrame = frames[index];
    const drawer = document.getElementById('anim-quick-drawer');
    const sceneNum = document.getElementById('drawer-scene-num');
    const inputCaption = document.getElementById('drawer-caption-text');
    const selectPause = document.getElementById('drawer-pause-duration');

    if (!drawer) return;
    if (sceneNum) sceneNum.textContent = `シーン${index + 1}`;

    const captionVal = (typeof curFrame === 'object' && curFrame !== null && curFrame.caption) ? curFrame.caption : '';
    const pauseVal = (typeof curFrame === 'object' && curFrame !== null && typeof curFrame.pauseDuration !== 'undefined') ? curFrame.pauseDuration : 2;

    if (inputCaption) inputCaption.value = captionVal;
    if (selectPause) selectPause.value = pauseVal;

    drawer.classList.remove('hidden');
}

export function closeQuickDrawer() {
    const drawer = document.getElementById('anim-quick-drawer');
    if (drawer) drawer.classList.add('hidden');
}

function initQuickDrawerEvents() {
    const inputCaption = document.getElementById('drawer-caption-text');
    const selectPause = document.getElementById('drawer-pause-duration');
    
    function updatePauseDuration(text, curFrame) {
        if (!text || text.length === 0) return;
        let calcPause = Math.max(2, Math.ceil(text.length / 10));
        if (calcPause === 4) calcPause = 5; // Fallback for missing '4' option
        if (calcPause > 5) calcPause = 5;
        curFrame.pauseDuration = calcPause;
        if (selectPause) selectPause.value = calcPause;
    }

    if (inputCaption) {
        inputCaption.oninput = (e) => {
            if (currentFrameIndex >= 0 && currentFrameIndex < frames.length) {
                const curFrame = frames[currentFrameIndex];
                if (typeof curFrame === 'object' && curFrame !== null) {
                    curFrame.caption = e.target.value;
                    updatePauseDuration(e.target.value, curFrame);
                    isDirty = true;
                    updateFrameCount();
                }
            }
        };
    }
    if (selectPause) {
        selectPause.onchange = (e) => {
            if (currentFrameIndex >= 0 && currentFrameIndex < frames.length) {
                const curFrame = frames[currentFrameIndex];
                if (typeof curFrame === 'object' && curFrame !== null) {
                    curFrame.pauseDuration = parseFloat(e.target.value) || 0;
                    isDirty = true;
                    updateFrameCount();
                }
            }
        };
    }
    const btnClose = document.getElementById('btn-close-quick-drawer');
    if (btnClose) btnClose.onclick = closeQuickDrawer;

    const presetChips = document.querySelectorAll('.preset-chip');
    presetChips.forEach(chip => {
        chip.onclick = () => {
            if (currentFrameIndex >= 0 && currentFrameIndex < frames.length) {
                const curFrame = frames[currentFrameIndex];
                if (typeof curFrame === 'object' && curFrame !== null) {
                    const text = chip.textContent;
                    if (inputCaption) inputCaption.value = text;
                    curFrame.caption = text;
                    updatePauseDuration(text, curFrame);
                    isDirty = true;
                    updateFrameCount();
                }
            }
        };
    });

    if (!window._quickDrawerEventsInitialized) {
        document.addEventListener('pointerdown', (e) => {
            const drawer = document.getElementById('anim-quick-drawer');
            if (!drawer || drawer.classList.contains('hidden')) return;

            const isInsideDrawer = drawer.contains(e.target);
            const isFilmstripCard = e.target.closest('.filmstrip-card');
            const isAnimAddBtn = e.target.closest('#anim-add-frame');

            if (!isInsideDrawer && !isFilmstripCard && !isAnimAddBtn) {
                closeQuickDrawer();
            }
        });

        const drawer = document.getElementById('anim-quick-drawer');
        if (drawer) {
            let startY = 0;
            let currentY = 0;
            drawer.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                currentY = startY;
            }, {passive: true});
            drawer.addEventListener('touchmove', (e) => {
                currentY = e.touches[0].clientY;
            }, {passive: true});
            drawer.addEventListener('touchend', (e) => {
                if (currentY > startY + 40) { // 40px swipe down threshold
                    closeQuickDrawer();
                }
            }, {passive: true});
        }
        window._quickDrawerEventsInitialized = true;
    }
}

function editFrameTitle() {
    if (frames.length === 0) {
        frames = [{ objects: JSON.parse(JSON.stringify(objects)), title: '', caption: '', pauseDuration: 0 }];
        currentFrameIndex = 0;
    }
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        currentFrameIndex = Math.max(0, frames.length - 1);
    }
    let f = frames[currentFrameIndex];
    let currentTitle = (f && typeof f === 'object' && !Array.isArray(f) && f.title) ? f.title : '';
    let currentCaption = (f && typeof f === 'object' && !Array.isArray(f) && f.caption) ? f.caption : '';
    let currentPause = (f && typeof f === 'object' && !Array.isArray(f)) ? (Number(f.pauseDuration) || 0) : 0;

    const modal = document.getElementById('modal-scene-title');
    const input = document.getElementById('input-scene-title');
    const captionInput = document.getElementById('input-scene-caption');
    const pauseSelect = document.getElementById('input-scene-pause');
    const form = document.getElementById('form-scene-title');
    const heading = document.getElementById('scene-title-modal-heading');

    if (modal && input && form) {
        if (heading) heading.textContent = `シーン ${currentFrameIndex + 1} の見出し編集`;
        input.value = currentTitle;
        if (captionInput) captionInput.value = currentCaption;
        if (pauseSelect) pauseSelect.value = String(currentPause);
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        // 既存のsubmitイベントが重複しないよう、一度クリアして再登録
        form.onsubmit = (ev) => {
            ev.preventDefault();
            const trimmed = input.value.trim();
            const captionVal = captionInput ? captionInput.value.trim() : '';
            const pauseVal = pauseSelect ? (parseInt(pauseSelect.value, 10) || 0) : 0;
            if (Array.isArray(f)) {
                frames[currentFrameIndex] = { objects: f, title: trimmed, caption: captionVal, pauseDuration: pauseVal };
            } else if (typeof f === 'object' && f !== null) {
                f.title = trimmed;
                f.caption = captionVal;
                f.pauseDuration = pauseVal;
            } else {
                frames[currentFrameIndex] = { objects: [], title: trimmed, caption: captionVal, pauseDuration: pauseVal };
            }
            updateFrameCount();
            showToast(`シーン ${currentFrameIndex + 1} の見出しを「${trimmed || '(なし)'}」に更新しました`);
            modal.classList.add('hidden');
        };
    }
}

function stopAnimation() {
    isPlaying = false;
    if (animReqId) cancelAnimationFrame(animReqId);
    if (animPauseTimer) { clearTimeout(animPauseTimer); animPauseTimer = null; }
    if (frames.length > 0) {
        const lastFrame = frames[frames.length - 1];
        objects = JSON.parse(JSON.stringify(Array.isArray(lastFrame) ? lastFrame : (lastFrame.objects || [])));
    }
    if (canvas) {
        drawPitch(objects);
    }
    // Hide caption bar on stop
    const captionBar = document.getElementById('anim-caption-bar');
    if (captionBar) captionBar.classList.add('hidden');
}

let animPauseTimer = null;

function showCaptionBar(text) {
    const bar = document.getElementById('anim-caption-bar');
    const span = document.getElementById('anim-caption-text');
    if (!bar || !span) return;
    if (text && text.trim()) {
        span.textContent = text;
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }
}

function getFrameCaptionText(frame) {
    if (!frame) return '';
    if (typeof frame === 'object' && !Array.isArray(frame)) {
        return frame.caption || '';
    }
    return '';
}

function getFramePauseSec(frame) {
    if (!frame) return 0;
    if (typeof frame === 'object' && !Array.isArray(frame)) {
        if (typeof frame.pauseDuration === 'number') return frame.pauseDuration;
        if (typeof frame.pauseDuration === 'string') return parseFloat(frame.pauseDuration) || 0;
    }
    return 0;
}

function getFrameObjects(frame) {
    if (!frame) return [];
    if (Array.isArray(frame)) return frame;
    return frame.objects || [];
}

function playAnimation() {
    syncCurrentFrameObjects();
    if (frames.length < 2) {
        alert('アニメーションを作成するには、少なくとも2つのシーンを記録してください。');
        return;
    }
    isPlaying = true;
    let currentFrameIdx = 0;
    let startTime = null;
    let stateStage = 'START'; // 'PAUSING' | 'ANIMATING'
    const duration = 1500;

    function startFrame(idx) {
        if (!isPlaying) return;
        currentFrameIdx = idx;
        const rawFrame = frames[idx];
        showCaptionBar(getFrameCaptionText(rawFrame));
        drawPitch(getFrameObjects(rawFrame));

        const pauseSec = getFramePauseSec(rawFrame);
        if (pauseSec > 0) {
            stateStage = 'PAUSING';
            animPauseTimer = setTimeout(() => {
                animPauseTimer = null;
                if (!isPlaying) return;
                stateStage = 'ANIMATING';
                startTime = null;
                animReqId = requestAnimationFrame(animate);
            }, pauseSec * 1000);
        } else {
            stateStage = 'ANIMATING';
            startTime = null;
            animReqId = requestAnimationFrame(animate);
        }
    }

    function animate(timestamp) {
        if (!isPlaying || stateStage !== 'ANIMATING') return;
        if (!startTime) startTime = timestamp;

        let progress = (timestamp - startTime) / duration;

        if (progress >= 1.0) {
            const nextIdx = (currentFrameIdx + 1) % frames.length;
            startFrame(nextIdx);
            return;
        }

        const nextIdx = (currentFrameIdx + 1) % frames.length;
        const currentFrame = getFrameObjects(frames[currentFrameIdx]);
        const nextFrame = getFrameObjects(frames[nextIdx]);

        const interpolatedObjects = currentFrame.map(obj1 => {
            const obj2 = nextFrame.find(o => o.id === obj1.id);
            if (!obj2) return obj1;

            const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            if (typeof obj1.x !== 'undefined' && typeof obj1.y !== 'undefined') {
                const interpolatedObj = {
                    ...obj1,
                    x: obj1.x + (obj2.x - obj1.x) * p,
                    y: obj1.y + (obj2.y - obj1.y) * p
                };
                if (typeof obj1.angle !== 'undefined' || typeof obj2.angle !== 'undefined') {
                    let a1 = typeof obj1.angle !== 'undefined' ? obj1.angle : 0;
                    let a2 = typeof obj2.angle !== 'undefined' ? obj2.angle : 0;
                    let diff = a2 - a1;
                    while (diff > 180) diff -= 360;
                    while (diff < -180) diff += 360;
                    interpolatedObj.angle = a1 + diff * p;
                }
                if (typeof obj1.radius !== 'undefined' && typeof obj2.radius !== 'undefined') {
                    interpolatedObj.radius = obj1.radius + (obj2.radius - obj1.radius) * p;
                }
                if (typeof obj1.fov !== 'undefined' || typeof obj2.fov !== 'undefined') {
                    let f1 = typeof obj1.fov !== 'undefined' ? obj1.fov : 60;
                    let f2 = typeof obj2.fov !== 'undefined' ? obj2.fov : 60;
                    interpolatedObj.fov = f1 + (f2 - f1) * p;
                }
                return interpolatedObj;
            } else if (typeof obj1.x1 !== 'undefined') {
                const res = {
                    ...obj1,
                    x1: obj1.x1 + (obj2.x1 - obj1.x1) * p,
                    y1: obj1.y1 + (obj2.y1 - obj1.y1) * p,
                    x2: obj1.x2 + (obj2.x2 - obj1.x2) * p,
                    y2: obj1.y2 + (obj2.y2 - obj1.y2) * p
                };
                if (typeof obj1.cx !== 'undefined' && typeof obj2.cx !== 'undefined') {
                    res.cx = obj1.cx + (obj2.cx - obj1.cx) * p;
                    res.cy = obj1.cy + (obj2.cy - obj1.cy) * p;
                }
                return res;
            }
            return obj1;
        });

        drawPitch(interpolatedObjects);
        animReqId = requestAnimationFrame(animate);
    }

    startFrame(0);
}

export function exportAnimationVideo() {
    const pitchCanvas = document.getElementById('pitch-canvas');
    if (!pitchCanvas) {
        alert('キャンバスが見つかりません');
        return;
    }

    let menuTitle = '戦術作図';
    const focusEl = document.getElementById('side-info-focus');
    if (focusEl && focusEl.textContent && focusEl.textContent.trim() !== '未設定') {
        menuTitle = focusEl.textContent.trim();
    }
    const safeTitle = menuTitle.replace(/[/\\?%*:|"<>]/g, '_');

    const downloadFile = (dataUrl, fileName) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
        }, 400);
    };

    stopAnimation();

    showToast('📹 .webm 動画ファイルを作成中...（完了まで数秒お待ちください）');

    try {
        const stream = pitchCanvas.captureStream(30);
        let options = {};
        const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) {
                options = { mimeType: t };
                break;
            }
        }

        const recordedChunks = [];
        let mediaRecorder;
        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (recordedChunks.length === 0) {
                alert('動画の書き出しに失敗しました。もう一度お試しください。');
                return;
            }
            const mime = mediaRecorder.mimeType || 'video/webm';
            const blob = new Blob(recordedChunks, { type: mime });
            const ext = mime.includes('mp4') ? 'mp4' : 'webm';
            const url = URL.createObjectURL(blob);
            downloadFile(url, `【作図動画】${safeTitle}.${ext}`);
            showToast('✅ 動画のダウンロードが完了しました！LINE等で送信できます。');
            drawPitch(objects);
        };

        mediaRecorder.start(100);

        const hasMultiFrames = frames && frames.length > 1;
        const durationPerFrame = 1400;
        let startTime = null;
        let isRecording = true;
        let recFrameIdx = 0;
        let recPauseUntil = 0; // timestamp until which we are paused
        let recFrameStartTime = null;

        // Pre-calculate total pause durations for accurate recording
        function getFramePause(idx) {
            return getFramePauseSec(frames[idx]);
        }
        function getFrameCaption(idx) {
            return getFrameCaptionText(frames[idx]);
        }

        // Draw caption text overlay directly on canvas for video export
        function drawCaptionOnCanvas(captionText) {
            if (!captionText || !captionText.trim()) return;
            const pitchCanvasEl = document.getElementById('pitch-canvas');
            if (!pitchCanvasEl) return;
            const exportCtx = pitchCanvasEl.getContext('2d');
            const w = pitchCanvasEl.width;
            const h = pitchCanvasEl.height;
            const fontSize = Math.round(h * 0.045);
            const padding = Math.round(h * 0.02);
            const maxTextWidth = Math.min(w * 0.85, w) - padding * 2;
            
            exportCtx.save();
            exportCtx.font = `bold ${fontSize}px 'Inter', sans-serif`;
            
            const words = captionText.split(''); 
            let lines = [];
            let currentLine = '';
            
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i];
                const metrics = exportCtx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxTextWidth && i > 0) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);

            const lineHeight = fontSize * 1.5;
            const barHeight = (lines.length * lineHeight) + padding * 2;
            const barY = h - barHeight - Math.round(h * 0.12);
            const barWidth = Math.min(w * 0.85, w);
            const barX = (w - barWidth) / 2;
            const radius = Math.round(h * 0.015);

            exportCtx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            exportCtx.beginPath();
            exportCtx.roundRect(barX, barY, barWidth, barHeight, radius);
            exportCtx.fill();

            exportCtx.fillStyle = '#ffffff';
            exportCtx.textAlign = 'center';
            exportCtx.textBaseline = 'middle';
            
            let textY = barY + padding + (lineHeight / 2);
            for (let i = 0; i < lines.length; i++) {
                exportCtx.fillText(lines[i], w / 2, textY);
                textY += lineHeight;
            }
            exportCtx.restore();
        }

        function recordLoop(timestamp) {
            if (!isRecording) return;
            if (!startTime) { 
                startTime = timestamp; 
                recFrameStartTime = timestamp; 
                const initPause = getFramePause(0);
                if (initPause > 0) {
                    recPauseUntil = timestamp + initPause * 1000;
                    const rawF = frames[0];
                    const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                    drawPitch(pauseObjs);
                    drawCaptionOnCanvas(getFrameCaption(0));
                    requestAnimationFrame(recordLoop);
                    return;
                }
            }

            // Handle pause at frame
            if (recPauseUntil > 0 && timestamp < recPauseUntil) {
                // Still paused: just keep drawing the current frame with caption
                const rawF = frames[recFrameIdx];
                const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                drawPitch(pauseObjs);
                drawCaptionOnCanvas(getFrameCaption(recFrameIdx));
                requestAnimationFrame(recordLoop);
                return;
            }
            if (recPauseUntil > 0) {
                // Pause just ended, advance to interpolation
                recPauseUntil = 0;
                recFrameStartTime = timestamp;
            }

            if (hasMultiFrames) {
                const frameElapsed = timestamp - recFrameStartTime;
                let progress = frameElapsed / durationPerFrame;

                if (progress >= 1) {
                    recFrameIdx++;
                    if (recFrameIdx >= frames.length - 1) {
                        // Draw last frame with caption before stopping
                        const lastRaw = frames[frames.length - 1];
                        const lastObjs = Array.isArray(lastRaw) ? lastRaw : ((lastRaw && lastRaw.objects) || []);
                        drawPitch(lastObjs);
                        drawCaptionOnCanvas(getFrameCaption(frames.length - 1));

                        isRecording = false;
                        try {
                            if (mediaRecorder.state !== 'inactive') {
                                mediaRecorder.requestData();
                                setTimeout(() => mediaRecorder.stop(), 150);
                            }
                        } catch (err) { mediaRecorder.stop(); }
                        return;
                    }

                    // Check for pause at this frame
                    const pauseSec = getFramePause(recFrameIdx);
                    if (pauseSec > 0) {
                        recPauseUntil = timestamp + pauseSec * 1000;
                        const rawF = frames[recFrameIdx];
                        const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                        drawPitch(pauseObjs);
                        drawCaptionOnCanvas(getFrameCaption(recFrameIdx));
                        requestAnimationFrame(recordLoop);
                        return;
                    }

                    recFrameStartTime = timestamp;
                    progress = 0;
                }

                const rawCurrent = frames[recFrameIdx];
                const rawNext = frames[recFrameIdx + 1];
                const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
                const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);
                const interpolatedObjects = currentFrame.map(obj1 => {
                    const obj2 = nextFrame.find(o => o.id === obj1.id);
                    if (!obj2) return obj1;

                    const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

                    if (typeof obj1.x !== 'undefined' && typeof obj1.y !== 'undefined') {
                        const interpolatedObj = {
                            ...obj1,
                            x: obj1.x + (obj2.x - obj1.x) * p,
                            y: obj1.y + (obj2.y - obj1.y) * p
                        };
                        if (typeof obj1.angle !== 'undefined' && typeof obj2.angle !== 'undefined') {
                            let a1 = obj1.angle;
                            let a2 = obj2.angle;
                            let diff = a2 - a1;
                            while (diff > 180) diff -= 360;
                            while (diff < -180) diff += 360;
                            interpolatedObj.angle = a1 + diff * p;
                        }
                        return interpolatedObj;
                    } else if (typeof obj1.x1 !== 'undefined') {
                        const res = {
                            ...obj1,
                            x1: obj1.x1 + (obj2.x1 - obj1.x1) * p,
                            y1: obj1.y1 + (obj2.y1 - obj1.y1) * p,
                            x2: obj1.x2 + (obj2.x2 - obj1.x2) * p,
                            y2: obj1.y2 + (obj2.y2 - obj1.y2) * p
                        };
                        if (typeof obj1.cx !== 'undefined' && typeof obj2.cx !== 'undefined') {
                            res.cx = obj1.cx + (obj2.cx - obj1.cx) * p;
                            res.cy = obj1.cy + (obj2.cy - obj1.cy) * p;
                        }
                        return res;
                    }
                    return obj1;
                });

                drawPitch(interpolatedObjects);
                // Draw caption overlay for current frame during interpolation
                drawCaptionOnCanvas(getFrameCaption(recFrameIdx));
            } else {
                drawPitch(objects);
                const elapsed = timestamp - startTime;
                if (elapsed >= 2000) {
                    isRecording = false;
                    try {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.requestData();
                            setTimeout(() => mediaRecorder.stop(), 150);
                        }
                    } catch (err) { mediaRecorder.stop(); }
                    return;
                }
            }
            requestAnimationFrame(recordLoop);
        }
        requestAnimationFrame(recordLoop);

    } catch (err) {
        console.error('MediaRecorder error:', err);
        const dataUrl = pitchCanvas.toDataURL('image/png');
        downloadFile(dataUrl, `【作図画像】${safeTitle}.png`);
        showToast('📸 作図画像をダウンロードしました');
    }
}

export function drawPitchToCtx(renderObjectsInput, targetCanvas, targetCtx, template = 'full') {
    const renderObjects = Array.isArray(renderObjectsInput) ? renderObjectsInput : ((renderObjectsInput && renderObjectsInput.objects) || []);

    const w = targetCanvas.width;
    const h = targetCanvas.height;

    targetCtx.clearRect(0, 0, w, h);
    targetCtx.save();

    const scaleX = w / 800;
    const scaleY = h / 500;
    targetCtx.scale(scaleX, scaleY);

    const pitchX = 24;
    const pitchY = 16;
    const pitchW = 800 - 48;
    const pitchH = 500 - 32;

    if (template !== 'blank') {
        targetCtx.fillStyle = '#f1f5f9';
        targetCtx.fillRect(0, 0, 800, 500);

        targetCtx.strokeStyle = '#334155';
        targetCtx.lineWidth = 1.5;
        targetCtx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    } else {
        if (targetCanvas.id !== 'pitch-canvas') {
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, 800, 500);
        }
    }

    if (template === 'full' || template === 'grid') {
        const laneH = pitchH / 5;
        const penW = pitchW * 0.16;
        const penH = laneH * 3;
        const penY = pitchY + laneH;
        const goalAreaW = pitchW * 0.055;
        const goalAreaH = laneH;
        const goalAreaY = pitchY + laneH * 2;
        const goalH = goalAreaH * 0.4;
        const goalTopY = pitchY + pitchH / 2 - goalH / 2;
        const goalBotY = pitchY + pitchH / 2 + goalH / 2;
        const centerCircleR = pitchH * 0.135;
        const penSpotDist = pitchW * 0.105;

        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        targetCtx.beginPath();
        [pitchY + laneH, pitchY + laneH * 2, pitchY + laneH * 3, pitchY + laneH * 4].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });

        const leftMidHalf = pitchX + penW + (pitchW / 2 - penW) / 2;
        const rightMidHalf = pitchX + pitchW / 2 + (pitchW / 2 - penW) / 2;
        [pitchX + penW, leftMidHalf, rightMidHalf, pitchX + pitchW - penW].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });

        let m, targetX;
        m = (penY - goalTopY) / penW;
        targetX = pitchX + (pitchY - goalTopY) / m;
        targetCtx.moveTo(pitchX, goalTopY);
        targetCtx.lineTo(targetX, pitchY);
        m = ((penY + penH) - goalBotY) / penW;
        targetX = pitchX + ((pitchY + pitchH) - goalBotY) / m;
        targetCtx.moveTo(pitchX, goalBotY);
        targetCtx.lineTo(targetX, pitchY + pitchH);
        m = (penY - goalTopY) / (-penW);
        targetX = (pitchX + pitchW) + (pitchY - goalTopY) / m;
        targetCtx.moveTo(pitchX + pitchW, goalTopY);
        targetCtx.lineTo(targetX, pitchY);
        m = ((penY + penH) - goalBotY) / (-penW);
        targetX = (pitchX + pitchW) + ((pitchY + pitchH) - goalBotY) / m;
        targetCtx.moveTo(pitchX + pitchW, goalBotY);
        targetCtx.lineTo(targetX, pitchY + pitchH);

        targetCtx.stroke();
        targetCtx.setLineDash([]);

        if (template === 'grid') {
            targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            targetCtx.lineWidth = 1;
            targetCtx.setLineDash([2, 2]);
            targetCtx.beginPath();
            [pitchX + pitchW / 4, pitchX + pitchW * 3 / 4].forEach(x => {
                targetCtx.moveTo(x, pitchY);
                targetCtx.lineTo(x, pitchY + pitchH);
            });
            [pitchY + pitchH / 4, pitchY + pitchH * 3 / 4].forEach(y => {
                targetCtx.moveTo(pitchX, y);
                targetCtx.lineTo(pitchX + pitchW, y);
            });
            targetCtx.stroke();
            targetCtx.setLineDash([]);
        }

        targetCtx.strokeStyle = '#334155';
        targetCtx.lineWidth = 1.5;

        targetCtx.beginPath();
        targetCtx.moveTo(pitchX + pitchW / 2, pitchY);
        targetCtx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, centerCircleR, 0, Math.PI * 2);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        targetCtx.strokeRect(pitchX, penY, penW, penH);
        targetCtx.strokeRect(pitchX, goalAreaY, goalAreaW, goalAreaH);
        const arcAngle = Math.acos((penW - penSpotDist) / centerCircleR);
        targetCtx.beginPath();
        targetCtx.arc(pitchX + penSpotDist, pitchY + pitchH / 2, centerCircleR, -arcAngle, arcAngle);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(pitchX + penSpotDist, pitchY + pitchH / 2, 2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.strokeRect(pitchX - 10, goalTopY, 10, goalH);

        targetCtx.strokeRect(pitchX + pitchW - penW, penY, penW, penH);
        targetCtx.strokeRect(pitchX + pitchW - goalAreaW, goalAreaY, goalAreaW, goalAreaH);
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW - penSpotDist, pitchY + pitchH / 2, centerCircleR, Math.PI - arcAngle, Math.PI + arcAngle);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW - penSpotDist, pitchY + pitchH / 2, 2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.strokeRect(pitchX + pitchW, goalTopY, 10, goalH);

    } else if (template === 'half') {
        const penX_left = 171.8;
        const penX_right = 627.2;
        const penY_half = 167.2;

        const goalAreaX_left = 297.5;
        const goalAreaX_right = 502.5;
        const goalAreaY_half = 70.6;

        const goalLeftX_half = 369.6;
        const goalRightX_half = 430.4;
        const goalW_half = goalRightX_half - goalLeftX_half;

        const penSpotY_half = 116.6;
        const circleR_halfX = 102.5;
        const circleR_halfY = 75.1;

        targetCtx.beginPath();
        targetCtx.moveTo(pitchX, pitchY + pitchH);
        targetCtx.lineTo(pitchX + pitchW, pitchY + pitchH);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.ellipse(400, pitchY + pitchH, circleR_halfX, circleR_halfY, 0, Math.PI, 0);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(400, pitchY + pitchH, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        targetCtx.strokeRect(penX_left, pitchY, penX_right - penX_left, penY_half - pitchY);
        targetCtx.strokeRect(goalAreaX_left, pitchY, goalAreaX_right - goalAreaX_left, goalAreaY_half - pitchY);

        targetCtx.beginPath();
        targetCtx.arc(400, penSpotY_half, 2, 0, Math.PI * 2);
        targetCtx.fill();

        const arcAngle_half = Math.acos((penY_half - penSpotY_half) / circleR_halfY);
        targetCtx.beginPath();
        targetCtx.ellipse(400, penSpotY_half, circleR_halfX, circleR_halfY, 0, arcAngle_half, Math.PI - arcAngle_half);
        targetCtx.stroke();

        targetCtx.strokeRect(goalLeftX_half, pitchY - 10, goalW_half, 10);

        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        targetCtx.beginPath();
        const laneW_half = pitchW / 5;
        [pitchX + laneW_half, pitchX + laneW_half * 2, pitchX + laneW_half * 3, pitchX + laneW_half * 4].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });

        const midTransverseY = penY_half + (pitchH - (penY_half - pitchY)) / 2;
        [penY_half, midTransverseY].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.moveTo(goalLeftX_half, pitchY);
        targetCtx.lineTo(20, 280);

        targetCtx.moveTo(goalRightX_half, pitchY);
        targetCtx.lineTo(780, 280);

        targetCtx.stroke();
        targetCtx.setLineDash([]);

    } else if (template === 'half-bottom') {
        const penX_left = 171.8;
        const penX_right = 627.2;
        const penY_half = 332.8;

        const goalAreaX_left = 297.5;
        const goalAreaX_right = 502.5;
        const goalAreaY_half = 429.4;

        const goalLeftX_half = 369.6;
        const goalRightX_half = 430.4;
        const goalW_half = goalRightX_half - goalLeftX_half;

        const penSpotY_half = 383.4;
        const circleR_halfX = 102.5;
        const circleR_halfY = 75.1;

        targetCtx.beginPath();
        targetCtx.moveTo(pitchX, pitchY);
        targetCtx.lineTo(pitchX + pitchW, pitchY);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.ellipse(400, pitchY, circleR_halfX, circleR_halfY, 0, 0, Math.PI);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(400, pitchY, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        targetCtx.strokeRect(penX_left, penY_half, penX_right - penX_left, (pitchY + pitchH) - penY_half);
        targetCtx.strokeRect(goalAreaX_left, goalAreaY_half, goalAreaX_right - goalAreaX_left, (pitchY + pitchH) - goalAreaY_half);

        targetCtx.beginPath();
        targetCtx.arc(400, penSpotY_half, 2, 0, Math.PI * 2);
        targetCtx.fill();

        const arcAngle_half = Math.acos((penSpotY_half - penY_half) / circleR_halfY);
        targetCtx.beginPath();
        targetCtx.ellipse(400, penSpotY_half, circleR_halfX, circleR_halfY, 0, Math.PI + arcAngle_half, 2 * Math.PI - arcAngle_half);
        targetCtx.stroke();

        targetCtx.strokeRect(goalLeftX_half, pitchY + pitchH, goalW_half, 10);

        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        targetCtx.beginPath();
        const laneW_half = pitchW / 5;
        [pitchX + laneW_half, pitchX + laneW_half * 2, pitchX + laneW_half * 3, pitchX + laneW_half * 4].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });

        const midTransverseY = 20 + 176.4;
        [penY_half, midTransverseY].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.moveTo(goalLeftX_half, pitchY + pitchH);
        targetCtx.lineTo(20, 220);

        targetCtx.moveTo(goalRightX_half, pitchY + pitchH);
        targetCtx.lineTo(780, 220);

        targetCtx.stroke();
        targetCtx.setLineDash([]);
    }

    renderObjects.forEach(obj => {
        if (obj.type === 'line') {
            drawArrowToCtx(obj.x1, obj.y1, obj.x2, obj.y2, obj.lineType || 'pass', targetCtx, obj.cx, obj.cy);
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
                
                const cx = typeof obj.cx !== 'undefined' ? obj.cx : (obj.x1 + obj.x2) / 2;
                const cy = typeof obj.cy !== 'undefined' ? obj.cy : (obj.y1 + obj.y2) / 2;
                targetCtx.beginPath(); targetCtx.arc(cx, cy, 6, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.strokeStyle = '#ffffff';
                targetCtx.lineWidth = 1.5;
                targetCtx.stroke();
            }
        } else if (obj.type === 'ladder') {
            drawLadderToCtx(obj.x1, obj.y1, obj.x2, obj.y2, targetCtx);
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
            }
        } else if (obj.type === 'rect') {
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
            targetCtx.lineWidth = 1.5;
            targetCtx.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                const s = 8;
                targetCtx.fillRect(obj.x1 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x1 - s / 2, obj.y2 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y2 - s / 2, s, s);
            }
        } else if (obj.type === 'circle') {
            const rx = Math.abs(obj.x2 - obj.x1) / 2;
            const ry = Math.abs(obj.y2 - obj.y1) / 2;
            const cx = Math.min(obj.x1, obj.x2) + rx;
            const cy = Math.min(obj.y1, obj.y2) + ry;

            targetCtx.beginPath();
            targetCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(148, 163, 184, 0.25)';
            targetCtx.fill();
            targetCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                const s = 8;
                targetCtx.fillRect(obj.x1 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x1 - s / 2, obj.y2 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y2 - s / 2, s, s);
            }
        } else if (obj.type === 'vision') {
            // 視野・扇形オブジェクト描画
            const r = obj.radius || 60;
            const angle = obj.angle || 0;
            const fov = obj.fov || 60; // field of view angle in degrees (default 60°)
            const halfFov = (fov / 2) * (Math.PI / 180);

            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            targetCtx.rotate((angle * Math.PI) / 180);

            // 扇形の塗りつぶし（半透明）
            targetCtx.beginPath();
            targetCtx.moveTo(0, 0);
            targetCtx.arc(0, 0, r, -Math.PI / 2 - halfFov, -Math.PI / 2 + halfFov);
            targetCtx.closePath();
            const visionColor = obj.color || '#38bdf8';
            targetCtx.fillStyle = visionColor + '40'; // 25% opacity
            targetCtx.fill();

            // 扇形の輪郭（破線）
            targetCtx.beginPath();
            targetCtx.moveTo(0, 0);
            targetCtx.arc(0, 0, r, -Math.PI / 2 - halfFov, -Math.PI / 2 + halfFov);
            targetCtx.closePath();
            targetCtx.strokeStyle = visionColor;
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 3]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);

            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                const selAngleRad = (angle * Math.PI) / 180;
                const halfFovRad = halfFov;

                // 半径ハンドル（扇形の先端中央）
                const rHx = obj.x + r * Math.sin(selAngleRad);
                const rHy = obj.y - r * Math.cos(selAngleRad);

                // FOVハンドル左右（扇形の左右端の弧上）
                const fovLx = obj.x + r * Math.sin(selAngleRad - halfFovRad) * 0.7;
                const fovLy = obj.y - r * Math.cos(selAngleRad - halfFovRad) * 0.7;
                const fovRx = obj.x + r * Math.sin(selAngleRad + halfFovRad) * 0.7;
                const fovRy = obj.y - r * Math.cos(selAngleRad + halfFovRad) * 0.7;

                const drawHandle = (hx, hy, fillColor) => {
                    targetCtx.beginPath();
                    targetCtx.arc(hx, hy, 6, 0, Math.PI * 2);
                    targetCtx.fillStyle = fillColor;
                    targetCtx.fill();
                    targetCtx.strokeStyle = '#ffffff';
                    targetCtx.lineWidth = 1.5;
                    targetCtx.stroke();
                };

                // 中心選択インジケータ
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, 7, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                drawHandle(rHx, rHy, '#10b981');   // 緑：半径ハンドル
                drawHandle(fovLx, fovLy, '#f59e0b'); // 黄：FOV左ハンドル
                drawHandle(fovRx, fovRy, '#f59e0b'); // 黄：FOV右ハンドル
            }
        } else if (obj.type === 'marker') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            targetCtx.beginPath();
            targetCtx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = obj.color || '#f97316';
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, 12, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 1.5;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'cone') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            targetCtx.beginPath();
            targetCtx.ellipse(0, obj.radius * 0.8, obj.radius * 0.8, 3, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = '#eab308';
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();

            targetCtx.beginPath();
            targetCtx.moveTo(0, -obj.radius * 1.2);
            targetCtx.lineTo(obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.lineTo(-obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.closePath();
            targetCtx.fillStyle = obj.color || '#facc15';
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'minigoal') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            let scale = obj.goalScale || 1.0;
            if (!obj.goalScale) {
                if (obj.sizeCategory === 'small') scale = 0.7;
                else if (obj.sizeCategory === 'large') scale = 1.6;
                else if (obj.sizeCategory === 'full') scale = 2.4;
            }

            const gw = 30 * scale;
            const gh = 15 * scale;
            const hw = gw / 2;

            // Draw net frame (back, left, right walls)
            targetCtx.strokeStyle = '#64748b';
            targetCtx.lineWidth = Math.max(1.5, 2 * scale);
            targetCtx.beginPath();
            targetCtx.moveTo(-hw, gh * 0.33);
            targetCtx.lineTo(-hw, -gh * 0.66);
            targetCtx.lineTo(hw, -gh * 0.66);
            targetCtx.lineTo(hw, gh * 0.33);
            targetCtx.stroke();

            // Draw net grid
            targetCtx.beginPath();
            targetCtx.lineWidth = 0.8 * scale;
            targetCtx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
            const gridStepX = 5 * scale;
            for (let nx = -hw + gridStepX; nx < hw; nx += gridStepX) {
                targetCtx.moveTo(nx, -gh * 0.66);
                targetCtx.lineTo(nx, gh * 0.33);
            }
            const gridStepY = 4 * scale;
            for (let ny = -gh * 0.5; ny < gh * 0.33; ny += gridStepY) {
                targetCtx.moveTo(-hw, ny);
                targetCtx.lineTo(hw, ny);
            }
            targetCtx.stroke();

            // Draw faint goal line
            targetCtx.strokeStyle = '#cbd5e1';
            targetCtx.lineWidth = 1;
            targetCtx.beginPath();
            targetCtx.moveTo(-hw, gh * 0.33);
            targetCtx.lineTo(hw, gh * 0.33);
            targetCtx.stroke();

            // Draw goal posts (at front corners)
            targetCtx.fillStyle = '#475569';
            targetCtx.beginPath();
            targetCtx.arc(-hw, gh * 0.33, Math.max(2, 3 * scale), 0, Math.PI * 2);
            targetCtx.arc(hw, gh * 0.33, Math.max(2, 3 * scale), 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                const selR = (obj.radius || 15) * scale + 6;
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, selR, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                targetCtx.fillStyle = 'var(--primary)';
                const handleSize = 8;
                [
                    { hx: obj.x - selR, hy: obj.y },
                    { hx: obj.x + selR, hy: obj.y },
                    { hx: obj.x, hy: obj.y - selR },
                    { hx: obj.x, hy: obj.y + selR }
                ].forEach(pt => {
                    targetCtx.fillRect(pt.hx - handleSize / 2, pt.hy - handleSize / 2, handleSize, handleSize);
                });
            }
        } else if (obj.type === 'text') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            const txt = obj.text || '';
            targetCtx.font = 'bold 14px Inter, sans-serif';

            if (obj.bgOpaque) {
                const tw = targetCtx.measureText(txt).width;
                targetCtx.fillStyle = '#ffffff';
                targetCtx.strokeStyle = '#cbd5e1';
                targetCtx.lineWidth = 1;
                targetCtx.beginPath();
                targetCtx.roundRect(-tw / 2 - 6, -12, tw + 12, 24, 6);
                targetCtx.fill();
                targetCtx.stroke();
            }

            targetCtx.fillStyle = obj.color || '#000000';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(txt, 0, 0);
            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                const tw = targetCtx.measureText(obj.text || '').width;
                targetCtx.rect(obj.x - tw / 2 - 4, obj.y - 12, tw + 8, 24);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 1.5;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'player') {
            const r = obj.radius || 16;
            const angle = obj.angle || 0;
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);

            let mainColor = '#1d0b5e';
            if (obj.color === 'red') mainColor = '#800a1d';
            else if (obj.color === 'blue') mainColor = '#1d0b5e';
            else if (obj.color === 'green') mainColor = '#064e3b';
            else if (obj.color === 'orange') mainColor = '#7c2d12';
            else if (obj.color) mainColor = obj.color;

            targetCtx.rotate((angle * Math.PI) / 180);

            // 前方の指向性ポイント（三角形）
            targetCtx.beginPath();
            targetCtx.moveTo(-r * 0.28, -r * 1.02);
            targetCtx.lineTo(0, -r * 1.35);
            targetCtx.lineTo(r * 0.28, -r * 1.02);
            targetCtx.closePath();
            targetCtx.fillStyle = mainColor;
            targetCtx.fill();

            // 腕（Arms: 左右の肩から前方へ伸びるライン）
            targetCtx.lineWidth = r * 0.32;
            targetCtx.strokeStyle = mainColor;
            targetCtx.lineCap = 'round';

            // 左腕
            targetCtx.beginPath();
            targetCtx.moveTo(-r * 0.75, -r * 0.05);
            targetCtx.lineTo(-r * 0.85, -r * 0.75);
            targetCtx.stroke();

            // 右腕
            targetCtx.beginPath();
            targetCtx.moveTo(r * 0.75, -r * 0.05);
            targetCtx.lineTo(r * 0.85, -r * 0.75);
            targetCtx.stroke();

            // 手先（Hands: 体の向きを象徴する左右の手のグラフィック）
            const handRadius = r * 0.28;

            // 左手先
            targetCtx.beginPath();
            targetCtx.arc(-r * 0.85, -r * 0.8, handRadius, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffdfc4';
            targetCtx.fill();
            targetCtx.strokeStyle = mainColor;
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            // 右手先
            targetCtx.beginPath();
            targetCtx.arc(r * 0.85, -r * 0.8, handRadius, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffdfc4';
            targetCtx.fill();
            targetCtx.strokeStyle = mainColor;
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            const grad = targetCtx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#311096');
            grad.addColorStop(0.7, mainColor);
            grad.addColorStop(1, '#0f0538');

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r, 0, Math.PI * 2);
            targetCtx.fillStyle = (obj.color === 'blue' || !obj.color) ? grad : mainColor;
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r - 0.75, 0, Math.PI * 2);
            targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            targetCtx.rotate((-angle * Math.PI) / 180);

            let label = obj.number !== undefined && obj.number !== null ? String(obj.number) : '';
            targetCtx.fillStyle = '#ffffff';
            targetCtx.font = 'bold 12px "Inter", "Meiryo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(label, 0, 0.5);

            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, r + 6, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'ball') {
            targetCtx.beginPath();
            targetCtx.arc(obj.x + 1, obj.y + 1, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(0,0,0,0.3)';
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fill();
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 1.5;
            targetCtx.stroke();

            const r = obj.radius;
            const pentRadius = r * 0.38;
            targetCtx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const px = obj.x + pentRadius * Math.cos(angle);
                const py = obj.y + pentRadius * Math.sin(angle);
                if (i === 0) targetCtx.moveTo(px, py);
                else targetCtx.lineTo(px, py);
            }
            targetCtx.closePath();
            targetCtx.fillStyle = '#1e293b';
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 1.2;
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const px = obj.x + pentRadius * Math.cos(angle);
                const py = obj.y + pentRadius * Math.sin(angle);
                const ox = obj.x + r * Math.cos(angle);
                const oy = obj.y + r * Math.sin(angle);

                targetCtx.moveTo(px, py);
                targetCtx.lineTo(ox, oy);
            }

            for (let i = 0; i < 5; i++) {
                const angle1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const angle2 = (Math.PI * 2 * (i + 1)) / 5 - Math.PI / 2;
                const midAngle = (angle1 + angle2) / 2;

                const ox1 = obj.x + r * Math.cos(angle1);
                const oy1 = obj.y + r * Math.sin(angle1);
                const oxMid = obj.x + r * Math.cos(midAngle);
                const oyMid = obj.y + r * Math.sin(midAngle);
                const ox2 = obj.x + r * Math.cos(angle2);
                const oy2 = obj.y + r * Math.sin(angle2);

                targetCtx.moveTo(ox1, oy1);
                targetCtx.lineTo(oxMid, oyMid);
                targetCtx.lineTo(ox2, oy2);
            }
            targetCtx.stroke();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        }
    });
    targetCtx.restore();
}

// プレビュー描画ヘルパー
function drawArrow(x1, y1, x2, y2, lineType, cx, cy) {
    ctx.save();
    const dpr = getHiDPIScale();
    ctx.scale(dpr, dpr);
    drawArrowToCtx(x1, y1, x2, y2, lineType, ctx, cx, cy);
    ctx.restore();
}
function drawLadder(x1, y1, x2, y2) {
    ctx.save();
    const dpr = getHiDPIScale();
    ctx.scale(dpr, dpr);
    drawLadderToCtx(x1, y1, x2, y2, ctx);
    ctx.restore();
}
function drawRectPreview(x1, y1, x2, y2) {
    ctx.save();
    const dpr = getHiDPIScale();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.setLineDash([]);
    ctx.restore();
}
function drawCirclePreview(x1, y1, x2, y2) {
    ctx.save();
    const dpr = getHiDPIScale();
    ctx.scale(dpr, dpr);
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const cx = Math.min(x1, x2) + rx;
    const cy = Math.min(y1, y2) + ry;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function getHiDPIScale() {
    return Math.max(window.devicePixelRatio || 1, 2);
}

export function drawPitchBackground() {
    bgCanvas = document.getElementById('pitch-bg-canvas');
    if (!bgCanvas) return;
    bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    const dpr = getHiDPIScale();
    const targetW = 800 * dpr;
    const targetH = 500 * dpr;

    if (bgCanvas.width !== targetW || bgCanvas.height !== targetH) {
        bgCanvas.width = targetW;
        bgCanvas.height = targetH;
    }

    const templateEl = document.getElementById('canvas-pitch-template');
    let template = templateEl && templateEl.value ? templateEl.value : 'full';

    drawPitchToCtx([], bgCanvas, bgCtx, template);
}

let activeSnapLines = { v: null, h: null };

export function drawTrajectoryTrailOnUI() {
    if (!selectedObject || !frames || frames.length <= 1 || !uiCtx) return;

    const selId = selectedObject.id;
    const selX = typeof selectedObject.x !== 'undefined' ? selectedObject.x : selectedObject.x1;
    const selY = typeof selectedObject.y !== 'undefined' ? selectedObject.y : selectedObject.y1;
    if (typeof selX === 'undefined' || typeof selY === 'undefined') return;

    const points = [];

    frames.forEach((f, fIdx) => {
        const frameObjs = (Array.isArray(f) ? f : (f.objects || []));
        let match = null;
        if (selId) {
            match = frameObjs.find(o => o && o.id === selId);
        }
        if (!match && typeof selectedObject.number !== 'undefined') {
            match = frameObjs.find(o => o && o.type === selectedObject.type && o.number === selectedObject.number);
        }
        if (!match) {
            match = frameObjs.find(o => {
                if (!o) return false;
                const ox = typeof o.x !== 'undefined' ? o.x : o.x1;
                const oy = typeof o.y !== 'undefined' ? o.y : o.y1;
                return o.type === selectedObject.type && typeof ox !== 'undefined' && Math.abs(ox - selX) < 40 && Math.abs(oy - selY) < 40;
            });
        }

        if (match) {
            const ptX = typeof match.x !== 'undefined' ? match.x : match.x1;
            const ptY = typeof match.y !== 'undefined' ? match.y : match.y1;
            if (typeof ptX !== 'undefined' && typeof ptY !== 'undefined') {
                points.push({ x: ptX, y: ptY, frameIdx: fIdx });
            }
        }
    });

    if (points.length <= 1) return;

    const dpr = getHiDPIScale();
    uiCtx.save();
    uiCtx.scale(dpr, dpr);

    uiCtx.beginPath();
    uiCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        uiCtx.lineTo(points[i].x, points[i].y);
    }
    uiCtx.strokeStyle = '#06b6d4';
    uiCtx.lineWidth = 2.5;
    uiCtx.setLineDash([6, 4]);
    uiCtx.stroke();
    uiCtx.setLineDash([]);

    points.forEach((pt) => {
        uiCtx.beginPath();
        uiCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        uiCtx.fillStyle = '#06b6d4';
        uiCtx.fill();
        uiCtx.strokeStyle = '#ffffff';
        uiCtx.lineWidth = 1.5;
        uiCtx.stroke();

        uiCtx.fillStyle = '#0f172a';
        uiCtx.fillRect(pt.x - 11, pt.y - 20, 22, 12);
        uiCtx.strokeStyle = '#06b6d4';
        uiCtx.lineWidth = 1;
        uiCtx.strokeRect(pt.x - 11, pt.y - 20, 22, 12);

        uiCtx.fillStyle = '#ffffff';
        uiCtx.font = 'bold 8px sans-serif';
        uiCtx.textAlign = 'center';
        uiCtx.textBaseline = 'middle';
        uiCtx.fillText(`S${pt.frameIdx + 1}`, pt.x, pt.y - 14);
    });

    uiCtx.restore();
}

export function drawSnapGuidesOnUI() {
    if ((activeSnapLines.v === null && activeSnapLines.h === null) || !uiCtx) return;
    const dpr = getHiDPIScale();
    uiCtx.save();
    uiCtx.scale(dpr, dpr);

    uiCtx.strokeStyle = '#06b6d4';
    uiCtx.lineWidth = 1.5;
    uiCtx.setLineDash([4, 4]);

    if (activeSnapLines.v !== null) {
        uiCtx.beginPath();
        uiCtx.moveTo(activeSnapLines.v, 0);
        uiCtx.lineTo(activeSnapLines.v, 500);
        uiCtx.stroke();
    }
    if (activeSnapLines.h !== null) {
        uiCtx.beginPath();
        uiCtx.moveTo(0, activeSnapLines.h);
        uiCtx.lineTo(800, activeSnapLines.h);
        uiCtx.stroke();
    }

    uiCtx.setLineDash([]);
    uiCtx.restore();
}

export function applySmartMagnetSnap(obj, x, y) {
    activeSnapLines = { v: null, h: null };
    if (!obj || typeof x === 'undefined' || typeof y === 'undefined') return { x, y };
    const tolerance = 8;
    let finalX = x;
    let finalY = y;

    objects.forEach(other => {
        if (!other || other === obj) return;
        const otherX = typeof other.x !== 'undefined' ? other.x : (typeof other.x1 !== 'undefined' ? other.x1 : null);
        const otherY = typeof other.y !== 'undefined' ? other.y : (typeof other.y1 !== 'undefined' ? other.y1 : null);

        if (otherX !== null && Math.abs(otherX - x) < tolerance) {
            finalX = otherX;
            activeSnapLines.v = otherX;
        }
        if (otherY !== null && Math.abs(otherY - y) < tolerance) {
            finalY = otherY;
            activeSnapLines.h = otherY;
        }
    });

    return { x: finalX, y: finalY };
}

export function drawPitchUI() {
    uiCanvas = document.getElementById('pitch-ui-canvas');
    if (!uiCanvas) return;
    uiCtx = uiCanvas.getContext('2d');
    if (!uiCtx) return;

    const dpr = getHiDPIScale();
    const targetW = 800 * dpr;
    const targetH = 500 * dpr;

    if (uiCanvas.width !== targetW || uiCanvas.height !== targetH) {
        uiCanvas.width = targetW;
        uiCanvas.height = targetH;
    }

    uiCtx.save();
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    uiCtx.restore();

    drawTrajectoryTrailOnUI();
    drawSnapGuidesOnUI();
}

export function drawPitch(renderObjects) {
    canvas = document.getElementById('pitch-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = getHiDPIScale();
    const targetW = 800 * dpr;
    const targetH = 500 * dpr;

    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    drawPitchBackground();
    drawPitchToCtx(renderObjects, canvas, ctx, 'blank');
    drawPitchUI();
    updateCanvasToolbar();
}

function updateContextPopover() {
    const popover = document.getElementById('anim-context-popover');
    if (!popover || !canvas) return;

    if (!selectedObject || isPlaying || draggedObject) {
        popover.classList.add('hidden');
        return;
    }

    let objX, objY;
    if (typeof selectedObject.x !== 'undefined' && typeof selectedObject.y !== 'undefined') {
        objX = selectedObject.x;
        objY = selectedObject.y;
    } else if (typeof selectedObject.x1 !== 'undefined') {
        if (typeof selectedObject.cx !== 'undefined' && typeof selectedObject.cy !== 'undefined') {
            objX = selectedObject.cx;
            objY = Math.min(selectedObject.y1, selectedObject.y2, selectedObject.cy);
        } else {
            objX = (selectedObject.x1 + selectedObject.x2) / 2;
            objY = Math.min(selectedObject.y1, selectedObject.y2);
        }
    }

    if (typeof objX === 'undefined' || typeof objY === 'undefined') {
        popover.classList.add('hidden');
        return;
    }

    const playerControls = document.getElementById('popover-player-controls');
    if (playerControls) {
        if (selectedObject.type === 'player' || selectedObject.type === 'marker') {
            playerControls.style.display = 'flex';
            const numInput = document.getElementById('canvas-player-number');
            const numLabels = playerControls.querySelectorAll('.popover-label');
            if (numInput) numInput.style.display = (selectedObject.type === 'player') ? 'inline-block' : 'none';
            if (numLabels && numLabels[0]) numLabels[0].style.display = (selectedObject.type === 'player') ? 'inline-block' : 'none';
            if (selectedObject.type === 'player' && numInput) {
                numInput.value = selectedObject.number || '';
            }

            const colorDots = popover.querySelectorAll('.color-dot');
            const currentColor = selectedObject.color || (selectedObject.type === 'marker' ? '#f97316' : 'red');
            colorDots.forEach(dot => {
                const c = dot.dataset.color;
                if ((c === 'red' && (currentColor === '#f23932' || currentColor === 'red' || currentColor === '#ef4444')) ||
                    (c === 'blue' && (currentColor === '#3d79d5' || currentColor === 'blue' || currentColor === '#3b82f6')) ||
                    (c === 'green' && (currentColor === '#63a84d' || currentColor === 'green')) ||
                    (c === 'orange' && (currentColor === '#f09f4d' || currentColor === 'orange' || currentColor === '#f97316')) ||
                    currentColor === c) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        } else {
            playerControls.style.display = 'none';
        }
    }

    const textControls = document.getElementById('popover-text-controls');
    if (textControls) {
        if (selectedObject.type === 'text') {
            textControls.style.display = 'flex';
            const bgOpaqueInput = document.getElementById('canvas-text-bg-opaque');
            if (bgOpaqueInput) {
                bgOpaqueInput.checked = !!selectedObject.bgOpaque;
                bgOpaqueInput.onchange = (ev) => {
                    selectedObject.bgOpaque = ev.target.checked;
                    saveHistory();
                    drawPitch(objects);
                };
            }
        } else {
            textControls.style.display = 'none';
        }
    }

    const canvasRect = canvas.getBoundingClientRect();
    const wrapper = document.getElementById('canvas-wrapper') || canvas.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();

    const scaleX = canvasRect.width / 800;
    const scaleY = canvasRect.height / 500;

    const objCenterX = (objX * scaleX) + (canvasRect.left - wrapperRect.left);
    const objTopY = (objY * scaleY) + (canvasRect.top - wrapperRect.top);

    popover.style.visibility = 'hidden';
    popover.classList.remove('hidden');

    const popWidth = popover.offsetWidth || (selectedObject.type === 'player' ? 260 : 180);
    const popHeight = popover.offsetHeight || 50;

    // オブジェクトの種類に応じた画面表示上の半径・高さを算出
    let objectRadiusInPixels = 16 * scaleY;
    if (selectedObject.type === 'player') {
        objectRadiusInPixels = (selectedObject.radius || 16) * scaleY;
    } else if (selectedObject.type === 'ball') {
        objectRadiusInPixels = 8 * scaleY;
    } else if (selectedObject.type === 'marker') {
        objectRadiusInPixels = 8 * scaleY;
    } else if (selectedObject.type === 'cone') {
        objectRadiusInPixels = 12 * scaleY;
    } else if (selectedObject.type === 'vision') {
        objectRadiusInPixels = (selectedObject.radius || 60) * scaleY;
    } else if (selectedObject.type === 'minigoal') {
        let scale = selectedObject.goalScale || 1.0;
        if (!selectedObject.goalScale) {
            if (selectedObject.sizeCategory === 'small') scale = 0.7;
            else if (selectedObject.sizeCategory === 'large') scale = 1.6;
            else if (selectedObject.sizeCategory === 'full') scale = 2.4;
        }
        objectRadiusInPixels = (15 * scale) * scaleY;
    } else if (selectedObject.type === 'text') {
        objectRadiusInPixels = 12 * scaleY;
    } else {
        objectRadiusInPixels = 10 * scaleY;
    }

    const isBelow = (objTopY - objectRadiusInPixels < popHeight + 25 || objY < 80);
    const topPos = isBelow ? (objTopY + objectRadiusInPixels + 12) : (objTopY - objectRadiusInPixels - popHeight - 12);

    let leftPos = objCenterX - (popWidth / 2);
    const padding = 10;
    if (leftPos < padding) {
        leftPos = padding;
    } else if (leftPos + popWidth > wrapperRect.width - padding) {
        leftPos = wrapperRect.width - popWidth - padding;
    }

    popover.style.transform = 'none';
    popover.style.left = `${leftPos}px`;
    popover.style.top = `${topPos}px`;
    popover.style.visibility = 'visible';

    if (isBelow) {
        popover.classList.add('popover-below');
    } else {
        popover.classList.remove('popover-below');
    }

    const arrow = popover.querySelector('.popover-arrow');
    if (arrow) {
        let arrowLeft = objCenterX - leftPos;
        arrowLeft = Math.max(15, Math.min(popWidth - 15, arrowLeft));
        arrow.style.left = `${arrowLeft}px`;
    }
}

function drawArrowToCtx(x1, y1, x2, y2, lineType, targetCtx, cx, cy) {
    const headlen = 10;
    const actualCx = typeof cx !== 'undefined' ? cx : (x1 + x2) / 2;
    const actualCy = typeof cy !== 'undefined' ? cy : (y1 + y2) / 2;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const isCurved = Math.sqrt((actualCx - midX) * (actualCx - midX) + (actualCy - midY) * (actualCy - midY)) > 1.5;
    const color = '#334155';

    targetCtx.beginPath();

    if (lineType === 'dribble') {
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([]);
        if (isCurved) {
            const steps = 30;
            let lastX = x1;
            let lastY = y1;
            targetCtx.moveTo(x1, y1);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * actualCx + t * t * x2;
                const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * actualCy + t * t * y2;
                const dx = px - lastX;
                const dy = py - lastY;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    const perpX = -dy / len * (i % 2 === 0 ? 4 : -4);
                    const perpY = dx / len * (i % 2 === 0 ? 4 : -4);
                    if (i === steps) targetCtx.lineTo(x2, y2);
                    else targetCtx.lineTo(px + perpX, py + perpY);
                }
                lastX = px;
                lastY = py;
            }
        } else {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.floor(dist / 10);
            targetCtx.moveTo(x1, y1);
            if (steps > 0) {
                for (let i = 1; i <= steps; i++) {
                    const px = x1 + (dx / steps) * i;
                    const py = y1 + (dy / steps) * i;
                    const perpX = -dy / dist * (i % 2 === 0 ? 5 : -5);
                    const perpY = dx / dist * (i % 2 === 0 ? 5 : -5);
                    if (i === steps) targetCtx.lineTo(x2, y2);
                    else targetCtx.lineTo(px + perpX, py + perpY);
                }
            } else {
                targetCtx.lineTo(x2, y2);
            }
        }
    } else {
        if (isCurved) {
            targetCtx.moveTo(x1, y1);
            targetCtx.quadraticCurveTo(actualCx, actualCy, x2, y2);
        } else {
            targetCtx.moveTo(x1, y1);
            targetCtx.lineTo(x2, y2);
        }
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = (lineType === 'move') ? 2 : 3;
        if (lineType === 'pass') targetCtx.setLineDash([5, 5]);
        else targetCtx.setLineDash([]);
    }

    targetCtx.stroke();
    targetCtx.setLineDash([]);

    const angle = Math.atan2(y2 - actualCy, x2 - actualCx);
    targetCtx.beginPath();
    targetCtx.moveTo(x2, y2);
    targetCtx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    targetCtx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    targetCtx.lineTo(x2, y2);
    targetCtx.fillStyle = color;
    targetCtx.fill();
}

function drawLadderToCtx(x1, y1, x2, y2, targetCtx) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;
    const width = 12;

    targetCtx.beginPath();
    targetCtx.moveTo(x1 + nx * width, y1 + ny * width);
    targetCtx.lineTo(x2 + nx * width, y2 + ny * width);
    targetCtx.moveTo(x1 - nx * width, y1 - ny * width);
    targetCtx.lineTo(x2 - nx * width, y2 - ny * width);

    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 2.5;
    targetCtx.stroke();

    const step = 20;
    targetCtx.beginPath();
    for (let t = 0; t <= dist; t += step) {
        const rx = x1 + ux * t;
        const ry = y1 + uy * t;
        targetCtx.moveTo(rx + nx * width, ry + ny * width);
        targetCtx.lineTo(rx - nx * width, ry - ny * width);
    }
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 2;
    targetCtx.stroke();
}

function applyGridSnap(val) {
    const cb = document.getElementById('canvas-snap-grid');
    if (cb && cb.checked) {
        return Math.round(val / 20) * 20;
    }
    return val;
}

function getCanvasPos(e) {
    const targetCanvas = document.getElementById('pitch-canvas') || canvas;
    if (!targetCanvas) return { x: 0, y: 0 };

    const rect = targetCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * (800 / rect.width),
        y: (clientY - rect.top) * (500 / rect.height)
    };
}

export function initAnimation(params, navigateFunc, openModalFunc) {
    canvas = document.getElementById('pitch-canvas');
    bgCanvas = document.getElementById('pitch-bg-canvas');
    if (!canvas) return;

    cleanupCanvasEvents();

    const dpr = getHiDPIScale();
    canvas.width = 800 * dpr;
    canvas.height = 500 * dpr;

    currentBgTemplate = null;
    if (bgCanvas) {
        bgCanvas.width = 800 * dpr;
        bgCanvas.height = 500 * dpr;
        bgCtx = bgCanvas.getContext('2d');
    }

    currentPracticeId = params && params.practiceId ? params.practiceId : null;
    currentMenuId = params && params.menuId ? params.menuId : null;
    currentMatchId = params && params.matchId ? params.matchId : null;
    currentFormationId = params && params.formId ? params.formId : null;
    currentLibraryId = params && params.libraryId ? params.libraryId : null;
    let currentTacticId = params && params.tacticId ? params.tacticId : null;

    let initialFrames = null;
    let isFormationMode = !!(currentMatchId && currentFormationId);
    let isLibraryMode = !!currentLibraryId;
    let isTacticsMode = !!currentTacticId;
    let targetMenu = null;

    if (currentPracticeId && currentMenuId) {
        const practice = state.practices.find(p => p.id === currentPracticeId);
        if (practice) {
            targetMenu = practice.menus.find(m => m.id === currentMenuId);
            if (targetMenu && targetMenu.frames) {
                initialFrames = JSON.parse(JSON.stringify(targetMenu.frames));
            }
        }
    } else if (isFormationMode) {
        const match = state.matches.find(m => m.id === currentMatchId);
        if (match) {
            const formObj = match.formations.find(f => f.id === currentFormationId);
            if (formObj && formObj.boardData && formObj.boardData.length > 0) {
                initialFrames = [JSON.parse(JSON.stringify(formObj.boardData))];
            } else {
                initialFrames = [];
            }
        }
    } else if (isLibraryMode) {
        targetMenu = state.menuLibrary.find(m => m.id === currentLibraryId);
        if (targetMenu && targetMenu.frames) {
            initialFrames = JSON.parse(JSON.stringify(targetMenu.frames));
        }
    } else if (isTacticsMode) {
        const tactic = state.tactics ? state.tactics.find(t => String(t.id) === String(currentTacticId)) : null;
        if (tactic && tactic.frames) {
            initialFrames = JSON.parse(JSON.stringify(tactic.frames));
        }
    }

    ctx = canvas.getContext('2d');
    frames = initialFrames || [];
    if (frames.length === 0) {
        frames = [{ objects: [], title: '' }];
    }
    currentFrameIndex = 0;
    const activeFrame = frames[currentFrameIndex];
    objects = JSON.parse(JSON.stringify(Array.isArray(activeFrame) ? activeFrame : (activeFrame.objects || [])));
    isPlaying = false;
    historyStack = [];
    saveHistory();
    isDirty = false;

    // ★ 保存されたピッチテンプレートの初期読込 & Reflect
    let savedTemplate = 'full';
    let targetTactic = isTacticsMode ? (state.tactics ? state.tactics.find(t => String(t.id) === String(currentTacticId)) : null) : null;

    if (targetTactic && targetTactic.pitchTemplate) {
        savedTemplate = targetTactic.pitchTemplate;
    } else if (targetMenu && targetMenu.pitchTemplate) {
        savedTemplate = targetMenu.pitchTemplate;
    } else if (isFormationMode) {
        const match = state.matches.find(m => m.id === currentMatchId);
        if (match) {
            const formObj = match.formations.find(f => f.id === currentFormationId);
            if (formObj && formObj.pitchTemplate) {
                savedTemplate = formObj.pitchTemplate;
            }
        }
    }
    const templateSel = document.getElementById('canvas-pitch-template');
    if (templateSel) {
        templateSel.value = savedTemplate;
        templateSel.onchange = () => {
            isDirty = true;
            drawPitchBackground(true);
            drawPitch(objects);
        };
    }
    drawPitchBackground(true);

    // テーマタイトルの反映
    const titleEl = document.getElementById('anim-menu-focus');
    if (titleEl) {
        if (targetMenu && (targetMenu.focus || targetMenu.name)) {
            titleEl.textContent = targetMenu.focus || targetMenu.name;
        } else if (targetTactic && targetTactic.title) {
            titleEl.textContent = targetTactic.title;
        } else if (isFormationMode) {
            titleEl.textContent = 'フォーメーション作図';
        } else {
            titleEl.textContent = 'テーマ・フォーカス未設定';
        }
        titleEl.title = titleEl.textContent;
        titleEl.onclick = () => showToast(titleEl.textContent);
    }

    // ★ 右側詳細パネルの情報反映＆開閉トグル復元
    const sidePanel = document.getElementById('anim-detail-side-panel');
    const sideToggleBtn = document.getElementById('anim-side-panel-toggle-btn');
    if (sidePanel && sideToggleBtn) {
        const sideFocus = document.getElementById('side-info-focus');
        const sideOrg = document.getElementById('side-info-organize');
        const sideKf = document.getElementById('side-info-keyfactor');
        const sideOpt = document.getElementById('side-info-options');

        const lblSideTitle = document.getElementById('anim-side-panel-title');
        const lblSideFocus = document.getElementById('lbl-side-focus');
        const lblSideOrg = document.getElementById('lbl-side-org');
        const lblSideKf = document.getElementById('lbl-side-kf');
        const cardSideOpt = document.getElementById('side-card-opt');

        if (targetMenu) {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="fa-solid fa-clipboard-list" style="color:var(--primary);"></i> メニュー詳細';
            if (lblSideFocus) lblSideFocus.innerHTML = '<i class="fa-solid fa-bullseye" style="color:var(--primary);"></i> テーマ・フォーカス';
            if (lblSideOrg) lblSideOrg.innerHTML = '<i class="fa-solid fa-users" style="color:#3b82f6;"></i> オーガナイズ';
            if (lblSideKf) lblSideKf.innerHTML = '<i class="fa-solid fa-key" style="color:#eab308;"></i> キーファクター';
            if (cardSideOpt) cardSideOpt.style.display = 'block';

            if (sideFocus) sideFocus.textContent = targetMenu.focus || targetMenu.name || '未設定';
            if (sideOrg) sideOrg.textContent = targetMenu.organize || 'なし';
            if (sideKf) sideKf.textContent = targetMenu.keyfactor || 'なし';
            if (sideOpt) sideOpt.textContent = targetMenu.options || 'なし';
        } else if (targetTactic) {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="fa-solid fa-chess-board" style="color:var(--primary);"></i> 戦術詳細';
            if (lblSideFocus) lblSideFocus.innerHTML = '<i class="fa-solid fa-heading" style="color:var(--primary);"></i> 戦術名';
            if (lblSideOrg) lblSideOrg.innerHTML = '<i class="fa-solid fa-tags" style="color:#3b82f6;"></i> カテゴリ';
            if (lblSideKf) lblSideKf.innerHTML = '<i class="fa-solid fa-align-left" style="color:#eab308;"></i> 説明';
            if (cardSideOpt) cardSideOpt.style.display = 'none';

            if (sideFocus) sideFocus.textContent = targetTactic.title || '未設定';
            if (sideOrg) sideOrg.textContent = targetTactic.category || 'その他';
            if (sideKf) sideKf.textContent = targetTactic.description || 'なし';
        } else {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="fa-solid fa-clipboard-list" style="color:var(--primary);"></i> メニュー詳細';
            if (cardSideOpt) cardSideOpt.style.display = 'block';

            if (sideFocus) sideFocus.textContent = '未設定';
            if (sideOrg) sideOrg.textContent = 'なし';
            if (sideKf) sideKf.textContent = 'なし';
            if (sideOpt) sideOpt.textContent = 'なし';
        }

        sidePanel.classList.remove('open');
        sidePanel.classList.add('collapsed');

        sideToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = sidePanel.classList.toggle('open');
            sidePanel.classList.toggle('collapsed', !isOpen);
        };

        // click / touch outside to close sidebar
        const closeSidebarOutside = (e) => {
            if (sidePanel.classList.contains('open')) {
                if (!sidePanel.contains(e.target) && !sideToggleBtn.contains(e.target)) {
                    sidePanel.classList.remove('open');
                    sidePanel.classList.add('collapsed');
                }
            }
        };
        setTimeout(() => {
            registerListener('drawing.canvas', document, 'click', closeSidebarOutside);
            registerListener('drawing.canvas', document, 'touchstart', closeSidebarOutside);
        }, 0);

        // Keyboard shortcuts and Escape key
        let arrowMoving = false;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (sidePanel.classList.contains('open')) {
                    sidePanel.classList.remove('open');
                    sidePanel.classList.add('collapsed');
                }
            }

            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedObject) {
                    e.preventDefault();
                    objects = objects.filter(o => o.id !== selectedObject.id);
                    selectedObject = null;
                    saveHistory();
                    drawPitch(objects);
                    const popover = document.getElementById('anim-context-popover');
                    if (popover) popover.classList.add('hidden');
                }
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    undoHistory();
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redoHistory();
                }
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (selectedObject && !isPlaying) {
                    e.preventDefault();
                    const step = e.shiftKey ? 5 : 1;
                    let dx = 0; let dy = 0;
                    if (e.key === 'ArrowUp') dy = -step;
                    if (e.key === 'ArrowDown') dy = step;
                    if (e.key === 'ArrowLeft') dx = -step;
                    if (e.key === 'ArrowRight') dx = step;

                    if (typeof selectedObject.x !== 'undefined' && typeof selectedObject.y !== 'undefined') {
                        selectedObject.x += dx;
                        selectedObject.y += dy;
                    }
                    if (typeof selectedObject.x1 !== 'undefined') {
                        selectedObject.x1 += dx; selectedObject.y1 += dy;
                        selectedObject.x2 += dx; selectedObject.y2 += dy;
                    }
                    if (typeof selectedObject.cx !== 'undefined' && typeof selectedObject.cy !== 'undefined') {
                        selectedObject.cx += dx;
                        selectedObject.cy += dy;
                    }
                    drawPitch(objects);
                    updateContextPopover();
                    arrowMoving = true;
                }
            }
        };

        const handleKeyUp = (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (arrowMoving) {
                    arrowMoving = false;
                    saveHistory();
                }
            }
        };

        registerListener('drawing.canvas', document, 'keydown', handleKeyDown);
        registerListener('drawing.canvas', document, 'keyup', handleKeyUp);
    }

    // ★ 戦術モード時のツールドック制御
    const animContainer = document.querySelector('.anim-app-container');
    if (animContainer) {
        if (isTacticsMode) {
            animContainer.classList.add('is-tactics-mode');
        } else {
            animContainer.classList.remove('is-tactics-mode');
        }
    }

    // ポップオーバー要素の取得
    const settingsBtn = document.getElementById('anim-settings-btn');
    const settingsPopover = document.getElementById('anim-settings-popover');
    const teamColorsBtn = document.getElementById('anim-team-colors-btn');
    const teamColorsPopover = document.getElementById('anim-team-colors-popover');
    const bulkFormationBtn = document.getElementById('anim-bulk-formation-btn');
    const bulkFormationPopover = document.getElementById('anim-bulk-formation-popover');
    const inputHomeColor = document.getElementById('input-home-team-color');
    const inputAwayColor = document.getElementById('input-away-team-color');

    let homeTeamColor = (inputHomeColor && inputHomeColor.value) || '#f23932';
    let awayTeamColor = (inputAwayColor && inputAwayColor.value) || '#2563eb';

    // ポップオーバー開閉ハンドラの個別登録
    if (settingsBtn && settingsPopover) {
        settingsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = settingsPopover.classList.contains('hidden');
            if (teamColorsPopover) teamColorsPopover.classList.add('hidden');
            if (bulkFormationPopover) bulkFormationPopover.classList.add('hidden');
            if (isHidden) {
                settingsPopover.classList.remove('hidden');
            } else {
                settingsPopover.classList.add('hidden');
            }
        };
    }

    if (teamColorsBtn && teamColorsPopover) {
        teamColorsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = teamColorsPopover.classList.contains('hidden');
            if (settingsPopover) settingsPopover.classList.add('hidden');
            if (bulkFormationPopover) bulkFormationPopover.classList.add('hidden');
            if (isHidden) {
                teamColorsPopover.classList.remove('hidden');
            } else {
                teamColorsPopover.classList.add('hidden');
            }
        };
    }

    if (bulkFormationBtn && bulkFormationPopover) {
        const selectHomeBulk = document.getElementById('select-bulk-home-formation');
        const selectAwayBulk = document.getElementById('select-bulk-away-formation');
        const selectTeamMode = document.getElementById('select-bulk-team-mode');
        const wrapHome = document.getElementById('wrapper-bulk-home-formation');
        const wrapAway = document.getElementById('wrapper-bulk-away-formation');

        let opts = `
            <option value="3-3-1">3-3-1 (8人制標準)</option>
            <option value="2-4-1">2-4-1 (8人制)</option>
            <option value="3-2-2">3-2-2 (8人制)</option>
            <option value="2-3-2">2-3-2 (8人制)</option>
            <option value="4-4-2">4-4-2 (11人制)</option>
            <option value="4-3-3">4-3-3 (11人制)</option>
        `;
        if (state.customFormations && state.customFormations.length > 0) {
            state.customFormations.forEach((cf, idx) => {
                opts += `<option value="custom_${idx}">カスタム: ${escapeHtml(cf.name)}</option>`;
            });
        }
        if (selectHomeBulk) selectHomeBulk.innerHTML = opts;
        if (selectAwayBulk) selectAwayBulk.innerHTML = opts;

        if (selectTeamMode) {
            selectTeamMode.onchange = () => {
                const mode = selectTeamMode.value;
                if (mode === 'both') {
                    if (wrapHome) wrapHome.style.display = 'block';
                    if (wrapAway) wrapAway.style.display = 'block';
                } else if (mode === 'home') {
                    if (wrapHome) wrapHome.style.display = 'block';
                    if (wrapAway) wrapAway.style.display = 'none';
                } else if (mode === 'away') {
                    if (wrapHome) wrapHome.style.display = 'none';
                    if (wrapAway) wrapAway.style.display = 'block';
                }
            };
        }

        bulkFormationBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = bulkFormationPopover.classList.contains('hidden');
            if (settingsPopover) settingsPopover.classList.add('hidden');
            if (teamColorsPopover) teamColorsPopover.classList.add('hidden');
            if (isHidden) {
                bulkFormationPopover.classList.remove('hidden');
            } else {
                bulkFormationPopover.classList.add('hidden');
            }
        };
    }

    // 全ポップオーバー共通の画面外クリック判定
    const closeAllPopoversOutside = (e) => {
        if (settingsPopover && !settingsPopover.contains(e.target) && settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPopover.classList.add('hidden');
        }
        if (teamColorsPopover && !teamColorsPopover.contains(e.target) && teamColorsBtn && !teamColorsBtn.contains(e.target)) {
            teamColorsPopover.classList.add('hidden');
        }
        if (bulkFormationPopover && !bulkFormationPopover.contains(e.target) && bulkFormationBtn && !bulkFormationBtn.contains(e.target)) {
            bulkFormationPopover.classList.add('hidden');
        }
    };
    registerListener('drawing.canvas', document, 'click', closeAllPopoversOutside);

    // チームカラー変更処理
    if (inputHomeColor) {
        inputHomeColor.onchange = (e) => {
            const oldColor = homeTeamColor;
            homeTeamColor = e.target.value;
            updateTeamColorsOnCanvas('home', oldColor, homeTeamColor);
        };
    }
    if (inputAwayColor) {
        inputAwayColor.onchange = (e) => {
            const oldColor = awayTeamColor;
            awayTeamColor = e.target.value;
            updateTeamColorsOnCanvas('away', oldColor, awayTeamColor);
        };
    }

    document.querySelectorAll('.btn-color-preset').forEach(btn => {
        btn.onclick = (e) => {
            const home = e.currentTarget.dataset.home;
            const away = e.currentTarget.dataset.away;
            if (home && away) {
                const oldHome = homeTeamColor;
                const oldAway = awayTeamColor;
                homeTeamColor = home;
                awayTeamColor = away;
                if (inputHomeColor) inputHomeColor.value = home;
                if (inputAwayColor) inputAwayColor.value = away;
                updateTeamColorsOnCanvas('home', oldHome, homeTeamColor);
                updateTeamColorsOnCanvas('away', oldAway, awayTeamColor);
                showToast('チームカラーを変更しました');
            }
        };
    });

    function updateTeamColorsOnCanvas(teamType, oldColor, newColor) {
        let changed = false;
        objects.forEach(obj => {
            if (obj.type === 'player') {
                if (obj.team === teamType || obj.color === oldColor) {
                    obj.color = newColor;
                    obj.team = teamType;
                    changed = true;
                }
            }
        });
        if (changed) {
            isDirty = true;
            saveHistory();
            drawPitch(objects);
        }
    }

    // フォーメーション一括配置実行処理
    const btnApplyBulk = document.getElementById('btn-apply-bulk-formation');
    if (btnApplyBulk) {
        btnApplyBulk.onclick = () => {
            const selectHome = document.getElementById('select-bulk-home-formation');
            const selectAway = document.getElementById('select-bulk-away-formation');
            const homeKey = selectHome ? selectHome.value : '3-3-1';
            const awayKey = selectAway ? selectAway.value : '3-3-1';
            const teamMode = document.getElementById('select-bulk-team-mode') ? document.getElementById('select-bulk-team-mode').value : 'both';
            const pitchTemplateSel = document.getElementById('canvas-pitch-template');
            const template = pitchTemplateSel ? pitchTemplateSel.value : 'full';

            applyBulkFormationToCanvas(homeKey, awayKey, teamMode, template);
            if (bulkFormationPopover) bulkFormationPopover.classList.add('hidden');
        };
    }

    function getFormationList(formationKey) {
        return getFormationPlayerList(formationKey, state.customFormations);
    }

    function applyBulkFormationToCanvas(homeKey, awayKey, teamMode, template) {
        if (teamMode === 'both') {
            objects = objects.filter(o => o.type !== 'player');
        } else if (teamMode === 'home') {
            objects = objects.filter(o => o.type !== 'player' || o.team !== 'home');
        } else if (teamMode === 'away') {
            objects = objects.filter(o => o.type !== 'player' || o.team !== 'away');
        }

        const minX = 40, maxX = 760;
        const minY = 30, maxY = 470;
        const pWidth = maxX - minX;
        const pHeight = maxY - minY;

        if (teamMode === 'home' || teamMode === 'both') {
            const homeList = getFormationList(homeKey);
            homeList.forEach(p => {
                let cx, cy, angle = 90;
                if (template === 'half' || template === 'half-bottom') {
                    cx = minX + p.y * pWidth;
                    cy = maxY - p.x * pHeight;
                    angle = 0;
                } else {
                    cx = minX + p.x * pWidth * 0.48;
                    cy = minY + p.y * pHeight;
                    angle = 90;
                }
                objects.push({
                    id: objectIdCounter++,
                    type: 'player',
                    team: 'home',
                    x: Math.round(cx),
                    y: Math.round(cy),
                    radius: 14,
                    color: homeTeamColor,
                    number: p.num,
                    angle: angle
                });
            });
        }

        if (teamMode === 'away' || teamMode === 'both') {
            const awayList = getFormationList(awayKey);
            awayList.forEach(p => {
                let cx, cy, angle = 270;
                if (template === 'half' || template === 'half-bottom') {
                    cx = minX + (1 - p.y) * pWidth;
                    cy = minY + p.x * pHeight * 0.7;
                    angle = 180;
                } else {
                    cx = maxX - p.x * pWidth * 0.48;
                    cy = maxY - p.y * pHeight;
                    angle = 270;
                }
                objects.push({
                    id: objectIdCounter++,
                    type: 'player',
                    team: 'away',
                    x: Math.round(cx),
                    y: Math.round(cy),
                    radius: 14,
                    color: awayTeamColor,
                    number: p.num,
                    angle: angle
                });
            });
        }

        isDirty = true;
        saveHistory();
        drawPitch(objects);
        showToast('フォーメーションを一括配置しました');
    }

    // ★ タイムラインバーの隠す/開くトグル復元
    const timelineToggleBtn = document.getElementById('anim-timeline-toggle');
    const timelineBar = document.getElementById('anim-timeline-bar');
    const filmstripWrapper = document.getElementById('filmstrip-timeline-wrapper');
    if (timelineToggleBtn && timelineBar) {
        timelineToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = timelineBar.classList.toggle('collapsed');
            if (filmstripWrapper) filmstripWrapper.classList.toggle('collapsed', isCollapsed);
            timelineToggleBtn.innerHTML = isCollapsed ? '<i class="fa-solid fa-film"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
        };
    }

    updateFrameCount();
    drawPitch(objects);

    // ★ ツールドック（ボタン）のイベント登録
    const tools = ['select', 'player', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'line-circle', 'vision', 'text', 'line-move', 'line-pass', 'line-dribble'];
    tools.forEach(tool => {
        const el = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (!el) return;

        const isPlayerTool = ['select', 'player'].includes(tool);
        if (isFormationMode && !isPlayerTool) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }

        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);

        newEl.addEventListener('click', () => {
            currentTool = tool;
            updateToolDockActive();
        });
    });
    currentTool = 'select';
    updateToolDockActive();

    // ★ オブジェクト回転ボタン (tool-rotate) の復元
    const btnRotate = document.getElementById('tool-rotate');
    if (btnRotate) {
        const newBtn = btnRotate.cloneNode(true);
        btnRotate.parentNode.replaceChild(newBtn, btnRotate);
        newBtn.addEventListener('click', () => {
            if (selectedObject) {
                if (typeof selectedObject.x1 !== 'undefined' && typeof selectedObject.x2 !== 'undefined') {
                    const rad = Math.PI / 4;
                    const cx = (selectedObject.x1 + selectedObject.x2) / 2;
                    const cy = (selectedObject.y1 + selectedObject.y2) / 2;
                    const rotatePt = (px, py) => {
                        const dx = px - cx;
                        const dy = py - cy;
                        return {
                            x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
                            y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
                        };
                    };
                    const p1 = rotatePt(selectedObject.x1, selectedObject.y1);
                    const p2 = rotatePt(selectedObject.x2, selectedObject.y2);
                    selectedObject.x1 = p1.x; selectedObject.y1 = p1.y;
                    selectedObject.x2 = p2.x; selectedObject.y2 = p2.y;
                } else {
                    selectedObject.angle = ((selectedObject.angle || 0) + 45) % 360;
                }
                saveHistory();
                drawPitch(objects);
            }
        });
    }

    // 削除ボタン (tool-delete)
    const btnDelete = document.getElementById('tool-delete');
    if (btnDelete) {
        const newBtn = btnDelete.cloneNode(true);
        btnDelete.parentNode.replaceChild(newBtn, btnDelete);
        newBtn.addEventListener('click', () => {
            if (selectedObject) {
                objects = objects.filter(o => o.id !== selectedObject.id);
                selectedObject = null;
                saveHistory();
                drawPitch(objects);
            }
        });
    }

    // 背番号入力
    const elPlayerNumber = document.getElementById('canvas-player-number');
    if (elPlayerNumber) {
        const newEl = elPlayerNumber.cloneNode(true);
        elPlayerNumber.parentNode.replaceChild(newEl, elPlayerNumber);
        newEl.addEventListener('input', (e) => {
            if (selectedObject && selectedObject.type === 'player') {
                selectedObject.number = e.target.value;
                drawPitch(objects);
            }
        });
    }

    // カラーパレット
    const popoverColorDots = document.querySelectorAll('.color-dot');
    popoverColorDots.forEach(dot => {
        dot.onclick = (e) => {
            e.stopPropagation();
            const colorName = dot.dataset.color;
            let hexColor = '#f23932';
            if (colorName === 'blue') hexColor = '#3d79d5';
            else if (colorName === 'green') hexColor = '#63a84d';
            else if (colorName === 'orange') hexColor = '#f09f4d';

            if (selectedObject) {
                if (selectedObject.type === 'marker') {
                    if (colorName === 'orange') hexColor = '#f97316';
                    else if (colorName === 'blue') hexColor = '#3b82f6';
                    else if (colorName === 'red') hexColor = '#ef4444';
                    else if (colorName === 'green') hexColor = '#22c55e';
                    selectedObject.color = hexColor;
                } else if (selectedObject.type === 'player') {
                    selectedObject.color = hexColor;
                }
                saveHistory();
                drawPitch(objects);
            }
        };
    });

    // Undo / Redo / Clear
    const btnUndo = document.getElementById('tool-undo');
    if (btnUndo) {
        const newBtn = btnUndo.cloneNode(true);
        btnUndo.parentNode.replaceChild(newBtn, btnUndo);
        newBtn.addEventListener('click', undoHistory);
    }
    const btnRedo = document.getElementById('tool-redo');
    if (btnRedo) {
        const newBtn = btnRedo.cloneNode(true);
        btnRedo.parentNode.replaceChild(newBtn, btnRedo);
        newBtn.addEventListener('click', redoHistory);
    }
    const btnClear = document.getElementById('tool-clear');
    if (btnClear) {
        const newBtn = btnClear.cloneNode(true);
        btnClear.parentNode.replaceChild(newBtn, btnClear);
        newBtn.addEventListener('click', () => {
            stopAnimation();
            objects = [];
            frames = [];
            updateFrameCount();
            saveHistory();
            drawPitch(objects);
        });
    }

    // シーン操作＆再生
    const btnAddFrame = document.getElementById('anim-add-frame');
    if (btnAddFrame) {
        const newBtn = btnAddFrame.cloneNode(true);
        btnAddFrame.parentNode.replaceChild(newBtn, btnAddFrame);
        newBtn.addEventListener('click', addFrame);
    }
    const btnDeleteFrame = document.getElementById('anim-delete-frame');
    if (btnDeleteFrame) {
        const newBtn = btnDeleteFrame.cloneNode(true);
        btnDeleteFrame.parentNode.replaceChild(newBtn, btnDeleteFrame);
        newBtn.addEventListener('click', () => deleteFrame(currentFrameIndex));
    }
    const selectFrameEl = document.getElementById('anim-frame-select');
    if (selectFrameEl) {
        selectFrameEl.onchange = (e) => {
            const idx = parseInt(e.target.value, 10);
            if (idx >= 0) selectFrame(idx);
        };
    }
    const btnPrevFrame = document.getElementById('anim-prev-frame');
    if (btnPrevFrame) btnPrevFrame.onclick = () => { if (currentFrameIndex > 0) selectFrame(currentFrameIndex - 1); };
    const btnNextFrame = document.getElementById('anim-next-frame');
    if (btnNextFrame) btnNextFrame.onclick = () => { if (currentFrameIndex >= 0 && currentFrameIndex < frames.length - 1) selectFrame(currentFrameIndex + 1); };
    const btnEditFrameTitle = document.getElementById('anim-edit-frame-title');
    if (btnEditFrameTitle) btnEditFrameTitle.onclick = () => editFrameTitle();

    const btnPlay = document.getElementById('anim-play');
    if (btnPlay) {
        const newBtn = btnPlay.cloneNode(true);
        btnPlay.parentNode.replaceChild(newBtn, btnPlay);
        newBtn.addEventListener('click', playAnimation);
    }
    const btnStop = document.getElementById('anim-stop');
    if (btnStop) {
        const newBtn = btnStop.cloneNode(true);
        btnStop.parentNode.replaceChild(newBtn, btnStop);
        newBtn.addEventListener('click', stopAnimation);
    }
    const btnExportVideo = document.getElementById('anim-export-video');
    if (btnExportVideo) {
        const newBtn = btnExportVideo.cloneNode(true);
        btnExportVideo.parentNode.replaceChild(newBtn, btnExportVideo);
        newBtn.addEventListener('click', exportAnimationVideo);
    }

    initQuickDrawerEvents();

    // 保存ボタン
    const btnSave = document.getElementById('anim-save');
    if (btnSave) {
        btnSave.onclick = () => {
            const templateEl = document.getElementById('canvas-pitch-template');
            const pitchTemplateVal = templateEl ? templateEl.value : 'full';

            if (isFormationMode) {
                const match = state.matches.find(m => m.id === currentMatchId);
                if (match) {
                    const formObj = match.formations.find(f => f.id === currentFormationId);
                    if (formObj) {
                        formObj.boardData = JSON.parse(JSON.stringify(objects));
                        formObj.pitchTemplate = pitchTemplateVal;
                        isDirty = false;
                        if (window.saveData) window.saveData();
                        showToast('フォーメーションを保存しました');
                        if (typeof navigateFunc === 'function') navigateFunc('matches');
                    }
                }
            } else if (currentPracticeId && currentMenuId) {
                const practice = state.practices.find(p => p.id === currentPracticeId);
                if (practice) {
                    const menu = practice.menus.find(m => m.id === currentMenuId);
                    if (menu) {
                        if (frames.length === 0) {
                            frames.push({ objects: JSON.parse(JSON.stringify(objects)), title: '' });
                        } else {
                            if (Array.isArray(frames[currentFrameIndex])) {
                                frames[currentFrameIndex] = { objects: JSON.parse(JSON.stringify(objects)), title: '' };
                            } else {
                                frames[currentFrameIndex].objects = JSON.parse(JSON.stringify(objects));
                            }
                        }
                        menu.frames = JSON.parse(JSON.stringify(frames));
                        menu.pitchTemplate = pitchTemplateVal;
                        
                        // Sync drawing back to library menu if linked
                        if (menu.librarySourceId) {
                            const libMenu = state.menuLibrary.find(m => m.id === menu.librarySourceId);
                            if (libMenu) {
                                libMenu.frames = JSON.parse(JSON.stringify(frames));
                                libMenu.pitchTemplate = pitchTemplateVal;
                            }
                        }

                        isDirty = false;
                        if (window.saveData) window.saveData();
                        showToast('作図を保存しました');
                        if (typeof navigateFunc === 'function') navigateFunc('practices');
                    }
                }
            } else if (isLibraryMode) {
                const libMenu = state.menuLibrary.find(m => m.id === currentLibraryId);
                if (libMenu) {
                    if (frames.length === 0) {
                        frames.push({ objects: JSON.parse(JSON.stringify(objects)), title: '' });
                    } else {
                        if (Array.isArray(frames[currentFrameIndex])) {
                            frames[currentFrameIndex] = { objects: JSON.parse(JSON.stringify(objects)), title: '' };
                        } else {
                            frames[currentFrameIndex].objects = JSON.parse(JSON.stringify(objects));
                        }
                    }
                    libMenu.frames = JSON.parse(JSON.stringify(frames));
                    libMenu.pitchTemplate = pitchTemplateVal;
                    
                    // Sync drawing forward to all assigned practice menus
                    state.practices.forEach(p => {
                        if (p.menus) {
                            p.menus.forEach(pm => {
                                if (pm.librarySourceId === libMenu.id) {
                                    pm.frames = JSON.parse(JSON.stringify(frames));
                                    pm.pitchTemplate = pitchTemplateVal;
                                }
                            });
                        }
                    });

                    isDirty = false;
                    if (window.saveData) window.saveData();
                    showToast('作図を保存しました');
                    if (typeof navigateFunc === 'function') navigateFunc('library');
                }
            } else if (isTacticsMode) {
                const tactic = state.tactics ? state.tactics.find(t => String(t.id) === String(currentTacticId)) : null;
                if (tactic) {
                    if (frames.length === 0) {
                        frames.push({ objects: JSON.parse(JSON.stringify(objects)), title: '' });
                    } else {
                        if (Array.isArray(frames[currentFrameIndex])) {
                            frames[currentFrameIndex] = { objects: JSON.parse(JSON.stringify(objects)), title: '' };
                        } else {
                            frames[currentFrameIndex].objects = JSON.parse(JSON.stringify(objects));
                        }
                    }
                    tactic.frames = JSON.parse(JSON.stringify(frames));
                    tactic.pitchTemplate = pitchTemplateVal;
                    isDirty = false;
                    if (window.saveData) window.saveData();
                    showToast('戦術の作図を保存しました');
                    if (typeof navigateFunc === 'function') navigateFunc('tactics');
                }
            }
        };
    }

    const btnBack = document.getElementById('anim-back');
    if (btnBack) {
        btnBack.onclick = async () => {
            if (isDirty) {
                const proceed = await showCustomConfirm('変更内容が保存されていません。編集を破棄して戻りますか？', '未保存の変更', { okText: '戻る', type: 'danger' });
                if (!proceed) {
                    return;
                }
            }
            if (isFormationMode) {
                if (typeof navigateFunc === 'function') navigateFunc('matches');
            } else if (isLibraryMode) {
                if (typeof navigateFunc === 'function') navigateFunc('library');
            } else if (isTacticsMode) {
                if (typeof navigateFunc === 'function') navigateFunc('tactics');
            } else {
                if (typeof navigateFunc === 'function') navigateFunc('practices');
            }
        };
    }

    const handleMouseDown = (e) => {
        if (isPlaying) return;
        const pos = getCanvasPos(e);
        let x = pos.x;
        let y = pos.y;

        if (currentTool === 'select') {
            const prevSelected = selectedObject;
            selectedObject = null;
            isResizing = false;
            resizeHandle = null;

            if (prevSelected) {
                if (prevSelected.type === 'minigoal') {
                    const scale = prevSelected.goalScale || 1.0;
                    const selR = (prevSelected.radius || 15) * scale + 6;
                    const s = 18;
                    if (Math.abs(x - (prevSelected.x - selR)) <= s && Math.abs(y - prevSelected.y) <= s) { isResizing = true; resizeHandle = 'goal-w'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - (prevSelected.x + selR)) <= s && Math.abs(y - prevSelected.y) <= s) { isResizing = true; resizeHandle = 'goal-e'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x) <= s && Math.abs(y - (prevSelected.y - selR)) <= s) { isResizing = true; resizeHandle = 'goal-n'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x) <= s && Math.abs(y - (prevSelected.y + selR)) <= s) { isResizing = true; resizeHandle = 'goal-s'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                } else if (prevSelected.type === 'vision') {
                    const vAngleRad = ((prevSelected.angle || 0) * Math.PI) / 180;
                    const vR = prevSelected.radius || 60;
                    const vHalfFov = ((prevSelected.fov || 60) / 2) * (Math.PI / 180);
                    const s = 18;

                    const rHx = prevSelected.x + vR * Math.sin(vAngleRad);
                    const rHy = prevSelected.y - vR * Math.cos(vAngleRad);
                    if (Math.abs(x - rHx) <= s && Math.abs(y - rHy) <= s) {
                        isResizing = true; resizeHandle = 'vision-radius';
                        draggedObject = prevSelected; selectedObject = prevSelected;
                        drawPitch(objects); return;
                    }

                    const fovLx = prevSelected.x + vR * Math.sin(vAngleRad - vHalfFov) * 0.7;
                    const fovLy = prevSelected.y - vR * Math.cos(vAngleRad - vHalfFov) * 0.7;
                    const fovRx = prevSelected.x + vR * Math.sin(vAngleRad + vHalfFov) * 0.7;
                    const fovRy = prevSelected.y - vR * Math.cos(vAngleRad + vHalfFov) * 0.7;
                    if (Math.abs(x - fovLx) <= s && Math.abs(y - fovLy) <= s) {
                        isResizing = true; resizeHandle = 'vision-fov-left';
                        draggedObject = prevSelected; selectedObject = prevSelected;
                        drawPitch(objects); return;
                    }
                    if (Math.abs(x - fovRx) <= s && Math.abs(y - fovRy) <= s) {
                        isResizing = true; resizeHandle = 'vision-fov-right';
                        draggedObject = prevSelected; selectedObject = prevSelected;
                        drawPitch(objects); return;
                    }
                } else if (prevSelected.type === 'rect' || prevSelected.type === 'circle') {
                    const s = 18;
                    if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'nw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'ne'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'sw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'se'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                } else if (prevSelected.type === 'line' || prevSelected.type === 'ladder') {
                    const s = 18;
                    if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y1) <= s) {
                        isResizing = true;
                        resizeHandle = 'pt1';
                        draggedObject = prevSelected;
                        selectedObject = prevSelected;
                        drawPitch(objects);
                        return;
                    }
                    if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y2) <= s) {
                        isResizing = true;
                        resizeHandle = 'pt2';
                        draggedObject = prevSelected;
                        selectedObject = prevSelected;
                        drawPitch(objects);
                        return;
                    }
                    if (prevSelected.type === 'line') {
                        const cx = typeof prevSelected.cx !== 'undefined' ? prevSelected.cx : (prevSelected.x1 + prevSelected.x2) / 2;
                        const cy = typeof prevSelected.cy !== 'undefined' ? prevSelected.cy : (prevSelected.y1 + prevSelected.y2) / 2;
                        if (Math.abs(x - cx) <= s && Math.abs(y - cy) <= s) {
                            isResizing = true;
                            resizeHandle = 'line-curve';
                            draggedObject = prevSelected;
                            selectedObject = prevSelected;
                            drawPitch(objects);
                            return;
                        }
                    }
                }
            }

            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                if (obj.type === 'line') {
                    let minDist = Infinity;
                    const cx = typeof obj.cx !== 'undefined' ? obj.cx : (obj.x1 + obj.x2) / 2;
                    const cy = typeof obj.cy !== 'undefined' ? obj.cy : (obj.y1 + obj.y2) / 2;
                    for (let t = 0; t <= 1; t += 0.1) {
                        const px = (1 - t) * (1 - t) * obj.x1 + 2 * (1 - t) * t * cx + t * t * obj.x2;
                        const py = (1 - t) * (1 - t) * obj.y1 + 2 * (1 - t) * t * cy + t * t * obj.y2;
                        const dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
                        if (dist < minDist) minDist = dist;
                    }
                    if (minDist <= 12) {
                        draggedObject = obj;
                        selectedObject = obj;
                        startX = x; startY = y;
                        break;
                    }
                } else if (obj.type === 'ladder') {
                    const A = x - obj.x1;
                    const B = y - obj.y1;
                    const C = obj.x2 - obj.x1;
                    const D = obj.y2 - obj.y1;
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    if (lenSq !== 0) param = dot / lenSq;
                    let xx, yy;
                    if (param < 0) { xx = obj.x1; yy = obj.y1; }
                    else if (param > 1) { xx = obj.x2; yy = obj.y2; }
                    else { xx = obj.x1 + param * C; yy = obj.y1 + param * D; }
                    const dx = x - xx;
                    const dy = y - yy;
                    if (Math.sqrt(dx * dx + dy * dy) <= 12) {
                        draggedObject = obj;
                        selectedObject = obj;
                        startX = x; startY = y;
                        break;
                    }
                } else if (obj.type === 'rect' || obj.type === 'circle') {
                    const mx1 = Math.min(obj.x1, obj.x2);
                    const mx2 = Math.max(obj.x1, obj.x2);
                    const my1 = Math.min(obj.y1, obj.y2);
                    const my2 = Math.max(obj.y1, obj.y2);
                    if (x >= mx1 && x <= mx2 && y >= my1 && y <= my2) {
                        draggedObject = obj;
                        selectedObject = obj;
                        startX = x; startY = y;
                        break;
                    }
                } else {
                    const dx = x - obj.x;
                    const dy = y - obj.y;
                    let isHit = false;
                    if (obj.type === 'text') {
                        ctx.font = 'bold 14px Inter, sans-serif';
                        const tw = ctx.measureText(obj.text || '').width;
                        isHit = Math.abs(dx) <= tw / 2 + 5 && Math.abs(dy) <= 15;
                    } else if (obj.type === 'vision') {
                        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                        if (distFromCenter <= 20) {
                            isHit = true;
                        } else if (distFromCenter <= (obj.radius || 60) + 5) {
                            const vAngleRad = ((obj.angle || 0) * Math.PI) / 180;
                            const clickAngle = Math.atan2(dx, -dy);
                            let diffAngle = clickAngle - vAngleRad;
                            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
                            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                            const halfFovRad = ((obj.fov || 60) / 2) * (Math.PI / 180);
                            isHit = Math.abs(diffAngle) <= halfFovRad;
                        }
                    } else if (obj.type === 'minigoal') {
                        const scale = obj.goalScale || 1.0;
                        const gw = 30 * scale;
                        const gh = 15 * scale;
                        isHit = Math.abs(dx) <= (gw / 2 + 10) && Math.abs(dy) <= (gh / 2 + 10);
                    } else {
                        isHit = Math.sqrt(dx * dx + dy * dy) <= ((obj.radius || 15) + 5);
                    }

                    if (isHit) {
                        draggedObject = obj;
                        selectedObject = obj;
                        startX = x; startY = y;
                        break;
                    }
                }
            }
            drawPitch(objects);
        } else if (currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
            isDrawing = true;
            startX = applyGridSnap(x);
            startY = applyGridSnap(y);
        } else {
            selectedObject = null;
            x = applyGridSnap(x);
            y = applyGridSnap(y);

            let color, radius, type, number = '';
            if (currentTool === 'player') {
                color = '#f23932'; radius = 14; type = 'player';
                const elNum = document.getElementById('canvas-player-number');
                if (elNum) number = elNum.value || '';
            }
            if (currentTool === 'ball') { color = '#ffffff'; radius = 8; type = 'ball'; }
            if (currentTool === 'marker') { color = '#f97316'; radius = 8; type = 'marker'; }
            if (currentTool === 'cone') { color = '#facc15'; radius = 10; type = 'cone'; }
            if (currentTool === 'minigoal') { color = '#ffffff'; radius = 15; type = 'minigoal'; }
            if (currentTool === 'vision') { color = '#38bdf8'; radius = 60; type = 'vision'; }
            if (currentTool === 'text') { color = '#000000'; radius = 0; type = 'text'; }

            if (type) {
                const newObj = { id: objectIdCounter++, type, x, y, radius, color, number };
                if (type === 'minigoal') {
                    newObj.sizeCategory = 'medium';
                    newObj.goalScale = 1.0;
                }
                if (type === 'text') {
                    const modal = document.getElementById('modal-text-input');
                    const input = document.getElementById('canvas-text-value');
                    if (modal && input) {
                        input.value = '';
                        modal.classList.remove('hidden');
                        input.focus();

                        const form = document.getElementById('form-text-input');
                        form.onsubmit = (ev) => {
                            ev.preventDefault();
                            if (input.value) {
                                newObj.text = input.value;
                                objects.push(newObj);
                                selectedObject = newObj;
                                currentTool = 'select';
                                updateToolDockActive();
                                saveHistory();
                                drawPitch(objects);
                                updateContextPopover();
                            }
                            modal.classList.add('hidden');
                        };
                        return;
                    }
                }

                objects.push(newObj);
                selectedObject = newObj;
                currentTool = 'select';
                updateToolDockActive();
                saveHistory();
                drawPitch(objects);

                if (type === 'player') {
                    const elNum = document.getElementById('canvas-player-number');
                    if (elNum) {
                        let n = parseInt(elNum.value, 10);
                        if (!isNaN(n)) elNum.value = n + 1;
                    }
                }
            }
        }
    };

    const handleMouseMove = (e) => {
        if (isPlaying) return;
        const pos = getCanvasPos(e);
        const x = pos.x;
        const y = pos.y;

        if (draggedObject) {
            if (isResizing && draggedObject.type === 'vision') {
                const dx = x - draggedObject.x;
                const dy = y - draggedObject.y;
                if (resizeHandle === 'vision-radius') {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    draggedObject.radius = Math.max(20, Math.min(300, Math.round(dist)));
                } else if (resizeHandle === 'vision-fov-left' || resizeHandle === 'vision-fov-right') {
                    const vAngleRad = ((draggedObject.angle || 0) * Math.PI) / 180;
                    const forwardX = Math.sin(vAngleRad);
                    const forwardY = -Math.cos(vAngleRad);
                    const dragAngle = Math.atan2(dx, -dy);
                    const forwardAngle = Math.atan2(forwardX, forwardY);
                    let diffDeg = Math.abs((dragAngle - forwardAngle) * (180 / Math.PI));
                    if (diffDeg > 180) diffDeg = 360 - diffDeg;
                    draggedObject.fov = Math.max(10, Math.min(270, Math.round(diffDeg * 2)));
                }
            } else if (isResizing && draggedObject.type === 'minigoal') {
                const dist = Math.sqrt(Math.pow(x - draggedObject.x, 2) + Math.pow(y - draggedObject.y, 2));
                const newScale = Math.max(0.4, Math.min(3.5, dist / 21));
                draggedObject.goalScale = parseFloat(newScale.toFixed(2));
            } else if (isResizing && (draggedObject.type === 'rect' || draggedObject.type === 'circle')) {
                if (resizeHandle === 'nw') { draggedObject.x1 = applyGridSnap(x); draggedObject.y1 = applyGridSnap(y); }
                if (resizeHandle === 'ne') { draggedObject.x2 = applyGridSnap(x); draggedObject.y1 = applyGridSnap(y); }
                if (resizeHandle === 'sw') { draggedObject.x1 = applyGridSnap(x); draggedObject.y2 = applyGridSnap(y); }
                if (resizeHandle === 'se') { draggedObject.x2 = applyGridSnap(x); draggedObject.y2 = applyGridSnap(y); }
            } else if (isResizing && (draggedObject.type === 'line' || draggedObject.type === 'ladder')) {
                const snapX = applyGridSnap(x);
                const snapY = applyGridSnap(y);
                if (resizeHandle === 'pt1') {
                    const dx = snapX - draggedObject.x1;
                    const dy = snapY - draggedObject.y1;
                    draggedObject.x1 = snapX;
                    draggedObject.y1 = snapY;
                    if (draggedObject.type === 'line' && typeof draggedObject.cx !== 'undefined') {
                        draggedObject.cx += dx / 2;
                        draggedObject.cy += dy / 2;
                    }
                } else if (resizeHandle === 'pt2') {
                    const dx = snapX - draggedObject.x2;
                    const dy = snapY - draggedObject.y2;
                    draggedObject.x2 = snapX;
                    draggedObject.y2 = snapY;
                    if (draggedObject.type === 'line' && typeof draggedObject.cx !== 'undefined') {
                        draggedObject.cx += dx / 2;
                        draggedObject.cy += dy / 2;
                    }
                } else if (resizeHandle === 'line-curve') {
                    draggedObject.cx = snapX;
                    draggedObject.cy = snapY;
                }
            } else if (draggedObject.type === 'rect' || draggedObject.type === 'circle') {
                const dx = applyGridSnap(x) - applyGridSnap(startX);
                const dy = applyGridSnap(y) - applyGridSnap(startY);
                draggedObject.x1 += dx; draggedObject.x2 += dx;
                draggedObject.y1 += dy; draggedObject.y2 += dy;
                startX = x; startY = y;
            } else if (draggedObject.type === 'line' || draggedObject.type === 'ladder') {
                const dx = applyGridSnap(x) - applyGridSnap(startX);
                const dy = applyGridSnap(y) - applyGridSnap(startY);
                draggedObject.x1 += dx; draggedObject.x2 += dx;
                draggedObject.y1 += dy; draggedObject.y2 += dy;
                if (draggedObject.type === 'line' && typeof draggedObject.cx !== 'undefined') {
                    draggedObject.cx += dx;
                    draggedObject.cy += dy;
                }
                startX = x; startY = y;
            } else {
                const snapped = applySmartMagnetSnap(draggedObject, applyGridSnap(x), applyGridSnap(y));
                draggedObject.x = snapped.x;
                draggedObject.y = snapped.y;
            }
            drawPitch(objects);
        } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
            drawPitch(objects);
            if (currentTool === 'ladder') {
                drawLadder(startX, startY, applyGridSnap(x), applyGridSnap(y));
            } else if (currentTool === 'line-rect') {
                drawRectPreview(startX, startY, applyGridSnap(x), applyGridSnap(y));
            } else if (currentTool === 'line-circle') {
                drawCirclePreview(startX, startY, applyGridSnap(x), applyGridSnap(y));
            } else {
                const lType = currentTool.replace('line-', '');
                drawArrow(startX, startY, applyGridSnap(x), applyGridSnap(y), lType);
            }
        }
    };

    const handleMouseUp = (e) => {
        if (isPlaying) return;
        if (draggedObject) {
            saveHistory();
            draggedObject = null;
            isResizing = false;
            resizeHandle = null;
            activeSnapLines = { v: null, h: null };
            drawPitch(objects);
        } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
            const pos = getCanvasPos(e);
            const x = applyGridSnap(pos.x);
            const y = applyGridSnap(pos.y);
            if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
                let newObj = null;
                if (currentTool === 'ladder') {
                    newObj = { id: objectIdCounter++, type: 'ladder', x1: startX, y1: startY, x2: x, y2: y };
                } else if (currentTool === 'line-rect') {
                    newObj = { id: objectIdCounter++, type: 'rect', x1: startX, y1: startY, x2: x, y2: y };
                } else if (currentTool === 'line-circle') {
                    newObj = { id: objectIdCounter++, type: 'circle', x1: startX, y1: startY, x2: x, y2: y };
                } else {
                    const lType = currentTool.replace('line-', '');
                    newObj = {
                        id: objectIdCounter++,
                        type: 'line',
                        lineType: lType,
                        x1: startX,
                        y1: startY,
                        x2: x,
                        y2: y,
                        cx: (startX + x) / 2,
                        cy: (startY + y) / 2
                    };
                }
                if (newObj) {
                    objects.push(newObj);
                    selectedObject = newObj;
                }
                saveHistory();
            }
            isDrawing = false;
            currentTool = 'select';
            updateToolDockActive();
            drawPitch(objects);
            updateContextPopover();
        }
    };

    const handleDoubleClick = (e) => {
        if (isPlaying) return;
        const pos = getCanvasPos(e);
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            if (obj.type === 'text') {
                const dx = pos.x - obj.x;
                const dy = pos.y - obj.y;
                ctx.font = 'bold 14px Inter, sans-serif';
                const tw = ctx.measureText(obj.text || '').width;
                if (Math.abs(dx) <= tw / 2 + 10 && Math.abs(dy) <= 15) {
                    const modal = document.getElementById('modal-text-input');
                    const input = document.getElementById('canvas-text-value');
                    if (modal && input) {
                        input.value = obj.text || '';
                        modal.classList.remove('hidden');
                        input.focus();

                        const form = document.getElementById('form-text-input');
                        form.onsubmit = (ev) => {
                            ev.preventDefault();
                            if (input.value) {
                                obj.text = input.value;
                                saveHistory();
                                drawPitch(objects);
                            }
                            modal.classList.add('hidden');
                        };
                    }
                    break;
                }
            }
        }
    };

    registerListener('drawing.canvas', canvas, 'mousedown', handleMouseDown);
    registerListener('drawing.canvas', canvas, 'mousemove', handleMouseMove);
    registerListener('drawing.canvas', canvas, 'mouseup', handleMouseUp);
    registerListener('drawing.canvas', canvas, 'dblclick', handleDoubleClick);

    // タッチデバイス（スマホ・タブレット）対応
    function getTouchPos(touchEvent) {
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
    }

    const handleTouchStart = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseDown({ clientX: pos.clientX, clientY: pos.clientY, button: 0 });
    };
    const handleTouchMove = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseMove({ clientX: pos.clientX, clientY: pos.clientY });
    };
    const handleTouchEnd = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseUp({ clientX: pos.clientX, clientY: pos.clientY });
    };

    registerListener('drawing.canvas', canvas, 'touchstart', handleTouchStart, { passive: false });
    registerListener('drawing.canvas', canvas, 'touchmove', handleTouchMove, { passive: false });
    registerListener('drawing.canvas', canvas, 'touchend', handleTouchEnd, { passive: false });
}