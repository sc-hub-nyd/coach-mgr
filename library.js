// library.js
import { state, uiState } from './state.js';
import { escapeHtml, showToast } from './utils.js';
import { navigate, openModal } from './app.js';
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
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:0.6rem; border-radius:8px; border:1px solid var(--surface-border);">
                <div>
                    <strong><i class="fa-regular fa-calendar"></i> ${p.date}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.15rem;"><i class="fa-solid fa-users"></i> ${p.attendance} | メニュー数: ${p.menus.length}</div>
                </div>
                <button class="btn btn-primary btn-execute-assign" data-pid="${p.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem;"><i class="fa-solid fa-check"></i> アサイン</button>
            </div>
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
        practicesList.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; text-align:center; padding:1rem;">練習予定・記録がありません。</p>';
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
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid ${isSearchActive ? 'fa-magnifying-glass' : 'fa-book'}"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">${isSearchActive ? '該当する練習メニューが見つかりません' : 'メニューライブラリが空です'}</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:360px; margin:0; line-height:1.4;">
                    ${isSearchActive ? '検索キーワードまたは絞り込み条件（カテゴリ・メディア・アサイン・評価）を変更してお試しください。' : '練習のテーマ、オーガナイズ、キーファクターをライブラリ化し、戦術ボードで作図しておくことで、いつでも練習日へコピーして計画を立てられます。'}
                </p>
                ${!isSearchActive ? `<button class="btn btn-primary" id="btn-empty-add-library" style="margin-top:0.5rem; display:${isCoach ? 'inline-block' : 'none'};"><i class="fa-solid fa-plus"></i> 最初のライブラリ作成</button>` : ''}
            </div>
        `;
    } else {
        libraryList.innerHTML = sortedCategories.map(cat => {
            const menus = grouped[cat];
            const cardsHtml = menus.map(m => {
                const actionBtns = isCoach ? `
                    <button class="btn btn-secondary btn-assign-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="練習日にアサイン"><i class="fa-solid fa-calendar-plus"></i></button>
                    <button class="btn btn-secondary btn-edit-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="編集"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-secondary btn-anim-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="${m.frames && m.frames.length > 0 ? '作図を編集' : '作図する'}"><i class="fa-solid fa-person-running"></i></button>
                    <button class="btn btn-danger btn-delete-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;"><i class="fa-solid fa-trash"></i></button>
                ` : `
                    <button class="btn btn-secondary btn-anim-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="作図を見る"><i class="fa-solid fa-person-running"></i></button>
                `;

                return `
                <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; min-height: auto;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem;">
                            <span class="badge" style="background:rgba(242, 57, 50, 0.15); color:var(--primary); font-weight:600; padding:0.25rem 0.5rem; border-radius:6px; margin:0; font-size:0.75rem;">${cat}</span>
                            <div style="display:flex; gap:0.3rem;">
                                ${actionBtns}
                            </div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--text-primary); line-height:1.3; margin-bottom:0.8rem;">
                            ${escapeHtml(m.focus)}
                            ${m.engagement ? `<span style="color:#f59e0b; font-size:0.85rem; margin-left:0.4rem;">${'★'.repeat(m.engagement)}${'☆'.repeat(5 - m.engagement)}</span>` : ''}
                        </div>

                        <div class="library-canvas-wrapper" style="width:100%; height:140px; background:#1e293b; border-radius:8px; overflow:hidden; position:relative; margin-bottom:0.8rem; cursor:pointer;" onclick="navigate('animation', { libraryId: ${m.id} })">
                            <canvas id="library-mini-pitch-${m.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                            <div class="canvas-hover-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:0.9rem; font-weight:bold; pointer-events:none;">
                            <i class="fa-solid fa-person-running" style="margin-right:0.3rem;"></i> 作図画面を開く
                        </div>
                        ${m.frames && m.frames.length > 1 ? `
                            <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:0.15rem 0.35rem; border-radius:4px; font-weight:bold; pointer-events:none; display:flex; align-items:center; gap:0.2rem;">
                                <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%; animation: pulse 1.5s infinite;"></span>ANIM
                            </div>
                        ` : ''}
                    </div>

                    <details class="library-card-details" style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:8px; cursor:pointer;">
                        <summary style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.8rem; font-size:0.85rem; font-weight:bold; color:var(--text-secondary); list-style:none; outline:none; box-sizing:border-box;">
                            <i class="fa-solid fa-chevron-down" style="font-size:0.75rem; color:var(--text-secondary); transition:transform 0.2s;"></i> 詳細を表示
                        </summary>
                        <div style="padding:0.8rem; border-top:1px solid rgba(0,0,0,0.05); font-size:0.85rem; display:flex; flex-direction:column; gap:0.5rem; color:var(--text-secondary); cursor:default;" onclick="event.stopPropagation();">
                            ${m.organize ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-users"></i> オーガナイズ</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${escapeHtml(m.organize)}</div></div>` : ''}
                            ${m.keyfactor ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-key"></i> キーファクター</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${escapeHtml(m.keyfactor)}</div></div>` : ''}
                            ${m.videoUrl ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 参考動画</strong><div style="margin-top:0.1rem;"><a href="${escapeHtml(m.videoUrl)}" target="_blank" rel="noopener noreferrer" style="color:#ef4444; text-decoration:underline; font-weight:bold; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
                            ${m.options ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-plus"></i> オプション</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${escapeHtml(m.options)}</div></div>` : ''}
                            ${m.reflection ? `<div><strong style="color:var(--primary); font-size:0.8rem;"><i class="fa-solid fa-clipboard-user"></i> 指導者の振り返り・メモ</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3; background:rgba(242,57,50,0.04); padding:0.4rem 0.6rem; border-radius:6px; border-left:3px solid var(--primary); color:var(--text-primary);">${escapeHtml(m.reflection)}</div></div>` : ''}
                        </div>
                    </details>
                </div>
            </div>`;
            }).join('');

            return `
            <div class="category-section" style="margin-bottom:2rem;">
                <h3 style="margin-bottom: 1rem; border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; display:inline-block; font-size: 1.15rem; font-weight:600;">
                    ${cat} <span class="text-secondary" style="font-size:0.85rem; font-weight:normal; margin-left:0.5rem;">(${menus.length}件)</span>
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
                document.getElementById('menu-practice-id').value = 'library';
                document.getElementById('menu-library-source-id').value = '';
                if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = id;

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
        });
    });

    document.querySelectorAll('.btn-delete-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm('このライブラリを削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id);
                state.menuLibrary = state.menuLibrary.filter(m => m.id !== id);
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