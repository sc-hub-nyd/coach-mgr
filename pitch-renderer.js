// pitch-renderer.js - ピッチとオブジェクトの描画を行う純粋な関数群

import { getCanvasPalette, resolveCanvasObjectColor, withCanvasAlpha } from './canvas-palette.js';

export function drawArrowToCtx(x1, y1, x2, y2, lineType, targetCtx, cx, cy) {
    const headlen = 10;
    const actualCx = typeof cx !== 'undefined' ? cx : (x1 + x2) / 2;
    const actualCy = typeof cy !== 'undefined' ? cy : (y1 + y2) / 2;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const isCurved = Math.sqrt((actualCx - midX) * (actualCx - midX) + (actualCy - midY) * (actualCy - midY)) > 1.5;
    const color = getCanvasPalette().pitchLine;

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

export function drawLadderToCtx(x1, y1, x2, y2, targetCtx) {
    const palette = getCanvasPalette();
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

    targetCtx.strokeStyle = palette.pitchLine;
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
    targetCtx.strokeStyle = palette.pitchLine;
    targetCtx.lineWidth = 2;
    targetCtx.stroke();
}

export function drawPitchToCtx(renderObjectsInput, targetCanvas, targetCtx, template = 'full', selectedObj = null) {
    const renderObjects = Array.isArray(renderObjectsInput) ? renderObjectsInput : ((renderObjectsInput && renderObjectsInput.objects) || []);
    const isAreaShape = object => object?.type === 'rect' || object?.type === 'circle';
    // エリア図形は保存順に関係なく常に背面へ描画する。既存の作図データも正規化不要で互換性を保つ。
    const layeredRenderObjects = [
        ...renderObjects.filter(isAreaShape),
        ...renderObjects.filter(object => !isAreaShape(object))
    ];
    const palette = getCanvasPalette();

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
        targetCtx.fillStyle = palette.pitchSurface;
        targetCtx.fillRect(0, 0, 800, 500);

        targetCtx.strokeStyle = palette.pitchLine;
        targetCtx.lineWidth = 1.5;
        targetCtx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    } else {
        if (targetCanvas.id !== 'pitch-canvas') {
            targetCtx.fillStyle = palette.objectOutlineLight;
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

        targetCtx.strokeStyle = palette.pitchGuide;
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
            targetCtx.strokeStyle = palette.pitchGuideSubtle;
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

        targetCtx.strokeStyle = palette.pitchLine;
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
        targetCtx.fillStyle = palette.pitchLine;
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
        targetCtx.fillStyle = palette.pitchLine;
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

        targetCtx.strokeStyle = palette.pitchGuide;
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
        targetCtx.fillStyle = palette.pitchLine;
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

        targetCtx.strokeStyle = palette.pitchGuide;
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

    layeredRenderObjects.forEach(obj => {
        if (obj.type === 'line') {
            drawArrowToCtx(obj.x1, obj.y1, obj.x2, obj.y2, obj.lineType || 'pass', targetCtx, obj.cx, obj.cy);
            if (selectedObj && selectedObj === obj) {
                targetCtx.fillStyle = palette.objectSelection;
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
                
                const cx = typeof obj.cx !== 'undefined' ? obj.cx : (obj.x1 + obj.x2) / 2;
                const cy = typeof obj.cy !== 'undefined' ? obj.cy : (obj.y1 + obj.y2) / 2;
                targetCtx.beginPath(); targetCtx.arc(cx, cy, 6, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.strokeStyle = palette.objectOutlineLight;
                targetCtx.lineWidth = 1.5;
                targetCtx.stroke();
            }
        } else if (obj.type === 'ladder') {
            drawLadderToCtx(obj.x1, obj.y1, obj.x2, obj.y2, targetCtx);
            if (selectedObj && selectedObj === obj) {
                targetCtx.fillStyle = palette.objectSelection;
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
            }
        } else if (obj.type === 'rect') {
            targetCtx.strokeStyle = palette.pitchGuideStrong;
            targetCtx.lineWidth = 1.5;
            targetCtx.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));

            if (selectedObj && selectedObj === obj) {
                targetCtx.fillStyle = palette.objectSelection;
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
            targetCtx.fillStyle = palette.selectionFill;
            targetCtx.fill();
            targetCtx.strokeStyle = palette.selectionStroke;
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);

            if (selectedObj && selectedObj === obj) {
                targetCtx.fillStyle = palette.objectSelection;
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
            const visionColor = resolveCanvasObjectColor(obj, palette);
            withCanvasAlpha(targetCtx, 0.25, () => {
                targetCtx.fillStyle = visionColor;
                targetCtx.fill();
            });

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

            if (selectedObj && selectedObj === obj) {
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
                    targetCtx.strokeStyle = palette.objectOutlineLight;
                    targetCtx.lineWidth = 1.5;
                    targetCtx.stroke();
                };

                // 中心選択インジケータ
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, 7, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                drawHandle(rHx, rHy, palette.objectSelectionHandlePrimary);
                drawHandle(fovLx, fovLy, palette.objectSelectionHandleSecondary);
                drawHandle(fovRx, fovRy, palette.objectSelectionHandleSecondary);
            }
        } else if (obj.type === 'marker') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            targetCtx.beginPath();
            targetCtx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = resolveCanvasObjectColor(obj, palette);
            targetCtx.fill();
            targetCtx.strokeStyle = palette.objectOutlineDark;
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
            targetCtx.restore();

            if (selectedObj && selectedObj === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, 12, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
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
            targetCtx.fillStyle = palette.objectLadder;
            targetCtx.fill();
            targetCtx.strokeStyle = palette.objectOutlineDark;
            targetCtx.lineWidth = 1;
            targetCtx.stroke();

            targetCtx.beginPath();
            targetCtx.moveTo(0, -obj.radius * 1.2);
            targetCtx.lineTo(obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.lineTo(-obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.closePath();
            targetCtx.fillStyle = resolveCanvasObjectColor(obj, palette);
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.restore();

            if (selectedObj && selectedObj === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
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
            targetCtx.strokeStyle = palette.chromeLine;
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
            targetCtx.strokeStyle = palette.chromeLineSubtle;
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
            targetCtx.strokeStyle = palette.chromeBorder;
            targetCtx.lineWidth = 1;
            targetCtx.beginPath();
            targetCtx.moveTo(-hw, gh * 0.33);
            targetCtx.lineTo(hw, gh * 0.33);
            targetCtx.stroke();

            // Draw goal posts (at front corners)
            targetCtx.fillStyle = palette.chromeText;
            targetCtx.beginPath();
            targetCtx.arc(-hw, gh * 0.33, Math.max(2, 3 * scale), 0, Math.PI * 2);
            targetCtx.arc(hw, gh * 0.33, Math.max(2, 3 * scale), 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.restore();

            if (selectedObj && selectedObj === obj) {
                const selR = (obj.radius || 15) * scale + 6;
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, selR, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                targetCtx.fillStyle = palette.objectSelection;
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
                targetCtx.fillStyle = palette.objectOutlineLight;
                targetCtx.strokeStyle = palette.chromeBorder;
                targetCtx.lineWidth = 1;
                targetCtx.beginPath();
                targetCtx.roundRect(-tw / 2 - 6, -12, tw + 12, 24, 6);
                targetCtx.fill();
                targetCtx.stroke();
            }

            targetCtx.fillStyle = resolveCanvasObjectColor(obj, palette);
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(txt, 0, 0);
            targetCtx.restore();

            if (selectedObj && selectedObj === obj) {
                targetCtx.beginPath();
                const tw = targetCtx.measureText(obj.text || '').width;
                targetCtx.rect(obj.x - tw / 2 - 4, obj.y - 12, tw + 8, 24);
                targetCtx.strokeStyle = palette.objectSelection;
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

            const mainColor = resolveCanvasObjectColor(obj, palette);

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
            targetCtx.fillStyle = palette.objectPlayerSkin;
            targetCtx.fill();
            targetCtx.strokeStyle = mainColor;
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            // 右手先
            targetCtx.beginPath();
            targetCtx.arc(r * 0.85, -r * 0.8, handRadius, 0, Math.PI * 2);
            targetCtx.fillStyle = palette.objectPlayerSkin;
            targetCtx.fill();
            targetCtx.strokeStyle = mainColor;
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            const grad = targetCtx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, palette.objectPlayerBlueHighlight);
            grad.addColorStop(0.7, mainColor);
            grad.addColorStop(1, palette.objectPlayerBlueShadow);

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r, 0, Math.PI * 2);
            targetCtx.fillStyle = (obj.color === 'blue' || !obj.color) ? grad : mainColor;
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r - 0.75, 0, Math.PI * 2);
            targetCtx.strokeStyle = palette.overlayBorder;
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            targetCtx.rotate((-angle * Math.PI) / 180);

            let label = obj.number !== undefined && obj.number !== null ? String(obj.number) : '';
            targetCtx.fillStyle = palette.objectOutlineLight;
            targetCtx.font = 'bold 12px "Inter", "Meiryo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(label, 0, 0.5);

            targetCtx.restore();

            if (selectedObj && selectedObj === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, r + 6, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'ball') {
            targetCtx.beginPath();
            targetCtx.arc(obj.x + 1, obj.y + 1, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = palette.objectShadow;
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = palette.objectOutlineLight;
            targetCtx.fill();
            targetCtx.strokeStyle = palette.pitchLine;
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
            targetCtx.fillStyle = palette.chromeTextStrong;
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.strokeStyle = palette.pitchLine;
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

            if (selectedObj && selectedObj === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = palette.objectSelection;
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        }
    });
    targetCtx.restore();
}

