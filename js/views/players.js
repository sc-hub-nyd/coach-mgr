// Players View Module

import { state, saveData } from '../state.js?v=25';
import { showToast, openModal } from '../ui.js';

export function drawRadarChart(canvasId, skillsData = [3, 3, 3, 3, 3, 3]) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 45;

    ctx.clearRect(0, 0, width, height);

    const labels = state.skillMetrics && state.skillMetrics.length >= 3 ? state.skillMetrics : ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
    const numVars = labels.length;
    const angleStep = (Math.PI * 2) / numVars;

    // Draw background concentric polygons (level 1..5)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let level = 1; level <= 5; level++) {
        const r = (radius / 5) * level;
        ctx.beginPath();
        for (let i = 0; i < numVars; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Draw axis lines and labels
    ctx.font = '500 18px "Inter", "Meiryo", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numVars; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.stroke();

        const labelRadius = radius + 24;
        const lx = centerX + labelRadius * Math.cos(angle);
        const ly = centerY + labelRadius * Math.sin(angle);
        ctx.fillText(labels[i], lx, ly);
    }

    // Draw data polygon
    if (skillsData && skillsData.length > 0) {
        ctx.beginPath();
        for (let i = 0; i < numVars; i++) {
            const val = skillsData[i] || 1;
            const r = (radius / 5) * Math.min(5, Math.max(1, val));
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(242, 57, 50, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#f23932';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Data points
        for (let i = 0; i < numVars; i++) {
            const val = skillsData[i] || 1;
            const r = (radius / 5) * Math.min(5, Math.max(1, val));
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#f23932';
            ctx.fill();
        }
    }
}

export function parsePlayerCSV(csvText) {
    if (!csvText || !csvText.trim()) return [];
    
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    const results = [];
    const headerKeywords = ['背番号', '番号', '氏名', '名前', '選手名', '学年', 'ポジション', 'num', 'number', 'name', 'pos', 'position'];
    let startIndex = 0;
    
    const firstLineLower = lines[0].toLowerCase();
    if (headerKeywords.some(k => firstLineLower.includes(k))) {
        startIndex = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        let parts = line.split(/,|\t/).map(p => p.trim());
        if (parts.length === 1 && line.includes(' ')) {
            parts = line.split(/\s+/).map(p => p.trim());
        }
        
        if (parts.length === 0 || !parts[0]) continue;
        
        let number = '';
        let name = '';
        let grade = '';
        let position = 'MF';
        
        if (parts.length >= 4) {
            number = parts[0];
            name = parts[1];
            grade = parts[2];
            position = parts[3];
        } else if (parts.length === 3) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
                if (['FW', 'MF', 'DF', 'GK', 'CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'].some(p => parts[2].toUpperCase().includes(p))) {
                    position = parts[2];
                } else {
                    grade = parts[2];
                }
            } else {
                name = parts[0];
                grade = parts[1];
                position = parts[2];
            }
        } else if (parts.length === 2) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
            } else {
                name = parts[0];
                position = parts[1];
            }
        } else if (parts.length === 1) {
            name = parts[0];
        }
        
        if (name) {
            results.push({
                number: number ? (parseInt(number, 10) || number) : '',
                name,
                grade: grade || '',
                position: position.toUpperCase() || 'MF'
            });
        }
    }
    
    return results;
}

export function openPlayerCSVImportModal() {
    const modal = document.getElementById('modal-import-players-csv');
    const inputFileInput = document.getElementById('input-csv-file');
    const textareaData = document.getElementById('textarea-csv-data');
    const previewContainer = document.getElementById('csv-preview-container');
    const errorMsg = document.getElementById('csv-error-msg');
    const form = document.getElementById('form-import-players-csv');
    
    if (!modal) return;
    
    if (inputFileInput) inputFileInput.value = '';
    if (textareaData) textareaData.value = '';
    if (previewContainer) { previewContainer.style.display = 'none'; previewContainer.innerHTML = ''; }
    if (errorMsg) errorMsg.style.display = 'none';
    
    const updatePreview = () => {
        const text = textareaData ? textareaData.value : '';
        const parsed = parsePlayerCSV(text);
        
        if (parsed.length > 0) {
            previewContainer.style.display = 'block';
            previewContainer.innerHTML = `
                <div style="font-size:0.75rem; font-weight:bold; margin-bottom:0.4rem; color:var(--primary);">
                    <i class="fa-solid fa-eye"></i> プレビュー (${parsed.length}件の選手を検出)
                </div>
                <table class="csv-preview-table">
                    <thead>
                        <tr>
                            <th>背番号</th>
                            <th>氏名</th>
                            <th>学年</th>
                            <th>ポジション</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${parsed.map(p => `
                            <tr>
                                <td>${p.number || '-'}</td>
                                <td><strong>${p.name}</strong></td>
                                <td>${p.grade || '-'}</td>
                                <td><span class="badge badge-sub">${p.position}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            if (errorMsg) errorMsg.style.display = 'none';
        } else {
            previewContainer.style.display = 'none';
            previewContainer.innerHTML = '';
        }
    };
    
    if (inputFileInput) {
        inputFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (textareaData) {
                        textareaData.value = event.target.result;
                        updatePreview();
                    }
                };
                reader.readAsText(file, 'UTF-8');
            }
        };
    }
    
    if (textareaData) {
        textareaData.oninput = updatePreview;
    }
    
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const text = textareaData ? textareaData.value : '';
            const parsed = parsePlayerCSV(text);
            
            if (parsed.length === 0) {
                if (errorMsg) {
                    errorMsg.textContent = '登録可能な選手データが検出されませんでした。フォーマットを確認してください。';
                    errorMsg.style.display = 'block';
                }
                return;
            }
            
            let addedCount = 0;
            parsed.forEach((p, idx) => {
                const newPlayer = {
                    id: Date.now() + Math.floor(Math.random() * 1000) + idx,
                    number: p.number ? p.number : (state.players.length + 1 + idx),
                    name: p.name,
                    grade: p.grade || '',
                    position: p.position || 'MF',
                    history: [{ id: Date.now(), date: new Date().toISOString().split('T')[0], comment: 'CSV一括登録', skills: {} }]
                };
                state.players.push(newPlayer);
                addedCount++;
            });
            
            saveData();
            modal.classList.add('hidden');
            showToast(`${addedCount}名の選手を一括登録しました！`);
            initPlayers();
        };
    }
    
    openModal('modal-import-players-csv');
}

