// Tactical Canvas Pitch & Animation Engine Module

import { state, saveData } from './state.js';
import { showToast, openModal } from './ui.js';
import { navigate } from './router.js';

export let canvas = null;
export let ctx = null;
export let objects = [];
export let frames = [];
export let isPlaying = false;
export let currentFrameIndex = -1;

let currentTool = 'select';
let isDrawing = false;
let draggedObject = null;
let startX = 0, startY = 0;
let selectedObject = null;
let historyStack = [];
let redoStack = [];
let animReqId = null;
let currentPracticeId = null;
let currentMenuId = null;
let currentMatchId = null;
let currentFormationId = null;

export function saveHistory() {
    if (isPlaying) return;
    historyStack.push(JSON.parse(JSON.stringify(objects)));
    if (historyStack.length > 30) historyStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

export function undoHistory() {
    if (isPlaying) return;
    if (historyStack.length > 1) {
        const current = historyStack.pop();
        redoStack.push(current);
        objects = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));
        selectedObject = null;
        drawPitch(objects);
    } else if (historyStack.length === 1) {
        const current = historyStack.pop();
        redoStack.push(current);
        objects = [];
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
}

export function redoHistory() {
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

export function updateUndoRedoButtons() {
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

export function updateCanvasToolbar() {
    const btnDelete = document.getElementById('tool-delete');
    const btnRotate = document.getElementById('tool-rotate');
    
    if (btnDelete) {
        btnDelete.disabled = !selectedObject;
        btnDelete.style.opacity = selectedObject ? '1' : '0.5';
    }
    if (btnRotate) {
        const canRotate = !!(selectedObject && (selectedObject.type === 'minigoal' || selectedObject.type === 'player'));
        btnRotate.disabled = !canRotate;
        btnRotate.style.opacity = canRotate ? '1' : '0.5';
    }
    updateUndoRedoButtons();
}

export function handleCanvasKeyDown(e) {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return; 
    }
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!canvasWrapper) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject) {
            e.preventDefault();
            objects = objects.filter(o => o.id !== selectedObject.id);
            selectedObject = null;
            saveHistory();
            drawPitch(objects);
        }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redoHistory();
        else undoHistory();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redoHistory();
    }
}

export function updateFrameCount() {
    const el = document.getElementById('frame-count');
    if(el) el.textContent = frames.length;

    const selectEl = document.getElementById('anim-frame-select');
    const btnPrev = document.getElementById('anim-prev-frame');
    const btnNext = document.getElementById('anim-next-frame');
    const btnDelete = document.getElementById('anim-delete-frame');

    if (!selectEl) return;

    if (frames.length === 0) {
        selectEl.innerHTML = '<option value="-1">シーン未作成 (0)</option>';
        selectEl.disabled = true;
        if (btnPrev) { btnPrev.disabled = true; btnPrev.style.opacity = '0.5'; }
        if (btnNext) { btnNext.disabled = true; btnNext.style.opacity = '0.5'; }
        if (btnDelete) { btnDelete.disabled = true; btnDelete.style.opacity = '0.5'; }
        return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = frames.map((f, idx) => `
        <option value="${idx}" ${idx === currentFrameIndex ? 'selected' : ''}>シーン ${idx + 1} / ${frames.length}</option>
    `).join('');

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

export function selectFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        currentFrameIndex = index;
        objects = JSON.parse(JSON.stringify(frames[index]));
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        showToast(`シーン #${index + 1} を表示中`);
    }
}

export function deleteFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        frames.splice(index, 1);
        if (frames.length > 0) {
            currentFrameIndex = Math.min(index, frames.length - 1);
            objects = JSON.parse(JSON.stringify(frames[currentFrameIndex]));
        } else {
            currentFrameIndex = -1;
        }
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        showToast(`シーン #${index + 1} を削除しました`);
    }
}

export function addFrame() {
    frames.push(JSON.parse(JSON.stringify(objects)));
    currentFrameIndex = frames.length - 1;
    updateFrameCount();
    showToast(`末尾にシーン #${frames.length} を追加しました`);
}

export function insertFrame() {
    const insertIdx = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? currentFrameIndex + 1 : frames.length;
    frames.splice(insertIdx, 0, JSON.parse(JSON.stringify(objects)));
    currentFrameIndex = insertIdx;
    updateFrameCount();
    showToast(`シーン #${insertIdx + 1} として間に挿入しました`);
}

export function stopAnimation() {
    isPlaying = false;
    if (animReqId) cancelAnimationFrame(animReqId);
    if (frames.length > 0) {
        objects = JSON.parse(JSON.stringify(frames[frames.length - 1]));
    }
    if (canvas) {
        drawPitch(objects);
    }
}

