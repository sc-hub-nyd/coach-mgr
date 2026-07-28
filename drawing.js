// drawing.js
import { state } from './state.js';
import { showToast } from './utils.js';

let canvas, ctx;
let bgCanvas, bgCtx;
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

let boundListeners = {
    canvasMouseDown: null,
    canvasMouseMove: null,
    canvasMouseUp: null,
    canvasDblClick: null,
    canvasTouchStart: null,
    canvasTouchMove: null,
    canvasTouchEnd: null,
    docKeyDown: null
};

export function cleanupCanvasEvents() {
    if (!canvas) return;

    if (boundListeners.canvasMouseDown) canvas.removeEventListener('mousedown', boundListeners.canvasMouseDown);
    if (boundListeners.canvasMouseMove) canvas.removeEventListener('mousemove', boundListeners.canvasMouseMove);
    if (boundListeners.canvasMouseUp) canvas.removeEventListener('mouseup', boundListeners.canvasMouseUp);
    if (boundListeners.canvasDblClick) canvas.removeEventListener('dblclick', boundListeners.canvasDblClick);
    if (boundListeners.canvasTouchStart) canvas.removeEventListener('touchstart', boundListeners.canvasTouchStart);
    if (boundListeners.canvasTouchMove) canvas.removeEventListener('touchmove', boundListeners.canvasTouchMove);
    if (boundListeners.canvasTouchEnd) canvas.removeEventListener('touchend', boundListeners.canvasTouchEnd);

    if (boundListeners.docKeyDown) {
        document.removeEventListener('keydown', boundListeners.docKeyDown);
    }

    Object.keys(boundListeners).forEach(key => boundListeners[key] = null);
}

function saveHistory() {
    if (isPlaying) return;
    historyStack.push(JSON.parse(JSON.stringify(objects)));
    if (historyStack.length > 30) historyStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

function undoHistory() {
    if (isPlaying) return;
    if (historyStack.length > 1) {
        const current = historyStack.pop();
        redoStack.push(current);
        objects = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));
        selectedObject = null;
        drawPitch(objects);
    } else if (historyStack.length === 1) {
        historyStack.pop();
        objects = [];
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
}

