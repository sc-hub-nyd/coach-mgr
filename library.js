// library.js
import { state, uiState } from './state.js';
import { escapeHtml, showToast, showCustomConfirm } from './utils.js';
import { navigate, openModal } from './app-context.js';
import { drawPitchToCtx } from './drawing.js';

export function openAssignPracticeModal(menuId) {
    const modal = document.getElementById('modal-assign-practice');
    const inputMenuId = document.getElementById('assign-menu-id');
    const practicesList = document.getElementById('assign-practices-list');
    if (!modal || !inputMenuId || !practicesList) return;

    inputMenuId.value = menuId;
    practicesList.innerHTML = '';

    if (state.practices.length > 0) {
        const sortedPractices = [...state.practices].sort((a, b) => new Date(b.date) - new Date(a.date));
        practicesList.innerHTML = sortedPractices.map(p => `
            <article class="c-data-list__item">
                <div class="c-data-list__header">
                    <div class="c-data-list__identity"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${p.date}</div>
                    <div class="c-data-list__actions">
                        <button type="button" class="btn btn-primary btn-execute-assign" data-pid="${p.id}"><i class="fa-solid fa-check" aria-hidden="true"></i> アサイン</button>
                    </div>
                </div>
                <div class="c-data-list__meta"><i class="fa-solid fa-users" aria-hidden="true"></i> ${p.attendance} | メニュー数: ${p.menus.length}</div>
            </article>
        `).join('');

        document.querySelectorAll('.btn-execute-assign').forEach(btn => {
            btn.onclick = (e) => {
                const pid = parseInt(e.currentTarget.dataset.pid);
                const mid = parseInt(inputMenuId.value);

                const practice = state.practices.find(p => p.id === pid);
                const libMenu = state.menuLibrary.find(m => m.id === mid);

                if (practice && libMenu) {
                    let frames = null;
                    let pitchTemplate = 'full';
                    if (libMenu.frames) {
                        frames = JSON.parse(JSON.stringify(libMenu.frames));
                    }
                    if (libMenu.pitchTemplate) {
                        pitchTemplate = libMenu.pitchTemplate;
                    }

                    const newMenuObj = {
                        id: Date.now(),
                        focus: libMenu.focus,
                        organize: libMenu.organize,
                        keyfactor: libMenu.keyfactor,
                        options: libMenu.options,
                        category: libMenu.category || 'その他',
                        videoUrl: libMenu.videoUrl || '',
                        frames: frames,
                        pitchTemplate: pitchTemplate
                    };

                    practice.menus.push(newMenuObj);
                    showToast(`「${libMenu.focus}」を ${practice.date} の練習にアサインしました`);
                    modal.classList.add('hidden');
                }
            };
        });
    } else {
        practicesList.innerHTML = `
            <section class="c-empty-state c-empty-state--compact" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon fa-solid fa-calendar-xmark" aria-hidden="true"></i>
                    <p class="c-empty-state__text">練習予定・記録がありません。</p>
                </div>
            </section>
        `;
    }

    const btnAddPractice = document.getElementById('btn-assign-add-practice');
    if (btnAddPractice) {
        btnAddPractice.onclick = () => {
            modal.classList.add('hidden');
            openModal('modal-practice');
        };
    }

    modal.classList.remove('hidden');
}