export function openPlayerDetail(id) {
    const p = state.players.find(pl => pl.id === id);
    if (!p) return;

    const pdPosition = document.getElementById('pd-position');
    if (pdPosition) {
        pdPosition.innerHTML = (Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
            if (!pos) return '';
            const lower = pos.toLowerCase();
            let badgeClass = 'badge-sub';
            if (lower === 'fw') badgeClass = 'badge-fw';
            else if (lower === 'mf') badgeClass = 'badge-mf';
            else if (lower === 'df') badgeClass = 'badge-df';
            else if (lower === 'gk') badgeClass = 'badge-gk';
            return `<span class="player-position ${badgeClass}" style="font-size:0.8rem; padding:0.2rem 0.5rem; border-radius:12px; font-weight:600; display:inline-block; margin-right:0.25rem;">${pos}</span>`;
        }).join('');
        pdPosition.style.background = 'transparent';
        pdPosition.style.border = 'none';
        pdPosition.style.padding = '0';
    }
    document.getElementById('pd-name').textContent = p.name;
    
    let playerGoals = 0;
    let playerAssists = 0;
    state.matches.forEach(m => {
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId === p.id) playerGoals++;
                if (r.assistId === p.id) playerAssists++;
            });
        }
    });
    
    const elPdGoals = document.getElementById('pd-goals');
    const elPdAssists = document.getElementById('pd-assists');
    if (elPdGoals) elPdGoals.textContent = playerGoals;
    if (elPdAssists) elPdAssists.textContent = playerAssists;

    openModal('modal-player-detail');
}

export function openPlayerModal(playerId = null) {
    const formPlayer = document.getElementById('form-player');
    if (formPlayer) formPlayer.reset();

    const editIdInp = document.getElementById('player-edit-id');
    if (editIdInp) editIdInp.value = playerId || '';

    const title = document.getElementById('player-modal-title');
    const assessmentSection = document.getElementById('player-initial-assessment-section');

    const posContainer = document.getElementById('player-position-container');
    if (posContainer) {
        posContainer.innerHTML = state.positions.map(p => `
            <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
            </label>
        `).join('');
    }

    const posCat2Container = document.getElementById('player-position-cat2-container');
    if (posCat2Container) {
        posCat2Container.innerHTML = (state.positionsCat2 || []).map(p => `
            <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
            </label>
        `).join('');
    }

    const initSkills = document.getElementById('player-initial-skills-container');
    if (initSkills) {
        initSkills.innerHTML = state.skillMetrics.map((m, i) => `
            <div class="form-group"><label>${m}</label><input type="number" id="skill-initial-${i}" class="form-control" min="1" max="5" value="3" required></div>
        `).join('');
    }

    if (playerId) {
        const p = state.players.find(pl => pl.id === playerId);
        if (p) {
            document.getElementById('player-name').value = p.name || '';
            document.getElementById('player-number').value = p.number || '';
            if (title) title.textContent = '選手情報を編集';
            if (assessmentSection) assessmentSection.classList.add('hidden');
            
            const positions = Array.isArray(p.position) ? p.position : [p.position];
            document.querySelectorAll('.player-pos-checkbox').forEach(cb => {
                cb.checked = positions.includes(cb.value);
            });
        }
    } else {
        if (title) title.textContent = '選手を登録';
        if (assessmentSection) assessmentSection.classList.remove('hidden');
        document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);
    }

    openModal('modal-player');
}