function redoHistory() {
    if (isPlaying) return;
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        historyStack.push(nextState);
        objects = JSON.parse(JSON.stringify(nextState));
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('tool-undo');
    const btnRedo = document.getElementById('tool-redo');
    if (btnUndo) {
        btnUndo.disabled = historyStack.length === 0;
        btnUndo.style.opacity = historyStack.length > 0 ? '1' : '0.5';
    }
    if (btnRedo) {
        btnRedo.disabled = redoStack.length === 0;
        btnRedo.style.opacity = redoStack.length > 0 ? '1' : '0.5';
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
    const insertIdx = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? currentFrameIndex + 1 : frames.length;
    frames.splice(insertIdx, 0, { objects: JSON.parse(JSON.stringify(objects)), title: '' });
    currentFrameIndex = insertIdx;
    updateFrameCount();
    drawPitch(objects);
    showToast(`シーン ${insertIdx + 1} を追加しました`);
}

function editFrameTitle() {
    if (frames.length === 0) {
        frames = [{ objects: JSON.parse(JSON.stringify(objects)), title: '' }];
        currentFrameIndex = 0;
    }
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        currentFrameIndex = Math.max(0, frames.length - 1);
    }
    let f = frames[currentFrameIndex];
    let currentTitle = (f && typeof f === 'object' && !Array.isArray(f) && f.title) ? f.title : '';

    const modal = document.getElementById('modal-scene-title');
    const input = document.getElementById('input-scene-title');
    const form = document.getElementById('form-scene-title');
    const heading = document.getElementById('scene-title-modal-heading');

    if (modal && input && form) {
        if (heading) heading.textContent = `シーン ${currentFrameIndex + 1} の見出し編集`;
        input.value = currentTitle;
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        // 既存のsubmitイベントが重複しないよう、一度クリアして再登録
        form.onsubmit = (ev) => {
            ev.preventDefault();
            const trimmed = input.value.trim();
            if (Array.isArray(f)) {
                frames[currentFrameIndex] = { objects: f, title: trimmed };
            } else if (typeof f === 'object' && f !== null) {
                f.title = trimmed;
            } else {
                frames[currentFrameIndex] = { objects: [], title: trimmed };
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
    if (frames.length > 0) {
        const lastFrame = frames[frames.length - 1];
        objects = JSON.parse(JSON.stringify(Array.isArray(lastFrame) ? lastFrame : (lastFrame.objects || [])));
    }
    if (canvas) {
        drawPitch(objects);
    }
}

function playAnimation() {
    if (frames.length < 2) {
        alert('アニメーションを作成するには、少なくとも2つのシーンを記録してください。');
        return;
    }
    isPlaying = true;
    let currentFrameIdx = 0;
    let startTime = null;
    const duration = 1500;

    function animate(timestamp) {
        if (!isPlaying) return;
        if (!startTime) startTime = timestamp;

        let progress = (timestamp - startTime) / duration;

        if (progress >= 1) {
            currentFrameIdx++;
            startTime = timestamp;
            progress = 0;
            if (currentFrameIdx >= frames.length - 1) {
                currentFrameIdx = 0;
            }
        }

        const rawCurrent = frames[currentFrameIdx];
        const rawNext = frames[currentFrameIdx + 1];

        const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
        const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);

        const isStaticType = (type) => ['line', 'ladder', 'rect', 'cone', 'marker', 'minigoal'].includes(type);

        const interpolatedObjects = currentFrame.map(obj1 => {
            if (isStaticType(obj1.type)) return obj1;
            const obj2 = nextFrame.find(o => o.id === obj1.id);
            if (!obj2) return obj1;

            const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            return {
                ...obj1,
                x: obj1.x + (obj2.x - obj1.x) * p,
                y: obj1.y + (obj2.y - obj1.y) * p
            };
        });

        const staticObjs = currentFrame.filter(o => isStaticType(o.type));
        const drawList = [...interpolatedObjects.filter(o => !isStaticType(o.type)), ...staticObjs];

        drawPitch(drawList);
        animReqId = requestAnimationFrame(animate);
    }

    animReqId = requestAnimationFrame(animate);
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

        function recordLoop(timestamp) {
            if (!isRecording) return;
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;

            if (hasMultiFrames) {
                let currentFrameIdx = Math.floor(elapsed / durationPerFrame);
                let progress = (elapsed % durationPerFrame) / durationPerFrame;

                if (currentFrameIdx >= frames.length - 1) {
                    isRecording = false;
                    try {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.requestData();
                            setTimeout(() => mediaRecorder.stop(), 150);
                        }
                    } catch (err) { mediaRecorder.stop(); }
                    return;
                }

                const rawCurrent = frames[currentFrameIdx];
                const rawNext = frames[currentFrameIdx + 1];
                const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
                const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);
                const isStaticType = (type) => ['line', 'ladder', 'rect', 'cone', 'marker', 'minigoal'].includes(type);

                const interpolatedObjects = currentFrame.map(obj1 => {
                    if (isStaticType(obj1.type)) return obj1;
                    const obj2 = nextFrame.find(o => o.id === obj1.id);
                    if (!obj2) return obj1;
                    const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
                    return { ...obj1, x: obj1.x + (obj2.x - obj1.x) * p, y: obj1.y + (obj2.y - obj1.y) * p };
                });

                const staticObjs = currentFrame.filter(o => isStaticType(o.type));
                const drawList = [...interpolatedObjects.filter(o => !isStaticType(o.type)), ...staticObjs];
                drawPitch(drawList);
            } else {
                drawPitch(objects);
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
            drawArrowToCtx(obj.x1, obj.y1, obj.x2, obj.y2, obj.lineType || 'pass', targetCtx);
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
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
            targetCtx.setLineDash([4, 4]);
            targetCtx.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));
            targetCtx.setLineDash([]);

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

            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = Math.max(2, 2.5 * scale);
            targetCtx.strokeRect(-hw, -gh * 0.66, gw, gh);

            targetCtx.beginPath();
            targetCtx.lineWidth = 1;
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            const gridStepX = 6 * scale;
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

            targetCtx.fillStyle = obj.color || '#000000';
            targetCtx.font = 'bold 14px Inter, sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(obj.text || '', 0, 0);
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

            targetCtx.beginPath();
            targetCtx.moveTo(-r * 0.45, -r * 1.05);
            targetCtx.lineTo(0, -r * 1.55);
            targetCtx.lineTo(r * 0.45, -r * 1.05);
            targetCtx.closePath();
            targetCtx.fillStyle = mainColor;
            targetCtx.fill();

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
function drawArrow(x1, y1, x2, y2, lineType) { drawArrowToCtx(x1, y1, x2, y2, lineType, ctx); }
function drawLadder(x1, y1, x2, y2) { drawLadderToCtx(x1, y1, x2, y2, ctx); }
function drawRectPreview(x1, y1, x2, y2) {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.setLineDash([]);
}
function drawCirclePreview(x1, y1, x2, y2) {
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
}

function drawPitchBackground() {
    bgCanvas = document.getElementById('pitch-bg-canvas');
    if (!bgCanvas) return;
    bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) return;

    if (bgCanvas.width !== 800 || bgCanvas.height !== 500) {
        bgCanvas.width = 800;
        bgCanvas.height = 500;
    }

    const templateEl = document.getElementById('canvas-pitch-template');
    let template = templateEl && templateEl.value ? templateEl.value : 'full';

    drawPitchToCtx([], bgCanvas, bgCtx, template);
}

