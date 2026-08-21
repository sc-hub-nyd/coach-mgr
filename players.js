// players.js
import { state } from './state.js';
import { escapeHtml, showToast, showCustomConfirm, getNendo } from './utils.js';
import { saveData, navigate, openModal } from './app-context.js';
import { addDevelopmentNote, buildDevelopmentSummary, removeDevelopmentNote } from './player-development-service.js';
import { getMatchGoalRecords, getPlayerStatistics } from './player-statistics-service.js';


function getRelativeGrade(currentGrade, recordNendo, currentNendo) {
    const diff = parseInt(recordNendo, 10) - parseInt(currentNendo, 10);
    if (!currentGrade) return '';
    if (diff === 0) return currentGrade;
    const match = currentGrade.match(/(\d+)/);
    if (match) {
        const num = parseInt(match[1], 10);
        const newNum = num + diff;
        if (newNum > 0) return currentGrade.replace(match[1], newNum);
    }
    return '';
}

function renderDevelopmentNotebook(player) {
    const canEdit = state.currentUserRole === 'coach';
    const metrics = state.skillMetrics || [];
    const summary = buildDevelopmentSummary(player, { matches: state.matches, practices: state.practices, metrics });
    const trends = document.getElementById('pd-notebook-trends');
    const timeline = document.getElementById('pd-notebook-timeline');
    const searchInput = document.getElementById('input-notebook-search');
    const filterChips = document.getElementById('notebook-type-filters');
    const ratings = document.getElementById('development-note-ratings');
    const playerId = document.getElementById('development-player-id');
    const dateInput = document.getElementById('development-note-date');
    if (playerId) playerId.value = player.id;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (ratings) {
        ratings.innerHTML = metrics.map(metric => `
            <label class="c-form-field"><span class="c-form-field__label">${escapeHtml(metric)}</span><select class="c-input form-control development-rating" data-metric="${escapeHtml(metric)}"><option value="">未評価</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>`).join('');
    }
    if (trends) {
        trends.innerHTML = summary.skillTrend.length ? summary.skillTrend.map(trend => {
            const phaseMap = { 1: '🌱 挑戦中', 2: '💦 基礎固め', 3: '⚖️ 安定', 4: '🔥 実力発揮', 5: '⭐ 圧倒的強み' };
            const phaseText = trend.latest ? phaseMap[trend.latest] : '—';
            let deltaText = '—';
            let trendClass = '';
            if (trend.delta !== null) {
                if (trend.delta > 0) { deltaText = '📈 成長サイクル'; trendClass = 'c-metric--positive'; }
                else if (trend.delta < 0) { deltaText = '🔍 振り返り期'; trendClass = 'c-metric--negative'; }
                else { deltaText = '➡️ キープ'; trendClass = 'c-metric--neutral'; }
            }
            return `<article class="c-metric c-metric--inline ${trendClass}"><div class="c-metric__content"><span class="c-metric__label">${escapeHtml(trend.metric)}</span><strong class="c-metric__value" style="font-size: 1.1rem;">${phaseText}</strong><small class="c-metric__note">${deltaText}</small></div></article>`;
        }).join('') : '<p class="c-focus-summary__note">スキル評価を記録すると、現在のフェーズが表示されます。</p>';
    }
    const labels = { note: '育成ノート', observation: '観察メモ', match: '試合', practice: '練習' };
    const icons = { note: 'ti-footprints', observation: 'ti-footprints', match: 'ti ti-ball-football', practice: 'ti ti-run' };
    
    // タイムライン描画関数（インラインフィルター対応・階層化）
    const renderTimeline = () => {
        if (!timeline) return;
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeChip = filterChips ? filterChips.querySelector('.active') : null;
        const filterType = activeChip ? activeChip.dataset.type : 'all';

        const filtered = summary.timeline.filter(item => {
            if (filterType !== 'all' && item.kind !== filterType) return false;
            if (query) {
                const text = `${item.title || ''} ${item.detail || ''}`.toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            timeline.innerHTML = '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-search c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">該当する記録がありません。</p></div></div>';
            return;
        }

        const todayNendo = getNendo(new Date().toISOString().slice(0, 10));
        const grouped = {};
        
        filtered.forEach(item => {
            const itemNendo = getNendo(item.date);
            const mm = parseInt(item.date.split('-')[1], 10);
            
            if (!grouped[itemNendo]) grouped[itemNendo] = { items: [], months: {} };
            grouped[itemNendo].items.push(item);
            
            // Month key is just the month number to sort properly within the Nendo
            if (!grouped[itemNendo].months[mm]) grouped[itemNendo].months[mm] = { items: [], focus: null };
            grouped[itemNendo].months[mm].items.push(item);
        });

        Object.keys(grouped).forEach(nendo => {
            Object.keys(grouped[nendo].months).forEach(mm => {
                const mGroup = grouped[nendo].months[mm];
                const notes = mGroup.items.filter(i => i.kind === 'note' && i.note && i.note.focus);
                if (notes.length > 0) mGroup.focus = notes[0].note.focus;
            });
        });

        let html = '';
        const isSearchActive = query.length > 0 || filterType !== 'all';
        let isFirstMonthGlobal = true;
        
        const sortedNendos = Object.keys(grouped).sort((a, b) => b - a);
        sortedNendos.forEach((nendo, nIndex) => {
            const isFirstChapter = nIndex === 0;
            const isChapterExpanded = isFirstChapter || isSearchActive;
            const chapterArrow = isChapterExpanded ? '▼' : '▶';
            
            const gradeStr = getRelativeGrade(player.grade, nendo, todayNendo);
            const titleText = gradeStr ? `${chapterArrow} ${escapeHtml(gradeStr)} ${nendo}年度` : `${chapterArrow} ${nendo}年度`;
            const nendoCount = grouped[nendo].items.length;
            
            html += `
                <div class="c-timeline-chapter" style="cursor: pointer; user-select: none;" onclick="const s = this.nextElementSibling; const isHidden = s.classList.toggle('is-collapsed'); const t = this.querySelector('.c-timeline-chapter__title'); t.innerHTML = t.innerHTML.replace(isHidden ? '▼' : '▶', isHidden ? '▶' : '▼');">
                    <span class="c-timeline-chapter__title">${titleText}</span>
                    <span class="c-timeline-chapter__count">${nendoCount}件</span>
                </div>
                <div class="c-timeline-grid ${isChapterExpanded ? '' : 'is-collapsed'}">
                    <div class="c-timeline-section">
            `;

            // Month sort desc (e.g. 12, 11, ... 1) inside a nendo, wait nendo starts from 4 to 3.
            // If month is 1,2,3 it belongs to next year's early months, so for desc sorting in Nendo:
            // 3, 2, 1, 12, 11, ... 4
            const sortedMonths = Object.keys(grouped[nendo].months).sort((a, b) => {
                const ma = parseInt(a, 10) <= 3 ? parseInt(a, 10) + 12 : parseInt(a, 10);
                const mb = parseInt(b, 10) <= 3 ? parseInt(b, 10) + 12 : parseInt(b, 10);
                return mb - ma;
            });

            sortedMonths.forEach(mm => {
                const mGroup = grouped[nendo].months[mm];
                const isMonthExpanded = isFirstMonthGlobal || isSearchActive;
                const mArrow = isMonthExpanded ? '▼' : '▶';
                const mTitleText = mGroup.focus ? `${mArrow} ${mm}月 ${mGroup.focus}` : `${mArrow} ${mm}月`;
                
                html += `
                    <div class="c-timeline-route" style="cursor: pointer; user-select: none;" onclick="const s = this.nextElementSibling; const isHidden = s.classList.toggle('is-collapsed'); const t = this.querySelector('.c-timeline-route__title'); t.innerHTML = t.innerHTML.replace(isHidden ? '▼' : '▶', isHidden ? '▶' : '▼');">
                        <span class="c-timeline-route__title">${escapeHtml(mTitleText)}</span>
                        <span class="c-timeline-route__count">${mGroup.items.length}件</span>
                    </div>
                    <div class="c-timeline-grid ${isMonthExpanded ? '' : 'is-collapsed'}">
                        <div class="c-timeline-items">
                `;
                
                mGroup.items.forEach(item => {
                    const isMatch = item.kind === 'match';
                    const clickAttr = isMatch ? ` onclick="window.router.navigate('match-detail', { id: ${item.id} })" style="cursor: pointer;" title="試合詳細を見る"` : '';
                    html += `
                    <article class="c-data-list__item is-${escapeHtml(item.kind)}"${clickAttr}>
                        <span class="c-data-list__identity"><i class="${icons[item.kind] || 'ti ti-circle'}" aria-hidden="true"></i></span>
                        <div class="c-data-list__content"><span class="c-data-list__meta">${escapeHtml(item.date || '')} ・ ${labels[item.kind] || '記録'}</span><strong>${escapeHtml(item.title || '')}</strong><p class="c-data-list__body">${escapeHtml(item.detail || '')}</p></div>
                        ${canEdit && item.kind === 'note' ? `<div class="c-data-list__actions"><button type="button" class="c-button btn c-button--secondary btn-secondary btn-remove-development-note" data-development-note-id="${escapeHtml(item.id)}" aria-label="育成ノートを削除"><i class="ti ti-trash"></i></button></div>` : ''}
                    </article>`;
                });
                
                html += `
                        </div>
                    </div>`; // Close c-timeline-items inner and grid
                isFirstMonthGlobal = false;
            });
            
            html += `
                </div>
            </div>`; // Close c-timeline-section inner and grid
        });

        timeline.innerHTML = html;
        
        timeline.querySelectorAll('.btn-remove-development-note').forEach(button => {
            button.onclick = async () => {
                if (!canEdit) {
                    showToast('保護者モードでは育成ノートを削除できません');
                    return;
                }
                const proceed = await showCustomConfirm('この育成ノートを削除しますか？', '育成ノートの削除', { okText: '削除する', type: 'danger' });
                if (!proceed) return;
                removeDevelopmentNote(player, button.dataset.developmentNoteId);
                await saveData();
                renderDevelopmentNotebook(player);
                showToast('育成ノートを削除しました');
            };
        });
    };

    // イベントリスナーの再設定
    if (searchInput) searchInput.oninput = renderTimeline;
    if (filterChips) {
        filterChips.querySelectorAll('.c-chip').forEach(btn => {
            btn.onclick = () => {
                filterChips.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTimeline();
            };
        });
    }

    renderTimeline();
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
    if (state.currentUserRole !== 'coach') {
        showToast('保護者モードでは選手情報を編集できません');
        return;
    }
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
                <label class="c-static-style--042">
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
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                </label>
            `;
        }).join('');
    }

    openModal('modal-player');
}

export function initPlayerDetailView(playerId) {
    const p = state.players.find(pl => pl.id === playerId);
    const canEdit = state.currentUserRole === 'coach';
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
        btnEdit.hidden = !canEdit;
        btnEdit.disabled = !canEdit;
        btnEdit.onclick = canEdit ? () => openPlayerEditModal(p) : null;
    }

    // 削除ボタン
    const btnDelete = document.getElementById('pd-btn-delete');
    if (btnDelete) {
        btnDelete.hidden = !canEdit;
        btnDelete.disabled = !canEdit;
        btnDelete.onclick = canEdit ? async () => {
            if (state.currentUserRole !== 'coach') {
                showToast('保護者モードでは選手を削除できません');
                return;
            }
            const proceed = await showCustomConfirm(`「${p.name}」選手を削除しますか？`, '選手の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.players = state.players.filter(pl => pl.id !== p.id);
                saveData();
                showToast('選手を削除しました');
                navigate('players');
            }
        } : null;
    }

    // ダッシュボードと同じ選手統計を使い、年度出席・通算得点／アシスト・出場試合を一貫して表示する。
    const playerStatistics = getPlayerStatistics(p, {
        matches: state.matches,
        practices: state.practices
    });
    const {
        attendanceRate,
        goals: playerGoals,
        assists: playerAssists,
        appearanceMatches: playerMatchesList
    } = playerStatistics;

    const elAtt = document.getElementById('pd-attendance-rate');
    const elMatches = document.getElementById('pd-matches-count');
    const elGoals = document.getElementById('pd-goals');
    const elAssists = document.getElementById('pd-assists');
    if (elAtt) elAtt.textContent = `${attendanceRate}%`;
    if (elMatches) elMatches.textContent = `${playerMatchesList.length} 試合`;
    if (elGoals) elGoals.textContent = `${playerGoals} 点`;
    if (elAssists) elAssists.textContent = `${playerAssists} 回`;




    const developmentNoteForm = document.getElementById('form-player-development-note');
    const btnNewDevNote = document.querySelector('.btn-new-development-note');
    if (btnNewDevNote) {
        btnNewDevNote.hidden = !canEdit;
    }
    
    if (developmentNoteForm) {
        developmentNoteForm.hidden = !canEdit;
        developmentNoteForm.querySelectorAll('input, select, textarea, button').forEach(control => {
            control.disabled = !canEdit;
        });
        
        if (canEdit) {
            developmentNoteForm.onsubmit = async (e) => {
                e.preventDefault();
                const focus = document.getElementById('development-note-focus').value.trim();
                const observation = document.getElementById('development-note-observation').value.trim();
                const nextStep = document.getElementById('development-note-next-step').value.trim();
                const date = document.getElementById('development-note-date').value;
                const ratingsEl = document.getElementById('development-note-ratings');
                
                const skillRatings = {};
                if (ratingsEl) {
                    ratingsEl.querySelectorAll('.development-rating').forEach(sel => {
                        const m = sel.dataset.metric;
                        if (m && sel.value !== '') {
                            skillRatings[m] = parseInt(sel.value, 10);
                        }
                    });
                }
                
                addDevelopmentNote(p, { date, focus, observation, nextStep, skillRatings });
                await saveData();
                showToast('育成ノートを記録しました');
                
                // フォームリセット
                document.getElementById('development-note-focus').value = '';
                document.getElementById('development-note-observation').value = '';
                document.getElementById('development-note-next-step').value = '';
                if (ratingsEl) {
                    ratingsEl.querySelectorAll('.development-rating').forEach(sel => sel.value = '');
                }
                
                document.getElementById('modal-player-development-note').classList.add('is-collapsed');
                
                // 再描画
                initPlayerDetailView(p.id);
            };
        } else {
            developmentNoteForm.onsubmit = null;
        }
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
                <div class="c-card c-static-style--246">
                    <span class="c-status c-status--info c-status--stacked"><i class="ti ti-check"></i> ${escapeHtml(sp.key)}</span>
                    <div class="c-static-style--169">${escapeHtml(sp.text)}</div>
                </div>
            `).join('');
        } else {
            spContainer.innerHTML = '<p class="text-secondary c-static-style--170">ストロングポイントは未設定です。</p>';
        }
    }

    renderDevelopmentNotebook(p);
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
                <div class="c-static-style--124">
                    <i class="ti ti-eye"></i> プレビュー (${parsed.length}件の選手を検出)
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
            modal.classList.add('is-collapsed');
            showToast(`${addedCount}名の選手を一括登録しました！`);
            initPlayers();
        };
    }

    modal.classList.remove('is-collapsed');
}