export function playAnimation() {
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

        const currentFrame = frames[currentFrameIdx];
        const nextFrame = frames[currentFrameIdx + 1];
        
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

export function drawPitch(renderObjects) {
    const templateEl = document.getElementById('canvas-pitch-template');
    const template = templateEl ? templateEl.value : 'full';
    drawPitchToCtx(renderObjects, canvas, ctx, template);
    updateCanvasToolbar();
}

export function drawPitchToCtx(renderObjects, targetCanvas, targetCtx, template = 'full') {
    if (!targetCanvas || !targetCtx) return;
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    
    targetCtx.clearRect(0, 0, w, h);
    targetCtx.fillStyle = '#f1f5f9';
    targetCtx.fillRect(0, 0, w, h);
    
    const pitchX = 20;
    const pitchY = 20;
    const pitchW = w - 40;
    const pitchH = h - 40;
    
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(pitchX, pitchY, pitchW, pitchH);

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

        targetCtx.stroke();
        targetCtx.setLineDash([]);

        targetCtx.strokeStyle = '#334155';
        targetCtx.lineWidth = 1.5;
        
        targetCtx.beginPath();
        targetCtx.moveTo(pitchX + pitchW / 2, pitchY);
        targetCtx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
        targetCtx.stroke();
        
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, centerCircleR, 0, Math.PI * 2);
        targetCtx.stroke();

        targetCtx.strokeRect(pitchX, penY, penW, penH);
        targetCtx.strokeRect(pitchX, goalAreaY, goalAreaW, goalAreaH);
        targetCtx.strokeRect(pitchX + pitchW - penW, penY, penW, penH);
        targetCtx.strokeRect(pitchX + pitchW - goalAreaW, goalAreaY, goalAreaW, goalAreaH);
    }

    renderObjects.forEach(obj => {
        if (obj.type === 'player') {
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

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r, 0, Math.PI * 2);
            targetCtx.fillStyle = mainColor;
            targetCtx.fill();

            targetCtx.rotate((-angle * Math.PI) / 180);
            let label = obj.number !== undefined && obj.number !== null ? String(obj.number) : '';
            targetCtx.fillStyle = '#ffffff';
            targetCtx.font = 'bold 12px "Inter", "Meiryo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(label, 0, 0.5);

            targetCtx.restore();
        } else if (obj.type === 'ball') {
            targetCtx.beginPath();
            targetCtx.arc(obj.x, obj.y, obj.radius || 8, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fill();
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 1.5;
            targetCtx.stroke();
        }
    });
}

function handleMouseDown(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    startX = x;
    startY = y;

    if (currentTool === 'select') {
        draggedObject = [...objects].reverse().find(o => {
            const dist = Math.hypot(o.x - x, o.y - y);
            return dist <= (o.radius || 15);
        });
        if (draggedObject) {
            selectedObject = draggedObject;
            isDrawing = true;
            drawPitch(objects);
        } else {
            selectedObject = null;
            drawPitch(objects);
        }
    } else if (currentTool === 'player') {
        const numInp = document.getElementById('canvas-player-number');
        const num = numInp ? parseInt(numInp.value, 10) || 1 : 1;
        const colorSel = document.getElementById('canvas-player-color');
        const color = colorSel ? colorSel.value : 'blue';

        const newPlayer = {
            id: Date.now(),
            type: 'player',
            x,
            y,
            radius: 16,
            number: num,
            color: color,
            angle: 0
        };
        objects.push(newPlayer);
        if (numInp) numInp.value = num + 1;
        saveHistory();
        drawPitch(objects);
    } else if (currentTool === 'ball') {
        const newBall = {
            id: Date.now(),
            type: 'ball',
            x,
            y,
            radius: 8
        };
        objects.push(newBall);
        saveHistory();
        drawPitch(objects);
    }
}

function handleMouseMove(e) {
    if (!isDrawing || !draggedObject) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    draggedObject.x = (e.clientX - rect.left) * scaleX;
    draggedObject.y = (e.clientY - rect.top) * scaleY;
    drawPitch(objects);
}

function handleMouseUp() {
    if (isDrawing) {
        isDrawing = false;
        if (draggedObject) {
            saveHistory();
            draggedObject = null;
        }
    }
}

export function initAnimation(params) {
    canvas = document.getElementById('pitch-canvas');
    if(!canvas) return;

    currentPracticeId = params && params.practiceId ? params.practiceId : null;
    currentMenuId = params && params.menuId ? params.menuId : null;
    currentMatchId = params && params.matchId ? params.matchId : null;
    currentFormationId = params && params.formId ? params.formId : null;
    let currentLibraryId = params && params.libraryId ? params.libraryId : null;

    let initialFrames = null;
    let isFormationMode = !!(currentMatchId && currentFormationId);
    let isLibraryMode = !!currentLibraryId;

    if (currentPracticeId && currentMenuId) {
        const practice = state.practices.find(p => p.id === currentPracticeId);
        if (practice) {
            const menu = practice.menus.find(m => m.id === currentMenuId);
            if (menu && menu.frames) initialFrames = JSON.parse(JSON.stringify(menu.frames));
        }
    } else if (isLibraryMode) {
        const menu = state.menuLibrary.find(m => m.id === currentLibraryId);
        if (menu && menu.frames) initialFrames = JSON.parse(JSON.stringify(menu.frames));
    }

    canvas.width = 800;
    canvas.height = 500;
    ctx = canvas.getContext('2d');

    frames = initialFrames || [];
    objects = frames.length > 0 ? JSON.parse(JSON.stringify(frames[frames.length - 1])) : [];
    isPlaying = false;
    historyStack = [];
    saveHistory();

    updateFrameCount();
    drawPitch(objects);

    canvas.onmousedown = handleMouseDown;
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    document.onkeydown = handleCanvasKeyDown;

    const btnAdd = document.getElementById('anim-add-frame');
    if (btnAdd) btnAdd.onclick = addFrame;

    const btnInsert = document.getElementById('anim-insert-frame');
    if (btnInsert) btnInsert.onclick = insertFrame;

    const btnPlay = document.getElementById('anim-play');
    if (btnPlay) btnPlay.onclick = playAnimation;

    const btnStop = document.getElementById('anim-stop');
    if (btnStop) btnStop.onclick = stopAnimation;
}