export function initLibrary(miniPitchObserver) {
    let currentLibraryCategory = uiState.currentLibraryCategory || 'all';
    let currentLibraryMedia = uiState.currentLibraryMedia || 'all';
    let currentLibraryAssigned = uiState.currentLibraryAssigned || 'all';
    let currentLibraryRating = uiState.currentLibraryRating || 'all';
    let currentLibrarySearch = (uiState.currentLibrarySearch || '').toLowerCase().trim();
    const isCoach = state.currentUserRole === 'coach';

    // ── Search Input ──
    const searchInput = document.getElementById('input-library-search');
    if (searchInput) {
        searchInput.value = uiState.currentLibrarySearch || '';
        searchInput.oninput = (e) => {
            uiState.currentLibrarySearch = e.target.value;
            initLibrary(miniPitchObserver);
        };
    }

    // ── Populate Accordion Selects ──
    const filterCategorySelect = document.getElementById('filter-library-category');
    if (filterCategorySelect) {
        let options = '<option value="all">すべてのカテゴリ</option>';
        (state.menuCategories || []).forEach(cat => { options += `<option value="${escapeHtml(cat)}" ${currentLibraryCategory === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`; });
        filterCategorySelect.innerHTML = options;
        filterCategorySelect.onchange = (e) => {
            uiState.currentLibraryCategory = e.target.value;
            initLibrary(miniPitchObserver);
        };
    }

    const filterMediaSelect = document.getElementById('filter-library-media');
    if (filterMediaSelect) {
        filterMediaSelect.value = currentLibraryMedia;
        filterMediaSelect.onchange = (e) => {
            uiState.currentLibraryMedia = e.target.value;
            initLibrary(miniPitchObserver);
        };
    }

    const filterAssignedSelect = document.getElementById('filter-library-assigned');
    if (filterAssignedSelect) {
        filterAssignedSelect.value = currentLibraryAssigned;
        filterAssignedSelect.onchange = (e) => {
            uiState.currentLibraryAssigned = e.target.value;
            initLibrary(miniPitchObserver);
        };
    }

    const filterRatingSelect = document.getElementById('filter-library-rating');
    if (filterRatingSelect) {
        filterRatingSelect.value = currentLibraryRating;
        filterRatingSelect.onchange = (e) => {
            uiState.currentLibraryRating = e.target.value;
            initLibrary(miniPitchObserver);
        };
    }

    // ── Active Filter Badge, Button State & Tag Chips ──
    let activeFilterCount = 0;
    const activeTagsContainer = document.getElementById('active-tags-library');
    let activeTagsHtml = '<span class="active-tag-label">絞り込み中:</span>';

    if (currentLibraryCategory !== 'all') {
        activeFilterCount++;
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="category">${escapeHtml(currentLibraryCategory)} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentLibraryMedia !== 'all') {
        activeFilterCount++;
        const mediaMap = { anim: '作図アニメあり', video: '参考動画あり', any: '作図/動画あり' };
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="media">${mediaMap[currentLibraryMedia] || currentLibraryMedia} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentLibraryAssigned !== 'all') {
        activeFilterCount++;
        const assignMap = { frequent: 'よく使う (5回以上)', assigned: 'アサイン済み', unassigned: '未アサイン' };
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="assigned">${assignMap[currentLibraryAssigned] || currentLibraryAssigned} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }
    if (currentLibraryRating !== 'all') {
        activeFilterCount++;
        const ratingMap = { '5': '★5のみ', '4': '★4以上', '3': '★3以上', rated: '評価あり' };
        activeTagsHtml += `<span class="active-tag-chip" data-clear-key="rating">${ratingMap[currentLibraryRating] || `★${currentLibraryRating}`} <i class="fa-solid fa-xmark tag-remove"></i></span>`;
    }

    if (activeTagsContainer) {
        if (activeFilterCount > 0) {
            activeTagsContainer.innerHTML = activeTagsHtml;
            activeTagsContainer.classList.remove('hidden');
            activeTagsContainer.querySelectorAll('.active-tag-chip').forEach(chip => {
                chip.onclick = () => {
                    const key = chip.dataset.clearKey;
                    if (key === 'category') uiState.currentLibraryCategory = 'all';
                    if (key === 'media') uiState.currentLibraryMedia = 'all';
                    if (key === 'assigned') uiState.currentLibraryAssigned = 'all';
                    if (key === 'rating') uiState.currentLibraryRating = 'all';
                    initLibrary(miniPitchObserver);
                };
            });
        } else {
            activeTagsContainer.innerHTML = '';
            activeTagsContainer.classList.add('hidden');
        }
    }

    const btnToggle = document.getElementById('btn-toggle-filter-library');
    const badgeEl = document.getElementById('badge-filter-library');
    if (btnToggle) {
        btnToggle.classList.toggle('active-filter', activeFilterCount > 0);
        btnToggle.onclick = () => {
            const accordion = document.getElementById('filter-accordion-library');
            if (accordion) accordion.classList.toggle('hidden');
        };
    }
    if (badgeEl) {
        badgeEl.textContent = activeFilterCount;
        badgeEl.classList.toggle('hidden', activeFilterCount === 0);
    }

    const btnReset = document.getElementById('btn-reset-filter-library');
    if (btnReset) {
        btnReset.onclick = () => {
            uiState.currentLibraryCategory = 'all';
            uiState.currentLibraryMedia = 'all';
            uiState.currentLibraryAssigned = 'all';
            uiState.currentLibraryRating = 'all';
            initLibrary(miniPitchObserver);
        };
    }

    const menuAssignCountMap = {};
    (state.practices || []).forEach(p => {
        (p.menus || []).forEach(pm => {
            if (pm.libraryId) {
                menuAssignCountMap[pm.libraryId] = (menuAssignCountMap[pm.libraryId] || 0) + 1;
            }
            if (pm.focus) {
                menuAssignCountMap[pm.focus] = (menuAssignCountMap[pm.focus] || 0) + 1;
            }
        });
    });

    const isAssigned = (m) => (menuAssignCountMap[m.id] || 0) > 0 || (menuAssignCountMap[m.focus] || 0) > 0;
    const getAssignCount = (m) => (menuAssignCountMap[m.id] || 0) + (m.focus && m.focus !== String(m.id) ? (menuAssignCountMap[m.focus] || 0) : 0);

    const filteredMenus = state.menuLibrary.filter(m => {
        const matchCategory = currentLibraryCategory === 'all' || m.category === currentLibraryCategory;

        let matchMedia = true;
        if (currentLibraryMedia === 'anim') {
            matchMedia = !!(m.frames && m.frames.length > 0);
        } else if (currentLibraryMedia === 'video') {
            matchMedia = !!m.videoUrl;
        } else if (currentLibraryMedia === 'any') {
            matchMedia = !!(m.frames && m.frames.length > 0) || !!m.videoUrl;
        }

        let matchAssigned = true;
        if (currentLibraryAssigned === 'frequent') {
            matchAssigned = getAssignCount(m) >= 5;
        } else if (currentLibraryAssigned === 'assigned') {
            matchAssigned = isAssigned(m);
        } else if (currentLibraryAssigned === 'unassigned') {
            matchAssigned = !isAssigned(m);
        }

        let matchRating = true;
        const rating = m.engagement || 0;
        if (currentLibraryRating === '5') {
            matchRating = rating === 5;
        } else if (currentLibraryRating === '4') {
            matchRating = rating >= 4;
        } else if (currentLibraryRating === '3') {
            matchRating = rating >= 3;
        } else if (currentLibraryRating === 'rated') {
            matchRating = rating > 0;
        }

        let matchKeyword = true;
        if (currentLibrarySearch) {
            const targetText = [
                m.focus,
                m.organize,
                m.keyfactor,
                m.options,
                m.category,
                m.reflection
            ].filter(Boolean).join(' ').toLowerCase();
            matchKeyword = targetText.includes(currentLibrarySearch);
        }

        return matchCategory && matchMedia && matchAssigned && matchRating && matchKeyword;
    });

    const elLibrary = document.getElementById('dash-library');
    if (elLibrary) elLibrary.textContent = filteredMenus.length + '個';

    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;

    const grouped = {};
    filteredMenus.forEach(m => {
        const cat = m.category || 'その他';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const idxA = state.menuCategories.indexOf(a);
        const idxB = state.menuCategories.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    if (filteredMenus.length === 0) {
        const isSearchActive = !!currentLibrarySearch || currentLibraryCategory !== 'all' || currentLibraryMedia !== 'all' || currentLibraryAssigned !== 'all' || currentLibraryRating !== 'all';
        libraryList.innerHTML = `
            <section class="c-empty-state" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon fa-solid ${isSearchActive ? 'fa-magnifying-glass' : 'fa-book'}" aria-hidden="true"></i>
                    <h3 class="c-empty-state__title">${isSearchActive ? '該当する練習メニューが見つかりません' : 'メニューライブラリが空です'}</h3>
                    <p class="c-empty-state__text">${isSearchActive ? '検索キーワードまたは絞り込み条件（カテゴリ・メディア・アサイン・評価）を変更してお試しください。' : '練習のテーマ、オーガナイズ、キーファクターをライブラリ化し、戦術ボードで作図しておくことで、いつでも練習日へコピーして計画を立てられます。'}</p>
                    ${!isSearchActive && isCoach ? `<button class="btn btn-primary" id="btn-empty-add-library"><i class="fa-solid fa-plus" aria-hidden="true"></i> 最初のライブラリ作成</button>` : ''}
                </div>
            </section>
        `;
    } else {
        libraryList.innerHTML = sortedCategories.map(cat => {
            const menus = grouped[cat];
            const cardsHtml = menus.map(m => {
                const actionBtns = isCoach ? `
                    <button class="u-ext-182 btn btn-secondary btn-assign-library" data-id="${m.id}"  title="練習日にアサイン"><i class="fa-solid fa-calendar-plus"></i></button>
                    <button class="u-ext-182 btn btn-secondary btn-edit-library" data-id="${m.id}"  title="編集"><i class="fa-solid fa-pen"></i></button>
                    <button class="u-ext-182 btn btn-secondary btn-anim-library" data-id="${m.id}"  title="${m.frames && m.frames.length > 0 ? '作図を編集' : '作図する'}"><i class="fa-solid fa-person-running"></i></button>
                    <button class="u-ext-182 btn btn-danger btn-delete-library" data-id="${m.id}" ><i class="fa-solid fa-trash"></i></button>
                ` : `
                    <button class="u-ext-182 btn btn-secondary btn-anim-library" data-id="${m.id}"  title="作図を見る"><i class="fa-solid fa-person-running"></i></button>
                `;

                return `
                <div class="u-ext-183 card" >
                    <div>
                        <div class="library-card-header" style="display:flex; flex-direction:column; gap:0.3rem; margin-bottom:0.4rem;">
                            <div>
                                <span class="u-ext-185 badge" >${cat}</span>
                            </div>
                            <div class="u-ext-156 library-card-actions" style="display:flex; justify-content:flex-end; gap:0.25rem; width:100%;">
                                ${actionBtns}
                            </div>
                        </div>
                        <div class="u-ext-186" >
                            ${escapeHtml(m.focus)}
                            ${m.engagement ? `<span class="u-ext-187" >${'★'.repeat(m.engagement)}${'☆'.repeat(5 - m.engagement)}</span>` : ''}
                        </div>

                        <div class="u-ext-188 library-canvas-wrapper"  onclick="navigate('animation', { libraryId: ${m.id} })">
                            <canvas class="u-ext-160" id="library-mini-pitch-${m.id}" width="800" height="500" ></canvas>
                            <div class="u-ext-189 canvas-hover-overlay" >
                            <i class="u-ext-190 fa-solid fa-person-running" ></i> 作図画面を開く
                        </div>
                        ${m.frames && m.frames.length > 1 ? `
                            <div class="u-ext-161" >
                                <span class="u-ext-162" ></span>ANIM
                            </div>
                        ` : ''}
                    </div>

                    <details class="u-ext-191 library-card-details" >
                        <summary class="u-ext-192" >
                            <i class="u-ext-154 fa-solid fa-chevron-down" ></i> 詳細を表示
                        </summary>
                        <div class="u-ext-193"  onclick="event.stopPropagation();">
                            ${m.organize ? `<div><strong class="u-ext-194" ><i class="fa-solid fa-users"></i> オーガナイズ</strong><div class="u-ext-195" >${escapeHtml(m.organize)}</div></div>` : ''}
                            ${m.keyfactor ? `<div><strong class="u-ext-194" ><i class="fa-solid fa-key"></i> キーファクター</strong><div class="u-ext-195" >${escapeHtml(m.keyfactor)}</div></div>` : ''}
                            ${m.videoUrl ? `<div><strong class="u-ext-194" ><i class="u-ext-16 fa-brands fa-youtube" ></i> 参考動画</strong><div class="u-ext-196" ><a class="u-ext-165" href="${escapeHtml(m.videoUrl)}" target="_blank" rel="noopener noreferrer" ><i class="u-ext-33 fa-solid fa-arrow-up-right-from-square" ></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
                            ${m.options ? `<div><strong class="u-ext-194" ><i class="fa-solid fa-plus"></i> オプション</strong><div class="u-ext-195" >${escapeHtml(m.options)}</div></div>` : ''}
                            ${m.reflection ? `<div><strong class="u-ext-197" ><i class="fa-solid fa-clipboard-user"></i> 指導者の振り返り・メモ</strong><div class="u-ext-198" >${escapeHtml(m.reflection)}</div></div>` : ''}
                        </div>
                    </details>
                </div>
            </div>`;
            }).join('');

            return `
            <div class="u-ext-199 category-section" >
                <h3 class="u-ext-200" >
                    ${cat} <span class="u-ext-201 text-secondary" >(${menus.length}件)</span>
                </h3>
                <div class="library-grid">
                    ${cardsHtml}
                </div>
            </div>`;
        }).join('');
    }

    setTimeout(() => {
        filteredMenus.forEach(m => {
            const mCanv = document.getElementById(`library-mini-pitch-${m.id}`);
            if (mCanv) {
                const mCtx = mCanv.getContext('2d');
                mCanv._animationFrames = m.frames || [];
                mCanv._pitchTemplate = m.pitchTemplate || 'full';

                drawPitchToCtx(m.frames && m.frames.length > 0 ? m.frames[0] : [], mCanv, mCtx, m.pitchTemplate || 'full');

                if (m.frames && m.frames.length > 1 && miniPitchObserver) {
                    miniPitchObserver.observe(mCanv);
                }
            }
        });
    }, 50);

    const btnAdd = document.getElementById('btn-add-library-menu');
    if (btnAdd) {
        btnAdd.style.display = isCoach ? 'inline-flex' : 'none';
        btnAdd.onclick = () => {
            document.getElementById('menu-practice-id').value = 'library';
            document.getElementById('menu-library-source-id').value = '';
            if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';

            const selWrap = document.getElementById('menu-library-select');
            if (selWrap) selWrap.parentElement.style.display = 'none';

            const form = document.getElementById('form-menu');
            if (form) form.reset();

            const title = document.querySelector('#modal-menu h2');
            if (title) title.textContent = '練習メニューを追加';

            openModal('modal-menu');
        };
    }

    document.querySelectorAll('.btn-edit-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const menu = state.menuLibrary.find(m => m.id === id);
            if (menu) {
                openLibraryMenuModal(menu);
            }
        });
    });

    document.querySelectorAll('.btn-delete-library').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // ★ await の前に ID を取得
            const id = parseInt(e.currentTarget.dataset.id, 10);
            const proceed = await showCustomConfirm('このライブラリを削除しますか？', 'ライブラリの削除', { okText: '削除する', type: 'danger' });
            if (proceed) {
                state.menuLibrary = state.menuLibrary.filter(m => m.id !== id);
                saveData();
                showToast('削除しました');
                initLibrary(miniPitchObserver);
            }
        });
    });

    document.querySelectorAll('.btn-anim-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            navigate('animation', { libraryId: id });
        });
    });

    document.querySelectorAll('.btn-assign-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            openAssignPracticeModal(id);
        });
    });
}

export function openLibraryMenuModal(menu) {
    if (!menu) return;
    document.getElementById('menu-practice-id').value = 'library';
    document.getElementById('menu-library-source-id').value = '';
    if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = menu.id;

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

    const selWrap = document.getElementById('menu-library-select');
    if (selWrap) selWrap.parentElement.style.display = 'none';

    const title = document.querySelector('#modal-menu h2');
    if (title) title.textContent = '練習メニューを編集';

    openModal('modal-menu');
}

window.openLibraryMenuModal = openLibraryMenuModal;