export function initPlayers() {
    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) return;

    if (state.players.length === 0) {
        playerGrid.innerHTML = `
            <section class="c-empty-state" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon ti ti-users" aria-hidden="true"></i>
                    <h3 class="c-empty-state__title">登録選手がいません</h3>
                    <p class="c-empty-state__text">選手を登録して、強みや指導フォーカスの設定、試合での出場ポジション設定、成長履歴の管理を始めましょう。</p>
                    <button class="c-button btn c-button--primary btn-primary" id="btn-empty-add-player"><i class="ti ti-user-plus" aria-hidden="true"></i> 最初の選手を追加</button>
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
                `<span class="c-status c-status--info"><i class="ti ti-check"></i> ${escapeHtml(sp.key)}</span>`
            ).join('');

            return `
                <article class="player-card c-card c-static-style--032" role="button" tabindex="0" aria-label="${escapeHtml(p.name)}の選手詳細を開く" onclick="openPlayerDetail(${p.id});" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPlayerDetail(${p.id}); }">
                    <div class="player-card-header">
                        <div class="player-card__identity">
                            <div class="player-card__positions c-static-style--069">${badges || '<span class="c-status c-status--muted c-status--compact">未設定</span>'}</div>
                            <div class="player-card__name c-static-style--162">${escapeHtml(p.name)}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div class="player-card__summary c-static-style--097">
                        <p class="player-card__playstyle c-static-style--173">${escapeHtml(p.playStyle || 'プレースタイル未設定')}</p>
                        <div class="player-card__strongpoints c-static-style--060">${spTags}</div>
                        <p class="player-card__focus c-static-style--207"><i class="ti ti-crosshair c-static-style--022" aria-hidden="true"></i> ${escapeHtml(p.shortFocus || 'フォーカス未設定')}</p>
                    </div>
                </article>
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
                    document.getElementById('modal-player').classList.add('is-collapsed');
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
                document.getElementById('modal-player').classList.add('is-collapsed');
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
                document.getElementById('modal-player-assessment').classList.add('is-collapsed');
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
                <label class="c-static-style--042">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }

        const posCat2Container = document.getElementById('player-position-cat2-container');
        if (posCat2Container) {
            posCat2Container.innerHTML = (state.positionsCat2 || []).map(p => `
                <label class="c-static-style--042">
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
                    view.classList.add('is-collapsed');
                });

                if (targetView === 'cards') {
                    document.getElementById('player-grid')?.classList.remove('is-collapsed');
                } else if (targetView === 'participation') {
                    document.getElementById('player-view-participation')?.classList.remove('is-collapsed');
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
            <button type="button" class="c-data-list__item c-data-list__item--button" data-player-detail-id="${Number(p.id)}">
                <span class="c-data-list__identity">${escapeHtml(String(p.number || '-'))}</span>
                <span class="c-data-list__content"><strong>${escapeHtml(p.name)}</strong><span class="c-data-list__meta">${escapeHtml(positionsStr || '-')}</span><span class="c-data-list__meta">試合参加 ${p.matchCount}試合 (${p.matchPct}%) ・ 30日出席率 ${p.attPct}%</span><span class="c-progress-bar" aria-label="試合参加率 ${p.matchPct}%"><span class="c-progress-bar__indicator" style="width:${p.matchPct}%"></span></span></span>
                <span class="c-data-list__value-group" aria-label="得点とアシスト"><span title="得点"><i class="ti ti-ball-football" aria-hidden="true"></i> <strong class="c-data-list__value">${p.goals}</strong></span><span title="アシスト"><i class="ti ti-shoe" aria-hidden="true"></i> <strong class="c-data-list__value">${p.assists}</strong></span></span>
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <section class="c-card" aria-labelledby="player-participation-title">
            <div class="c-section-header c-card__header"><div class="c-section-header__content"><span class="c-kicker"><i class="ti ti-chart-column" aria-hidden="true"></i> PARTICIPATION</span><h3 class="c-section-header__title c-card__title" id="player-participation-title">試合出場機会＆スタッツ比較</h3></div></div>
            <div class="c-card__body"><div class="c-data-list c-data-list--participation">${rowsHTML}</div></div>
        </section>
    `;
    container.querySelectorAll('[data-player-detail-id]').forEach(button => {
        button.addEventListener('click', () => openPlayerDetail(Number(button.dataset.playerDetailId)));
    });
}