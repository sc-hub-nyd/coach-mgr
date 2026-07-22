// Settings & Master Management View Module

import { state, saveData } from '../state.js';
import { showToast, openModal } from '../ui.js';

export function openCustomFormationModal(editIndex = null) {
    const modal = document.getElementById('modal-custom-formation');
    if (!modal) return;

    const nameInp = document.getElementById('custom-form-name');
    const indexInp = document.getElementById('custom-form-edit-index');
    const container = document.getElementById('custom-form-positions-list');
    if (!nameInp || !container) return;

    if (indexInp) indexInp.value = editIndex !== null ? editIndex : '';

    if (editIndex !== null && state.customFormations[editIndex]) {
        const item = state.customFormations[editIndex];
        nameInp.value = item.name;
        container.innerHTML = item.coords.map((c, i) => `
            <div style="display:grid; grid-template-columns: 60px 70px 1fr 1fr 30px; gap:0.4rem; align-items:center; margin-bottom:0.4rem;">
                <select class="form-control pos-role-sel" style="font-size:0.75rem; padding:0.2rem;">
                    <option value="GK" ${c.role === 'GK' ? 'selected' : ''}>GK</option>
                    <option value="DF" ${c.role === 'DF' ? 'selected' : ''}>DF</option>
                    <option value="MF" ${c.role === 'MF' ? 'selected' : ''}>MF</option>
                    <option value="FW" ${c.role === 'FW' ? 'selected' : ''}>FW</option>
                </select>
                <input type="text" class="form-control pos-label-inp" value="${c.label}" placeholder="ラベル" style="font-size:0.75rem; padding:0.2rem;">
                <input type="text" class="form-control pos-top-inp" value="${c.top}" placeholder="縦 (例: 70%)" style="font-size:0.75rem; padding:0.2rem;">
                <input type="text" class="form-control pos-left-inp" value="${c.left}" placeholder="横 (例: 50%)" style="font-size:0.75rem; padding:0.2rem;">
                <button type="button" class="btn btn-danger btn-sm btn-del-pos-row" style="padding:0.1rem 0.3rem;"><i class="fa-solid fa-times"></i></button>
            </div>
        `).join('');
    } else {
        nameInp.value = '';
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 60px 70px 1fr 1fr 30px; gap:0.4rem; align-items:center; margin-bottom:0.4rem;">
                <select class="form-control pos-role-sel" style="font-size:0.75rem; padding:0.2rem;">
                    <option value="GK" selected>GK</option>
                    <option value="DF">DF</option>
                    <option value="MF">MF</option>
                    <option value="FW">FW</option>
                </select>
                <input type="text" class="form-control pos-label-inp" value="GK" placeholder="ラベル" style="font-size:0.75rem; padding:0.2rem;">
                <input type="text" class="form-control pos-top-inp" value="88%" placeholder="縦" style="font-size:0.75rem; padding:0.2rem;">
                <input type="text" class="form-control pos-left-inp" value="50%" placeholder="横" style="font-size:0.75rem; padding:0.2rem;">
                <button type="button" class="btn btn-danger btn-sm btn-del-pos-row" style="padding:0.1rem 0.3rem;"><i class="fa-solid fa-times"></i></button>
            </div>
        `;
    }

    // Bind delete row buttons
    container.querySelectorAll('.btn-del-pos-row').forEach(btn => {
        btn.onclick = (e) => e.target.closest('div').remove();
    });

    openModal('modal-custom-formation');
}

export function initSettings() {
    const formTeam = document.getElementById('form-team-info');
    if (formTeam) {
        document.getElementById('team-name-input').value = state.teamInfo.name || 'My Team';
        document.getElementById('team-color-input').value = state.teamInfo.color || '#f23932';
        const passcodeInp = document.getElementById('team-passcode-input');
        if (passcodeInp) passcodeInp.value = state.teamInfo.passcode || '7064';

        formTeam.onsubmit = (e) => {
            e.preventDefault();
            state.teamInfo.name = document.getElementById('team-name-input').value.trim();
            state.teamInfo.color = document.getElementById('team-color-input').value;
            if (passcodeInp) state.teamInfo.passcode = passcodeInp.value.trim() || '7064';

            document.documentElement.style.setProperty('--primary', state.teamInfo.color);
            const sidebarTitle = document.querySelector('.sidebar-header h2');
            if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;

            saveData();
            showToast('チーム基本情報を更新しました');
        };
    }

    // Render Master Management tags
    const renderTags = (containerId, itemsArray, onAdd, onDelete) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = itemsArray.map((item, idx) => `
            <span class="badge" style="background:rgba(0,0,0,0.06); color:var(--text-primary); padding:0.3rem 0.6rem; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.4rem;">
                ${item}
                <i class="fa-solid fa-times btn-del-tag" data-idx="${idx}" style="cursor:pointer; color:#ef4444;"></i>
            </span>
        `).join('');

        container.querySelectorAll('.btn-del-tag').forEach(btn => {
            btn.onclick = () => onDelete(parseInt(btn.dataset.idx, 10));
        });
    };

    // Match Types
    renderTags('tags-match-types', state.matchTypes, null, (idx) => {
        if (state.matchTypes.length <= 1) return alert('最低1つの試合種別が必要です');
        state.matchTypes.splice(idx, 1);
        saveData();
        initSettings();
    });

    const btnAddMatchType = document.getElementById('btn-add-match-type');
    if (btnAddMatchType) {
        btnAddMatchType.onclick = () => {
            const inp = document.getElementById('input-new-match-type');
            if (inp && inp.value.trim()) {
                state.matchTypes.push(inp.value.trim());
                inp.value = '';
                saveData();
                initSettings();
            }
        };
    }

    // Menu Categories
    renderTags('tags-menu-categories', state.menuCategories, null, (idx) => {
        if (state.menuCategories.length <= 1) return alert('最低1つのカテゴリが必要です');
        state.menuCategories.splice(idx, 1);
        saveData();
        initSettings();
    });

    const btnAddCategory = document.getElementById('btn-add-menu-category');
    if (btnAddCategory) {
        btnAddCategory.onclick = () => {
            const inp = document.getElementById('input-new-menu-category');
            if (inp && inp.value.trim()) {
                state.menuCategories.push(inp.value.trim());
                inp.value = '';
                saveData();
                initSettings();
            }
        };
    }

    // Custom Formations List
    const customFormsContainer = document.getElementById('custom-formations-list');
    if (customFormsContainer) {
        customFormsContainer.innerHTML = state.customFormations.map((item, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); padding:0.5rem 0.8rem; border-radius:6px; border:1px solid var(--surface-border); margin-bottom:0.4rem;">
                <span><strong>${item.name}</strong> (${item.coords.length}人配置)</span>
                <div>
                    <button class="btn btn-secondary btn-sm btn-edit-custom-form" data-idx="${idx}" style="padding:0.2rem 0.4rem; font-size:0.75rem;"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm btn-del-custom-form" data-idx="${idx}" style="padding:0.2rem 0.4rem; font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        customFormsContainer.querySelectorAll('.btn-edit-custom-form').forEach(btn => {
            btn.onclick = () => openCustomFormationModal(parseInt(btn.dataset.idx, 10));
        });

        customFormsContainer.querySelectorAll('.btn-del-custom-form').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (state.customFormations.length <= 1) return alert('最低1つのフォーメーションが必要です');
                if (confirm('このフォーメーション定義を削除しますか？')) {
                    state.customFormations.splice(idx, 1);
                    saveData();
                    initSettings();
                }
            };
        });
    }

    const btnAddCustomForm = document.getElementById('btn-add-custom-formation');
    if (btnAddCustomForm) {
        btnAddCustomForm.onclick = () => openCustomFormationModal();
    }

    // Form submit for custom formation
    const formCustomFormation = document.getElementById('form-custom-formation');
    if (formCustomFormation) {
        formCustomFormation.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('custom-form-name').value.trim();
            const indexVal = document.getElementById('custom-form-edit-index').value;
            const container = document.getElementById('custom-form-positions-list');
            
            const rows = container.querySelectorAll('div');
            const coords = [];
            rows.forEach(row => {
                const role = row.querySelector('.pos-role-sel').value;
                const label = row.querySelector('.pos-label-inp').value.trim();
                const top = row.querySelector('.pos-top-inp').value.trim();
                const left = row.querySelector('.pos-left-inp').value.trim();
                if (label && top && left) {
                    coords.push({ role, label, top, left });
                }
            });

            if (coords.length === 0) return alert('ポジション配置を1つ以上追加してください');

            if (indexVal !== '') {
                const idx = parseInt(indexVal, 10);
                state.customFormations[idx] = { name, coords };
            } else {
                state.customFormations.push({ name, coords });
            }

            saveData();
            showToast('フォーメーション定義を保存しました');
            document.getElementById('modal-custom-formation').classList.add('hidden');
            initSettings();
        };
    }
}
