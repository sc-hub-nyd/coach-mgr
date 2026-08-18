// players.js
import { state } from './state.js';
import { escapeHtml, showToast, showCustomConfirm } from './utils.js';
import { saveData, navigate, openModal } from './app-context.js';
import { addDevelopmentNote, buildDevelopmentSummary, removeDevelopmentNote } from './player-development-service.js';

function renderDevelopmentNotebook(player) {
    const metrics = state.skillMetrics || [];
    const summary = buildDevelopmentSummary(player, { matches: state.matches, practices: state.practices, metrics });
    const trends = document.getElementById('pd-notebook-trends');
    const timeline = document.getElementById('pd-notebook-timeline');
    const ratings = document.getElementById('development-note-ratings');
    const playerId = document.getElementById('development-player-id');
    const dateInput = document.getElementById('development-note-date');
    if (playerId) playerId.value = player.id;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (ratings) {
        ratings.innerHTML = metrics.map(metric => `
            <label><span>${escapeHtml(metric)}</span><select class="form-control development-rating" data-metric="${escapeHtml(metric)}"><option value="">未評価</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>`).join('');
    }
    if (trends) {
        trends.innerHTML = summary.skillTrend.length ? summary.skillTrend.map(trend => {
            const delta = trend.delta === null ? '—' : trend.delta > 0 ? `+${trend.delta}` : String(trend.delta);
            const trendClass = trend.delta > 0 ? 'is-up' : trend.delta < 0 ? 'is-down' : 'is-neutral';
            return `<span class="player-notebook-trend ${trendClass}"><strong>${escapeHtml(trend.metric)}</strong><em>${trend.latest ?? '—'}</em><small>${delta}</small></span>`;
        }).join('') : '<p class="text-secondary">スキル評価を記録すると、前回との変化を確認できます。</p>';
    }
    const labels = { note: '育成ノート', observation: '観察メモ', match: '試合', practice: '練習' };
    const icons = { note: 'fa-book-open', observation: 'fa-eye', match: 'fa-futbol', practice: 'fa-person-running' };
    if (timeline) {
        timeline.innerHTML = summary.timeline.length ? summary.timeline.map(item => `
            <article class="player-notebook-entry is-${escapeHtml(item.kind)}">
                <span class="player-notebook-icon"><i class="fa-solid ${icons[item.kind] || 'fa-circle'}"></i></span>
                <div><small>${escapeHtml(item.date || '')} ・ ${labels[item.kind] || '記録'}</small><strong>${escapeHtml(item.title || '')}</strong><p>${escapeHtml(item.detail || '')}</p></div>
                ${item.kind === 'note' ? `<button type="button" class="btn btn-secondary btn-remove-development-note" data-development-note-id="${escapeHtml(item.id)}" aria-label="育成ノートを削除"><i class="fa-solid fa-trash"></i></button>` : ''}
            </article>`).join('') : '<p class="player-notebook-empty">まだ成長ノートはありません。練習・試合後の事実と次の一歩を記録しましょう。</p>';
        timeline.querySelectorAll('.btn-remove-development-note').forEach(button => {
            button.onclick = async () => {
                const proceed = await showCustomConfirm('この育成ノートを削除しますか？', '育成ノートの削除', { okText: '削除する', type: 'danger' });
                if (!proceed) return;
                removeDevelopmentNote(player, button.dataset.developmentNoteId);
                await saveData();
                renderDevelopmentNotebook(player);
                showToast('育成ノートを削除しました');
            };
        });
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
                const parts = hItem.comment.split(/\n【(?:More|ネクストステップ)】\n/);
                if (parts.length === 2) {
                    goodText = parts[0].replace(/【(?:Good！|ポジティブ)】\n/, '');
                    improveText = parts[1];
                } else {
                    goodText = hItem.comment.replace(/【(?:Good！|ポジティブ)】\n/, '');
                }
            }
            document.getElementById('assessment-good').value = goodText;
            document.getElementById('assessment-improve').value = improveText;

            // スキルコンテナの処理は削除

            openModal('modal-player-assessment');
        };
    });

    document.querySelectorAll('.btn-delete-assessment').forEach(btn => {
        btn.onclick = async (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            const proceed = await showCustomConfirm('この過去の評価記録を削除しますか？', '評価記録の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
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
    // ★ ここから新しいプロフィール項目のセット
    document.getElementById('pd-playstyle').textContent = p.playStyle || '未設定';
    document.getElementById('pd-shortfocus').textContent = p.shortFocus || '未設定';

    const spContainer = document.getElementById('pd-strongpoints');
    if (p.strongPoints && p.strongPoints.length > 0) {
        spContainer.innerHTML = p.strongPoints.map(sp => `
            <div>
                <span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; font-size:0.75rem; padding:0.15rem 0.4rem; margin-bottom:0.2rem; display:inline-block;"><i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}</span>
                <div style="font-size:0.85rem; color:var(--text-primary); line-height:1.4;">${escapeHtml(sp.text)}</div>
            </div>
        `).join('');
    } else {
        spContainer.innerHTML = '<div style="font-size:0.85rem; color:var(--text-secondary);">未設定</div>';
    }

    openModal('modal-player-detail');

    // ★ drawRadarChart の呼び出しを完全に削除

    const btnAddAssessment = document.getElementById('btn-add-assessment');
    if (btnAddAssessment) {
        btnAddAssessment.onclick = () => {
            document.getElementById('assessment-player-id').value = p.id;
            document.getElementById('assessment-edit-id').value = '';
            const titleEl = document.getElementById('assessment-modal-title');
            if (titleEl) titleEl.textContent = '新しい観察メモを記録';
            document.getElementById('assessment-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('assessment-good').value = '';
            document.getElementById('assessment-improve').value = '';

            // スキルコンテナの生成処理は削除

            openModal('modal-player-assessment');
        };
    }

    const btnEdit = document.getElementById('btn-edit-player-detail');
    if (btnEdit) {
        btnEdit.onclick = () => {
            document.getElementById('player-edit-id').value = p.id;
            document.getElementById('player-modal-title').textContent = '選手情報を編集';

            document.getElementById('player-name').value = p.name;
            document.getElementById('player-number').value = p.number;

            // ★ 編集時にカルテ情報をフォームにセット
            document.getElementById('player-playstyle').value = p.playStyle || '';
            document.getElementById('player-strong-key-1').value = p.strongPoints?.[0]?.key || '';
            document.getElementById('player-strong-text-1').value = p.strongPoints?.[0]?.text || '';
            document.getElementById('player-strong-key-2').value = p.strongPoints?.[1]?.key || '';
            document.getElementById('player-strong-text-2').value = p.strongPoints?.[1]?.text || '';
            document.getElementById('player-short-focus').value = p.shortFocus || '';

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
        btnDel.onclick = async () => {
            const proceed = await showCustomConfirm('この選手を削除しますか？', '選手の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.players = state.players.filter(pl => pl.id !== p.id);
                saveData();
                showToast('削除しました');
                document.getElementById('modal-player-detail').classList.add('hidden');
                initPlayers();
            }
        };
    }

    renderDevelopmentNotebook(p);
    const developmentForm = document.getElementById('form-player-development-note');
    if (developmentForm) {
        developmentForm.onsubmit = event => {
            event.preventDefault();
            const skillRatings = Object.fromEntries([...developmentForm.querySelectorAll('.development-rating')].map(input => [input.dataset.metric, input.value]));
            try {
                addDevelopmentNote(p, {
                    date: document.getElementById('development-note-date').value,
                    focus: document.getElementById('development-note-focus').value,
                    observation: document.getElementById('development-note-observation').value,
                    nextStep: document.getElementById('development-note-next-step').value,
                    skillRatings
                });
                saveData();
                developmentForm.reset();
                renderDevelopmentNotebook(p);
                showToast('成長ノートを保存しました');
            } catch (error) {
                showToast(error.message || '成長ノートを保存できませんでした');
            }
        };
    }

    const goalsPlIdEl = document.getElementById('goals-player-id');
    if (goalsPlIdEl) goalsPlIdEl.value = p.id;

    const shortEl = document.getElementById('player-goal-short');
    if (shortEl) shortEl.value = (p.goals && p.goals.shortTerm) ? p.goals.shortTerm : '';

    const longEl = document.getElementById('player-goal-long');
    if (longEl) longEl.value = (p.goals && p.goals.longTerm) ? p.goals.longTerm : '';

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
    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) return;

    if (state.players.length === 0) {
        playerGrid.innerHTML = `
            <section class="c-empty-state" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon fa-solid fa-users" aria-hidden="true"></i>
                    <h3 class="c-empty-state__title">登録選手がいません</h3>
                    <p class="c-empty-state__text">選手を登録して、強みや指導フォーカスの設定、試合での出場ポジション設定、成長履歴の管理を始めましょう。</p>
                    <button class="btn btn-primary" id="btn-empty-add-player"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> 最初の選手を追加</button>
                </div>
            </section>
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
            const badges = (Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
                if (!pos) return '';
                const lower = pos.toLowerCase();
                let badgeClass = 'badge-sub';
                if (lower === 'fw') badgeClass = 'badge-fw';
                else if (lower === 'mf') badgeClass = 'badge-mf';
                else if (lower === 'df') badgeClass = 'badge-df';
                else if (lower === 'gk') badgeClass = 'badge-gk';
                return `<span class="player-position ${badgeClass}" style="font-size:0.7rem; padding:0.1rem 0.35rem; border-radius:12px; font-weight:600; display:inline-block;">${pos}</span>`;
            }).join('');

            const spTags = (p.strongPoints || []).filter(sp => sp.key).map(sp =>
                `<span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; font-size:0.7rem; padding:0.15rem 0.4rem;"><i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}</span>`
            ).join('');

            return `
                <div class="player-card" style="cursor:pointer; display:flex; flex-direction:column;" onclick="openPlayerDetail(${p.id});">
                    <div class="player-card-header" style="border-bottom: 1px solid var(--surface-border); padding-bottom: 0.6rem; margin-bottom: 0.6rem;">
                        <div>
                            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-bottom:0.3rem;">${badges}</div>
                            <div style="font-size:1.15rem; font-weight:bold;">${escapeHtml(p.name)}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column;">
                        <div style="font-size:0.8rem; font-weight:600; color:var(--text-primary); margin-bottom:0.6rem; line-height:1.4;">
                            ${escapeHtml(p.playStyle || 'プレースタイル未設定')}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:auto;">
                            ${spTags}
                        </div>
                        <div style="margin-top:0.8rem; padding-top:0.6rem; border-top:1px dashed var(--surface-border); font-size:0.75rem; color:var(--text-secondary); font-weight:600;">
                            <i class="fa-solid fa-crosshairs" style="color:var(--primary);"></i> ${escapeHtml(p.shortFocus || 'フォーカス未設定')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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

            const playStyle = document.getElementById('player-playstyle') ? document.getElementById('player-playstyle').value.trim() : '';
            const key1 = document.getElementById('player-strong-key-1') ? document.getElementById('player-strong-key-1').value : '';
            const text1 = document.getElementById('player-strong-text-1') ? document.getElementById('player-strong-text-1').value.trim() : '';
            const key2 = document.getElementById('player-strong-key-2') ? document.getElementById('player-strong-key-2').value : '';
            const text2 = document.getElementById('player-strong-text-2') ? document.getElementById('player-strong-text-2').value.trim() : '';
            const shortFocus = document.getElementById('player-short-focus') ? document.getElementById('player-short-focus').value.trim() : '';

            const strongPoints = [
                { key: key1, text: text1 },
                { key: key2, text: text2 }
            ].filter(sp => sp.key || sp.text);

            if (editId) {
                const player = state.players.find(p => p.id === parseInt(editId, 10));
                if (player) {
                    player.name = document.getElementById('player-name').value;
                    player.number = parseInt(document.getElementById('player-number').value, 10);
                    player.position = selectedPositions;
                    player.playStyle = playStyle;
                    player.strongPoints = strongPoints;
                    player.shortFocus = shortFocus;

                    saveData();
                    showToast('選手情報を更新しました');
                    document.getElementById('modal-player').classList.add('hidden');
                    openPlayerDetail(player.id);
                    initPlayers();
                }
            } else {
                const newPlayer = {
                    id: Date.now(),
                    name: document.getElementById('player-name').value,
                    number: parseInt(document.getElementById('player-number').value, 10),
                    position: selectedPositions,
                    playStyle: playStyle,
                    strongPoints: strongPoints,
                    shortFocus: shortFocus,
                    history: []
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
                const goodText = document.getElementById('assessment-good') ? document.getElementById('assessment-good').value.trim() : '';
                const improveText = document.getElementById('assessment-improve') ? document.getElementById('assessment-improve').value.trim() : '';
                let commentText = '【Good！】\n' + goodText;
                if (improveText) {
                    commentText += '\n【More】\n' + improveText;
                }
                const evalDate = document.getElementById('assessment-date').value;

                if (editId) {
                    const hId = parseInt(editId, 10);
                    const hItem = player.history ? player.history.find(h => h.id === hId) : null;
                    if (hItem) {
                        hItem.date = evalDate;
                        hItem.comment = commentText;
                        showToast('観察メモを更新しました');
                    }
                } else {
                    if (!player.history) player.history = [];
                    player.history.push({
                        id: Date.now(),
                        date: evalDate,
                        comment: commentText
                    });
                    showToast('観察メモを記録しました');
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

        const updateStrongKeySelects = () => {
            const optionsHtml = '<option value="">-- 強みの軸を選択 --</option>' +
                state.skillMetrics.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
            const sel1 = document.getElementById('player-strong-key-1');
            const sel2 = document.getElementById('player-strong-key-2');
            if (sel1) sel1.innerHTML = optionsHtml;
            if (sel2) sel2.innerHTML = optionsHtml;
        };

        btnAdd.addEventListener('click', () => {
            document.getElementById('player-edit-id').value = '';
            document.getElementById('player-modal-title').textContent = '選手を登録';

            const psEl = document.getElementById('player-playstyle');
            if (psEl) psEl.value = '';
            const st1El = document.getElementById('player-strong-text-1');
            if (st1El) st1El.value = '';
            const st2El = document.getElementById('player-strong-text-2');
            if (st2El) st2El.value = '';
            const sfEl = document.getElementById('player-short-focus');
            if (sfEl) sfEl.value = '';

            updateStrongKeySelects();
            document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);

            openModal('modal-player');
        });

        updateStrongKeySelects();
    }

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            openPlayerCSVImportModal();
        });
    }

    // Setup View Switcher Tabs
    const tabsContainer = document.getElementById('player-view-tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.player-view-tab').forEach(tab => {
            tab.onclick = (e) => {
                const targetView = e.currentTarget.dataset.view;

                tabsContainer.querySelectorAll('.player-view-tab').forEach(t => {
                    t.classList.remove('active', 'is-active');
                    t.setAttribute('aria-selected', 'false');
                });

                e.currentTarget.classList.add('active', 'is-active');
                e.currentTarget.setAttribute('aria-selected', 'true');

                document.querySelectorAll('.player-subview').forEach(view => {
                    view.classList.add('hidden');
                });

                if (targetView === 'cards') {
                    document.getElementById('player-grid')?.classList.remove('hidden');
                } else if (targetView === 'participation') {
                    document.getElementById('player-view-participation')?.classList.remove('hidden');
                    renderParticipationGraph();
                }
            };
        });
    }
}

let currentHeatmapPosFilter = 'ALL';

export function renderParticipationGraph() {
    const container = document.getElementById('player-view-participation');
    if (!container) return;

    const totalMatches = state.matches.length;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const recentPracs = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
    const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
    const totalEvents = recentPracs.length + recentMatches.length;

    const playersStats = state.players.map(p => {
        let matchCount = 0, goals = 0, assists = 0;
        state.matches.forEach(m => {
            if ((m.presentPlayerIds || []).includes(p.id)) matchCount++;
            if (m.goalRecords) {
                m.goalRecords.forEach(r => {
                    if (r.scorerId === p.id) goals++;
                    if (r.assistId === p.id) assists++;
                });
            }
        });

        let presentCount = 0;
        recentPracs.forEach(prac => { if ((prac.presentPlayerIds || []).includes(p.id)) presentCount++; });
        recentMatches.forEach(m => { if ((m.presentPlayerIds || []).includes(p.id)) presentCount++; });
        const attPct = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0;
        const matchPct = totalMatches > 0 ? Math.round((matchCount / totalMatches) * 100) : 0;

        return { ...p, matchCount, matchPct, goals, assists, attPct };
    });

    playersStats.sort((a, b) => b.matchCount - a.matchCount);

    const cat1List = (state.positions || ['GK', 'DF', 'MF', 'FW']).map(pos => pos.toUpperCase());
    const cat2ToCat1Map = {
        'CB': 'DF', 'SB': 'DF',
        'CH': 'MF', 'SH': 'MF', 'OH': 'MF', 'DH': 'MF',
        'ST': 'FW', 'WG': 'FW'
    };

    const rowsHTML = playersStats.map(p => {
        const rawPositions = (Array.isArray(p.position) ? p.position : [p.position]).filter(Boolean);
        let cat1Positions = rawPositions
            .map(pos => {
                const u = pos.toUpperCase();
                if (cat1List.includes(u)) return u;
                if (cat2ToCat1Map[u]) return cat2ToCat1Map[u];
                return null;
            })
            .filter(Boolean);
        cat1Positions = [...new Set(cat1Positions)];
        const positionsStr = cat1Positions.join(', ');

        return `
            <div class="player-participation-row" onclick="openPlayerDetail(${p.id})">
                <div class="player-participation-player">
                    <span class="heatmap-player-num">${p.number}</span>
                    <div class="player-participation-player-meta">
                        <strong>${escapeHtml(p.name)}</strong>
                        <span>${positionsStr || '-'}</span>
                    </div>
                </div>
                <div class="player-participation-metrics">
                    <div class="player-participation-metric-labels">
                        <span>試合参加: <strong>${p.matchCount}試合 (${p.matchPct}%)</strong></span>
                        <span>30日出席率: <strong>${p.attPct}%</strong></span>
                    </div>
                    <div class="stat-bar-outer">
                        <div class="stat-bar-inner" style="width:${p.matchPct}%; background:linear-gradient(90deg, #3b82f6, #9333ea);"></div>
                    </div>
                </div>
                <div class="player-participation-stats">
                    <span title="得点"><i class="fa-solid fa-futbol" style="color:var(--primary);"></i> <strong>${p.goals}</strong></span>
                    <span title="アシスト"><i class="fa-solid fa-shoe-prints" style="color:#22c55e; transform:rotate(45deg);"></i> <strong>${p.assists}</strong></span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
            <div class="card c-card player-participation-panel">
            <h3 class="player-participation-title">
                <i class="fa-solid fa-chart-column" style="color:#9333ea;"></i> 試合出場機会＆スタッツ比較
            </h3>
            <div class="player-participation-list">
                ${rowsHTML}
            </div>
        </div>
    `;
}