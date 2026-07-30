// practices.js
import { state, uiState } from './state.js';
import { escapeHtml, getNendo, showToast } from './utils.js';
import { saveData, navigate, openModal, clearAllMiniPitchIntervals } from './app.js';
import { drawPitchToCtx } from './drawing.js';

export function renderPracticeRoster(selectedPlayerIds = []) {
    const container = document.getElementById('practice-attendance-roster');
    if (!container) return;

    if (!state.players || state.players.length === 0) {
        container.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; margin:0;">登録されている選手がいません。「選手一覧」から選手を登録してください。</p>';
        return;
    }

    const sortedPlayers = [...state.players].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
    });

    container.innerHTML = sortedPlayers.map(p => {
        const isChecked = (selectedPlayerIds && selectedPlayerIds.includes(p.id)) ? 'checked' : '';
        return `
            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; cursor:pointer; padding:0.3rem 0; user-select:none;">
                <input type="checkbox" value="${p.id}" ${isChecked} style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer; margin:0; display:inline-block; opacity:1; visibility:visible;">
                <span style="color:var(--text-primary); font-weight:500;">${p.number}. ${escapeHtml(p.name)}</span>
            </label>
        `;
    }).join('');
}

export function openPracticeModal(practiceId = null) {
    const form = document.getElementById('form-practice');
    if (form) form.reset();

    const editIdEl = document.getElementById('practice-edit-id');
    if (editIdEl) editIdEl.value = '';

    const title = document.getElementById('practice-modal-title');
    if (title) title.textContent = '練習日を追加';

    if (practiceId) {
        const p = state.practices.find(prac => prac.id === practiceId);
        if (p) {
            if (editIdEl) editIdEl.value = p.id;
            const dateEl = document.getElementById('practice-date');
            if (dateEl) dateEl.value = p.date;
            if (title) title.textContent = '練習日情報を編集';

            let activeIds = p.presentPlayerIds;
            if (!activeIds && p.attendance) {
                activeIds = state.players.map(pl => pl.id);
            } else if (!activeIds) {
                activeIds = [];
            }
            renderPracticeRoster(activeIds);
        }
    } else {
        const allPlayerIds = state.players.map(p => p.id);
        renderPracticeRoster(allPlayerIds);
    }

    openModal('modal-practice');
}

