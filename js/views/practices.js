// Practices View Module

import { state, saveData, getNendo, filters } from '../state.js';
import { showToast, openModal } from '../ui.js';
import { navigate } from '../router.js';

export function openPracticeModal(practiceId = null) {
    const formPractice = document.getElementById('form-practice');
    if (formPractice) formPractice.reset();
    
    const editIdInp = document.getElementById('practice-edit-id');
    if (editIdInp) editIdInp.value = '';
    
    const title = document.getElementById('practice-modal-title');
    if (title) title.textContent = '練習日を追加';
    
    if (practiceId) {
        const p = state.practices.find(prac => prac.id === practiceId);
        if (p) {
            if (editIdInp) editIdInp.value = p.id;
            document.getElementById('practice-date').value = p.date;
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

export function renderPracticeRoster(activeIds = []) {
    const container = document.getElementById('practice-attendance-roster');
    if (!container) return;

    if (state.players.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">選手が登録されていません</div>';
        return;
    }

    const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
    
    container.innerHTML = sortedPlayers.map(p => {
        const checked = activeIds.includes(p.id) ? 'checked' : '';
        return `
            <label style="display:inline-flex; align-items:center; gap:0.25rem; font-size:0.8rem; background:#fff; padding:0.2rem 0.5rem; border-radius:6px; border:1px solid var(--surface-border); cursor:pointer;">
                <input type="checkbox" value="${p.id}" ${checked}> ${p.number} ${p.name}
            </label>
        `;
    }).join('');
}

export function openMenuModal(practiceId = null, menuId = null) {
    const formMenu = document.getElementById('form-menu');
    if (formMenu) formMenu.reset();

    const practiceIdInp = document.getElementById('menu-practice-id');
    if (practiceIdInp) practiceIdInp.value = practiceId || '';

    const sourceIdInp = document.getElementById('menu-library-source-id');
    if (sourceIdInp) sourceIdInp.value = '';

    const editIdInp = document.getElementById('menu-edit-id');
    if (editIdInp) editIdInp.value = menuId || '';

    const title = document.querySelector('#modal-menu h2');
    if (title) title.textContent = menuId ? '練習メニューを編集' : 'メニューを追加';

    const libSelectGroup = document.getElementById('menu-library-select');
    if (libSelectGroup && libSelectGroup.parentElement) {
        libSelectGroup.parentElement.style.display = menuId ? 'none' : 'block';
    }

    const catSel = document.getElementById('menu-category');
    if (catSel) {
        catSel.innerHTML = state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const libSelect = document.getElementById('menu-library-select');
    if (libSelect) {
        libSelect.innerHTML = '<option value="">- ライブラリから選択しない -</option>' + state.menuLibrary.map(m => `<option value="${m.id}">${m.focus}</option>`).join('');
    }

    if (menuId && practiceId) {
        const practice = state.practices.find(p => p.id === practiceId);
        if (practice) {
            const menu = practice.menus.find(m => m.id === menuId);
            if (menu) {
                document.getElementById('menu-focus').value = menu.focus || '';
                document.getElementById('menu-category').value = menu.category || 'その他';
                document.getElementById('menu-organize').value = menu.organize || '';
                document.getElementById('menu-keyfactor').value = menu.keyfactor || '';
                document.getElementById('menu-options').value = menu.options || '';
                const vInp = document.getElementById('menu-video-url');
                if (vInp) vInp.value = menu.videoUrl || '';
            }
        }
    }

    openModal('modal-menu');
}

export function initPractices() {
    const filterNendo = document.getElementById('filter-nendo-practice');
    const filterMonth = document.getElementById('filter-month-practice');

    if (filterNendo) {
        const nendos = Array.from(new Set(state.practices.map(p => getNendo(p.date)))).sort((a, b) => b - a);
        filterNendo.innerHTML = '<option value="all">すべての年度</option>' + nendos.map(n => `<option value="${n}">${n}年度</option>`).join('');
        filterNendo.value = filters.currentPracticeNendo;

        filterNendo.onchange = (e) => {
            filters.currentPracticeNendo = e.target.value;
            initPractices();
        };
    }

    const filteredPractices = filters.currentPracticeNendo === 'all'
        ? state.practices
        : state.practices.filter(p => getNendo(p.date) == filters.currentPracticeNendo);

    const practiceList = document.getElementById('practice-list');
    if (!practiceList) return;

    if (filteredPractices.length === 0) {
        practiceList.innerHTML = '<div class="text-secondary" style="text-align:center; padding:2rem; font-style:italic;">練習日が登録されていません</div>';
        return;
    }

    const sortedPractices = [...filteredPractices].sort((a, b) => new Date(b.date) - new Date(a.date));

    practiceList.innerHTML = sortedPractices.map(p => `
        <div class="card" style="padding:1.25rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                <div>
                    <h3 style="font-size:1.1rem; margin:0; font-weight:bold; color:var(--text-primary);"><i class="fa-solid fa-calendar-check" style="color:var(--primary);"></i> ${p.date} 練習</h3>
                    <span style="font-size:0.8rem; color:var(--text-secondary);"><i class="fa-solid fa-users"></i> 参加: ${p.attendance || '未記録'}</span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-primary btn-sm btn-add-menu" data-pid="${p.id}"><i class="fa-solid fa-plus"></i> メニュー追加</button>
                    <button class="btn btn-secondary btn-sm btn-edit-practice" data-pid="${p.id}"><i class="fa-solid fa-pen"></i> 編集</button>
                    <button class="btn btn-danger btn-sm btn-delete-practice" data-pid="${p.id}"><i class="fa-solid fa-trash"></i> 削除</button>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
                ${(!p.menus || p.menus.length === 0)
                    ? '<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic; padding:0.5rem 0;">メニュー未登録</div>'
                    : p.menus.map(m => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); padding:0.6rem 0.8rem; border-radius:8px; border:1px solid var(--surface-border);">
                            <div>
                                <span class="badge" style="background:rgba(0,0,0,0.05); font-size:0.7rem;">${m.category || 'その他'}</span>
                                <strong style="font-size:0.9rem; margin-left:0.4rem;">${m.focus}</strong>
                            </div>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn btn-secondary btn-sm btn-anim-practice" data-pid="${p.id}" data-mid="${m.id}"><i class="fa-solid fa-pen-ruler"></i> 作図</button>
                                <button class="btn btn-secondary btn-sm btn-edit-menu" data-pid="${p.id}" data-mid="${m.id}"><i class="fa-solid fa-pen"></i> 編集</button>
                                <button class="btn btn-danger btn-sm btn-delete-menu" data-pid="${p.id}" data-mid="${m.id}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
            </div>
        </div>
    `).join('');

    // Bind event listeners
    document.querySelectorAll('.btn-add-menu').forEach(btn => {
        btn.onclick = () => openMenuModal(parseInt(btn.dataset.pid, 10));
    });
    document.querySelectorAll('.btn-edit-practice').forEach(btn => {
        btn.onclick = () => openPracticeModal(parseInt(btn.dataset.pid, 10));
    });
    document.querySelectorAll('.btn-delete-practice').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.pid, 10);
            if (confirm('この練習日を削除しますか？')) {
                state.practices = state.practices.filter(p => p.id !== id);
                saveData();
                showToast('練習日を削除しました');
                initPractices();
            }
        };
    });

    document.querySelectorAll('.btn-anim-practice').forEach(btn => {
        btn.onclick = () => {
            const pid = parseInt(btn.dataset.pid, 10);
            const mid = parseInt(btn.dataset.mid, 10);
            navigate('animation', { practiceId: pid, menuId: mid });
        };
    });

    document.querySelectorAll('.btn-edit-menu').forEach(btn => {
        btn.onclick = () => {
            const pid = parseInt(btn.dataset.pid, 10);
            const mid = parseInt(btn.dataset.mid, 10);
            openMenuModal(pid, mid);
        };
    });

    document.querySelectorAll('.btn-delete-menu').forEach(btn => {
        btn.onclick = () => {
            const pid = parseInt(btn.dataset.pid, 10);
            const mid = parseInt(btn.dataset.mid, 10);
            if (confirm('この練習メニューを削除しますか？')) {
                const practice = state.practices.find(p => p.id === pid);
                if (practice) {
                    practice.menus = practice.menus.filter(m => m.id !== mid);
                    saveData();
                    showToast('メニューを削除しました');
                    initPractices();
                }
            }
        };
    });

    const btnAddPractice = document.getElementById('btn-add-practice');
    if (btnAddPractice) {
        btnAddPractice.onclick = () => openPracticeModal();
    }
}