export function drawPitch(renderObjects) {
    canvas = document.getElementById('pitch-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== 800 || canvas.height !== 500) {
        canvas.width = 800;
        canvas.height = 500;
    }

    drawPitchBackground();
    drawPitchToCtx(renderObjects, canvas, ctx, 'blank');
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
        objX = (selectedObject.x1 + selectedObject.x2) / 2;
        objY = Math.min(selectedObject.y1, selectedObject.y2);
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

    const isBelow = (objTopY < popHeight + 20 || objY < 80);
    const topPos = isBelow ? (objTopY + 15) : (objTopY - popHeight - 12);

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

function drawArrowToCtx(x1, y1, x2, y2, lineType, targetCtx) {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const color = '#334155';

    targetCtx.beginPath();

    if (lineType === 'dribble') {
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([]);
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
    } else {
        targetCtx.moveTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = (lineType === 'move') ? 2 : 3;
        if (lineType === 'pass') targetCtx.setLineDash([5, 5]);
        else targetCtx.setLineDash([]);
    }

    targetCtx.stroke();
    targetCtx.setLineDash([]);

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

    canvas.width = 800;
    canvas.height = 500;

    if (bgCanvas) {
        bgCanvas.width = 800;
        bgCanvas.height = 500;
        bgCtx = bgCanvas.getContext('2d');
    }

    currentPracticeId = params && params.practiceId ? params.practiceId : null;
    currentMenuId = params && params.menuId ? params.menuId : null;
    currentMatchId = params && params.matchId ? params.matchId : null;
    currentFormationId = params && params.formId ? params.formId : null;
    currentLibraryId = params && params.libraryId ? params.libraryId : null;

    let initialFrames = null;
    let isFormationMode = !!(currentMatchId && currentFormationId);
    let isLibraryMode = !!currentLibraryId;
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

    // ★ 保存されたピッチテンプレートの初期読込 & Reflect
    let savedTemplate = 'full';
    if (targetMenu && targetMenu.pitchTemplate) {
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
        templateSel.onchange = () => drawPitch(objects);
    }

    // テーマタイトルの反映
    const titleEl = document.getElementById('anim-menu-focus');
    if (titleEl) {
        if (targetMenu && (targetMenu.focus || targetMenu.name)) {
            titleEl.textContent = targetMenu.focus || targetMenu.name;
        } else if (isFormationMode) {
            titleEl.textContent = 'フォーメーション作図';
        } else {
            titleEl.textContent = 'テーマ・フォーカス未設定';
        }
    }

    // ★ 右側詳細パネルの情報反映＆開閉トグル復元
    const sidePanel = document.getElementById('anim-detail-side-panel');
    const sideToggleBtn = document.getElementById('anim-side-panel-toggle-btn');
    if (sidePanel && sideToggleBtn) {
        const sideFocus = document.getElementById('side-info-focus');
        const sideOrg = document.getElementById('side-info-organize');
        const sideKf = document.getElementById('side-info-keyfactor');
        const sideOpt = document.getElementById('side-info-options');

        if (targetMenu) {
            if (sideFocus) sideFocus.textContent = targetMenu.focus || targetMenu.name || '未設定';
            if (sideOrg) sideOrg.textContent = targetMenu.organize || 'なし';
            if (sideKf) sideKf.textContent = targetMenu.keyfactor || 'なし';
            if (sideOpt) sideOpt.textContent = targetMenu.options || 'なし';
        } else {
            if (sideFocus) sideFocus.textContent = '未設定';
            if (sideOrg) sideOrg.textContent = 'なし';
            if (sideKf) sideKf.textContent = 'なし';
            if (sideOpt) sideOpt.textContent = 'なし';
        }

        if (window.innerWidth <= 768) sidePanel.classList.remove('open');
        else sidePanel.classList.add('open');

        sideToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = sidePanel.classList.toggle('open');
            const icon = sideToggleBtn.querySelector('i');
            if (icon) {
                icon.className = isOpen ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
            }
        };
    }

    // 設定ポップオーバー開閉
    const settingsBtn = document.getElementById('anim-settings-btn');
    const settingsPopover = document.getElementById('anim-settings-popover');
    if (settingsBtn && settingsPopover) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            settingsPopover.classList.toggle('hidden');
        };
        document.addEventListener('click', (e) => {
            if (settingsPopover && !settingsPopover.contains(e.target) && e.target !== settingsBtn) {
                settingsPopover.classList.add('hidden');
            }
        });
    }

    // ★ タイムラインバーの隠す/開くトグル復元
    const timelineToggleBtn = document.getElementById('anim-timeline-toggle');
    const timelineBar = document.getElementById('anim-timeline-bar');
    if (timelineToggleBtn && timelineBar) {
        timelineToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = timelineBar.classList.toggle('collapsed');
            timelineToggleBtn.innerHTML = isCollapsed ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
        };
    }

    updateFrameCount();
    drawPitch(objects);

    // ★ ツールドック（ボタン）のイベント登録
    const tools = ['select', 'player', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'line-circle', 'text', 'line-move', 'line-pass', 'line-dribble'];
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
                    if (window.saveData) window.saveData();
                    showToast('作図を保存しました');
                    if (typeof navigateFunc === 'function') navigateFunc('library');
                }
            }
        };
    }

    const btnBack = document.getElementById('anim-back');
    if (btnBack) {
        btnBack.onclick = () => {
            if (isFormationMode) {
                if (typeof navigateFunc === 'function') navigateFunc('matches');
            } else if (isLibraryMode) {
                if (typeof navigateFunc === 'function') navigateFunc('library');
            } else {
                if (typeof navigateFunc === 'function') navigateFunc('practices');
            }
        };
    }

    // ★ 全オブジェクトの配置・ドラッグ・描画イベントハンドラ（完全復元）
    boundListeners.canvasMouseDown = (e) => {
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
                } else if (prevSelected.type === 'rect' || prevSelected.type === 'circle') {
                    const s = 18;
                    if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'nw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'ne'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'sw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                    if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'se'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                }
            }

            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                if (obj.type === 'line' || obj.type === 'ladder') {
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
                                saveHistory();
                                drawPitch(objects);
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

    boundListeners.canvasMouseMove = (e) => {
        if (isPlaying) return;
        const pos = getCanvasPos(e);
        const x = pos.x;
        const y = pos.y;

        if (draggedObject) {
            if (isResizing && draggedObject.type === 'minigoal') {
                const dist = Math.sqrt(Math.pow(x - draggedObject.x, 2) + Math.pow(y - draggedObject.y, 2));
                const newScale = Math.max(0.4, Math.min(3.5, dist / 21));
                draggedObject.goalScale = parseFloat(newScale.toFixed(2));
            } else if (isResizing && (draggedObject.type === 'rect' || draggedObject.type === 'circle')) {
                if (resizeHandle === 'nw') { draggedObject.x1 = applyGridSnap(x); draggedObject.y1 = applyGridSnap(y); }
                if (resizeHandle === 'ne') { draggedObject.x2 = applyGridSnap(x); draggedObject.y1 = applyGridSnap(y); }
                if (resizeHandle === 'sw') { draggedObject.x1 = applyGridSnap(x); draggedObject.y2 = applyGridSnap(y); }
                if (resizeHandle === 'se') { draggedObject.x2 = applyGridSnap(x); draggedObject.y2 = applyGridSnap(y); }
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
                startX = x; startY = y;
            } else {
                draggedObject.x = applyGridSnap(x);
                draggedObject.y = applyGridSnap(y);
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

    boundListeners.canvasMouseUp = (e) => {
        if (isPlaying) return;
        if (draggedObject) {
            saveHistory();
            draggedObject = null;
            isResizing = false;
            resizeHandle = null;
            drawPitch(objects);
        } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
            const pos = getCanvasPos(e);
            const x = applyGridSnap(pos.x);
            const y = applyGridSnap(pos.y);
            if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
                if (currentTool === 'ladder') {
                    objects.push({ id: objectIdCounter++, type: 'ladder', x1: startX, y1: startY, x2: x, y2: y });
                } else if (currentTool === 'line-rect') {
                    objects.push({ id: objectIdCounter++, type: 'rect', x1: startX, y1: startY, x2: x, y2: y });
                } else if (currentTool === 'line-circle') {
                    objects.push({ id: objectIdCounter++, type: 'circle', x1: startX, y1: startY, x2: x, y2: y });
                } else {
                    const lType = currentTool.replace('line-', '');
                    objects.push({ id: objectIdCounter++, type: 'line', lineType: lType, x1: startX, y1: startY, x2: x, y2: y });
                }
                saveHistory();
            }
            isDrawing = false;
            currentTool = 'select';
            updateToolDockActive();
            drawPitch(objects);
        }
    };

    boundListeners.canvasDblClick = (e) => {
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

    canvas.addEventListener('mousedown', boundListeners.canvasMouseDown);
    canvas.addEventListener('mousemove', boundListeners.canvasMouseMove);
    canvas.addEventListener('mouseup', boundListeners.canvasMouseUp);
    canvas.addEventListener('dblclick', boundListeners.canvasDblClick);

    // タッチデバイス（スマホ・タブレット）対応
    function getTouchPos(touchEvent) {
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        return { clientX: touch.clientX, clientY: touch.clientY };
    }

    boundListeners.canvasTouchStart = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        boundListeners.canvasMouseDown({ clientX: pos.clientX, clientY: pos.clientY, button: 0 });
    };
    boundListeners.canvasTouchMove = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        boundListeners.canvasMouseMove({ clientX: pos.clientX, clientY: pos.clientY });
    };
    boundListeners.canvasTouchEnd = (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        boundListeners.canvasMouseUp({ clientX: pos.clientX, clientY: pos.clientY });
    };

    canvas.addEventListener('touchstart', boundListeners.canvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove', boundListeners.canvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', boundListeners.canvasTouchEnd, { passive: false });
}