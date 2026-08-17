// practices.js
import { state, uiState } from './state.js';
import { escapeHtml, getNendo, showToast, showCustomConfirm } from './utils.js';
import { saveData, navigate, openModal, clearAllMiniPitchIntervals } from './app-context.js';
import { drawPitchToCtx } from './drawing.js';

export function renderPracticeRoster(selectedPlayerIds = []) {
    const container = document.getElementById('practice-attendance-roster');
    if (!container) return;

    if (!state.players || state.players.length === 0) {
        container.innerHTML = '<p class="text-secondary empty-state-text">登録されている選手がいません。「選手一覧」から選手を登録してください。</p>';
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
            <label class="roster-checkbox-label">
                <input type="checkbox" value="${p.id}" ${isChecked} class="roster-checkbox">
                <span class="roster-player-name">${p.number}. ${escapeHtml(p.name)}</span>
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

    // ★ 追加: 練習場所フォーム要素の参照
    const locationEl = document.getElementById('practice-location');

    if (practiceId) {
        const p = state.practices.find(prac => prac.id === practiceId);
        if (p) {
            if (editIdEl) editIdEl.value = p.id;
            const dateEl = document.getElementById('practice-date');
            if (dateEl) dateEl.value = p.date;
            if (locationEl) locationEl.value = p.location || ''; // ★ 既存の練習場所をセット
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
        if (locationEl) locationEl.value = ''; // ★ 新規作成時は空にする
        const allPlayerIds = state.players.map(p => p.id);
        renderPracticeRoster(allPlayerIds);
    }

    openModal('modal-practice');
}

export function initPractices(miniPitchObserver) {
    let currentPracticeNendo = uiState.currentPracticeNendo || 'all';
    let currentPracticeMonth = uiState.currentPracticeMonth || 'all';
    let currentPracticeCategory = uiState.currentPracticeCategory || 'all';
    let currentPracticePlayer = uiState.currentPracticePlayer || 'all';
    let currentPracticeSearch = (uiState.currentPracticeSearch || '').toLowerCase().trim();
    let practiceSortOrder = uiState.practiceSortOrder || 'desc';
    let currentPracticePage = uiState.currentPracticePage;
    const ITEMS_PER_PAGE = uiState.ITEMS_PER_PAGE;

    // ── Search Input ──
    const searchInput = document.getElementById('input-practice-search');
    if (searchInput) {
        searchInput.value = uiState.currentPracticeSearch || '';
        searchInput.oninput = (e) => {
            uiState.currentPracticeSearch = e.target.value;
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    // ── Populate Accordion Selects ──
    const practiceNendos = [...new Set(state.practices.map(p => getNendo(p.date)))].sort((a, b) => b - a);
    const filterNendoSelect = document.getElementById('filter-nendo-practice');
    if (filterNendoSelect) {
        let options = '<option value="all">すべての年度</option>';
        practiceNendos.forEach(y => { options += `<option value="${y}" ${currentPracticeNendo === String(y) ? 'selected' : ''}>${y}年度</option>`; });
        filterNendoSelect.innerHTML = options;
        filterNendoSelect.onchange = (e) => {
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

    const filterCategorySelect = document.getElementById('filter-category-practice');
    if (filterCategorySelect) {
        let options = '<option value="all">すべてのカテゴリ</option>';
        (state.menuCategories || []).forEach(cat => { options += `<option value="${escapeHtml(cat)}" ${currentPracticeCategory === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`; });
        filterCategorySelect.innerHTML = options;
        filterCategorySelect.onchange = (e) => {
            uiState.currentPracticeCategory = e.target.value;
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    const filterPlayerSelect = document.getElementById('filter-player-practice');
    if (filterPlayerSelect) {
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        let options = '<option value="all">すべての参加選手</option>';
        sortedPlayers.forEach(p => { options += `<option value="${p.id}" ${currentPracticePlayer === String(p.id) ? 'selected' : ''}>${p.number ? `${p.number}. ` : ''}${escapeHtml(p.name)}</option>`; });
        filterPlayerSelect.innerHTML = options;
        filterPlayerSelect.onchange = (e) => {
            uiState.currentPracticePlayer = e.target.value;
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    // ── Active Filter Badge, Button State & Tag Chips ──
    let activeFilterCount = 0;
    const activeTagsContainer = document.getElementById('active-tags-practices');
    let activeTagsHtml = '<span class="active-tag-label">絞り込み中:</span>';

    if (currentPracticeNendo !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="nendo">${currentPracticeNendo}年度 <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentPracticeMonth !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="month">${parseInt(currentPracticeMonth, 10)}月 <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentPracticeCategory !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="category">${escapeHtml(currentPracticeCategory)} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentPracticePlayer !== 'all') {
        activeFilterCount++;
        const targetPlayer = state.players.find(p => String(p.id) === currentPracticePlayer);
        const playerName = targetPlayer ? targetPlayer.name : currentPracticePlayer;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="player">${escapeHtml(playerName)} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }

    if (activeTagsContainer) {
        if (activeFilterCount > 0) {
            activeTagsContainer.innerHTML = activeTagsHtml;
            activeTagsContainer.classList.remove('hidden');
            activeTagsContainer.querySelectorAll('.active-tag-chip').forEach(chip => {
                chip.onclick = () => {
                    const key = chip.dataset.clearKey;
                    if (key === 'nendo') uiState.currentPracticeNendo = 'all';
                    if (key === 'month') uiState.currentPracticeMonth = 'all';
                    if (key === 'category') uiState.currentPracticeCategory = 'all';
                    if (key === 'player') uiState.currentPracticePlayer = 'all';
                    uiState.currentPracticePage = 1;
                    initPractices(miniPitchObserver);
                };
            });
        } else {
            activeTagsContainer.innerHTML = '';
            activeTagsContainer.classList.add('hidden');
        }
    }

    const btnToggle = document.getElementById('btn-toggle-filter-practices');
    const badgeEl = document.getElementById('badge-filter-practices');
    if (btnToggle) {
        btnToggle.classList.toggle('active-filter', activeFilterCount > 0);
        btnToggle.onclick = () => {
            const accordion = document.getElementById('filter-accordion-practices');
            if (accordion) accordion.classList.toggle('hidden');
        };
    }
    if (badgeEl) {
        badgeEl.textContent = activeFilterCount;
        badgeEl.classList.toggle('hidden', activeFilterCount === 0);
    }

    const btnReset = document.getElementById('btn-reset-filter-practices');
    if (btnReset) {
        btnReset.onclick = () => {
            uiState.currentPracticeNendo = 'all';
            uiState.currentPracticeMonth = 'all';
            uiState.currentPracticeCategory = 'all';
            uiState.currentPracticePlayer = 'all';
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    const btnSort = document.getElementById('btn-sort-practice');
    if (btnSort) {
        const isDesc = practiceSortOrder === 'desc';
        btnSort.innerHTML = `<i class="fa-solid ${isDesc ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}"></i>`;
        btnSort.title = isDesc ? '新しい順 (クリックで古い順へ)' : '古い順 (クリックで新しい順へ)';
        btnSort.onclick = () => {
            uiState.practiceSortOrder = practiceSortOrder === 'desc' ? 'asc' : 'desc';
            uiState.currentPracticePage = 1;
            initPractices(miniPitchObserver);
        };
    }

    const filteredPractices = state.practices.filter(p => {
        const matchNendo = currentPracticeNendo === 'all' || String(getNendo(p.date)) === currentPracticeNendo;
        const matchMonth = currentPracticeMonth === 'all' || p.date.substring(5, 7) === currentPracticeMonth;

        let matchCategory = true;
        if (currentPracticeCategory !== 'all') {
            matchCategory = (p.menus || []).some(mn => mn.category === currentPracticeCategory || (mn.focus && mn.focus.includes(currentPracticeCategory)));
        }

        let matchPlayer = true;
        if (currentPracticePlayer !== 'all') {
            const playerIdNum = parseInt(currentPracticePlayer, 10);
            matchPlayer = (p.presentPlayerIds || []).includes(playerIdNum);
        }

        let matchKeyword = true;
        if (currentPracticeSearch) {
            const attendeeNames = (p.presentPlayerIds || []).map(id => {
                const pl = state.players.find(x => x.id === id);
                return pl ? pl.name : '';
            }).join(' ');

            const menuTexts = (p.menus || []).map(mn => [mn.focus, mn.organize, mn.keyfactor, mn.options, mn.category, mn.reflection].filter(Boolean).join(' ')).join(' ');

            const targetText = [
                p.date,
                menuTexts,
                attendeeNames
            ].filter(Boolean).join(' ').toLowerCase();

            matchKeyword = targetText.includes(currentPracticeSearch);
        }

        return matchNendo && matchMonth && matchCategory && matchPlayer && matchKeyword;
    }).sort((a, b) => {
        return practiceSortOrder === 'asc'
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date);
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

    const sortedMonths = practiceSortOrder === 'asc'
        ? Object.keys(grouped).sort()
        : Object.keys(grouped).sort().reverse();
    let html = '';
    sortedMonths.forEach(month => {
        html += `
            <div class="month-section">
                <h3>${month}</h3>
                <!-- ★ 試合管理と同様に library-grid で3列レスポンシブ表示 -->
                <div class="library-grid">
        `;
        grouped[month].forEach(p => {
            const isCoach = state.currentUserRole === 'coach';

            // ★1. 練習場所バッジの表示用HTMLを定義（ここを追加）
            const locationHtml = p.location
                ? `<span class="badge-sub" style="margin-left: 0.4rem; color: var(--text-secondary); font-weight: 500;"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;"></i> ${escapeHtml(p.location)}</span>`
                : '';

            const attendeesHtml = p.presentPlayerIds && p.presentPlayerIds.length > 0
                ? state.players.filter(pl => p.presentPlayerIds.includes(pl.id)).map(pl => `
                    <span class="u-ext-54">
                        ${pl.number ? `<span class="u-ext-55">${pl.number}</span>` : ''}
                        <span class="u-ext-56">${escapeHtml(pl.name)}</span>
                    </span>
                `).join('')
                : '<span class="u-ext-57">出席登録がありません</span>';

            const attendeeCount = p.presentPlayerIds ? p.presentPlayerIds.length : 0;
            const menuCount = p.menus ? p.menus.length : 0;

            const actionBtns = isCoach ? `
                <div class="practice-card-actions">
                    <button class="btn btn-primary btn-xs btn-add-menu" data-id="${p.id}" title="メニュー追加"><i class="fa-solid fa-plus"></i> メニュー</button>
                    <button class="btn btn-secondary btn-xs btn-edit-practice" data-id="${p.id}" title="編集"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-xs btn-delete-practice" data-id="${p.id}" title="削除"><i class="fa-solid fa-trash"></i></button>
                </div>
            ` : '';

            html += `
                <div class="card practice-card" data-practice-id="${p.id}">
                    <!-- カードヘッダー（常時表示） -->
                    <div class="practice-card-header">
                        <div class="practice-card-header-main">
                            <!-- ★2. ${p.date} の直後に ${locationHtml} を追加 -->
                            <div class="practice-card-date"><i class="fa-regular fa-calendar"></i> ${p.date}${locationHtml}</div>
                            <div class="practice-card-summary-badges">
                                <span class="badge-sub"><i class="fa-solid fa-users"></i> ${attendeeCount}/${state.players.length}名</span>
                                <span class="badge-sub"><i class="fa-solid fa-list-check"></i> ${menuCount}メニュー</span>
                            </div>
                        </div>
                        ${actionBtns}
                    </div>

                    <!-- ★ 参加者と練習メニューをまとめて開閉するアコーディオン -->
                    <details class="practice-card-details">
                        <summary class="practice-card-summary">
                            <i class="fa-solid fa-chevron-down summary-icon"></i>
                            <span>詳細を表示 (参加者・メニュー)</span>
                        </summary>
                        
                        <div class="practice-card-expanded-body">
                            <!-- 1. 参加選手領域 -->
                            <div class="practice-detail-section">
                                <div class="practice-section-label"><i class="fa-solid fa-users"></i> 参加選手 (${attendeeCount}名)</div>
                                <div class="practice-card-attendance-list">
                                    ${attendeesHtml}
                                </div>
                            </div>

                            <!-- 2. 練習メニュー領域 -->
                            <div class="practice-detail-section">
                                <div class="practice-section-label"><i class="fa-solid fa-layer-group"></i> 練習メニュー (${menuCount}件)</div>
                                <ul class="practice-card-menu-list">
                                    ${p.menus.length > 0 ? p.menus.map(menu => `
                                        <li class="u-ext-150 practice-menu-item">
                                            <details class="u-ext-151 practice-menu-details">
                                                <summary class="u-ext-152 practice-menu-item-header">
                                                    <div class="practice-menu-title-block">
                                                        <span class="u-ext-153 practice-menu-item-title">
                                                            <i class="u-ext-154 fa-solid fa-chevron-down"></i>
                                                            ${escapeHtml(menu.focus)}
                                                        </span>
                                                        ${menu.engagement ? `<span class="u-ext-155 practice-stars-badge">${'★'.repeat(menu.engagement)}${'☆'.repeat(5 - menu.engagement)}</span>` : ''}
                                                    </div>
                                                    ${isCoach ? `
                                                    <div class="u-ext-156 practice-menu-actions-block" onclick="event.stopPropagation();">
                                                        <button class="u-ext-157 btn btn-secondary btn-edit-menu" data-pid="${p.id}" data-mid="${menu.id}" title="編集"><i class="fa-solid fa-pen"></i></button>
                                                        <button class="u-ext-157 btn btn-secondary btn-anim-practice" data-pid="${p.id}" data-mid="${menu.id}" title="作図"><i class="fa-solid fa-person-running"></i></button>
                                                        <button class="u-ext-157 btn btn-danger btn-delete-menu" data-pid="${p.id}" data-mid="${menu.id}"><i class="fa-solid fa-times"></i></button>
                                                    </div>
                                                    ` : ''}
                                                </summary>
                                                ${(menu.organize || menu.keyfactor || menu.options || menu.videoUrl || menu.frames || menu.reflection) ? `
                                                <div class="u-ext-158 practice-menu-item-details">
                                                    <div class="u-ext-159 practice-canvas-wrapper btn-open-anim-preview" data-pid="${p.id}" data-mid="${menu.id}" onclick="event.stopPropagation();" title="クリックして作図アニメーションを拡大表示">
                                                        <canvas class="u-ext-160" id="practice-mini-pitch-${p.id}-${menu.id}" width="800" height="500"></canvas>
                                                        ${menu.frames && menu.frames.length > 0 ? `
                                                            <div class="u-ext-161">
                                                                <span class="u-ext-162"></span>${menu.frames.length > 1 ? 'ANIM' : 'ZOOM'}
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    ${menu.organize ? `<div><strong><i class="fa-solid fa-users"></i> オーガナイズ</strong><div class="u-ext-163">${escapeHtml(menu.organize)}</div></div>` : ''}
                                                    ${menu.keyfactor ? `<div><strong><i class="fa-solid fa-key"></i> キーファクター</strong><div class="u-ext-163">${escapeHtml(menu.keyfactor)}</div></div>` : ''}
                                                    ${menu.videoUrl ? `<div><strong><i class="u-ext-16 fa-brands fa-youtube"></i> 参考動画</strong><div class="u-ext-164"><a class="u-ext-165" href="${escapeHtml(menu.videoUrl)}" target="_blank" rel="noopener noreferrer"><i class="u-ext-33 fa-solid fa-arrow-up-right-from-square"></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
                                                    ${menu.options ? `<div><strong><i class="fa-solid fa-sliders"></i> オプション</strong><div class="u-ext-163">${escapeHtml(menu.options)}</div></div>` : ''}
                                                    ${menu.reflection ? `<div><strong class="u-ext-77"><i class="fa-solid fa-clipboard-user"></i> 指導者の振り返り・メモ</strong><div class="u-ext-166">${escapeHtml(menu.reflection)}</div></div>` : ''}
                                                </div>
                                                ` : '<div class="u-ext-167">詳細説明はありません。</div>'}
                                            </details>
                                        </li>
                                    `).join('') : '<li class="text-secondary no-practice-menu" style="font-size:0.8rem; padding:0.3rem 0;">メニューなし</li>'}
                                </ul>
                            </div>
                        </div>
                    </details>
                </div>
            `;
        });
        html += `</div></div>`;
    });

    if (filteredPractices.length > displayedPractices.length) {
        const remaining = filteredPractices.length - displayedPractices.length;
        html += `
            <div class="u-ext-142" >
                <button class="u-ext-143 btn btn-secondary" id="btn-load-more-practices" >
                    <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredPractices.length} 件)
                </button>
            </div>
        `;
    }

    if (sortedMonths.length === 0) {
        const isSearchActive = !!currentPracticeSearch || currentPracticeCategory !== 'all' || currentPracticePlayer !== 'all' || currentPracticeNendo !== 'all' || currentPracticeMonth !== 'all';
        html = `
            <div class="u-ext-144 card" >
                <div class="u-ext-145" ><i class="fa-solid ${isSearchActive ? 'fa-magnifying-glass' : 'fa-calendar-check'}"></i></div>
                <h3 class="u-ext-146" >${isSearchActive ? '該当する練習記録がありません' : 'まだ練習記録がありません'}</h3>
                <p class="u-ext-169" >
                    ${isSearchActive ? '検索キーワードまたは絞り込み条件（年度・月・カテゴリ・参加選手）を変更してお試しください。' : '日々の練習日を作成し、テーマに応じたトレーニングメニューのアサインや、戦術ボードでの作図を行いましょう。'}
                </p>
                ${!isSearchActive ? `<button class="u-ext-170 btn btn-primary" id="btn-empty-add-practice" ><i class="fa-solid fa-plus"></i> 最初の練習日を追加</button>` : ''}
            </div>
        `;
    }

    practiceList.innerHTML = html;

    const formPractice = document.getElementById('form-practice');
    if (formPractice) {
        formPractice.onsubmit = (e) => {
            e.preventDefault();
            const editId = document.getElementById('practice-edit-id').value;
            const locationVal = document.getElementById('practice-location')?.value.trim() || ''; // ★ 練習場所を取得

            const checkedBoxes = document.querySelectorAll('#practice-attendance-roster input[type="checkbox"]:checked');
            const presentIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));
            const attendanceStr = `${presentIds.length}/${state.players.length}`;

            if (editId) {
                const practice = state.practices.find(p => p.id === parseInt(editId, 10));
                if (practice) {
                    practice.date = document.getElementById('practice-date').value;
                    practice.location = locationVal; // ★ 練習場所を更新
                    practice.attendance = attendanceStr;
                    practice.presentPlayerIds = presentIds;
                    showToast('練習日情報を更新しました');
                }
            } else {
                const newPractice = {
                    id: Date.now(),
                    date: document.getElementById('practice-date').value,
                    location: locationVal, // ★ 練習場所を新規保存
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
                    // ★【追加】ライブラリ未選択の新規メニューの場合、メニュー管理(ライブラリ)にも同時追加する
                    if (!sourceId) {
                        const libMenuObj = JSON.parse(JSON.stringify(newMenuObj));
                        state.menuLibrary.push(libMenuObj);
                        newMenuObj.librarySourceId = libMenuObj.id; // ライブラリと相互リンク
                    }

                    practice.menus.push(newMenuObj);
                    saveData();
                    showToast('メニューを追加（ライブラリにも保存）しました');
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

    // ★ 1行リスト開閉イベントハンドラ
    document.querySelectorAll('.btn-toggle-practice-row').forEach(rowHeader => {
        rowHeader.onclick = (e) => {
            const rowItem = e.currentTarget.closest('.practice-row-item');
            if (rowItem) {
                rowItem.classList.toggle('is-expanded');
            }
        };
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
        btn.addEventListener('click', async (e) => {
            // ★ await の前に ID を取得
            const id = parseInt(e.currentTarget.dataset.id, 10);
            const proceed = await showCustomConfirm('この日の練習記録をすべて削除しますか？', '練習記録の削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.practices = state.practices.filter(p => p.id !== id);
                saveData();
                initPractices(miniPitchObserver);
            }
        });
    });

    document.querySelectorAll('.btn-delete-menu').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // ★ await の前に ID を取得
            const pid = parseInt(e.currentTarget.dataset.pid, 10);
            const mid = parseInt(e.currentTarget.dataset.mid, 10);
            const proceed = await showCustomConfirm('この練習メニューを削除しますか？', 'メニューの削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
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