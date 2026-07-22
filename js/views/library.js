// Menu Library View Module

import { state, saveData, filters } from '../state.js';
import { showToast, openModal } from '../ui.js';
import { navigate } from '../router.js';
import { openMenuModal } from './practices.js';

export function openLibraryModal(menuId = null) {
    openMenuModal('library', menuId);
}

export function initLibrary() {
    const filterCatSelect = document.getElementById('filter-category-library');
    if (filterCatSelect) {
        filterCatSelect.innerHTML = '<option value="all">すべてのカテゴリ</option>' + state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
        filterCatSelect.value = filters.currentLibraryCategory;

        filterCatSelect.onchange = (e) => {
            filters.currentLibraryCategory = e.target.value;
            initLibrary();
        };
    }

    const filteredMenus = filters.currentLibraryCategory === 'all'
        ? state.menuLibrary
        : state.menuLibrary.filter(m => m.category === filters.currentLibraryCategory);

    const libList = document.getElementById('library-list');
    if (!libList) return;

    if (filteredMenus.length === 0) {
        libList.innerHTML = '<div class="text-secondary" style="text-align:center; padding:2rem; font-style:italic;">ライブラリメニューが登録されていません</div>';
        return;
    }

    libList.innerHTML = filteredMenus.map(m => `
        <div class="card" style="padding:1.25rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                <div>
                    <span class="badge" style="background:rgba(0,0,0,0.05); font-size:0.75rem;">${m.category || 'その他'}</span>
                    <h3 style="font-size:1.1rem; margin:0.3rem 0; font-weight:bold; color:var(--text-primary);">${m.focus}</h3>
                </div>
                <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-secondary btn-sm btn-anim-library" data-id="${m.id}"><i class="fa-solid fa-pen-ruler"></i> 作図</button>
                    <button class="btn btn-secondary btn-sm btn-edit-library" data-id="${m.id}"><i class="fa-solid fa-pen"></i> 編集</button>
                    <button class="btn btn-danger btn-sm btn-delete-library" data-id="${m.id}"><i class="fa-solid fa-trash"></i> 削除</button>
                </div>
            </div>

            ${m.organize ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;"><strong>オーガナイズ:</strong> ${m.organize}</div>` : ''}
            ${m.keyfactor ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;"><strong>キーファクター:</strong> ${m.keyfactor}</div>` : ''}
            ${m.options ? `<div style="font-size:0.85rem; color:var(--text-secondary);"><strong>バリエーション:</strong> ${m.options}</div>` : ''}
        </div>
    `).join('');

    // Bind button listeners
    document.querySelectorAll('.btn-anim-library').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.id, 10);
            navigate('animation', { libraryId: id });
        };
    });

    document.querySelectorAll('.btn-edit-library').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.id, 10);
            openLibraryModal(id);
        };
    });

    document.querySelectorAll('.btn-delete-library').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.id, 10);
            if (confirm('このライブラリメニューを削除しますか？')) {
                state.menuLibrary = state.menuLibrary.filter(m => m.id !== id);
                saveData();
                showToast('メニューを削除しました');
                initLibrary();
            }
        };
    });

    const btnAdd = document.getElementById('btn-add-library-menu');
    if (btnAdd) {
        btnAdd.onclick = () => openLibraryModal();
    }
}