export function initPractices(miniPitchObserver) {
    let currentPracticeNendo = uiState.currentPracticeNendo;
    let currentPracticeMonth = uiState.currentPracticeMonth;
    let currentPracticePage = uiState.currentPracticePage;
    const ITEMS_PER_PAGE = uiState.ITEMS_PER_PAGE;

    const practiceNendos = [...new Set(state.practices.map(p => getNendo(p.date)))].sort((a, b) => b - a);
    const filterSelect = document.getElementById('filter-nendo-practice');
    if (filterSelect) {
        let options = '<option value="all">すべての年度</option>';
        practiceNendos.forEach(y => {
            options += `<option value="${y}" ${currentPracticeNendo === String(y) ? 'selected' : ''}>${y}年度</option>`;
        });
        filterSelect.innerHTML = options;

        filterSelect.onchange = (e) => {
            uiState.currentPracticeNendo = e.target.value;
            uiState.currentPracticeMonth = 'all';
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    const filterMonthSelect = document.getElementById('filter-month-practice');
    if (filterMonthSelect) {
        const availablePractices = currentPracticeNendo === 'all'
            ? state.practices
            : state.practices.filter(p => String(getNendo(p.date)) === currentPracticeNendo);

        const practiceMonths = [...new Set(availablePractices.map(p => parseInt(p.date.substring(5, 7), 10)))].sort((a, b) => b - a);
        let options = '<option value="all">すべての月</option>';
        practiceMonths.forEach(m => {
            const mStr = m.toString().padStart(2, '0');
            options += `<option value="${mStr}" ${currentPracticeMonth === mStr ? 'selected' : ''}>${m}月</option>`;
        });
        filterMonthSelect.innerHTML = options;

        filterMonthSelect.onchange = (e) => {
            uiState.currentPracticeMonth = e.target.value;
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    const filteredPractices = state.practices.filter(p => {
        const matchNendo = currentPracticeNendo === 'all' || String(getNendo(p.date)) === currentPracticeNendo;
        const matchMonth = currentPracticeMonth === 'all' || p.date.substring(5, 7) === currentPracticeMonth;
        return matchNendo && matchMonth;
    });

    const elPractices = document.getElementById('dash-practices');
    if (elPractices) elPractices.textContent = filteredPractices.length;

    const displayedPractices = filteredPractices.slice(0, currentPracticePage * ITEMS_PER_PAGE);

    const practiceList = document.getElementById('practice-list');
    if (!practiceList) return;

    const grouped = {};
    displayedPractices.forEach(p => {
        const ym = p.date.substring(0, 7).replace('-', '年') + '月';
        if (!grouped[ym]) grouped[ym] = [];
        grouped[ym].push(p);
    });

    const sortedMonths = Object.keys(grouped).sort().reverse();
    let html = '';
    sortedMonths.forEach(month => {
        html += `
            <div class="month-section">
                <h3>${month}</h3>
                <div class="library-grid">
        `;
        grouped[month].forEach(p => {
            const isCoach = state.currentUserRole === 'coach';
            const attendeesHtml = p.presentPlayerIds && p.presentPlayerIds.length > 0
                ? state.players.filter(pl => p.presentPlayerIds.includes(pl.id)).map(pl => `
                    <span style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; font-size:0.7rem; font-weight:600; padding:0.15rem 0.4rem; border-radius:9999px; gap:0.25rem; white-space:nowrap;">
                        ${pl.number ? `<span style="background:var(--primary); color:#ffffff; font-size:0.55rem; width:14px; height:14px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0;">${pl.number}</span>` : ''}
                        <span style="flex-shrink:0;">${escapeHtml(pl.name)}</span>
                    </span>
                `).join('')
                : '<span style="font-size:0.75rem; color:var(--text-secondary); font-style:italic; padding:0.2rem 0;">出席登録がありません</span>';

            html += `
                <div class="card practice-card">
                    <div class="practice-card-header">
                        <div style="flex:1;">
                            <div class="practice-card-header-title"><i class="fa-regular fa-calendar"></i> ${p.date}</div>
                            <div class="text-secondary" style="font-size:0.8rem; margin-top:0.25rem;">
                                <details class="practice-attendance-details" style="width: 100%; cursor: pointer;">
                                    <summary style="font-weight:600; font-size:0.8rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.3rem; outline:none; list-style:none; user-select:none;">
                                        <i class="fa-solid fa-chevron-down" style="font-size:0.7rem; color:var(--text-secondary); transition:transform 0.2s;"></i>
                                        <span>参加者 (${p.presentPlayerIds ? `${p.presentPlayerIds.length}/${state.players.length}` : p.attendance})</span>
                                    </summary>
                                    <div style="display:flex; flex-wrap:wrap; gap:0.25rem; padding:0.4rem; border-radius:8px; background:rgba(0,0,0,0.02); margin-top:0.25rem; max-height:100px; overflow-y:auto; box-sizing:border-box;">
                                        ${attendeesHtml}
                                    </div>
                                </details>
                            </div>
                        </div>
                        ${isCoach ? `
                        <div style="display:flex; gap:0.3rem; align-self: flex-start;">
                            <button class="btn btn-primary btn-add-menu" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="メニュー追加"><i class="fa-solid fa-plus"></i></button>
                            <button class="btn btn-secondary btn-edit-practice" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="練習日詳細を編集"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger btn-delete-practice" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                    <ul class="practice-card-menu-list">
                        ${p.menus.length > 0 ? p.menus.map(menu => `
                            <li class="practice-menu-item" style="padding: 0; border: none; list-style: none; margin-bottom: 0.5rem;">
                                <details class="practice-menu-details" style="background: rgba(0, 0, 0, 0.03); border: 1px solid var(--surface-border); border-radius: 12px; cursor: pointer; width: 100%;">
                                    <summary class="practice-menu-item-header" style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem; list-style:none; outline:none; box-sizing:border-box;">
    <span class="practice-menu-item-title" style="display:inline-flex; align-items:center; gap:0.5rem; font-size:0.95rem; font-weight:bold; color:var(--primary);">
        <i class="fa-solid fa-chevron-down" style="font-size:0.75rem; color:var(--text-secondary); transition:transform 0.2s;"></i>
        ${escapeHtml(menu.focus)}
        ${menu.engagement ? `<span style="color:#f59e0b; font-size:0.8rem; margin-left:0.3rem;">${'★'.repeat(menu.engagement)}${'☆'.repeat(5 - menu.engagement)}</span>` : ''}
    </span>
    ${isCoach ? `
    <div style="display:flex; gap:0.3rem;" onclick="event.stopPropagation();">
        <button class="btn btn-secondary btn-edit-menu" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;" title="編集"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-secondary btn-anim-practice" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;" title="作図"><i class="fa-solid fa-person-running"></i></button>
        <button class="btn btn-danger btn-delete-menu" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;"><i class="fa-solid fa-times"></i></button>
    </div>
    ` : ''}
</summary>
${(menu.organize || menu.keyfactor || menu.options || menu.videoUrl || menu.frames || menu.reflection) ? `
<div class="practice-menu-item-details" style="padding:0 0.8rem 0.8rem 0.8rem; border-top:1px solid rgba(0,0,0,0.05); font-size:0.85rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.5rem; margin-top:0.4rem;">
    <div class="practice-canvas-wrapper btn-open-anim-preview" data-pid="${p.id}" data-mid="${menu.id}" style="width:100%; height:140px; background:#1e293b; border-radius:8px; overflow:hidden; position:relative; margin-top:0.25rem; cursor:pointer;" onclick="event.stopPropagation();" title="クリックして作図アニメーションを拡大表示">
        <canvas id="practice-mini-pitch-${p.id}-${menu.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
        ${menu.frames && menu.frames.length > 0 ? `
            <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:0.15rem 0.35rem; border-radius:4px; font-weight:bold; pointer-events:none; display:flex; align-items:center; gap:0.2rem;">
                <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%; animation: pulse 1.5s infinite;"></span>${menu.frames.length > 1 ? 'ANIM' : 'ZOOM'}
            </div>
        ` : ''}
    </div>
    ${menu.organize ? `<div><strong><i class="fa-solid fa-users"></i> オーガナイズ</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${escapeHtml(menu.organize)}</div></div>` : ''}
    ${menu.keyfactor ? `<div><strong><i class="fa-solid fa-key"></i> キーファクター</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${escapeHtml(menu.keyfactor)}</div></div>` : ''}
    ${menu.videoUrl ? `<div><strong><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 参考動画</strong><div style="margin-top:0.15rem;"><a href="${escapeHtml(menu.videoUrl)}" target="_blank" rel="noopener noreferrer" style="color:#ef4444; text-decoration:underline; font-weight:bold; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
    ${menu.options ? `<div><strong><i class="fa-solid fa-sliders"></i> オプション</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${escapeHtml(menu.options)}</div></div>` : ''}
    ${menu.reflection ? `<div><strong style="color:var(--primary);"><i class="fa-solid fa-clipboard-user"></i> 指導者の振り返り・メモ</strong><div style="white-space:pre-wrap; margin-top:0.15rem; background:rgba(242,57,50,0.04); padding:0.5rem; border-radius:6px; border-left:3px solid var(--primary); color:var(--text-primary);">${escapeHtml(menu.reflection)}</div></div>` : ''}
</div>
` : '<div style="padding:0 0.8rem 0.8rem 0.8rem; font-size:0.8rem; color:var(--text-secondary);">詳細説明はありません。</div>'}
                                </details>
                            </li>
                        `).join('') : '<li class="text-secondary" style="font-style:italic; border-bottom:none; padding:0.5rem 0; list-style:none;">メニューなし</li>'}
                    </ul>
                </div>
            `;
        });
        html += `</div></div>`;
    });

    if (filteredPractices.length > displayedPractices.length) {
        const remaining = filteredPractices.length - displayedPractices.length;
        html += `
            <div style="text-align:center; margin: 1.5rem 0 1rem 0;">
                <button class="btn btn-secondary" id="btn-load-more-practices" style="padding: 0.6rem 2rem; font-size: 0.9rem; border-radius: 9999px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
                    <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredPractices.length} 件)
                </button>
            </div>
        `;
    }

    if (sortedMonths.length === 0) {
        html = `
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-calendar-check"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">まだ練習管理がありません</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    日々の練習日を作成し、テーマに応じたトレーニングメニューのアサインや、戦術ボードでの作図を行いましょう。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-practice" style="margin-top:0.5rem;"><i class="fa-solid fa-plus"></i> 最初の練習日を追加</button>
            </div>
        `;
    }

    practiceList.innerHTML = html;

    const formPractice = document.getElementById('form-practice');
    if (formPractice) {
        formPractice.onsubmit = (e) => {
            e.preventDefault();
            const editId = document.getElementById('practice-edit-id').value;

            const checkedBoxes = document.querySelectorAll('#practice-attendance-roster input[type="checkbox"]:checked');
            const presentIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));
            const attendanceStr = `${presentIds.length}/${state.players.length}`;

            if (editId) {
                const practice = state.practices.find(p => p.id === parseInt(editId, 10));
                if (practice) {
                    practice.date = document.getElementById('practice-date').value;
                    practice.attendance = attendanceStr;
                    practice.presentPlayerIds = presentIds;
                    showToast('練習日情報を更新しました');
                }
            } else {
                const newPractice = {
                    id: Date.now(),
                    date: document.getElementById('practice-date').value,
                    attendance: attendanceStr,
                    presentPlayerIds: presentIds,
                    menus: []
                };
                state.practices.unshift(newPractice);
                showToast('練習日を記録しました');
            }

            saveData();
            document.getElementById('modal-practice').classList.add('hidden');
            navigate('practices');
        };
    }

    const formMenu = document.getElementById('form-menu');
    if (formMenu) {
        formMenu.onsubmit = (e) => {
            e.preventDefault();
            const practiceId = document.getElementById('menu-practice-id').value;
            const sourceId = document.getElementById('menu-library-source-id').value;

            let frames = null;
            let pitchTemplate = 'full';
            if (sourceId) {
                const src = state.menuLibrary.find(m => m.id === parseInt(sourceId, 10));
                if (src) {
                    if (src.frames) frames = JSON.parse(JSON.stringify(src.frames));
                    if (src.pitchTemplate) pitchTemplate = src.pitchTemplate;
                }
            }

            const videoUrlInp = document.getElementById('menu-video-url');
            const videoUrlVal = videoUrlInp ? videoUrlInp.value.trim() : '';

            const engagementInp = document.getElementById('menu-engagement');
            const engagementVal = engagementInp ? parseInt(engagementInp.value, 10) : 0;
            const reflectionInp = document.getElementById('menu-reflection');
            const reflectionVal = reflectionInp ? reflectionInp.value.trim() : '';

            const newMenuObj = {
                id: Date.now(),
                librarySourceId: sourceId ? parseInt(sourceId, 10) : null,
                focus: document.getElementById('menu-focus').value,
                organize: document.getElementById('menu-organize').value,
                keyfactor: document.getElementById('menu-keyfactor').value,
                options: document.getElementById('menu-options').value,
                category: document.getElementById('menu-category').value,
                videoUrl: videoUrlVal,
                engagement: engagementVal,  // ★ 追加
                reflection: reflectionVal,  // ★ 追加
                frames: frames,
                pitchTemplate: pitchTemplate
            };

            const editId = document.getElementById('menu-edit-id') ? document.getElementById('menu-edit-id').value : '';
            if (editId) {
                let targetMenu = null;
                if (practiceId === 'library') {
                    targetMenu = state.menuLibrary.find(m => m.id === parseInt(editId, 10));
                } else {
                    const practice = state.practices.find(p => p.id === parseInt(practiceId, 10));
                    if (practice) {
                        targetMenu = practice.menus.find(m => m.id === parseInt(editId, 10));
                    }
                }
                if (targetMenu) {
                    targetMenu.focus = newMenuObj.focus;
                    targetMenu.organize = newMenuObj.organize;
                    targetMenu.keyfactor = newMenuObj.keyfactor;
                    targetMenu.options = newMenuObj.options;
                    targetMenu.category = newMenuObj.category;
                    targetMenu.videoUrl = newMenuObj.videoUrl;
                    targetMenu.engagement = newMenuObj.engagement;  // ★ 追加
                    targetMenu.reflection = newMenuObj.reflection;  // ★ 追加
                    if (sourceId) {
                        targetMenu.frames = frames;
                        targetMenu.pitchTemplate = pitchTemplate;
                        targetMenu.librarySourceId = parseInt(sourceId, 10);
                    }
                    
                    // Sync back to library menu if linked
                    const libId = targetMenu.librarySourceId;
                    if (libId) {
                        const libMenu = state.menuLibrary.find(m => m.id === libId);
                        if (libMenu) {
                            libMenu.focus = newMenuObj.focus;
                            libMenu.organize = newMenuObj.organize;
                            libMenu.keyfactor = newMenuObj.keyfactor;
                            libMenu.options = newMenuObj.options;
                            libMenu.category = newMenuObj.category;
                            libMenu.videoUrl = newMenuObj.videoUrl;
                            if (sourceId) {
                                libMenu.frames = frames;
                                libMenu.pitchTemplate = pitchTemplate;
                            }
                        }
                    }

                    // Sync library menu edits forward to all assigned practice menus
                    if (practiceId === 'library') {
                        state.practices.forEach(p => {
                            if (p.menus) {
                                p.menus.forEach(pm => {
                                    if (pm.librarySourceId === targetMenu.id) {
                                        pm.focus = newMenuObj.focus;
                                        pm.organize = newMenuObj.organize;
                                        pm.keyfactor = newMenuObj.keyfactor;
                                        pm.options = newMenuObj.options;
                                        pm.category = newMenuObj.category;
                                        pm.videoUrl = newMenuObj.videoUrl;
                                        if (sourceId) {
                                            pm.frames = frames;
                                            pm.pitchTemplate = pitchTemplate;
                                        }
                                    }
                                });
                            }
                        });
                    }
                    saveData();
                    showToast('メニューを更新しました');
                    document.getElementById('modal-menu').classList.add('hidden');
                    if (practiceId === 'library') navigate('library');
                    else navigate('practices');
                    return;
                }
            }

            if (practiceId === 'library') {
                state.menuLibrary.push(newMenuObj);
                saveData();
                showToast('ライブラリに保存しました');
                document.getElementById('modal-menu').classList.add('hidden');
                navigate('library');
            } else {
                const practice = state.practices.find(p => p.id === parseInt(practiceId, 10));
                if (practice) {
                    practice.menus.push(newMenuObj);
                    saveData();
                    showToast('メニューを追加しました');
                    document.getElementById('modal-menu').classList.add('hidden');
                    navigate('practices');
                }
            }
        };
    }

    const btnLoadMorePractices = document.getElementById('btn-load-more-practices');
    if (btnLoadMorePractices) {
        btnLoadMorePractices.onclick = () => {
            uiState.currentPracticePage++;
            initPractices(miniPitchObserver);
        };
    }

    clearAllMiniPitchIntervals();

    setTimeout(() => {
        displayedPractices.forEach(p => {
            if (p.menus && p.menus.length > 0) {
                p.menus.forEach(menu => {
                    const mCanv = document.getElementById(`practice-mini-pitch-${p.id}-${menu.id}`);
                    if (mCanv) {
                        const mCtx = mCanv.getContext('2d');
                        mCanv._animationFrames = menu.frames || [];
                        mCanv._pitchTemplate = menu.pitchTemplate || 'full';

                        drawPitchToCtx(menu.frames && menu.frames.length > 0 ? menu.frames[0] : [], mCanv, mCtx, menu.pitchTemplate || 'full');

                        if (menu.frames && menu.frames.length > 1 && miniPitchObserver) {
                            miniPitchObserver.observe(mCanv);
                        }
                    }
                });
            }
        });
    }, 50);

    const btnAddPractice = document.getElementById('btn-add-practice');
    if (btnAddPractice) {
        btnAddPractice.onclick = () => { openPracticeModal(null); };
    }

    document.querySelectorAll('.btn-edit-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id, 10);
            openPracticeModal(id);
        });
    });

    document.querySelectorAll('.btn-add-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            document.getElementById('menu-practice-id').value = id;
            document.getElementById('menu-library-source-id').value = '';
            if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';

            // Reset modal input fields
            document.getElementById('menu-focus').value = '';
            document.getElementById('menu-category').value = 'ウォーミングアップ';
            document.getElementById('menu-organize').value = '';
            document.getElementById('menu-keyfactor').value = '';
            document.getElementById('menu-options').value = '';
            const vInp = document.getElementById('menu-video-url');
            if (vInp) vInp.value = '';
            const engInp = document.getElementById('menu-engagement');
            if (engInp) engInp.value = 0;
            const refInp = document.getElementById('menu-reflection');
            if (refInp) refInp.value = '';

            const select = document.getElementById('menu-library-select');
            if (select) {
                select.innerHTML = '<option value="">（新規作成）</option>' + state.menuLibrary.map(m => `<option value="${m.id}">${m.focus}</option>`).join('');
                select.parentElement.style.display = 'block';
                select.value = '';

                select.onchange = (ev) => {
                    const libId = parseInt(ev.target.value, 10);
                    if (libId) {
                        const libMenu = state.menuLibrary.find(m => m.id === libId);
                        if (libMenu) {
                            document.getElementById('menu-focus').value = libMenu.focus || '';
                            document.getElementById('menu-organize').value = libMenu.organize || '';
                            document.getElementById('menu-keyfactor').value = libMenu.keyfactor || '';
                            document.getElementById('menu-options').value = libMenu.options || '';
                            document.getElementById('menu-category').value = libMenu.category || 'その他';
                            const videoInput = document.getElementById('menu-video-url');
                            if (videoInput) videoInput.value = libMenu.videoUrl || '';
                            document.getElementById('menu-library-source-id').value = libMenu.id;
                        }
                    } else {
                        document.getElementById('menu-focus').value = '';
                        document.getElementById('menu-organize').value = '';
                        document.getElementById('menu-keyfactor').value = '';
                        document.getElementById('menu-options').value = '';
                        document.getElementById('menu-category').value = 'ウォーミングアップ';
                        const videoInput = document.getElementById('menu-video-url');
                        if (videoInput) videoInput.value = '';
                        document.getElementById('menu-library-source-id').value = '';
                    }
                };
            }

            const title = document.querySelector('#modal-menu h2');
            if (title) title.textContent = '練習メニューを追加';

            openModal('modal-menu');
        });
    });

    document.querySelectorAll('.btn-anim-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = parseInt(e.currentTarget.dataset.pid, 10);
            const mid = parseInt(e.currentTarget.dataset.mid, 10);
            navigate('animation', { practiceId: pid, menuId: mid });
        });
    });

    document.querySelectorAll('.btn-delete-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm('この日の練習記録をすべて削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                state.practices = state.practices.filter(p => p.id !== id);
                saveData();
                initPractices(miniPitchObserver);
            }
        });
    });

    document.querySelectorAll('.btn-delete-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm('この練習メニューを削除しますか？')) {
                const pid = parseInt(e.currentTarget.dataset.pid, 10);
                const mid = parseInt(e.currentTarget.dataset.mid, 10);
                const practice = state.practices.find(p => p.id === pid);
                if (practice) {
                    practice.menus = practice.menus.filter(m => m.id !== mid);
                    saveData();
                    showToast('メニューを削除しました');
                    initPractices(miniPitchObserver);
                }
            }
        });
    });

    document.querySelectorAll('.btn-edit-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = parseInt(e.currentTarget.dataset.pid, 10);
            const mid = parseInt(e.currentTarget.dataset.mid, 10);
            const practice = state.practices.find(p => p.id === pid);
            if (practice) {
                const menu = practice.menus.find(m => m.id === mid);
                if (menu) {
                    document.getElementById('menu-practice-id').value = pid;
                    document.getElementById('menu-library-source-id').value = '';
                    if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = mid;

                    document.getElementById('menu-focus').value = menu.focus || '';
                    document.getElementById('menu-category').value = menu.category || 'その他';
                    document.getElementById('menu-organize').value = menu.organize || '';
                    document.getElementById('menu-keyfactor').value = menu.keyfactor || '';
                    document.getElementById('menu-options').value = menu.options || '';
                    const vInp = document.getElementById('menu-video-url');
                    if (vInp) vInp.value = menu.videoUrl || '';

                    const engInp = document.getElementById('menu-engagement');
                    if (engInp) engInp.value = menu.engagement || 0;
                    const refInp = document.getElementById('menu-reflection');
                    if (refInp) refInp.value = menu.reflection || '';

                    const libSel = document.getElementById('menu-library-select');
                    if (libSel) libSel.parentElement.style.display = 'none';

                    const title = document.querySelector('#modal-menu h2');
                    if (title) title.textContent = '練習メニューを編集';

                    openModal('modal-menu');
                }
            }
        });
    });

    // 練習プレビュークリック時のアニメーション拡大表示モーダル
    document.querySelectorAll('.btn-open-anim-preview').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            const pid = parseInt(wrapper.dataset.pid, 10);
            const mid = parseInt(wrapper.dataset.mid, 10);
            const practice = state.practices.find(pr => pr.id === pid);
            if (practice) {
                const menu = practice.menus.find(m => m.id === mid);
                if (menu) {
                    const frames = (menu.frames && menu.frames.length > 0) ? menu.frames : [{ objects: [] }];
                    const modal = document.getElementById('modal-practice-anim-preview');
                    const title = document.getElementById('anim-preview-title');
                    if (modal && title) {
                        title.textContent = menu.focus || 'メニュー作図';
                        modal.classList.remove('hidden');

                        // イベント登録
                        const closeBtn = document.getElementById('btn-close-anim-preview');
                        if (closeBtn) {
                            closeBtn.onclick = () => {
                                stopPreviewAnimation();
                                modal.classList.add('hidden');
                            };
                        }

                        const playBtn = document.getElementById('btn-preview-play-toggle');
                        if (playBtn) {
                            if (frames.length > 1) {
                                playBtn.style.display = 'inline-block';
                                playBtn.onclick = () => {
                                    if (previewIsPlaying) {
                                        stopPreviewAnimation();
                                    } else {
                                        startPreviewAnimation(frames, menu.pitchTemplate);
                                    }
                                };
                            } else {
                                playBtn.style.display = 'none';
                            }
                        }

                        // 初期描画/再生開始
                        startPreviewAnimation(frames, menu.pitchTemplate);
                    }
                }
            }
        });
    });
}

