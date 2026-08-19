import { state, uiState } from './state.js';
import { escapeHtml, showToast, showCustomConfirm } from './utils.js';
import { navigate, openModal, saveData, clearAllMiniPitchIntervals } from './app-context.js';
import { drawPitchToCtx } from './drawing.js';

export function initTactics(miniPitchObserver) {
    if (state.currentUserRole !== 'coach') {
        navigate('dashboard');
        return;
    }

    let currentCategory = uiState.currentTacticsCategory || 'all';
    let currentSearch = (uiState.currentTacticsSearch || '').toLowerCase().trim();
    const isCoach = state.currentUserRole === 'coach';

    // Populate Category Select
    const filterCategorySelect = document.getElementById('filter-tactics-category');
    if (filterCategorySelect) {
        let options = '<option value="all">すべてのカテゴリ</option>';
        (state.tacticsCategories || []).forEach(cat => {
            options += `<option value="${cat}">${cat}</option>`;
        });
        filterCategorySelect.innerHTML = options;
        filterCategorySelect.value = currentCategory;

        filterCategorySelect.onchange = (e) => {
            uiState.currentTacticsCategory = e.target.value;
            uiState.currentTacticsPage = 1;
            initTactics(miniPitchObserver);
        };
    }

    // Search Input
    const searchInput = document.getElementById('input-tactics-search');
    if (searchInput) {
        searchInput.value = uiState.currentTacticsSearch || '';
        searchInput.oninput = (e) => {
            uiState.currentTacticsSearch = e.target.value;
            uiState.currentTacticsPage = 1;
            initTactics(miniPitchObserver);
        };
    }

    // Add Tactic Button
    const btnAdd = document.getElementById('btn-add-tactic');
    if (btnAdd) {
        if (!isCoach) {
            btnAdd.style.display = 'none';
        } else {
            btnAdd.style.display = 'inline-block';
            btnAdd.onclick = () => openTacticModal();
        }
    }

    renderTacticsList(miniPitchObserver, currentCategory, currentSearch, isCoach);
}

