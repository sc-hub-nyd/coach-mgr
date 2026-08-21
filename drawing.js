import { state } from './state.js';
import { showToast, showCustomConfirm, escapeHtml } from './utils.js';
import { getFormationPlayerList } from './formation-defs.js';
import { registerListener, cleanupScope } from './event-manager.js';
import { tacticsStore } from './store.js';
import { commandStack, SetObjectsCommand } from './command-stack.js';
import { drawPitchToCtx, drawArrowToCtx, drawLadderToCtx } from './pitch-renderer.js';
import { getCanvasPalette, getCanvasSwatchColor, getCanvasSwatchName, resolveCanvasObjectColor, resolveCanvasOutline } from './canvas-palette.js';
export { drawPitchToCtx };

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
let animationBackHandler = null;

export async function requestAnimationBack() {
    if (typeof animationBackHandler !== 'function') return false;
    return animationBackHandler();
}

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
    const dockBtns = document.querySelectorAll('.c-tool-dock .c-tool-dock__button, .canvas-toolbar .tool-btn');
    dockBtns.forEach(btn => {
        if (!btn.dataset.tool) return;
        const isActive = btn.dataset.tool === currentTool;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
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
                <div class="c-frame-strip__item c-data-list__item ${idx === currentFrameIndex ? 'active' : ''}" data-frame-index="${idx}" draggable="true">
                    <div class="c-frame-strip__header c-data-list__header">
                        <span class="c-frame-strip__index">S${idx + 1}</span>
                        <div class="c-frame-strip__meta c-action-group">
                            ${pauseVal > 0 ? `<span class="c-status c-status--compact c-status--info" title="停止時間 ${pauseVal}秒"><i class="ti ti-clock" aria-hidden="true"></i> ${pauseVal}s</span>` : ''}
                            ${captionStr ? `<span class="c-status c-status--compact c-status--muted" title="${escapeHtml(captionStr)}"><i class="ti ti-message-circle" aria-hidden="true"></i><span class="u-visually-hidden">キャプションあり</span></span>` : ''}
                        </div>
                    </div>
                    <div class="c-frame-strip__title c-data-list__body">${escapeHtml(titleStr)}</div>
                    <div class="c-frame-strip__actions c-action-group"><button type="button" class="c-button btn c-button--danger btn-danger c-frame-strip__delete" data-idx="${idx}" title="削除" aria-label="${escapeHtml(titleStr)}を削除"><i class="ti ti-x" aria-hidden="true"></i></button></div>
                </div>
            `;
        }).join('');

        const cards = filmstripContainer.querySelectorAll('.c-frame-strip__item');
        cards.forEach(card => {
            const delBtn = card.querySelector('.c-frame-strip__delete');
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
                if (idx >= 0) {
                    currentFrameIndex = idx;
                    editFrameTitle();
                }
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
    showToast(`シーン ${insertIdx + 1} を追加しました`);
}

export function openQuickDrawer(index) {
    editFrameTitle();
}

export function closeQuickDrawer() {
    const modal = document.getElementById('modal-scene-title');
    if (modal) modal.classList.add('hidden');
}

function initQuickDrawerEvents() {
    // Legacy drawer compatibility no-op
}

function editFrameTitle() {
    if (frames.length === 0) {
        frames = [{ objects: JSON.parse(JSON.stringify(objects)), title: '', caption: '', pauseDuration: 0 }];
        currentFrameIndex = 0;
    }
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        currentFrameIndex = Math.max(0, frames.length - 1);
    }
    const f = frames[currentFrameIndex];
    const currentTitle = (f && typeof f === 'object' && !Array.isArray(f) && f.title) ? f.title : '';
    const currentCaption = (f && typeof f === 'object' && !Array.isArray(f) && f.caption) ? f.caption : '';
    const currentPause = (f && typeof f === 'object' && !Array.isArray(f)) ? (Number(f.pauseDuration) || 0) : 0;

    // Mobile: Show scene detail popover in the lower panel
    const mobilePopover = document.getElementById('anim-scene-detail-popover');
    const mobileMenuDetails = document.getElementById('anim-mobile-menu-details');
    const inputMobileTitle = document.getElementById('input-mobile-scene-title');
    const inputMobilePause = document.getElementById('input-mobile-scene-pause');
    const inputMobileCaption = document.getElementById('input-mobile-scene-caption');
    const headingMobile = document.getElementById('mobile-scene-detail-heading');
    const btnSaveMobile = document.getElementById('btn-save-mobile-scene-detail');
    const btnCloseMobile = document.getElementById('btn-close-mobile-scene-detail');

    if (window.innerWidth <= 768 && mobilePopover) {
        if (headingMobile) headingMobile.innerHTML = `<i class="ti ti-movie"></i> シーン ${currentFrameIndex + 1} の詳細`;
        if (inputMobileTitle) inputMobileTitle.value = currentTitle;
        if (inputMobilePause) inputMobilePause.value = String(currentPause);
        if (inputMobileCaption) inputMobileCaption.value = currentCaption;

        if (mobileMenuDetails) mobileMenuDetails.classList.add('hidden');
        mobilePopover.classList.remove('hidden');

        if (btnSaveMobile) {
            btnSaveMobile.onclick = () => {
                const trimmed = inputMobileTitle ? inputMobileTitle.value.trim() : '';
                const captionVal = inputMobileCaption ? inputMobileCaption.value.trim() : '';
                const pauseVal = inputMobilePause ? (parseInt(inputMobilePause.value, 10) || 0) : 0;

                if (Array.isArray(f)) {
                    frames[currentFrameIndex] = { objects: f, title: trimmed, caption: captionVal, pauseDuration: pauseVal };
                } else if (typeof f === 'object' && f !== null) {
                    f.title = trimmed;
                    f.caption = captionVal;
                    f.pauseDuration = pauseVal;
                } else {
                    frames[currentFrameIndex] = { objects: [], title: trimmed, caption: captionVal, pauseDuration: pauseVal };
                }
                isDirty = true;
                updateFrameCount();
                showToast(`シーン ${currentFrameIndex + 1} の設定を保存しました`);
                mobilePopover.classList.add('hidden');
                if (mobileMenuDetails) mobileMenuDetails.classList.remove('hidden');
            };
        }

        if (btnCloseMobile) {
            btnCloseMobile.onclick = () => {
                mobilePopover.classList.add('hidden');
                if (mobileMenuDetails) mobileMenuDetails.classList.remove('hidden');
            };
        }
        return;
    }

    const modal = document.getElementById('modal-scene-title');
    const input = document.getElementById('input-scene-title');
    const captionInput = document.getElementById('input-scene-caption');
    const pauseSelect = document.getElementById('input-scene-pause');
    const form = document.getElementById('form-scene-title');
    const heading = document.getElementById('scene-title-modal-heading');

    if (modal && input && form) {
        if (heading) heading.textContent = `シーン ${currentFrameIndex + 1} の設定`;
        input.value = currentTitle;
        if (captionInput) captionInput.value = currentCaption;
        if (pauseSelect) pauseSelect.value = String(currentPause);
        modal.classList.remove('hidden');

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

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
            isDirty = true;
            updateFrameCount();
            showToast(`シーン ${currentFrameIndex + 1} の設定を保存しました`);
            modal.classList.add('hidden');
        };

        const cancelBtns = modal.querySelectorAll('.btn-close-modal');
        cancelBtns.forEach(btn => {
            btn.onclick = () => {
                modal.classList.add('hidden');
            };
        });

        const presetChips = modal.querySelectorAll('.c-drawer__preset-chip');
        presetChips.forEach(chip => {
            chip.onclick = () => {
                if (captionInput) {
                    captionInput.value = chip.textContent;
                    if (pauseSelect && pauseSelect.value === '0') {
                        pauseSelect.value = '2';
                    }
                }
            };
        });
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

function showCaptionBar(title, text) {
    const bar = document.getElementById('anim-caption-bar');
    const titleSpan = document.getElementById('anim-caption-title');
    const textSpan = document.getElementById('anim-caption-text');
    if (!bar) return;

    const hasTitle = Boolean(title && title.trim());
    const hasText = Boolean(text && text.trim());

    if (hasTitle || hasText) {
        if (titleSpan) {
            titleSpan.textContent = hasTitle ? title.trim() : '';
            titleSpan.style.display = hasTitle ? 'inline-block' : 'none';
        }
        if (textSpan) {
            textSpan.textContent = hasText ? text.trim() : '';
            textSpan.style.display = hasText ? 'inline' : 'none';
        }
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
        showToast('⚠️ アニメーションを作成するには、少なくとも2つのシーンを記録してください。', { type: 'warning' });
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
        const rawTitle = (typeof rawFrame === 'object' && rawFrame && rawFrame.title) ? rawFrame.title.trim() : '';
        const captionText = getFrameCaptionText(rawFrame);
        const hasCustomTitle = Boolean(rawTitle && rawTitle !== `シーン ${idx + 1}` && rawTitle !== `シーン${idx + 1}`);
        const hasCaption = Boolean(captionText && captionText.trim().length > 0);

        let titleForDisplay = '';
        if (hasCustomTitle) {
            titleForDisplay = `【${rawTitle}】`;
        } else if (hasCaption) {
            titleForDisplay = `【S${idx + 1}】`;
        }

        showCaptionBar(titleForDisplay, captionText);
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
    const pitchBgCanvas = document.getElementById('pitch-bg-canvas');
    if (!pitchCanvas) {
        showToast('キャンバスが見つかりません', { type: 'error' });
        return;
    }
    
    if (frames.length < 2) {
        showToast('⚠️ 動画を書き出すには、少なくとも2つのシーンを記録してください。', { type: 'warning' });
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

    showToast('📹 動画ファイルを作成中...（完了まで数秒お待ちください）');

    try {
        const recCanvas = document.createElement('canvas');
        recCanvas.width = 800;
        recCanvas.height = 500;
        const recCtx = recCanvas.getContext('2d');

        const stream = recCanvas.captureStream(30);
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
                showToast('動画の書き出しに失敗しました。もう一度お試しください。', { type: 'error' });
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
        let recPauseUntil = 0;
        let recFrameStartTime = null;

        function getFramePause(idx) {
            return getFramePauseSec(frames[idx]);
        }
        function getFrameCaption(idx) {
            return getFrameCaptionText(frames[idx]);
        }
        function getFrameDisplayTitle(idx) {
            const rawF = frames[idx];
            const rawTitle = (typeof rawF === 'object' && rawF && rawF.title) ? rawF.title.trim() : '';
            const cap = getFrameCaption(idx);
            const hasCustom = Boolean(rawTitle && rawTitle !== `シーン ${idx + 1}` && rawTitle !== `シーン${idx + 1}`);
            if (hasCustom) return `【${rawTitle}】`;
            if (cap && cap.trim().length > 0) return `【S${idx + 1}】`;
            return '';
        }

        function renderRecordFrame(frameObjs, idx) {
            recCtx.clearRect(0, 0, 800, 500);
            const palette = getCanvasPalette(pitchCanvas);

            // 1. 静的ピッチ背景を描画 (緑の芝生と白線)
            if (pitchBgCanvas && pitchBgCanvas.width > 0) {
                recCtx.drawImage(pitchBgCanvas, 0, 0, 800, 500);
            } else {
                recCtx.fillStyle = palette.pitchSurface;
                recCtx.fillRect(0, 0, 800, 500);
            }

            // 2. 動的オブジェクト（選手、ボール、矢印等）を描画
            drawPitch(frameObjs);
            recCtx.drawImage(pitchCanvas, 0, 0, 800, 500);

            // 3. シーン見出し・テロップのオーバーレイバナーを録画フレーム上に描画
            const titleText = getFrameDisplayTitle(idx);
            const captionText = getFrameCaption(idx);
            const hasTitle = Boolean(titleText && titleText.trim());
            const hasCap = Boolean(captionText && captionText.trim());

            if (hasTitle || hasCap) {
                recCtx.save();
                const bannerH = 34;

                recCtx.fillStyle = palette.overlaySurface;
                recCtx.fillRect(0, 0, 800, bannerH);
                recCtx.strokeStyle = palette.overlayBorder;
                recCtx.lineWidth = 1;
                recCtx.beginPath();
                recCtx.moveTo(0, bannerH);
                recCtx.lineTo(800, bannerH);
                recCtx.stroke();

                recCtx.textBaseline = 'middle';

                if (hasTitle && hasCap) {
                    recCtx.font = "bold 14px sans-serif";
                    const titleW = recCtx.measureText(titleText + ' ').width;
                    const capW = recCtx.measureText(captionText).width;
                    const startX = 400 - (titleW + capW) / 2;

                    recCtx.textAlign = 'left';
                    recCtx.fillStyle = palette.objectCone;
                    recCtx.fillText(titleText, startX, bannerH / 2);

                    recCtx.fillStyle = palette.overlayText;
                    recCtx.fillText(captionText, startX + titleW, bannerH / 2);
                } else if (hasTitle) {
                    recCtx.textAlign = 'center';
                    recCtx.font = "bold 14px sans-serif";
                    recCtx.fillStyle = palette.objectCone;
                    recCtx.fillText(titleText, 400, bannerH / 2);
                } else {
                    recCtx.textAlign = 'center';
                    recCtx.font = "bold 14px sans-serif";
                    recCtx.fillStyle = palette.overlayText;
                    recCtx.fillText(captionText, 400, bannerH / 2);
                }
                recCtx.restore();
            }
        }

        function recordLoop(timestamp) {
            if (!isRecording) return;
            if (!startTime) { 
                startTime = timestamp; 
                recFrameStartTime = timestamp; 
                const initPause = getFramePause(0);
                const rawF = frames[0];
                const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                renderRecordFrame(pauseObjs, 0);

                if (initPause > 0) {
                    recPauseUntil = timestamp + initPause * 1000;
                    requestAnimationFrame(recordLoop);
                    return;
                }
            }

            // Handle pause at frame
            if (recPauseUntil > 0 && timestamp < recPauseUntil) {
                const rawF = frames[recFrameIdx];
                const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                renderRecordFrame(pauseObjs, recFrameIdx);
                requestAnimationFrame(recordLoop);
                return;
            }
            if (recPauseUntil > 0) {
                recPauseUntil = 0;
                recFrameStartTime = timestamp;
            }

            if (hasMultiFrames) {
                const frameElapsed = timestamp - recFrameStartTime;
                let progress = frameElapsed / durationPerFrame;

                if (progress >= 1) {
                    recFrameIdx++;
                    if (recFrameIdx >= frames.length - 1) {
                        const lastRaw = frames[frames.length - 1];
                        const lastObjs = Array.isArray(lastRaw) ? lastRaw : ((lastRaw && lastRaw.objects) || []);
                        renderRecordFrame(lastObjs, frames.length - 1);

                        isRecording = false;
                        try {
                            if (mediaRecorder.state !== 'inactive') {
                                mediaRecorder.requestData();
                                setTimeout(() => mediaRecorder.stop(), 150);
                            }
                        } catch (err) { mediaRecorder.stop(); }
                        return;
                    }

                    const pauseSec = getFramePause(recFrameIdx);
                    if (pauseSec > 0) {
                        recPauseUntil = timestamp + pauseSec * 1000;
                        const rawF = frames[recFrameIdx];
                        const pauseObjs = Array.isArray(rawF) ? rawF : ((rawF && rawF.objects) || []);
                        renderRecordFrame(pauseObjs, recFrameIdx);
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

                renderRecordFrame(interpolatedObjects, recFrameIdx);
            } else {
                renderRecordFrame(objects, 0);
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
    ctx.strokeStyle = getCanvasPalette().pitchGuideStrong;
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
    ctx.fillStyle = getCanvasPalette().selectionFill;
    ctx.fill();
    ctx.strokeStyle = getCanvasPalette().selectionStroke;
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

    drawPitchToCtx([], bgCanvas, bgCtx, template, null);
}

let activeSnapLines = { v: null, h: null };

export function drawTrajectoryTrailOnUI() {
    if (!selectedObject || !frames || frames.length <= 1 || !uiCtx) return;

    const matches = new Array(frames.length).fill(null);
    if (currentFrameIndex >= 0 && currentFrameIndex < frames.length) {
        matches[currentFrameIndex] = selectedObject;
    }

    function findBestMatch(frameObjs, target) {
        if (!target) return null;
        let match = null;
        if (target.id) {
            match = frameObjs.find(o => o && o.id === target.id);
        }
        if (!match && typeof target.number !== 'undefined' && target.number !== '') {
            match = frameObjs.find(o => o && o.type === target.type && o.number === target.number);
        }
        if (!match) {
            const tx = typeof target.x !== 'undefined' ? target.x : target.x1;
            const ty = typeof target.y !== 'undefined' ? target.y : target.y1;
            if (typeof tx === 'undefined' || typeof ty === 'undefined') return null;
            
            let minDist = Infinity;
            frameObjs.forEach(o => {
                if (!o || o.type !== target.type) return;
                const tNum = target.number || '';
                const oNum = o.number || '';
                if (tNum !== oNum) return;
                
                const ox = typeof o.x !== 'undefined' ? o.x : o.x1;
                const oy = typeof o.y !== 'undefined' ? o.y : o.y1;
                if (typeof ox === 'undefined' || typeof oy === 'undefined') return;
                
                const dist = Math.sqrt(Math.pow(ox - tx, 2) + Math.pow(oy - ty, 2));
                if (dist < minDist && dist < 120) {
                    minDist = dist;
                    match = o;
                }
            });
        }
        return match;
    }

    for (let i = currentFrameIndex - 1; i >= 0; i--) {
        const frameObjs = Array.isArray(frames[i]) ? frames[i] : (frames[i].objects || []);
        matches[i] = findBestMatch(frameObjs, matches[i + 1]);
    }
    for (let i = currentFrameIndex + 1; i < frames.length; i++) {
        const frameObjs = Array.isArray(frames[i]) ? frames[i] : (frames[i].objects || []);
        matches[i] = findBestMatch(frameObjs, matches[i - 1]);
    }

    const points = [];
    matches.forEach((match, fIdx) => {
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
    
    const palette = getCanvasPalette();
    const objColor = resolveCanvasObjectColor(selectedObject, palette);
    const outlineColor = resolveCanvasOutline(objColor, palette);

    // Draw outline first for contrast
    uiCtx.strokeStyle = outlineColor;
    uiCtx.lineWidth = 5;
    uiCtx.setLineDash([6, 4]);
    uiCtx.stroke();
    
    // Draw colored line on top
    uiCtx.strokeStyle = objColor;
    uiCtx.lineWidth = 2.5;
    uiCtx.stroke();
    uiCtx.setLineDash([]);

    points.forEach((pt) => {
        uiCtx.beginPath();
        uiCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        uiCtx.fillStyle = objColor;
        uiCtx.fill();
        uiCtx.strokeStyle = outlineColor;
        uiCtx.lineWidth = 1.5;
        uiCtx.stroke();

        uiCtx.fillStyle = palette.objectOutlineDark;
        uiCtx.fillRect(pt.x - 11, pt.y - 20, 22, 12);
        uiCtx.strokeStyle = objColor;
        uiCtx.lineWidth = 1;
        uiCtx.strokeRect(pt.x - 11, pt.y - 20, 22, 12);

        uiCtx.fillStyle = palette.objectOutlineLight;
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

    uiCtx.strokeStyle = getCanvasPalette().objectAnnotation;
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
    drawPitchToCtx(renderObjects, canvas, ctx, 'blank', typeof selectedObject !== 'undefined' ? selectedObject : null);
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
            const swatchName = getCanvasSwatchName(selectedObject.color, selectedObject.type, getCanvasPalette());
            colorDots.forEach(dot => {
                dot.classList.toggle('active', dot.dataset.color === swatchName);
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

    // object-fit: contain で実際に描画されている領域を正確に計算
    const canvasRatio = 800 / 500;
    const rectRatio = canvasRect.width / canvasRect.height;
    let visualLeft = canvasRect.left;
    let visualTop = canvasRect.top;
    let visualWidth = canvasRect.width;
    let visualHeight = canvasRect.height;
    if (rectRatio > canvasRatio) {
        visualWidth = canvasRect.height * canvasRatio;
        visualLeft = canvasRect.left + (canvasRect.width - visualWidth) / 2;
    } else {
        visualHeight = canvasRect.width / canvasRatio;
        visualTop = canvasRect.top + (canvasRect.height - visualHeight) / 2;
    }

    const scaleX = visualWidth / 800;
    const scaleY = visualHeight / 500;

    const objCenterX = (objX * scaleX) + (visualLeft - wrapperRect.left);
    const objTopY = (objY * scaleY) + (visualTop - wrapperRect.top);

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

    // Account for object-fit: contain maintaining 800x500 ratio
    const canvasRatio = 800 / 500;
    const rectRatio = rect.width / rect.height;
    
    let visualLeft = rect.left;
    let visualTop = rect.top;
    let visualWidth = rect.width;
    let visualHeight = rect.height;
    
    if (rectRatio > canvasRatio) {
        visualHeight = rect.height;
        visualWidth = rect.height * canvasRatio;
        visualLeft = rect.left + (rect.width - visualWidth) / 2;
    } else {
        visualWidth = rect.width;
        visualHeight = rect.width / canvasRatio;
        visualTop = rect.top + (rect.height - visualHeight) / 2;
    }

    return {
        x: (clientX - visualLeft) * (800 / visualWidth),
        y: (clientY - visualTop) * (500 / visualHeight)
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

    // ★ 右側詳細パネル & スマホ下部詳細エリアの情報反映
    const sidePanel = document.getElementById('anim-detail-side-panel');
    const sideToggleBtn = document.getElementById('anim-side-panel-toggle-btn');
    if (sidePanel) {
        const sideFocus = document.getElementById('side-info-focus');
        const sideOrg = document.getElementById('side-info-organize');
        const sideKf = document.getElementById('side-info-keyfactor');
        const sideOpt = document.getElementById('side-info-options');

        const mobileFocus = document.getElementById('mobile-info-focus');
        const mobileOrg = document.getElementById('mobile-info-organize');
        const mobileKf = document.getElementById('mobile-info-keyfactor');
        const mobileOpt = document.getElementById('mobile-info-options');

        const lblSideTitle = document.getElementById('anim-side-panel-title');
        const lblSideFocus = document.getElementById('lbl-side-focus');
        const lblSideOrg = document.getElementById('lbl-side-org');
        const lblSideKf = document.getElementById('lbl-side-kf');
        const cardSideOpt = document.getElementById('side-card-opt');

        const btnEditSide = document.getElementById('btn-edit-anim-side-info');
        const btnEditMobile = document.getElementById('btn-edit-anim-side-info-mobile');
        const isCoach = state.currentUserRole === 'coach';

        if (targetMenu) {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="ti ti-clipboard-list c-static-style--022"></i> メニュー詳細';
            if (lblSideFocus) lblSideFocus.innerHTML = '<i class="ti ti-target c-static-style--022"></i> テーマ・フォーカス';
            if (lblSideOrg) lblSideOrg.innerHTML = '<i class="ti ti-users c-static-style--015"></i> オーガナイズ';
            if (lblSideKf) lblSideKf.innerHTML = '<i class="ti ti-key c-static-style--017"></i> キーファクター';
            if (cardSideOpt) cardSideOpt.style.display = 'block';

            const focusVal = targetMenu.focus || targetMenu.name || '未設定';
            const orgVal = targetMenu.organize || 'なし';
            const kfVal = targetMenu.keyfactor || 'なし';
            const optVal = targetMenu.options || 'なし';

            if (sideFocus) sideFocus.textContent = focusVal;
            if (sideOrg) sideOrg.textContent = orgVal;
            if (sideKf) sideKf.textContent = kfVal;
            if (sideOpt) sideOpt.textContent = optVal;

            if (mobileFocus) mobileFocus.textContent = focusVal;
            if (mobileOrg) mobileOrg.textContent = orgVal;
            if (mobileKf) mobileKf.textContent = kfVal;
            if (mobileOpt) mobileOpt.textContent = optVal;

            const handleEdit = (e) => {
                e.stopPropagation();
                if (window.openLibraryMenuModal) {
                    window.openLibraryMenuModal(targetMenu);
                }
            };

            if (btnEditSide) {
                if (isCoach) {
                    btnEditSide.style.display = 'inline-flex';
                    btnEditSide.onclick = handleEdit;
                } else {
                    btnEditSide.style.display = 'none';
                }
            }
            if (btnEditMobile) {
                if (isCoach) {
                    btnEditMobile.style.display = 'inline-flex';
                    btnEditMobile.onclick = handleEdit;
                } else {
                    btnEditMobile.style.display = 'none';
                }
            }
        } else if (targetTactic) {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="ti ti-chess c-static-style--022"></i> 戦術詳細';
            if (lblSideFocus) lblSideFocus.innerHTML = '<i class="ti ti-text-size c-static-style--022"></i> 戦術名';
            if (lblSideOrg) lblSideOrg.innerHTML = '<i class="ti ti-tags c-static-style--015"></i> カテゴリ';
            if (lblSideKf) lblSideKf.innerHTML = '<i class="ti ti-align-left c-static-style--017"></i> 説明';
            if (cardSideOpt) cardSideOpt.style.display = 'none';

            const focusVal = targetTactic.title || '未設定';
            const orgVal = targetTactic.category || 'その他';
            const kfVal = targetTactic.description || 'なし';

            if (sideFocus) sideFocus.textContent = focusVal;
            if (sideOrg) sideOrg.textContent = orgVal;
            if (sideKf) sideKf.textContent = kfVal;

            if (mobileFocus) mobileFocus.textContent = focusVal;
            if (mobileOrg) mobileOrg.textContent = orgVal;
            if (mobileKf) mobileKf.textContent = kfVal;
            if (mobileOpt) mobileOpt.textContent = 'なし';

            const handleEdit = (e) => {
                e.stopPropagation();
                if (window.openTacticModal) {
                    window.openTacticModal(targetTactic);
                }
            };

            if (btnEditSide) {
                if (isCoach) {
                    btnEditSide.style.display = 'inline-flex';
                    btnEditSide.onclick = handleEdit;
                } else {
                    btnEditSide.style.display = 'none';
                }
            }
            if (btnEditMobile) {
                if (isCoach) {
                    btnEditMobile.style.display = 'inline-flex';
                    btnEditMobile.onclick = handleEdit;
                } else {
                    btnEditMobile.style.display = 'none';
                }
            }
        } else {
            if (lblSideTitle) lblSideTitle.innerHTML = '<i class="ti ti-clipboard-list c-static-style--022"></i> メニュー詳細';
            if (cardSideOpt) cardSideOpt.style.display = 'block';

            if (sideFocus) sideFocus.textContent = '未設定';
            if (sideOrg) sideOrg.textContent = 'なし';
            if (sideKf) sideKf.textContent = 'なし';
            if (sideOpt) sideOpt.textContent = 'なし';

            if (mobileFocus) mobileFocus.textContent = '未設定';
            if (mobileOrg) mobileOrg.textContent = 'なし';
            if (mobileKf) mobileKf.textContent = 'なし';
            if (mobileOpt) mobileOpt.textContent = 'なし';

            if (btnEditSide) btnEditSide.style.display = 'none';
            if (btnEditMobile) btnEditMobile.style.display = 'none';
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

    const palette = getCanvasPalette();
    let homeTeamColor = (inputHomeColor && inputHomeColor.value) || palette.teamHome;
    let awayTeamColor = (inputAwayColor && inputAwayColor.value) || palette.teamAway;

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
        if (bulkFormationPopover) bulkFormationPopover.classList.add('hidden');
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
            timelineToggleBtn.innerHTML = isCollapsed ? '<i class="ti ti-movie"></i>' : '<i class="ti ti-chevron-down"></i>';
        };
    }

    updateFrameCount();
    drawPitch(objects);

    // ★ ツールドック（ボタン）のイベント登録
    const tools = ['select', 'player', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'line-circle', 'vision', 'text', 'line-move', 'line-pass', 'line-dribble'];
    tools.forEach(tool => {
        const el = document.querySelector(`.c-tool-dock__button[data-tool="${tool}"]`);
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

            if (selectedObject) {
                if (selectedObject.type === 'marker' || selectedObject.type === 'player') {
                    selectedObject.color = getCanvasSwatchColor(colorName, selectedObject.type, getCanvasPalette());
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

    // モバイル用ボトムドック モード切替タブ (描画ツール ⇄ アニメーション)
    const tabDraw = document.getElementById('anim-mobile-tab-draw');
    const tabAnim = document.getElementById('anim-mobile-tab-anim');
    const workspaceEl = document.querySelector('.anim-main-workspace');

    if (tabDraw && tabAnim && workspaceEl) {
        tabDraw.onclick = () => {
            tabDraw.classList.add('active');
            tabDraw.setAttribute('aria-pressed', 'true');
            tabAnim.classList.remove('active');
            tabAnim.setAttribute('aria-pressed', 'false');
            workspaceEl.classList.remove('is-mobile-anim-mode');
        };
        tabAnim.onclick = () => {
            tabAnim.classList.add('active');
            tabAnim.setAttribute('aria-pressed', 'true');
            tabDraw.classList.remove('active');
            tabDraw.setAttribute('aria-pressed', 'false');
            workspaceEl.classList.add('is-mobile-anim-mode');
        };
    }

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
                        if (typeof navigateFunc === 'function') navigateFunc('matches', null, true);
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
                        if (typeof navigateFunc === 'function') navigateFunc('practices', null, true);
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
                    if (typeof navigateFunc === 'function') navigateFunc('library', null, true);
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
                    if (typeof navigateFunc === 'function') navigateFunc('tactics', null, true);
                }
            }
        };
    }

    const navigateBackFromAnimation = async () => {
        if (isDirty) {
            const proceed = await showCustomConfirm('変更内容が保存されていません。編集を破棄して戻りますか？', '未保存の変更', { okText: '戻る', type: 'danger' });
            if (!proceed) {
                return false;
            }
        }
        if (isFormationMode) {
            if (typeof navigateFunc === 'function') navigateFunc('matches', null, true);
        } else if (isLibraryMode) {
            if (typeof navigateFunc === 'function') navigateFunc('library', null, true);
        } else if (isTacticsMode) {
            if (typeof navigateFunc === 'function') navigateFunc('tactics', null, true);
        } else {
            if (typeof navigateFunc === 'function') navigateFunc('practices', null, true);
        }
        return true;
    };

    animationBackHandler = navigateBackFromAnimation;
    const btnBack = document.getElementById('anim-back');
    if (btnBack) {
        btnBack.onclick = navigateBackFromAnimation;
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

            const palette = getCanvasPalette();
            let color, radius, type, number = '';
            if (currentTool === 'player') {
                color = palette.teamHome; radius = 14; type = 'player';
                const elNum = document.getElementById('canvas-player-number');
                if (elNum) number = elNum.value || '';
            }
            if (currentTool === 'ball') { color = palette.objectBall; radius = 8; type = 'ball'; }
            if (currentTool === 'marker') { color = palette.objectMarker; radius = 8; type = 'marker'; }
            if (currentTool === 'cone') { color = palette.objectCone; radius = 10; type = 'cone'; }
            if (currentTool === 'minigoal') { color = palette.objectBall; radius = 15; type = 'minigoal'; }
            if (currentTool === 'vision') { color = palette.objectVision; radius = 60; type = 'vision'; }
            if (currentTool === 'text') { color = palette.objectText; radius = 0; type = 'text'; }

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