// 練習作図プレビュー用 軽量アニメーション制御
let previewAnimationId = null;
let previewCurrentFrameIdx = 0;
let previewStartTime = null;
let previewIsPlaying = false;
let previewFrames = [];
let previewPitchTemplate = 'full';

function startPreviewAnimation(frames, pitchTemplate) {
    const canvas = document.getElementById('practice-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    previewFrames = frames;
    previewPitchTemplate = pitchTemplate || 'full';
    previewCurrentFrameIdx = 0;
    previewStartTime = null;
    previewIsPlaying = true;

    const playBtn = document.getElementById('btn-preview-play-toggle');
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 一時停止';

    function animate(timestamp) {
        if (!previewIsPlaying) return;
        if (!previewStartTime) previewStartTime = timestamp;
        
        let elapsed = timestamp - previewStartTime;
        let duration = 1200; // 1フレームあたりの時間
        let progress = elapsed / duration;

        if (progress >= 1) {
            previewCurrentFrameIdx++;
            previewStartTime = timestamp;
            progress = 0;
            if (previewCurrentFrameIdx >= previewFrames.length - 1) {
                previewCurrentFrameIdx = 0;
            }
        }

        const indicator = document.getElementById('preview-frame-indicator');
        if (indicator) {
            indicator.textContent = `${previewCurrentFrameIdx + 1} / ${previewFrames.length}`;
        }

        const rawCurrent = previewFrames[previewCurrentFrameIdx];
        const rawNext = previewFrames[previewCurrentFrameIdx + 1];
        const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
        
        if (previewFrames.length <= 1 || !rawNext) {
            drawPitchToCtx(currentFrame, canvas, ctx, previewPitchTemplate);
            previewIsPlaying = false;
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i> 再生';
            return;
        }

        const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);
        const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        const interpolatedObjects = currentFrame.map(obj1 => {
            const obj2 = nextFrame.find(o => o.id === obj1.id);
            if (!obj2) return obj1;

            if (typeof obj1.x !== 'undefined' && typeof obj1.y !== 'undefined') {
                return {
                    ...obj1,
                    x: obj1.x + (obj2.x - obj1.x) * p,
                    y: obj1.y + (obj2.y - obj1.y) * p
                };
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

        drawPitchToCtx(interpolatedObjects, canvas, ctx, previewPitchTemplate);
        previewAnimationId = requestAnimationFrame(animate);
    }

    if (previewAnimationId) cancelAnimationFrame(previewAnimationId);
    previewAnimationId = requestAnimationFrame(animate);
}

function stopPreviewAnimation() {
    previewIsPlaying = false;
    if (previewAnimationId) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }
    const playBtn = document.getElementById('btn-preview-play-toggle');
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i> 再生';
}