// players.js
import { state } from './state.js';
import { escapeHtml, showToast } from './utils.js';
import { saveData, navigate, openModal } from './app.js';

export function drawRadarChart(canvasId, skills, prevSkills = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scaleFactor = w / 200;
    const radius = w / 2 - (56 * scaleFactor / 2);

    ctx.clearRect(0, 0, w, h);

    const labels = state.skillMetrics || ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
    const maxVal = 5;
    const numSides = labels.length;

    for (let i = 1; i <= maxVal; i++) {
        ctx.beginPath();
        for (let j = 0; j <= numSides; j++) {
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * i;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 1 * scaleFactor;
        ctx.stroke();

        if (i === maxVal) {
            for (let j = 0; j < numSides; j++) {
                const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
                ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
                ctx.lineWidth = 1 * scaleFactor;
                ctx.stroke();

                const labelDist = radius + (14 * scaleFactor);
                const lx = cx + labelDist * Math.cos(angle);
                const ly = cy + labelDist * Math.sin(angle);
                ctx.fillStyle = '#334155';
                ctx.font = `bold ${Math.round(10.5 * scaleFactor)}px 'Inter', 'Hiragino Kaku Gothic ProN', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labels[j], lx, ly);
            }
        }
    }

    if (prevSkills) {
        ctx.beginPath();
        for (let j = 0; j < numSides; j++) {
            const val = prevSkills[j] || 0;
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * val;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2 * scaleFactor;
        ctx.setLineDash([4 * scaleFactor, 4 * scaleFactor]);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let j = 0; j < numSides; j++) {
            const val = prevSkills[j] || 0;
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * val;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, 3 * scaleFactor, 0, Math.PI * 2);
            ctx.fillStyle = '#64748b';
            ctx.fill();
        }
    }

    ctx.beginPath();
    for (let j = 0; j < numSides; j++) {
        const val = skills[j] || 0;
        const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
        const r = (radius / maxVal) * val;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(242, 57, 50, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#f23932';
    ctx.lineWidth = 2.5 * scaleFactor;
    ctx.stroke();

    for (let j = 0; j < numSides; j++) {
        const val = skills[j] || 0;
        const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
        const r = (radius / maxVal) * val;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 4 * scaleFactor, 0, Math.PI * 2);
        ctx.fillStyle = '#f23932';
        ctx.fill();
    }
}

export function render1on1List(p) {
    const listEl = document.getElementById('pd-1on1-list');
    if (!listEl) return;

    if (p.notes1on1 && p.notes1on1.length > 0) {
        const sorted = [...p.notes1on1].sort((a, b) => new Date(b.date) - new Date(a.date));
        listEl.innerHTML = sorted.map(note => `
            <div class="feedback-box" style="position:relative; padding:0.6rem 0.8rem; background:rgba(0,0,0,0.01); border:1px solid var(--surface-border); border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <strong style="font-size:0.8rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${note.date}</strong>
                    <button class="btn btn-danger btn-delete-1on1" data-player-id="${p.id}" data-note-id="${note.id}" style="padding:0.15rem 0.35rem; font-size:0.65rem; height:20px; min-width:auto; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <p style="font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap; margin:0; line-height:1.4;">${note.content}</p>
            </div>
        `).join('');

        listEl.querySelectorAll('.btn-delete-1on1').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('この面談記録を削除しますか？')) {
                    const plId = parseInt(e.currentTarget.dataset.playerId, 10);
                    const noteId = parseInt(e.currentTarget.dataset.noteId, 10);
                    const player = state.players.find(pl => pl.id === plId);
                    if (player && player.notes1on1) {
                        player.notes1on1 = player.notes1on1.filter(n => n.id !== noteId);
                        saveData();
                        showToast('面談記録を削除しました');
                        render1on1List(player);
                    }
                }
            };
        });
    } else {
        listEl.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; font-style:italic; text-align:center; padding:1rem 0; margin:0;">面談記録はありません。</p>';
    }
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

    const nameEl = document.getElementById('pd-name');
    if (nameEl) nameEl.textContent = p.name;

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

    const btnPdGoals = document.getElementById('btn-pd-goals');
    if (btnPdGoals) {
        btnPdGoals.onclick = () => {
            const matchesWithGoals = state.matches.filter(m =>
                m.goalRecords && m.goalRecords.some(r => r.scorerId === p.id)
            );

            const pmlTitle = document.getElementById('pml-title');
            const pmlContent = document.getElementById('pml-content');
            if (pmlTitle && pmlContent) {
                pmlTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${p.name} の得点した試合`;
                pmlContent.innerHTML = matchesWithGoals.length > 0 ? matchesWithGoals.map(m => `
                    <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; cursor:pointer;" onclick="document.getElementById('modal-player-detail').classList.add('hidden'); document.getElementById('modal-player-matches-list').classList.add('hidden'); openMatchDetail(${m.id});">
                        <div>
                            <strong>vs ${m.opponent}</strong>
                            <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${m.result}</div>
                    </div>
                `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">得点した試合はありません。</p>';

                openModal('modal-player-matches-list');
            }
        };
    }

    const btnPdAssists = document.getElementById('btn-pd-assists');
    if (btnPdAssists) {
        btnPdAssists.onclick = () => {
            const matchesWithAssists = state.matches.filter(m =>
                m.goalRecords && m.goalRecords.some(r => r.assistId === p.id)
            );

            const pmlTitle = document.getElementById('pml-title');
            const pmlContent = document.getElementById('pml-content');
            if (pmlTitle && pmlContent) {
                pmlTitle.innerHTML = `<span style="display:inline-block; transform:rotate(45deg); color:#22c55e;"><i class="fa-solid fa-shoe-prints"></i></span> ${p.name} のアシストした試合`;
                pmlContent.innerHTML = matchesWithAssists.length > 0 ? matchesWithAssists.map(m => `
                    <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; cursor:pointer;" onclick="document.getElementById('modal-player-detail').classList.add('hidden'); document.getElementById('modal-player-matches-list').classList.add('hidden'); openMatchDetail(${m.id});">
                        <div>
                            <strong>vs ${m.opponent}</strong>
                            <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${m.result}</div>
                    </div>
                `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">アシストした試合はありません。</p>';

                openModal('modal-player-matches-list');
            }
        };
    }

    let timeline = [];
    if (p.history) {
        p.history.forEach(h => {
            timeline.push({ type: 'assessment', date: h.date, comment: h.comment, data: h });
        });
    }

    state.matches.forEach(m => {
        if (m.playerFeedback) {
            m.playerFeedback.forEach(fb => {
                if (fb.playerId === p.id) {
                    timeline.push({ type: 'match', date: m.date, matchDetails: `${m.type}${m.tournament ? ` (${m.tournament})` : ''} vs ${m.opponent}`, comment: fb.comment, matchId: m.id });
                }
            });
        }
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    const historyList = document.getElementById('pd-history-list');
    if (historyList) {
        historyList.innerHTML = timeline.length > 0 ? timeline.map(item => {
            if (item.type === 'assessment') {
                const hId = item.data ? item.data.id : null;
                const editBtn = hId ? `<button type="button" class="btn btn-secondary btn-edit-assessment" data-history-id="${hId}" style="padding:0.15rem 0.4rem; font-size:0.7rem; margin-left:auto;"><i class="fa-solid fa-pen"></i> 編集</button>` : '';
                const delBtn = hId ? `<button type="button" class="btn btn-danger btn-delete-assessment" data-history-id="${hId}" style="padding:0.15rem 0.4rem; font-size:0.7rem; margin-left:0.25rem;"><i class="fa-solid fa-trash"></i> 削除</button>` : '';
                return `
                    <div class="timeline-item">
                        <div class="timeline-item-date" style="display:flex; align-items:center;">
                            <span>${item.date} <span class="timeline-item-badge">スキル評価</span></span>
                            ${editBtn}
                            ${delBtn}
                        </div>
                        <div class="timeline-item-comment" style="white-space:pre-wrap;">${item.comment}</div>
                    </div>
                `;
            } else {
                const matchingMatch = state.matches.find(m => m.id === item.matchId);
                const firstForm = (matchingMatch && matchingMatch.formations && matchingMatch.formations.length > 0) ? matchingMatch.formations[0] : null;
                const linkBtn = firstForm ? `<button class="btn btn-secondary btn-timeline-anim" data-match-id="${matchingMatch.id}" data-form-id="${firstForm.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; margin-top:0.35rem; display:inline-flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-person-running"></i> 作図を見る</button>` : '';
                return `
                    <div class="timeline-item match-timeline-item">
                        <div class="timeline-item-date">
                            ${item.date} <span class="timeline-item-badge">試合評価</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">${item.matchDetails}</p>
                        <p>${item.comment}</p>
                        ${linkBtn}
                    </div>
                `;
            }
        }).join('') : '<p class="text-secondary">記録がありません。</p>';
    }

    document.querySelectorAll('.btn-edit-assessment').forEach(btn => {
        btn.onclick = (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            const hItem = p.history ? p.history.find(h => h.id === hId) : null;
            if (!hItem) return;

            document.getElementById('assessment-player-id').value = p.id;
            document.getElementById('assessment-edit-id').value = hId;
            const titleEl = document.getElementById('assessment-modal-title');
            if (titleEl) titleEl.textContent = 'スキル評価を編集';

            document.getElementById('assessment-date').value = hItem.date || new Date().toISOString().split('T')[0];

            let goodText = '';
            let improveText = '';
            if (hItem.comment) {
                const parts = hItem.comment.split('\n\n【ネクストステップ】\n');
                if (parts.length === 2) {
                    goodText = parts[0].replace('【ポジティブ】\n', '');
                    improveText = parts[1];
                } else {
                    goodText = hItem.comment;
                }
            }
            document.getElementById('assessment-good').value = goodText;
            document.getElementById('assessment-improve').value = improveText;

            const assSkills = document.getElementById('assessment-skills-container');
            if (assSkills) {
                assSkills.innerHTML = state.skillMetrics.map((m, i) => `
                    <div class="form-group"><label>${m}</label><input type="number" id="skill-ass-${i}" class="form-control" min="1" max="5" value="${(hItem.skills && hItem.skills[i]) || 3}" required></div>
                `).join('');
            }

            openModal('modal-player-assessment');
        };
    });

    document.querySelectorAll('.btn-delete-assessment').forEach(btn => {
        btn.onclick = (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            if (confirm('この過去の評価記録を削除しますか？')) {
                p.history = p.history.filter(h => h.id !== hId);
                saveData();
                showToast('評価を削除しました');
                openPlayerDetail(p.id);
                initPlayers();
            }
        };
    });

    document.querySelectorAll('.btn-timeline-anim').forEach(btn => {
        btn.onclick = (e) => {
            const matchId = parseInt(e.currentTarget.dataset.matchId, 10);
            const formId = parseInt(e.currentTarget.dataset.formId, 10);
            document.getElementById('modal-player-detail').classList.add('hidden');
            navigate('animation', { matchId, formId });
        };
    });

    openModal('modal-player-detail');

    const currentSkills = p.history && p.history.length > 0 ? (p.history[0].data ? p.history[0].data.skills : p.history[0].skills) : [0, 0, 0, 0, 0, 0];
    const prevSkills = p.history && p.history.length > 1 ? (p.history[1].data ? p.history[1].data.skills : p.history[1].skills) : null;

    const legend = document.getElementById('pd-radar-legend');
    if (legend) {
        legend.style.display = prevSkills ? 'flex' : 'none';
    }

    setTimeout(() => {
        drawRadarChart('pd-radar', currentSkills, prevSkills);
    }, 50);

    const btnAddAssessment = document.getElementById('btn-add-assessment');
    if (btnAddAssessment) {
        btnAddAssessment.onclick = () => {
            document.getElementById('assessment-player-id').value = p.id;
            document.getElementById('assessment-edit-id').value = '';
            const titleEl = document.getElementById('assessment-modal-title');
            if (titleEl) titleEl.textContent = '新しいスキル評価を記録';
            document.getElementById('assessment-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('assessment-good').value = '';
            document.getElementById('assessment-improve').value = '';

            const assSkills = document.getElementById('assessment-skills-container');
            if (assSkills) {
                assSkills.innerHTML = state.skillMetrics.map((m, i) => `
                    <div class="form-group"><label>${m}</label><input type="number" id="skill-ass-${i}" class="form-control" min="1" max="5" value="3" required></div>
                `).join('');

                if (currentSkills) {
                    state.skillMetrics.forEach((m, i) => {
                        const el = document.getElementById(`skill-ass-${i}`);
                        if (el) el.value = currentSkills[i] || 3;
                    });
                }
            }

            openModal('modal-player-assessment');
        };
    }

    const btnEdit = document.getElementById('btn-edit-player-detail');
    if (btnEdit) {
        btnEdit.onclick = () => {
            document.getElementById('player-edit-id').value = p.id;
            document.getElementById('player-modal-title').textContent = '選手情報を編集';
            document.getElementById('player-initial-assessment-section').classList.add('hidden');
            document.getElementById('player-initial-good').removeAttribute('required');
            document.getElementById('player-initial-improve').removeAttribute('required');

            document.getElementById('player-name').value = p.name;
            document.getElementById('player-number').value = p.number;

            const posContainer = document.getElementById('player-position-container');
            if (posContainer) {
                posContainer.innerHTML = state.positions.map(pos => {
                    const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
                    return `
                        <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                            <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                        </label>
                    `;
                }).join('');
            }

            const posCat2Container = document.getElementById('player-position-cat2-container');
            if (posCat2Container) {
                posCat2Container.innerHTML = (state.positionsCat2 || []).map(pos => {
                    const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
                    return `
                        <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                            <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                        </label>
                    `;
                }).join('');
            }

            document.getElementById('modal-player-detail').classList.add('hidden');
            openModal('modal-player');
        };
    }

    const btnDel = document.getElementById('btn-delete-player-detail');
    if (btnDel) {
        btnDel.onclick = () => {
            if (confirm('この選手を削除しますか？')) {
                state.players = state.players.filter(pl => pl.id !== p.id);
                saveData();
                showToast('削除しました');
                document.getElementById('modal-player-detail').classList.add('hidden');
                initPlayers();
            }
        };
    }

    const goalsPlIdEl = document.getElementById('goals-player-id');
    if (goalsPlIdEl) goalsPlIdEl.value = p.id;

    const shortEl = document.getElementById('player-goal-short');
    if (shortEl) shortEl.value = (p.goals && p.goals.shortTerm) ? p.goals.shortTerm : '';

    const longEl = document.getElementById('player-goal-long');
    if (longEl) longEl.value = (p.goals && p.goals.longTerm) ? p.goals.longTerm : '';

    const pl1on1IdEl = document.getElementById('1on1-player-id');
    if (pl1on1IdEl) pl1on1IdEl.value = p.id;

    const date1on1El = document.getElementById('player-1on1-date');
    if (date1on1El) date1on1El.value = new Date().toISOString().split('T')[0];

    const note1on1El = document.getElementById('player-1on1-note');
    if (note1on1El) note1on1El.value = '';

    render1on1List(p);

    const tabs = document.querySelectorAll('#modal-player-detail .player-detail-tab');
    const panes = document.querySelectorAll('#modal-player-detail .player-detail-tab-pane');

    tabs.forEach(tab => {
        if (tab.dataset.tab === 'pd-tab-history') tab.classList.add('active');
        else tab.classList.remove('active');
    });
    panes.forEach(pane => {
        if (pane.id === 'pd-tab-history') pane.classList.add('active');
        else pane.classList.remove('active');
    });

    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(pane => pane.classList.remove('active'));

            tab.classList.add('active');
            const targetPane = document.getElementById(tab.dataset.tab);
            if (targetPane) targetPane.classList.add('active');
        };
    });

    const formGoals = document.getElementById('form-player-goals');
    if (formGoals) {
        formGoals.onsubmit = (e) => {
            e.preventDefault();
            const plId = parseInt(document.getElementById('goals-player-id').value, 10);
            const player = state.players.find(pl => pl.id === plId);
            if (player) {
                player.goals = {
                    shortTerm: document.getElementById('player-goal-short').value.trim(),
                    longTerm: document.getElementById('player-goal-long').value.trim()
                };
                saveData();
                showToast('個人目標を保存しました');
            }
        };
    }

    const form1on1 = document.getElementById('form-player-1on1');
    if (form1on1) {
        form1on1.onsubmit = (e) => {
            e.preventDefault();
            const plId = parseInt(document.getElementById('1on1-player-id').value, 10);
            const player = state.players.find(pl => pl.id === plId);
            if (player) {
                if (!player.notes1on1) player.notes1on1 = [];
                player.notes1on1.push({
                    id: Date.now(),
                    date: document.getElementById('player-1on1-date').value,
                    content: document.getElementById('player-1on1-note').value.trim()
                });
                saveData();
                showToast('面談記録を追加しました');
                document.getElementById('player-1on1-note').value = '';
                render1on1List(player);
            }
        };
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
                                <td><strong>${escapeHtml(p.name)}</strong></td>
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

    modal.classList.remove('hidden');
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
                const skills = p.history[0].skills || [0, 0, 0, 0, 0, 0];
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
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-player');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-player');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    } else {
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        playerGrid.innerHTML = sortedPlayers.map(p => {
            return `
                <div class="player-card" style="cursor:pointer;" onclick="openPlayerDetail(${p.id});">
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
                            <div style="font-size:1.2rem; font-weight:bold; margin-top:0.2rem;">${escapeHtml(p.name)}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div class="radar-container" style="width:200px; height:200px; margin:0 auto; position:relative;">
                        <canvas id="radar-${p.id}" width="400" height="400" style="width:200px; height:200px;"></canvas>
                    </div>
                </div>
            `;
        }).join('');

        sortedPlayers.forEach(p => {
            const currentSkills = p.history && p.history.length > 0 ? p.history[0].skills : [0, 0, 0, 0, 0, 0];
            drawRadarChart(`radar-${p.id}`, currentSkills);
        });
    }

    const formPlayer = document.getElementById('form-player');
    if (formPlayer) {
        formPlayer.onsubmit = (e) => {
            e.preventDefault();
            const editId = document.getElementById('player-edit-id').value;
            const selectedPositions = [];
            document.querySelectorAll('.player-pos-checkbox:checked').forEach(cb => {
                selectedPositions.push(cb.value);
            });

            if (editId) {
                const player = state.players.find(p => p.id === parseInt(editId, 10));
                if (player) {
                    player.name = document.getElementById('player-name').value;
                    player.number = parseInt(document.getElementById('player-number').value, 10);
                    player.position = selectedPositions;
                    saveData();
                    showToast('選手情報を更新しました');
                    document.getElementById('modal-player').classList.add('hidden');
                    openPlayerDetail(player.id);
                    initPlayers();
                }
            } else {
                const skills = [];
                state.skillMetrics.forEach((metric, i) => {
                    const val = document.getElementById(`skill-initial-${i}`);
                    skills.push(val ? parseInt(val.value, 10) : 3);
                });
                const newPlayer = {
                    id: Date.now(),
                    name: document.getElementById('player-name').value,
                    number: parseInt(document.getElementById('player-number').value, 10),
                    position: selectedPositions,
                    history: [
                        {
                            id: Date.now(),
                            date: new Date().toISOString().split('T')[0],
                            comment: '【ポジティブ】\n' + document.getElementById('player-initial-good').value + '\n\n【ネクストステップ】\n' + document.getElementById('player-initial-improve').value,
                            skills: skills
                        }
                    ]
                };
                state.players.push(newPlayer);
                saveData();
                showToast('選手を登録しました');
                document.getElementById('modal-player').classList.add('hidden');
                initPlayers();
            }
        };
    }

    const formAssessment = document.getElementById('form-player-assessment');
    if (formAssessment) {
        formAssessment.onsubmit = (e) => {
            e.preventDefault();
            const playerId = parseInt(document.getElementById('assessment-player-id').value, 10);
            const editId = document.getElementById('assessment-edit-id').value;
            const player = state.players.find(p => p.id === playerId);
            if (player) {
                const skills = [];
                state.skillMetrics.forEach((metric, i) => {
                    const val = document.getElementById(`skill-ass-${i}`);
                    skills.push(val ? parseInt(val.value, 10) : 3);
                });
                const commentText = '【ポジティブ】\n' + document.getElementById('assessment-good').value + '\n\n【ネクストステップ】\n' + document.getElementById('assessment-improve').value;
                const evalDate = document.getElementById('assessment-date').value;

                if (editId) {
                    const hId = parseInt(editId, 10);
                    const hItem = player.history ? player.history.find(h => h.id === hId) : null;
                    if (hItem) {
                        hItem.date = evalDate;
                        hItem.comment = commentText;
                        hItem.skills = skills;
                        showToast('評価を更新しました');
                    }
                } else {
                    if (!player.history) player.history = [];
                    player.history.push({
                        id: Date.now(),
                        date: evalDate,
                        comment: commentText,
                        skills: skills
                    });
                    showToast('評価を記録しました');
                }

                player.history.sort((a, b) => new Date(b.date) - new Date(a.date));
                saveData();
                document.getElementById('modal-player-assessment').classList.add('hidden');
                openPlayerDetail(playerId);
                initPlayers();
            }
        };
    }

    const btnAdd = document.getElementById('btn-add-player');
    if (btnAdd) {
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

        btnAdd.addEventListener('click', () => {
            document.getElementById('player-edit-id').value = '';
            document.getElementById('player-modal-title').textContent = '選手を登録';
            document.getElementById('player-initial-assessment-section').classList.remove('hidden');
            document.getElementById('player-initial-good').setAttribute('required', 'true');
            document.getElementById('player-initial-improve').setAttribute('required', 'true');

            document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);

            openModal('modal-player');
        });
    }

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            openPlayerCSVImportModal();
        });
    }
}