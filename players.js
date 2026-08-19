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

export function populateStrongKeySelects() {
    const optionsHtml = '<option value="">-- 強みの軸を選択 --</option>' +
        (state.skillMetrics || []).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    const sel1 = document.getElementById('player-strong-key-1');
    const sel2 = document.getElementById('player-strong-key-2');
    if (sel1) sel1.innerHTML = optionsHtml;
    if (sel2) sel2.innerHTML = optionsHtml;
}

export function openPlayerDetail(id) {
    navigate('player-detail', { playerId: id });
}

export function openPlayerEditModal(p) {
    if (!p) return;
    const editIdEl = document.getElementById('player-edit-id');
    const titleEl = document.getElementById('player-modal-title');
    const nameEl = document.getElementById('player-name');
    const numEl = document.getElementById('player-number');
    const gradeEl = document.getElementById('player-grade');
    const playStyleEl = document.getElementById('player-playstyle');
    const key1El = document.getElementById('player-strong-key-1');
    const text1El = document.getElementById('player-strong-text-1');
    const key2El = document.getElementById('player-strong-key-2');
    const text2El = document.getElementById('player-strong-text-2');
    const shortFocusEl = document.getElementById('player-short-focus');

    if (editIdEl) editIdEl.value = p.id;
    if (titleEl) titleEl.textContent = '選手を編集';
    const btnSubmit = document.querySelector('#form-player button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = '更新';
    if (nameEl) nameEl.value = p.name || '';
    if (numEl) numEl.value = p.number || '';
    if (gradeEl) gradeEl.value = p.grade || '';
    if (playStyleEl) playStyleEl.value = p.playStyle || '';

    populateStrongKeySelects();

    if (key1El) key1El.value = p.strongPoints?.[0]?.key || '';
    if (text1El) text1El.value = p.strongPoints?.[0]?.text || '';
    if (key2El) key2El.value = p.strongPoints?.[1]?.key || '';
    if (text2El) text2El.value = p.strongPoints?.[1]?.text || '';
    if (shortFocusEl) shortFocusEl.value = p.shortFocus || '';

    const posContainer = document.getElementById('player-position-container');
    if (posContainer) {
        posContainer.innerHTML = (state.positions || []).map(pos => {
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

    openModal('modal-player');
}

export function initPlayerDetailView(playerId) {
    const p = state.players.find(pl => pl.id === playerId);
    if (!p) {
        showToast('選手が見つかりませんでした');
        navigate('players');
        return;
    }

    // 選手ヘッダー
    const numEl = document.getElementById('pd-number');
    const nameEl = document.getElementById('pd-name');
    const posEl = document.getElementById('pd-position');
    const metaEl = document.getElementById('pd-meta');
    if (numEl) numEl.textContent = p.number ? `#${p.number}` : '-';
    if (nameEl) nameEl.textContent = p.name || '名前なし';
    if (posEl) posEl.textContent = Array.isArray(p.position) ? p.position.join(' / ') : (p.position || 'ポジション未設定');
    if (metaEl) metaEl.textContent = p.grade ? `${p.grade}` : '学年未設定';

    // 編集ボタン
    const btnEdit = document.getElementById('pd-btn-edit');
    if (btnEdit) {
        btnEdit.onclick = () => {
            openPlayerEditModal(p);
        };
    }

    // 削除ボタン
    const btnDelete = document.getElementById('pd-btn-delete');
    if (btnDelete) {
        btnDelete.onclick = async () => {
            const proceed = await showCustomConfirm(`「${p.name}」選手を削除しますか？`, '選手の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.players = state.players.filter(pl => pl.id !== p.id);
                saveData();
                showToast('選手を削除しました');
                navigate('players');
            }
        };
    }

    // スタッツ集計
    let playerGoals = 0;
    let playerAssists = 0;
    let playerMatches = 0;
    state.matches.forEach(m => {
        let participated = false;
        if (m.formations) {
            m.formations.forEach(f => {
                if (f.slots && f.slots.some(s => s.playerId === p.id)) participated = true;
            });
        }
        if (participated) playerMatches++;
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId === p.id) playerGoals++;
                if (r.assistId === p.id) playerAssists++;
            });
        }
    });

    // 出席率
    let attendanceRate = '—';
    if (state.practices && state.practices.length > 0) {
        const total = state.practices.length;
        const attended = state.practices.filter(pr => pr.attendedPlayerIds && pr.attendedPlayerIds.includes(p.id)).length;
        attendanceRate = total > 0 ? `${Math.round((attended / total) * 100)}%` : '—';
    }

    const elAtt = document.getElementById('pd-attendance-rate');
    const elMatches = document.getElementById('pd-matches-count');
    const elGoals = document.getElementById('pd-goals');
    const elAssists = document.getElementById('pd-assists');
    if (elAtt) elAtt.textContent = attendanceRate;
    if (elMatches) elMatches.textContent = `${playerMatches} 試合`;
    if (elGoals) elGoals.textContent = `${playerGoals} 点`;
    if (elAssists) elAssists.textContent = `${playerAssists} 点`;


    // タイムライン描画
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

    const timelineEl = document.getElementById('pd-timeline');
    if (timelineEl) {
        timelineEl.innerHTML = timeline.length > 0 ? timeline.map(item => {
            if (item.type === 'assessment') {
                const hId = item.data ? item.data.id : null;
                const editBtn = hId ? `<button type="button" class="btn btn-secondary btn-sm btn-edit-assessment" data-history-id="${hId}"><i class="fa-solid fa-pen"></i> 編集</button>` : '';
                const delBtn = hId ? `<button type="button" class="btn btn-danger btn-sm btn-delete-assessment" data-history-id="${hId}"><i class="fa-solid fa-trash"></i></button>` : '';
                return `
                    <article class="c-data-list__item player-history-item" style="margin-bottom:var(--space-2);">
                        <div class="c-data-list__header">
                            <div class="c-data-list__identity"><i class="fa-solid fa-clipboard-user"></i> ${item.date} <span class="c-status c-status--info">指導・評価</span></div>
                            ${hId ? `<div class="c-data-list__actions c-action-group">${editBtn}${delBtn}</div>` : ''}
                        </div>
                        <div class="c-data-list__body" style="white-space:pre-wrap; line-height:1.5; margin-top:var(--space-1);">${escapeHtml(item.comment || '')}</div>
                    </article>
                `;
            } else {
                const matchingMatch = state.matches.find(m => m.id === item.matchId);
                const firstForm = (matchingMatch && matchingMatch.formations && matchingMatch.formations.length > 0) ? matchingMatch.formations[0] : null;
                const linkBtn = firstForm ? `<button type="button" class="btn btn-secondary btn-sm btn-timeline-anim" data-match-id="${matchingMatch.id}" data-form-id="${firstForm.id}"><i class="fa-solid fa-person-running"></i> 作図を見る</button>` : '';
                return `
                    <article class="c-data-list__item player-history-item match-timeline-item" style="margin-bottom:var(--space-2);">
                        <div class="c-data-list__header">
                            <div class="c-data-list__identity"><i class="fa-solid fa-futbol"></i> ${item.date} <span class="c-status c-status--muted">試合コメント</span></div>
                            ${linkBtn ? `<div class="c-data-list__actions c-action-group">${linkBtn}</div>` : ''}
                        </div>
                        <p class="c-data-list__meta" style="margin:var(--space-1) 0; font-size:var(--text-meta-size); color:var(--text-secondary);">${escapeHtml(item.matchDetails)}</p>
                        <p class="c-data-list__body" style="white-space:pre-wrap; line-height:1.5;">${escapeHtml(item.comment || '')}</p>
                    </article>
                `;
            }
        }).join('') : '<p class="text-secondary" style="padding:var(--space-3); text-align:center;">成長メモ・評価の記録がまだありません。</p>';
    }

    document.querySelectorAll('.btn-timeline-anim').forEach(btn => {
        btn.onclick = (e) => {
            const matchId = parseInt(e.currentTarget.dataset.matchId, 10);
            const formId = parseInt(e.currentTarget.dataset.formId, 10);
            navigate('animation', { matchId, formId });
        };
    });


    // タイムラインの編集・削除ボタンバインド
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

            openModal('modal-player-assessment');
        };
    });

    document.querySelectorAll('.btn-delete-assessment').forEach(btn => {
        btn.onclick = async (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            const proceed = await showCustomConfirm('この評価記録を削除しますか？', '評価記録の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                p.history = p.history.filter(h => h.id !== hId);
                saveData();
                showToast('評価を削除しました');
                initPlayerDetailView(p.id);
            }
        };
    });

    // 観察メモ追加ボタン
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
            openModal('modal-player-assessment');
        };
    }

    // 特徴・プレースタイル
    const playStyleEl = document.getElementById('pd-playstyle');
    const shortFocusEl = document.getElementById('pd-shortfocus');
    if (playStyleEl) playStyleEl.textContent = p.playStyle || '未設定';
    if (shortFocusEl) shortFocusEl.textContent = p.shortFocus || '未設定';

    const spContainer = document.getElementById('pd-strongpoints');
    if (spContainer) {
        if (p.strongPoints && p.strongPoints.length > 0) {
            spContainer.innerHTML = p.strongPoints.map(sp => `
                <div class="c-card" style="padding:var(--space-2) var(--space-3); background:var(--color-surface-subtle); border-radius:var(--radius-sm); margin-bottom:var(--space-2);">
                    <span class="c-status c-status--info c-status--stacked"><i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}</span>
                    <div style="font-size:var(--text-dense-size); color:var(--text-primary); line-height:1.4;">${escapeHtml(sp.text)}</div>
                </div>
            `).join('');
        } else {
            spContainer.innerHTML = '<p class="text-secondary" style="font-size:var(--text-meta-size);">ストロングポイントは未設定です。</p>';
        }
    }

    // 出場試合履歴一覧
    const matchesListEl = document.getElementById('pd-matches-list');
    if (matchesListEl) {
        const playerMatchesList = state.matches.filter(m => {
            return m.formations && m.formations.some(f => f.slots && f.slots.some(s => s.playerId === p.id));
        });
        matchesListEl.innerHTML = playerMatchesList.length > 0 ? playerMatchesList.map(m => {
            const goalsInMatch = (m.goalRecords || []).filter(r => r.scorerId === p.id).length;
            const assistsInMatch = (m.goalRecords || []).filter(r => r.assistId === p.id).length;
            let statsBadge = '';
            if (goalsInMatch > 0) statsBadge += ` <span class="c-status c-status--warning">${goalsInMatch}得点</span>`;
            if (assistsInMatch > 0) statsBadge += ` <span class="c-status c-status--success">${assistsInMatch}アシスト</span>`;
            return `
                <div class="c-data-item" style="cursor:pointer;" onclick="navigate('match-detail', { matchId: ${m.id} })">
                    <div class="c-data-item__label">
                        <strong>vs ${escapeHtml(m.opponent)}</strong>
                        <div style="font-size:var(--text-meta-size); color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${escapeHtml(m.type || '試合')}${statsBadge}</div>
                    </div>
                    <span class="c-status c-status--info">${escapeHtml(m.result || '詳細')}</span>
                </div>
            `;
        }).join('') : '<p class="text-secondary" style="padding:var(--space-3); text-align:center;">出場した試合の記録はありません。</p>';
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
                                <td><span class="c-status c-status--muted c-status--compact">${p.position}</span></td>
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
                const statusVariant = lower === 'fw'
                    ? ''
                    : lower === 'mf'
                        ? 'c-status--warning'
                        : lower === 'df'
                            ? 'c-status--info'
                            : lower === 'gk'
                                ? 'c-status--success'
                                : 'c-status--muted';
                return `<span class="player-position c-status c-status--compact ${statusVariant}">${pos}</span>`;
            }).join('');

            const spTags = (p.strongPoints || []).filter(sp => sp.key).map(sp =>
                `<span class="c-status c-status--info"><i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}</span>`
            ).join('');

            return `
                <div class="player-card c-card" style="cursor:pointer; display:flex; flex-direction:column;" onclick="openPlayerDetail(${p.id});">
                    <div class="player-card-header">
                        <div>
                            <div style="display:flex; gap:var(--space-1); flex-wrap:wrap; margin-bottom:var(--space-1);">${badges}</div>
                            <div style="font-size:1.15rem; font-weight:bold;">${escapeHtml(p.name)}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column;">
                        <div style="font-size:var(--text-meta-size); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-2); line-height:1.4;">
                            ${escapeHtml(p.playStyle || 'プレースタイル未設定')}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:var(--space-1); margin-bottom:auto;">
                            ${spTags}
                        </div>
                        <div style="margin-top:var(--space-2); padding-top:var(--space-2); border-top:1px dashed var(--surface-border); font-size:var(--text-meta-size); color:var(--text-secondary); font-weight:600;">
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
            const grade = document.getElementById('player-grade') ? document.getElementById('player-grade').value.trim() : '';
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
                    player.grade = grade;
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
                    grade: grade,
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
            posContainer.innerHTML = (state.positions || []).map(p => `
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

        btnAdd.addEventListener('click', () => {
            document.getElementById('player-edit-id').value = '';
            document.getElementById('player-modal-title').textContent = '選手を登録';

            const nameEl = document.getElementById('player-name');
            if (nameEl) nameEl.value = '';
            const numEl = document.getElementById('player-number');
            if (numEl) numEl.value = '';
            const gradeEl = document.getElementById('player-grade');
            if (gradeEl) gradeEl.value = '';
            const psEl = document.getElementById('player-playstyle');
            if (psEl) psEl.value = '';
            const st1El = document.getElementById('player-strong-text-1');
            if (st1El) st1El.value = '';
            const st2El = document.getElementById('player-strong-text-2');
            if (st2El) st2El.value = '';
            const sfEl = document.getElementById('player-short-focus');
            if (sfEl) sfEl.value = '';

            populateStrongKeySelects();
            document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);

            openModal('modal-player');
        });

        populateStrongKeySelects();
    }

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            openPlayerCSVImportModal();
        });
    }

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