function renderTacticsList(miniPitchObserver, category, search, isCoach) {
    const tacticsList = document.getElementById('tactics-list');
    if (!tacticsList) return;

    let filteredTactics = state.tactics || [];
    
    // Filter by Category
    if (category !== 'all') {
        filteredTactics = filteredTactics.filter(t => t.category === category);
    }
    // Filter by Search
    if (search) {
        filteredTactics = filteredTactics.filter(t => 
            (t.title || '').toLowerCase().includes(search) || 
            (t.description || '').toLowerCase().includes(search)
        );
    }

    // Grouping by category
    const grouped = {};
    filteredTactics.forEach(t => {
        const cat = t.category || 'その他';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const idxA = (state.tacticsCategories || []).indexOf(a);
        const idxB = (state.tacticsCategories || []).indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    if (filteredTactics.length === 0) {
        const isSearchActive = !!search || category !== 'all';
        tacticsList.style.display = 'flex';
        tacticsList.style.flexDirection = 'column';
        tacticsList.style.gap = '1.5rem';
        tacticsList.innerHTML = `
            <section class="c-empty-state" aria-live="polite">
                <div class="c-empty-state__body">
                    <i class="c-empty-state__icon fa-solid ${isSearchActive ? 'fa-magnifying-glass' : 'fa-chess-knight'}" aria-hidden="true"></i>
                    <h3 class="c-empty-state__title">${isSearchActive ? '該当する戦術が見つかりません' : '戦術が登録されていません'}</h3>
                    <p class="c-empty-state__text">${isSearchActive ? '検索キーワードまたはカテゴリフィルタを変更してお試しください。' : 'チームの戦術方針（攻撃・守備・ビルドアップ等）の狙いやキーファクターを記録・作図し、いつでも振り返ることができます。'}</p>
                    ${!isSearchActive && isCoach ? `<button class="c-button btn c-button--primary btn-primary" id="btn-empty-add-tactic"><i class="fa-solid fa-plus" aria-hidden="true"></i> 最初の戦術作成</button>` : ''}
                </div>
            </section>
        `;
        const btnEmptyAdd = document.getElementById('btn-empty-add-tactic');
        if (btnEmptyAdd) btnEmptyAdd.onclick = () => openTacticModal();
        return;
    }

    tacticsList.style.display = 'flex';
    tacticsList.style.flexDirection = 'column';
    tacticsList.style.gap = '1.5rem';

    tacticsList.innerHTML = sortedCategories.map(cat => {
        const tactics = grouped[cat];
        // sort by id desc inside category
        tactics.sort((a, b) => b.id - a.id);

        const cardsHtml = tactics.map(t => {
            const actionBtns = isCoach ? `
                <button type="button" class="c-button btn c-button--secondary btn-secondary btn-edit-tactic" data-id="${t.id}" title="編集"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="c-button btn c-button--secondary btn-secondary btn-edit-tactic-board" data-id="${t.id}" title="${t.frames && t.frames.length > 0 ? '作図を編集' : '作図する'}"><i class="fa-solid fa-person-running"></i></button>
                <button type="button" class="c-button btn c-button--secondary btn-secondary btn-add-to-library" data-id="${t.id}" title="練習メニューライブラリに追加"><i class="fa-solid fa-plus"></i></button>
                <button type="button" class="c-button btn c-button--danger btn-danger btn-delete-tactic" data-id="${t.id}" title="削除"><i class="fa-solid fa-trash"></i></button>
            ` : `
                <button type="button" class="c-button btn c-button--secondary btn-secondary btn-edit-tactic-board" data-id="${t.id}" title="作図を見る"><i class="fa-solid fa-person-running"></i></button>
            `;

            return `
            <div class="u-ext-183 c-card card">
                <div>
                    <div class="library-card-header" style="display:flex; flex-direction:column; gap:0.3rem; margin-bottom:0.4rem;">
                        <div>
                            <span class="u-ext-185 c-status c-status--muted">${cat}</span>
                        </div>
                        <div class="u-ext-156 library-card-actions c-action-group c-action-group--end c-action-group--compact" style="width:100%;">
                            ${actionBtns}
                        </div>
                    </div>
                    <div class="u-ext-186">
                        ${escapeHtml(t.title || '無題')}
                    </div>

                    <div class="u-ext-188 library-canvas-wrapper" onclick="navigate('animation', { tacticId: ${t.id} })">
                        <canvas class="u-ext-160" id="tactic-mini-pitch-${t.id}" width="800" height="500"></canvas>
                        <div class="u-ext-189 canvas-hover-overlay">
                            <i class="u-ext-190 fa-solid fa-person-running"></i> 作図画面を開く
                        </div>
                        ${t.frames && t.frames.length > 1 ? `
                            <div class="u-ext-161">
                                <span class="u-ext-162"></span>ANIM
                            </div>
                        ` : ''}
                    </div>

                    ${t.description ? `
                    <details class="u-ext-191 library-card-details">
                        <summary class="u-ext-192">
                            <i class="u-ext-154 fa-solid fa-chevron-down"></i> 詳細を表示
                        </summary>
                        <div class="u-ext-193" onclick="event.stopPropagation();">
                            <div><strong class="u-ext-194"><i class="fa-solid fa-key"></i> 説明・キーファクター</strong><div class="u-ext-195" style="white-space:pre-wrap;">${escapeHtml(t.description)}</div></div>
                        </div>
                    </details>
                    ` : ''}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="u-ext-199 category-section">
            <h3 class="u-ext-200">
                ${cat} <span class="u-ext-201 text-secondary">(${tactics.length}件)</span>
            </h3>
            <div class="library-grid">
                ${cardsHtml}
            </div>
        </div>`;
    }).join('');

    // Attach Events
    document.querySelectorAll('.btn-edit-tactic').forEach(btn => {
        btn.onclick = (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const t = filteredTactics.find(x => x.id === id);
            if (t) openTacticModal(t);
        };
    });

    document.querySelectorAll('.btn-edit-tactic-board').forEach(btn => {
        btn.onclick = (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const t = filteredTactics.find(x => x.id === id);
            if (t) {
                navigate('animation', { tacticId: t.id });
            }
        };
    });

    document.querySelectorAll('.btn-add-to-library').forEach(btn => {
        btn.onclick = (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const t = filteredTactics.find(x => x.id === id);
            if (t) {
                const newLibMenu = {
                    id: Date.now(),
                    focus: t.title,
                    category: t.category || 'その他',
                    organize: '',
                    keyfactor: t.description || '',
                    options: '',
                    videoUrl: '',
                    frames: t.frames ? JSON.parse(JSON.stringify(t.frames)) : null,
                    pitchTemplate: t.pitchTemplate || 'full'
                };
                state.menuLibrary = state.menuLibrary || [];
                state.menuLibrary.push(newLibMenu);
                saveData();
                showToast(`戦術「${t.title}」を練習メニューライブラリに追加しました`);
            }
        };
    });

    document.querySelectorAll('.btn-delete-tactic').forEach(btn => {
        btn.onclick = async (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const t = filteredTactics.find(x => x.id === id);
            const title = t ? `「${t.title || '無題'}」を削除` : '戦術を削除';
            const confirmed = await showCustomConfirm('この戦術を削除します。この操作は取り消せません。', title, { okText: '削除する', type: 'danger' });
            if (!confirmed) return;
            state.tactics = state.tactics.filter(x => x.id !== id);
            saveData();
            showToast('戦術を削除しました');
            initTactics(miniPitchObserver);
        };
    });

    clearAllMiniPitchIntervals();

    setTimeout(() => {
        filteredTactics.forEach(t => {
            const mCanv = document.getElementById(`tactic-mini-pitch-${t.id}`);
            if (mCanv) {
                const mCtx = mCanv.getContext('2d');
                mCanv._animationFrames = t.frames || [];
                mCanv._pitchTemplate = t.pitchTemplate || 'full';

                drawPitchToCtx(t.frames && t.frames.length > 0 ? t.frames[0] : [], mCanv, mCtx, t.pitchTemplate || 'full');

                if (t.frames && t.frames.length > 1 && miniPitchObserver) {
                    miniPitchObserver.observe(mCanv);
                }
            }
        });
    }, 50);
}

export function openTacticModal(tactic = null) {
    const modal = document.getElementById('modal-tactic');
    const titleEl = document.getElementById('modal-tactic-title');
    const form = document.getElementById('form-tactic');
    
    // Populate categories
    const catSelect = document.getElementById('tactic-category');
    const categories = state.tacticsCategories || ['攻撃：ビルドアップ（自陣）', '攻撃：前進・崩し（中盤〜敵陣）', '守備：ハイプレス（前線）', '守備：ブロック・ゴール前（自陣）', '切り替え：攻→守（奪われたとき）', '切り替え：守→攻（奪ったとき）', 'セットプレー', 'その他'];
    catSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    const btnSubmit = document.querySelector('#form-tactic button[type="submit"]') || document.querySelector('button[form="form-tactic"]');
    if (tactic) {
        titleEl.textContent = '戦術を編集';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i> 更新';
        document.getElementById('tactic-id').value = tactic.id;
        document.getElementById('tactic-title').value = tactic.title || '';
        document.getElementById('tactic-category').value = tactic.category || 'その他';
        document.getElementById('tactic-description').value = tactic.description || '';
    } else {
        titleEl.textContent = '戦術を追加';
        if (btnSubmit) btnSubmit.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> 追加';
        document.getElementById('tactic-id').value = '';
        form.reset();
        document.getElementById('tactic-category').value = uiState.currentTacticsCategory !== 'all' ? uiState.currentTacticsCategory : categories[0];
    }

    form.onsubmit = (e) => {
        e.preventDefault();
        const idVal = document.getElementById('tactic-id').value;
        const title = document.getElementById('tactic-title').value.trim();
        const category = document.getElementById('tactic-category').value;
        const description = document.getElementById('tactic-description').value.trim();

        if (idVal) {
            const t = state.tactics.find(x => x.id === parseInt(idVal));
            if (t) {
                t.title = title;
                t.category = category;
                t.description = description;
                saveData();
                showToast('戦術を更新しました');
            }
        } else {
            const newTactic = {
                id: Date.now(),
                title: title,
                category: category,
                description: description,
                frames: null,
                pitchTemplate: 'full'
            };
            state.tactics = state.tactics || [];
            state.tactics.push(newTactic);
            saveData();
            showToast('戦術を作成しました');
        }
        
        modal.classList.add('hidden');
        navigate('tactics');
    };

    modal.classList.remove('hidden');
}

window.openTacticModal = openTacticModal;
