// Data Export / Import View Module

import { state, loadData } from '../state.js?v=25';
import { showToast, _showExportFallbackModal } from '../ui.js';

export function initData() {
    const handleExport = () => {
        const dataStr = JSON.stringify({
            matches: state.matches,
            practices: state.practices,
            players: state.players,
            menuLibrary: state.menuLibrary,
            matchTypes: state.matchTypes,
            menuCategories: state.menuCategories,
            skillMetrics: state.skillMetrics,
            positions: state.positions,
            positionsCat2: state.positionsCat2,
            teamInfo: state.teamInfo,
            customFormations: state.customFormations
        }, null, 2);

        const filename = `soccer_coach_manager_backup_${new Date().toISOString().split('T')[0]}.json`;

        try {
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('データをバックアップファイルとしてダウンロードしました');
        } catch (e) {
            _showExportFallbackModal(dataStr);
        }
    };

    const btnExportSettings = document.getElementById('btn-export-data');
    if (btnExportSettings) btnExportSettings.onclick = handleExport;

    const btnExportView = document.getElementById('btn-data-view-export');
    if (btnExportView) btnExportView.onclick = handleExport;

    const handleImportFile = (file, inputEl) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed.matches && !parsed.practices && !parsed.players && !parsed.menuLibrary) {
                    alert('有効なデータファイルではありません。エクスポートしたJSONファイルを選択してください。');
                    return;
                }
                localStorage.setItem('coachMgrData', JSON.stringify(parsed));
                loadData();
                document.documentElement.style.setProperty('--primary', state.teamInfo.color);
                const sidebarTitle = document.querySelector('.sidebar-header h2');
                if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
                showToast('データをインポートしました。ページを再読み込みします...');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                alert('ファイルの読み込みに失敗しました。有効なJSONファイルを選択してください。');
            }
        };
        reader.readAsText(file);
    };

    const inputImportSettings = document.getElementById('input-import-data');
    if (inputImportSettings) {
        inputImportSettings.onchange = (e) => handleImportFile(e.target.files[0], inputImportSettings);
    }

    const inputImportView = document.getElementById('input-data-view-import');
    if (inputImportView) {
        inputImportView.onchange = (e) => handleImportFile(e.target.files[0], inputImportView);
    }

    const btnAllClear = document.getElementById('btn-data-all-clear');
    if (btnAllClear) {
        btnAllClear.onclick = () => {
            if (!confirm('【警告】入力済みのデータをすべて消去して初期化します。\nこの操作は取り消せません。よろしいですか？')) {
                return;
            }
            if (!confirm('本当にすべてのデータを消去しますか？（最終確認）')) {
                return;
            }
            state.matches = [];
            state.practices = [];
            state.players = [];
            state.menuLibrary = [];
            localStorage.removeItem('coachMgrData');
            showToast('すべての入力データをクリアしました。');
            setTimeout(() => location.reload(), 1000);
        };
    }
}