export function initPlayers() {
    const summaryCardsContainer = document.getElementById('player-summary-cards');
    if (summaryCardsContainer) {
        const totalPlayers = state.players.length;
        const posCounts = { FW: 0, MF: 0, DF: 0, GK: 0 };
        state.players.forEach(p => {
            const positions = Array.isArray(p.position) ? p.position : [p.position];
            positions.forEach(pos => {
                if (pos) {
                    const u = pos.toUpperCase();
                    if (u.includes('FW')) posCounts.FW++;
                    else if (u.includes('MF')) posCounts.MF++;
                    else if (u.includes('DF')) posCounts.DF++;
                    else if (u.includes('GK')) posCounts.GK++;
                }
            });
        });

        let totalSkillAvg = 0;
        let evaluatedCount = 0;

        state.players.forEach(p => {
            if (p.history && p.history.length > 0) {
                evaluatedCount++;
                const skills = p.history[0].skills || [0,0,0,0,0,0];
                const sum = skills.reduce((a, b) => a + (b || 0), 0);
                const avg = skills.length > 0 ? sum / skills.length : 0;
                totalSkillAvg += avg;
            }
        });

        const teamAvgSkill = evaluatedCount > 0 ? (totalSkillAvg / evaluatedCount).toFixed(1) : '-';

        summaryCardsContainer.innerHTML = `
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(242,57,50,0.1); color:var(--primary);"><i class="fa-solid fa-users"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">チームの仲間</h3>
                    <p style="font-size:1.15rem;">${totalPlayers}名</p>
                </div>
            </div>
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(59,130,246,0.1); color:#2563eb;"><i class="fa-solid fa-layer-group"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">ポジション内訳</h3>
                    <div style="font-size:0.72rem; font-weight:bold; color:var(--text-primary); margin-top:0.2rem; display:flex; gap:0.35rem; flex-wrap:wrap;">
                        <span style="color:#ef4444;">FW:${posCounts.FW}</span>
                        <span style="color:#3b82f6;">MF:${posCounts.MF}</span>
                        <span style="color:#22c55e;">DF:${posCounts.DF}</span>
                        <span style="color:#eab308;">GK:${posCounts.GK}</span>
                    </div>
                </div>
            </div>
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(34,197,94,0.1); color:#16a34a;"><i class="fa-solid fa-chart-line"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">チーム平均スキル</h3>
                    <p style="font-size:1.15rem;">Lv ${teamAvgSkill} <span style="font-size:0.7rem; font-weight:normal; color:var(--text-secondary);">/ 5.0</span></p>
                </div>
            </div>
        `;
    }

    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) return;
    
    if (state.players.length === 0) {
        playerGrid.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-users"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">登録選手がいません</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    選手を登録して、スキル評価のレーダーチャート作成や、試合での出場ポジション設定、成長履歴の管理を始めましょう。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-player" style="margin-top:0.5rem;"><i class="fa-solid fa-user-plus"></i> 最初の選手を追加</button>
            </div>
        `;
        const btnEmptyAdd = document.getElementById('btn-empty-add-player');
        if (btnEmptyAdd) {
            btnEmptyAdd.onclick = () => openPlayerModal();
        }
    } else {
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        playerGrid.innerHTML = sortedPlayers.map(p => {
            return `
                <div class="player-card" style="cursor:pointer;" data-id="${p.id}">
                    <div class="player-card-header">
                        <div>
                            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-bottom:0.3rem;">
                                ${(Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
                                    if (!pos) return '';
                                    const lower = pos.toLowerCase();
                                    let badgeClass = 'badge-sub';
                                    if (lower === 'fw') badgeClass = 'badge-fw';
                                    else if (lower === 'mf') badgeClass = 'badge-mf';
                                    else if (lower === 'df') badgeClass = 'badge-df';
                                    else if (lower === 'gk') badgeClass = 'badge-gk';
                                    return `<span class="player-position ${badgeClass}" style="font-size:0.7rem; padding:0.1rem 0.35rem; border-radius:12px; font-weight:600; display:inline-block;">${pos}</span>`;
                                }).join('')}
                            </div>
                            <div style="font-size:1.2rem; font-weight:bold; margin-top:0.2rem;">${p.name}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div class="radar-container" style="width:200px; height:200px; margin:0 auto; position:relative;">
                        <canvas id="radar-${p.id}" width="400" height="400" style="width:200px; height:200px;"></canvas>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.player-card').forEach(card => {
            card.onclick = () => openPlayerDetail(parseInt(card.dataset.id, 10));
        });

        sortedPlayers.forEach(p => {
            const currentSkills = p.history && p.history.length > 0 ? p.history[0].skills : [0,0,0,0,0,0];
            drawRadarChart(`radar-${p.id}`, currentSkills);
        });
    }

    const btnAdd = document.getElementById('btn-add-player');
    if (btnAdd) {
        btnAdd.onclick = () => openPlayerModal();
    }

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.onclick = () => openPlayerCSVImportModal();
    }
}
