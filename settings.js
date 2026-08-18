// settings.js
import { state } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, showCustomConfirm } from './utils.js';
import { createBackupPayload, parseBackupPayload, savePersistedSnapshot, loadRecoverySnapshot, clearPersistedSnapshot } from './repository.js';
import { markBackupCreated, buildOperationalDiagnostics, buildOperationsShareText } from './operations-service.js';
import { listCloudRecoveries } from './sync-service.js';
import { ensureParentShareSettings, rotateParentShareLink, buildPendingRsvpDigest, createParentAccessInvite, getParentAccessSummary, PARENT_ACCESS_SCOPES, revokeParentAccessInvite } from './parent-operations-service.js';
import { archiveSeason, createSeason, createTeam, ensureWorkspaceState, getActiveSeason, getActiveTeam, switchWorkspace } from './workspace-service.js';
import { buildSeasonReport, buildSeasonReportCsv, buildSeasonReportPrintHtml } from './season-report-service.js';
import { loadUiPreferences, saveUiPreferences, applyUiPreferences } from './experience-service.js';
import { applyTeamTheme, buildTeamTheme, normalizeHex, normalizeTeamTheme } from './color-theme-service.js';

import { saveData, syncPushGasCloud, syncPullGasCloud, restoreCloudRecovery, updateRoleUI, openModal, loadData } from './app-context.js';

export function _showExportFallbackModal(jsonStr) {
    const modal = document.getElementById('modal-export-fallback');
    const textarea = document.getElementById('export-json-textarea');
    const btnCopy = document.getElementById('btn-copy-export-json');
    const successMsg = document.getElementById('export-copy-success');
    if (!modal || !textarea) return;

    textarea.value = jsonStr;
    if (successMsg) successMsg.style.display = 'none';
    modal.classList.remove('hidden');

    if (btnCopy) {
        btnCopy.onclick = () => {
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(jsonStr).then(() => {
                        const msg = document.getElementById('export-copy-success');
                        if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2500); }
                    });
                } else {
                    document.execCommand('copy');
                    const msg = document.getElementById('export-copy-success');
                    if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2500); }
                }
            } catch (e) {
                alert('コピーできませんでした。テキストを手動で選択してコピーしてください。');
            }
        };
    }
}

export function exportBackupData() {
    const dataStr = JSON.stringify(createBackupPayload(state), null, 2);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = `coachMgrBackup_${dateStr}.json`;
    try {
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast(`${filename} をダウンロードしました`);
    } catch (_error) {
        _showExportFallbackModal(dataStr);
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) setTimeout(() => _showExportFallbackModal(dataStr), 300);
    markBackupCreated(now);
    if (typeof window.refreshOperationalDiagnostics === 'function') window.refreshOperationalDiagnostics();
    return { filename, dataStr };
}

export async function exportRecoveryBackupData() {
    const recoverySnapshot = await loadRecoverySnapshot({ decryptData });
    if (!recoverySnapshot) throw new Error('復旧用データが見つかりません');

    const dataStr = JSON.stringify(createBackupPayload(recoverySnapshot), null, 2);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = `coachMgrRecovery_${dateStr}.json`;
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast(`${filename} をダウンロードしました`);
    return { filename, dataStr };
}

export function initData() {
    const settingsVersionText = document.getElementById('settings-version-text');
    if (settingsVersionText) {
        import('./version.js').then(ver => {
            settingsVersionText.textContent = `CoachMgr ${ver.APP_VERSION} (${ver.RELEASE_DATE})`;
        });
    }

    const btnShowReleaseNotes = document.getElementById('btn-show-release-notes');
    if (btnShowReleaseNotes) {
        btnShowReleaseNotes.onclick = () => {
            if (window.openReleaseNotesModal) window.openReleaseNotesModal();
        };
    }
    const btnExportSettings = document.getElementById('btn-export-data');
    const btnExportView = document.getElementById('btn-data-view-export');

    const handleExport = () => exportBackupData();

    if (btnExportSettings) btnExportSettings.onclick = handleExport;
    if (btnExportView) btnExportView.onclick = handleExport;

    const handleImportFile = async (file, inputEl) => {
        if (!file) return;
        const proceed = await showCustomConfirm('現在のデータがすべて上書きされます。インポートを実行してよろしいですか？', 'データのインポート', { okText: 'インポートする' });
        if (!proceed) {
            if (inputEl) inputEl.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                                const parsed = parseBackupPayload(evt.target.result);
                await savePersistedSnapshot(parsed, { encryptData });

                await loadData();
                applyCurrentTeamTheme();
                const sidebarTitle = document.querySelector('.sidebar-header h2');
                if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${escapeHtml(state.teamInfo.name)}`;
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
        inputImportSettings.onchange = async (e) => await handleImportFile(e.target.files[0], inputImportSettings);
    }

    const inputImportView = document.getElementById('input-data-view-import');
    if (inputImportView) {
        inputImportView.onchange = async (e) => await handleImportFile(e.target.files[0], inputImportView);
    }

    const btnAllClear = document.getElementById('btn-data-all-clear');
    if (btnAllClear) {
        btnAllClear.onclick = async () => {
            const proceed1 = await showCustomConfirm('【警告】入力済みのデータをすべて消去して初期化します。\nこの操作は取り消せません。よろしいですか？', 'データの初期化（警告）', { okText: '消去する', type: 'danger' });
            if (!proceed1) {
                return;
            }
            const proceed2 = await showCustomConfirm('本当にすべてのデータを消去しますか？（最終確認）', 'データの初期化（最終確認）', { okText: '本当に消去する', type: 'danger' });
            if (!proceed2) {
                return;
            }
            state.matches = [];
            state.practices = [];
            state.players = [];
            state.menuLibrary = [];
                state.tactics = [];
                state.practiceTemplates = [];

            await clearPersistedSnapshot();

            showToast('すべての入力データをクリアしました。');
            setTimeout(() => location.reload(), 1000);
        };
    }
}

export function applyCurrentTeamTheme({ colorMode = loadUiPreferences().colorMode } = {}) {
    if (!state.teamInfo || typeof state.teamInfo !== 'object') state.teamInfo = {};
    const theme = normalizeTeamTheme(state.teamInfo);
    state.teamInfo.theme = theme;
    // Keep color as a backward-compatible mirror for existing exports and workspace records.
    state.teamInfo.color = theme.seed;
    return applyTeamTheme({ teamInfo: state.teamInfo, colorMode });
}

function renderThemePreview(seed) {
    const preview = document.getElementById('team-theme-preview');
    const hex = document.getElementById('team-theme-hex');
    const status = document.getElementById('team-theme-contrast-status');
    const normalizedSeed = normalizeHex(seed);
    const palettes = ['light', 'dark'].map(mode => buildTeamTheme(normalizedSeed, mode));
    if (hex) hex.textContent = normalizedSeed.toUpperCase();
    if (preview) {
        preview.innerHTML = palettes.map(palette => `
            <section class="c-theme-preview__mode" style="--preview-canvas:${palette.canvas};--preview-surface:${palette.surface};--preview-text:${palette.text};--preview-muted:${palette.textMuted};--preview-border:${palette.border};--preview-primary:${palette.primary};--preview-on-primary:${palette.onPrimary};">
                <header><span>${palette.mode === 'dark' ? 'ダーク' : 'ライト'}</span><span>${palette.mode === 'dark' ? '夜間の表示' : '日中の表示'}</span></header>
                <div class="c-theme-preview__surface"><strong>練習の準備を確認</strong><span class="c-theme-preview__muted">文字・境界・選択状態を役割ごとに調整します。</span><button type="button" class="c-theme-preview__button" tabindex="-1">主操作</button></div>
            </section>`).join('');
    }
    if (status) {
        const checks = palettes.flatMap(palette => palette.validation.checks);
        const passed = checks.every(check => check.ratio >= check.minimum);
        status.classList.toggle('is-pass', passed);
        status.classList.toggle('is-fallback', !passed);
        status.innerHTML = passed
            ? '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> ライト／ダークの必須文字・UIコントラストを確認済みです。'
            : '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> 安全な標準トーンで表示します。';
    }
}

export function initSettings() {

    const settingsVersionText = document.getElementById('settings-version-text');
    if (settingsVersionText) {
        import('./version.js').then(ver => {
            settingsVersionText.textContent = `CoachMgr ${ver.APP_VERSION} (${ver.RELEASE_DATE})`;
        });
    }

    const btnShowReleaseNotes = document.getElementById('btn-show-release-notes');
    if (btnShowReleaseNotes) {
        btnShowReleaseNotes.onclick = () => {
            if (window.openReleaseNotesModal) window.openReleaseNotesModal();
        };
    }

    // P28: 設定ハブから目的別のカードへ移動し、長い画面でも迷子にならないようにする。
    document.querySelectorAll('[data-settings-target]').forEach(button => {
        button.onclick = () => document.getElementById(button.dataset.settingsTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // P32: 表示設定は端末にだけ保存し、チームの共有データや他の利用者の画面へ影響させない。
    const uiPreferences = loadUiPreferences();
    const colorMode = document.getElementById('ui-color-mode');
    const fontScale = document.getElementById('ui-font-scale');
    const preferredHand = document.getElementById('ui-preferred-hand');
    const reduceMotion = document.getElementById('ui-reduce-motion');
    const compactMode = document.getElementById('ui-compact-mode');
    if (colorMode) colorMode.value = uiPreferences.colorMode;
    if (fontScale) fontScale.value = uiPreferences.fontScale;
    if (preferredHand) preferredHand.value = uiPreferences.preferredHand;
    if (reduceMotion) reduceMotion.checked = Boolean(uiPreferences.reduceMotion);
    if (compactMode) compactMode.checked = Boolean(uiPreferences.compactMode);
    const saveUiPreferencesButton = document.getElementById('btn-save-ui-preferences');
    if (saveUiPreferencesButton) saveUiPreferencesButton.onclick = () => {
        const saved = saveUiPreferences({
            colorMode: colorMode?.value === 'dark' ? 'dark' : 'light',
            fontScale: fontScale?.value || 'normal',
            preferredHand: preferredHand?.value || 'right',
            reduceMotion: Boolean(reduceMotion?.checked),
            compactMode: Boolean(compactMode?.checked)
        });
        applyUiPreferences(saved);
        applyCurrentTeamTheme({ colorMode: saved.colorMode });
        window.dispatchEvent(new CustomEvent('coachmgr:color-mode-changed', { detail: { colorMode: saved.colorMode } }));
        showToast('この端末の表示・操作設定を保存しました');
    };

    // P28: P26の招待の現在状態と、静的PWA上での権限制約を分けて明示する。
    const trustStatus = document.getElementById('parent-access-trust-status');
    if (trustStatus) {
        const summary = getParentAccessSummary(state.teamInfo || {});
        trustStatus.innerHTML = `<i class="fa-solid fa-shield-halved" aria-hidden="true"></i><span><strong>招待状態：</strong>有効 ${summary.active.length}件${summary.expired.length ? ` ・期限切れ ${summary.expired.length}件` : ''}${summary.revoked.length ? ` ・失効 ${summary.revoked.length}件` : ''}<small>現在の公開版では、招待URLの利用範囲を端末・同期データ上で確認します。本人確認とサーバー側遮断は認証バックエンド導入後に有効化します。</small></span>`;
    }

    const diagnosticsContainer = document.getElementById('operations-diagnostics');
    const syncAuditHistory = document.getElementById('sync-audit-history');
    const renderSyncAuditHistory = () => {
        if (!syncAuditHistory) return;
        const entries = Array.isArray(state.syncAudit) ? state.syncAudit.slice(0, 6) : [];
        const pending = Array.isArray(state.syncOutbox?.items) ? state.syncOutbox.items.filter(item => item.status !== 'sending').length : 0;
        if (!entries.length && !pending) {
            syncAuditHistory.innerHTML = '<p class="sync-audit-empty">同期待機はありません。クラウド同期を行うと、送信・受領・失敗の履歴をここで確認できます。</p>';
            return;
        }
        const label = { queued: '待機へ追加', sending: '送信中', acknowledged: '受領済み', failed: '送信失敗', conflict: '競合' };
        syncAuditHistory.innerHTML = `<div class="sync-audit-heading"><strong>同期監査ログ</strong><span>${pending ? `送信待ち ${pending}件` : '送信待ちなし'}</span></div>${entries.map(entry => `<div class="sync-audit-item is-${escapeHtml(entry.type || 'unknown')}"><span><strong>${escapeHtml(label[entry.type] || entry.type || '記録')}</strong><small>${escapeHtml(entry.message || '')}</small></span><time>${escapeHtml(entry.at ? new Date(entry.at).toLocaleString('ja-JP') : '')}</time></div>`).join('')}`;
    };
    const refreshOperationalDiagnostics = () => {
        if (!diagnosticsContainer) return;
        const diagnostics = buildOperationalDiagnostics(state);
        const icons = { backup: 'fa-box-archive', sync: 'fa-cloud', cloudRecovery: 'fa-clock-rotate-left', recovery: 'fa-clock-rotate-left', outbox: 'fa-list-check', team: 'fa-people-group', storage: 'fa-hard-drive' };
        diagnosticsContainer.innerHTML = diagnostics.checks.map(check => {
            const action = check.action ? `<button type="button" class="btn btn-secondary btn-sm operations-check-action" data-operation-action="${escapeHtml(check.action.action)}">${escapeHtml(check.action.label)}</button>` : '';
            return `<div class="operations-check is-${check.status}${action ? ' has-action' : ''}">
                <span class="operations-check-icon"><i class="fa-solid ${icons[check.key] || 'fa-circle-info'}" aria-hidden="true"></i></span>
                <span><strong>${escapeHtml(check.label)}</strong><small title="${escapeHtml(check.detail)}">${escapeHtml(check.detail)}</small></span>
                ${action}
            </div>`;
        }).join('');
        diagnosticsContainer.querySelectorAll('.operations-check-action').forEach(button => {
            button.onclick = async () => {
                const action = button.dataset.operationAction;
                if (action === 'backup') return exportBackupData();
                if (action === 'sync') return syncPushGasCloud(false).finally(refreshOperationalDiagnostics);
                if (action === 'recoveries') return refreshCloudRecoveries();
                if (action === 'local-recovery') return exportRecoveryBackupData();
            };
        });
        renderSyncAuditHistory();
        const recoveryButton = document.getElementById('btn-export-recovery');
        if (recoveryButton) recoveryButton.disabled = !diagnostics.lastRecoveryAt;
    };
    window.refreshOperationalDiagnostics = refreshOperationalDiagnostics;
    refreshOperationalDiagnostics();

    const btnOperationsBackup = document.getElementById('btn-operations-backup');
    if (btnOperationsBackup) btnOperationsBackup.onclick = () => exportBackupData();
    const btnExportRecovery = document.getElementById('btn-export-recovery');
    if (btnExportRecovery) {
        btnExportRecovery.onclick = async () => {
            try {
                await exportRecoveryBackupData();
            } catch (_error) {
                alert('復旧用データを準備できませんでした。端末バックアップを作成してください。');
            }
        };
    }
    const btnRetrySyncOutbox = document.getElementById('btn-retry-sync-outbox');
    if (btnRetrySyncOutbox) btnRetrySyncOutbox.onclick = async () => {
        try {
            await syncPushGasCloud(false);
        } catch (_error) {
            // 同期関数が利用者向け通知と監査ログの更新を担う。
        } finally {
            refreshOperationalDiagnostics();
        }
    };
    const btnCopyOperationsCheck = document.getElementById('btn-copy-operations-check');
    if (btnCopyOperationsCheck) {
        btnCopyOperationsCheck.onclick = async () => {
            const text = buildOperationsShareText(state.teamInfo?.name, buildOperationalDiagnostics(state));
            try {
                await navigator.clipboard.writeText(text);
                showToast('運用チェックの状態をコピーしました');
            } catch (_error) {
                window.prompt('以下をコピーして共有してください。', text);
            }
        };
    }

    const cloudRecoveryHistory = document.getElementById('cloud-recovery-history');
    const renderCloudRecoveries = recoveries => {
        if (!cloudRecoveryHistory) return;
        if (!recoveries.length) {
            cloudRecoveryHistory.innerHTML = '<p class="cloud-recovery-empty">利用可能なクラウド復旧世代はありません。次回以降のクラウド送信後に表示されます。</p>';
            return;
        }
        cloudRecoveryHistory.innerHTML = recoveries.map(item => `
            <div class="cloud-recovery-item">
                <span><strong>世代 ${Number(item.revision)}</strong><small>${escapeHtml(item.updatedAt || '直前の確定版')} ・ ${escapeHtml(item.source === 'immediate' ? '直前の安全スロット' : '世代履歴')}</small></span>
                <button type="button" class="btn btn-secondary btn-sm btn-restore-cloud-generation" data-revision="${Number(item.revision)}"><i class="fa-solid fa-clock-rotate-left"></i> 復元</button>
            </div>`).join('');
        cloudRecoveryHistory.querySelectorAll('.btn-restore-cloud-generation').forEach(button => {
            button.onclick = async () => {
                const revision = Number(button.dataset.revision);
                const proceed = await showCustomConfirm(`クラウド世代 ${revision} を復元します。現在のクラウド状態と端末状態は復旧ポイントとして保護されます。`, 'クラウド世代の復元', { okText: 'この世代を復元する', type: 'danger' });
                if (!proceed) return;
                try {
                    button.disabled = true;
                    await restoreCloudRecovery(revision);
                    refreshOperationalDiagnostics();
                    await refreshCloudRecoveries();
                } catch (error) {
                    alert(`クラウド世代を復元できませんでした。\n${error?.message || error}`);
                } finally {
                    button.disabled = false;
                }
            };
        });
    };
    const refreshCloudRecoveries = async () => {
        if (!cloudRecoveryHistory) return [];
        if (!state.teamInfo?.gasApiUrl) {
            cloudRecoveryHistory.innerHTML = '<p class="cloud-recovery-empty">クラウド同期を設定すると、クラウド上の復旧世代を確認できます。</p>';
            return [];
        }
        if (state.teamInfo.gasSyncProtocol !== 'secure-v2') {
            cloudRecoveryHistory.innerHTML = '<p class="cloud-recovery-empty">クラウド世代の復元は安全モード（POST認証）で利用できます。</p>';
            return [];
        }
        cloudRecoveryHistory.innerHTML = '<p class="cloud-recovery-empty"><i class="fa-solid fa-rotate fa-spin"></i> クラウド復旧世代を確認中...</p>';
        try {
            const recoveries = await listCloudRecoveries({ teamInfo: state.teamInfo });
            renderCloudRecoveries(recoveries);
            return recoveries;
        } catch (error) {
            cloudRecoveryHistory.innerHTML = `<p class="cloud-recovery-empty is-error">クラウド復旧世代を確認できませんでした。${escapeHtml(error?.message || '')}</p>`;
            return [];
        }
    };
    window.refreshCloudRecoveries = refreshCloudRecoveries;
    const btnRefreshCloudRecoveries = document.getElementById('btn-refresh-cloud-recoveries');
    if (btnRefreshCloudRecoveries) btnRefreshCloudRecoveries.onclick = () => refreshCloudRecoveries();
    void refreshCloudRecoveries();

    const teamNameInput = document.getElementById('team-info-name');
    const teamColorInput = document.getElementById('team-info-color');
    const teamPasscodeInput = document.getElementById('team-info-passcode');

    if (teamNameInput && teamColorInput) {
        const currentTheme = normalizeTeamTheme(state.teamInfo);
        teamNameInput.value = state.teamInfo.name;
        teamColorInput.value = currentTheme.seed;
        renderThemePreview(currentTheme.seed);
        teamColorInput.oninput = () => renderThemePreview(teamColorInput.value);
        if (teamPasscodeInput) teamPasscodeInput.value = state.teamInfo.passcode || '7064';

        const formTeamInfo = document.getElementById('form-team-info');
        if (formTeamInfo) {
            formTeamInfo.onsubmit = (e) => {
                e.preventDefault();
                state.teamInfo.name = document.getElementById('team-info-name').value;
                state.teamInfo.theme = normalizeTeamTheme({ color: document.getElementById('team-info-color').value });
                state.teamInfo.color = state.teamInfo.theme.seed;
                const activeTeam = getActiveTeam(state);
                activeTeam.name = state.teamInfo.name;
                activeTeam.color = state.teamInfo.color;
                activeTeam.theme = { ...state.teamInfo.theme };
                const newPasscode = document.getElementById('team-info-passcode') ? document.getElementById('team-info-passcode').value.trim() : '';
                if (newPasscode) {
                    state.teamInfo.passcode = newPasscode;
                }
                saveData();
                applyCurrentTeamTheme();
                renderThemePreview(state.teamInfo.theme.seed);
                showToast('チームテーマを保存しました');
                const sidebarTitle = document.querySelector('.sidebar-header h2');
                if (sidebarTitle) {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-futbol';
                    sidebarTitle.replaceChildren(icon, document.createTextNode(` ${state.teamInfo.name}`));
                }
            };
        }
    }

    const workspaceTeamSelect = document.getElementById('workspace-team-select');
    const workspaceSeasonSelect = document.getElementById('workspace-season-select');
    const workspaceContextStatus = document.getElementById('workspace-context-status');
    const renderWorkspaceManagement = () => {
        if (!workspaceTeamSelect || !workspaceSeasonSelect || !workspaceContextStatus) return;
        ensureWorkspaceState(state);
        const activeTeam = getActiveTeam(state);
        const activeSeason = getActiveSeason(state);
        const requestedTeamId = workspaceTeamSelect.value || activeTeam.id;
        workspaceTeamSelect.innerHTML = state.teams.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === requestedTeamId ? 'selected' : ''}>${escapeHtml(team.name)}${team.archivedAt ? '（アーカイブ）' : ''}</option>`).join('');
        const selectedTeamId = workspaceTeamSelect.value || activeTeam.id;
        const selectedTeam = state.teams.find(team => team.id === selectedTeamId) || activeTeam;
        const requestedSeasonId = workspaceSeasonSelect.value || (selectedTeam.id === activeTeam.id ? activeSeason.id : selectedTeam.seasons[0]?.id);
        workspaceSeasonSelect.innerHTML = selectedTeam.seasons.map(season => `<option value="${escapeHtml(season.id)}" ${season.id === requestedSeasonId ? 'selected' : ''}>${escapeHtml(season.name)}${season.archivedAt ? '（アーカイブ）' : ''}</option>`).join('');
        const selectedSeason = selectedTeam.seasons.find(season => season.id === workspaceSeasonSelect.value) || selectedTeam.seasons[0] || activeSeason;
        const isCurrent = selectedTeam.id === activeTeam.id && selectedSeason.id === activeSeason.id;
        workspaceContextStatus.textContent = isCurrent
            ? `現在表示中：${activeTeam.name} / ${activeSeason.name}${activeSeason.archivedAt ? '（アーカイブ済み）' : ''}`
            : `切替予定：${selectedTeam.name} / ${selectedSeason.name}${selectedSeason.archivedAt ? '（アーカイブ済み）' : ''}`;
    };
    const updateWorkspaceSidebar = () => {
        const team = getActiveTeam(state);
        const season = getActiveSeason(state);
        const sidebarTitle = document.querySelector('.sidebar-header h2');
        if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${escapeHtml(team.name)}`;
        const topbarTitle = document.getElementById('topbar-title');
        if (topbarTitle) topbarTitle.dataset.workspace = season.name;
    };
    if (workspaceTeamSelect) {
        renderWorkspaceManagement();
        workspaceTeamSelect.onchange = () => renderWorkspaceManagement();
        workspaceSeasonSelect.onchange = () => renderWorkspaceManagement();
    }
    const btnWorkspaceSwitch = document.getElementById('btn-workspace-switch');
    if (btnWorkspaceSwitch) btnWorkspaceSwitch.onclick = async () => {
        try {
            switchWorkspace(state, workspaceTeamSelect.value, workspaceSeasonSelect.value);
            await saveData();
            updateWorkspaceSidebar();
            applyCurrentTeamTheme();
            showToast(`${getActiveTeam(state).name} / ${getActiveSeason(state).name} に切り替えました`);
            if (typeof window.navigate === 'function') window.navigate('dashboard');
        } catch (error) { showToast(error?.message || 'チーム・シーズンを切り替えられませんでした'); }
    };
    const btnWorkspaceNewSeason = document.getElementById('btn-workspace-new-season');
    if (btnWorkspaceNewSeason) btnWorkspaceNewSeason.onclick = async () => {
        const proposed = `${new Date().getFullYear() + (new Date().getMonth() >= 2 ? 1 : 0)}年度`;
        const name = window.prompt('新しいシーズン名を入力してください。選手・設定を引き継ぎ、試合・練習は空で開始します。', proposed);
        if (name === null) return;
        try {
            createSeason(state, { name, copyPlayers: true, copyTeamSetup: true });
            await saveData();
            updateWorkspaceSidebar();
            applyCurrentTeamTheme();
            renderWorkspaceManagement();
            showToast('新しいシーズンを作成して切り替えました');
            if (typeof window.navigate === 'function') window.navigate('dashboard');
        } catch (error) { showToast(error?.message || '新年度を作成できませんでした'); }
    };
    const btnWorkspaceNewTeam = document.getElementById('btn-workspace-new-team');
    if (btnWorkspaceNewTeam) btnWorkspaceNewTeam.onclick = async () => {
        const name = window.prompt('新しいチーム名を入力してください。新しいチームは空の記録から始まります。', '新しいチーム');
        if (name === null) return;
        try {
            createTeam(state, { name, color: state.teamInfo?.theme?.seed || state.teamInfo?.color || '#ef3340' });
            await saveData();
            updateWorkspaceSidebar();
            applyCurrentTeamTheme();
            renderWorkspaceManagement();
            showToast('新しいチームを作成して切り替えました');
            if (typeof window.navigate === 'function') window.navigate('dashboard');
        } catch (error) { showToast(error?.message || 'チームを作成できませんでした'); }
    };
    const btnWorkspaceArchive = document.getElementById('btn-workspace-archive');
    if (btnWorkspaceArchive) btnWorkspaceArchive.onclick = async () => {
        const team = getActiveTeam(state);
        const season = getActiveSeason(state);
        const proceed = await showCustomConfirm(`${team.name}の${season.name}をアーカイブします。記録は削除されず、後から切り替えて確認できます。`, 'シーズンをアーカイブ', { okText: 'アーカイブする', type: 'danger' });
        if (!proceed) return;
        try {
            archiveSeason(state, team.id, season.id);
            const alternative = team.seasons.filter(item => !item.archivedAt)[0];
            if (alternative) switchWorkspace(state, team.id, alternative.id);
            await saveData();
            updateWorkspaceSidebar();
            applyCurrentTeamTheme();
            renderWorkspaceManagement();
            showToast('シーズンのアーカイブ状態を更新しました');
        } catch (error) { showToast(error?.message || 'アーカイブ状態を更新できませんでした'); }
    };

    const seasonReportContext = document.getElementById('season-report-context');
    const seasonReportSummary = document.getElementById('season-report-summary');
    const renderSeasonReport = () => {
        if (!seasonReportContext || !seasonReportSummary) return null;
        const team = getActiveTeam(state);
        const season = getActiveSeason(state);
        const report = buildSeasonReport(state, { teamName: team.name, seasonName: season.name });
        seasonReportContext.textContent = `対象：${team.name} / ${season.name}${season.archivedAt ? '（アーカイブ済み）' : ''}`;
        const summary = report.summary;
        seasonReportSummary.innerHTML = [
            ['試合', `${summary.matches}件`, `${summary.wins}勝 ${summary.draws}分 ${summary.losses}敗`],
            ['得失点', `${summary.goalsFor}-${summary.goalsAgainst}`, `勝率 ${summary.winRate}%`],
            ['練習', `${summary.practices}回`, `選手 ${summary.players}名`],
            ['平均出席率', `${summary.attendanceAverage}%`, '選手別集計はCSV・印刷で確認']
        ].map(([label, value, detail]) => `<div class="season-report-metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></div>`).join('');
        return report;
    };
    const downloadSeasonCsv = report => {
        const fileName = `CoachMgr_${String(report.teamName).replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ヶー_-]/g, '_')}_${String(report.seasonName).replace(/[^a-zA-Z0-9一-龠ぁ-んァ-ヶー_-]/g, '_')}_report.csv`;
        const blob = new Blob([buildSeasonReportCsv(report)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName; link.style.display = 'none';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showToast('シーズンレポートCSVを出力しました');
    };
    const btnRefreshSeasonReport = document.getElementById('btn-refresh-season-report');
    if (btnRefreshSeasonReport) btnRefreshSeasonReport.onclick = () => { renderSeasonReport(); showToast('シーズン集計を更新しました'); };
    const btnExportSeasonReportCsv = document.getElementById('btn-export-season-report-csv');
    if (btnExportSeasonReportCsv) btnExportSeasonReportCsv.onclick = () => { const report = renderSeasonReport(); if (report) downloadSeasonCsv(report); };
    const btnPrintSeasonReport = document.getElementById('btn-print-season-report');
    if (btnPrintSeasonReport) btnPrintSeasonReport.onclick = () => {
        const report = renderSeasonReport();
        if (!report) return;
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow) { showToast('印刷用ウィンドウを開けませんでした。ブラウザのポップアップ設定を確認してください'); return; }
        printWindow.document.open();
        printWindow.document.write(buildSeasonReportPrintHtml(report));
        printWindow.document.close();
    };
    renderSeasonReport();

    const gasApiInput = document.getElementById('gas-api-url');
    const gasSheetInput = document.getElementById('gas-sheet-name');
    const gasAuthInput = document.getElementById('gas-auth-token');
    const gasProtocolInput = document.getElementById('gas-sync-protocol');
    const gasSecurityGuidance = document.getElementById('gas-security-guidance');
    const getProtocolValue = () => gasProtocolInput?.value === 'secure-v2' ? 'secure-v2' : 'legacy-v1';
    const renderProtocolGuidance = () => {
        if (!gasSecurityGuidance) return;
        gasSecurityGuidance.textContent = getProtocolValue() === 'secure-v2'
            ? '安全モードでは受信もPOSTで行い、認証トークンをURLに含めません。P10のGASテンプレートをデプロイして利用してください。'
            : '互換モードでは旧GASのGET受信を使います。認証トークンがURLに含まれるため、安全モードへの移行を推奨します。';
    };
    if (gasApiInput) gasApiInput.value = state.teamInfo.gasApiUrl || '';
    if (gasSheetInput) gasSheetInput.value = state.teamInfo.gasSheetName || '';
    if (gasAuthInput) gasAuthInput.value = state.teamInfo.gasAuthToken || '';
    if (gasProtocolInput) {
        gasProtocolInput.value = state.teamInfo.gasSyncProtocol || 'legacy-v1';
        gasProtocolInput.onchange = renderProtocolGuidance;
    }
    renderProtocolGuidance();

    const applyGasSettingsFromForm = () => {
        const urlVal = gasApiInput ? gasApiInput.value.trim() : '';
        const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : '';
        const authVal = gasAuthInput ? gasAuthInput.value.trim() : '';
        state.teamInfo.gasApiUrl = urlVal;
        state.teamInfo.gasSheetName = sheetVal;
        state.teamInfo.gasAuthToken = authVal;
        state.teamInfo.gasSyncProtocol = getProtocolValue();
    };

    const persistGasSettings = async () => {
        applyGasSettingsFromForm();
        // GAS接続先の変更は端末ローカル設定です。保存完了後に手動同期を開始し、
        // 直前の接続先を使う自動送信や未同期データ競合を発生させません。
        await saveData({ sync: false, markChange: false });
        updateRoleUI();
    };

    const formGasSync = document.getElementById('form-gas-sync');
    if (formGasSync) {
        formGasSync.onsubmit = async (e) => {
            e.preventDefault();
            await persistGasSettings();
            showToast('クラウド同期設定を保存しました');
        };
    }

    const btnPush = document.getElementById('btn-manual-sync-push');
    if (btnPush) {
        btnPush.onclick = async () => {
            try {
                await persistGasSettings();
                await syncPushGasCloud(false);
            } catch (_error) {
                // 同期関数が利用者向けのエラー表示と診断保存を担う。
            }
        };
    }

    const btnPull = document.getElementById('btn-manual-sync-pull');
    if (btnPull) {
        btnPull.onclick = async () => {
            try {
                await persistGasSettings();
                const proceed = await showCustomConfirm('クラウドからデータを復元しますか？ローカルのデータは上書きされます。', 'クラウドからの復元', { okText: '復元する' });
                if (proceed) {
                    await syncPullGasCloud(false);
                }
            } catch (_error) {
                // 同期関数が利用者向けのエラー表示と診断保存を担う。
            }
        };
    }

    const parentSharePlayer = document.getElementById('parent-share-player');
    const parentShareExpires = document.getElementById('parent-share-expires');
    const parentShareStatus = document.getElementById('parent-share-status');
    const renderParentShare = () => {
        if (!parentSharePlayer || !parentShareStatus) return null;
        if (!state.teamInfo) state.teamInfo = {};
        const share = ensureParentShareSettings(state.teamInfo);
        const sortedPlayers = [...(state.players || [])].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
        const selected = String(share.defaultPlayerId || parentSharePlayer.value || '');
        parentSharePlayer.innerHTML = `<option value="">選手を選択してください</option>${sortedPlayers.map(player => `<option value="${player.id}" ${String(player.id) === selected ? 'selected' : ''}>${player.number ? `${player.number}. ` : ''}${escapeHtml(player.name)}</option>`).join('')}`;
        if (parentShareExpires) parentShareExpires.value = share.expiresAt || '';
        parentShareStatus.textContent = `共有リンク v${share.version}${share.expiresAt ? ` ・ 有効期限 ${share.expiresAt}` : ' ・ 有効期限なし'}。再発行すると、以前のリンクはこの端末で無効として扱われます。`;
        return share;
    };
    const copyText = async (text, successText) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(successText);
        } catch (_error) {
            window.prompt('以下をコピーしてください。', text);
        }
    };
    const buildParentShareUrl = () => {
        const share = renderParentShare();
        const playerId = parentSharePlayer?.value || '';
        if (!share || !playerId) throw new Error('共有する選手を選択してください');
        share.defaultPlayerId = playerId;
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        const apiUrl = gasApiInput?.value.trim() || state.teamInfo.gasApiUrl || '';
        const sheetName = gasSheetInput?.value.trim() || state.teamInfo.gasSheetName || '';
        if (apiUrl) params.set('apiUrl', apiUrl);
        if (sheetName) params.set('sheetName', sheetName);
        if (getProtocolValue() === 'secure-v2') params.set('syncProtocol', 'secure-v2');
        params.set('parentPlayerId', playerId);
        params.set('parentShareVersion', String(share.version));
        params.set('parentShareToken', share.token);
        if (share.expiresAt) params.set('parentShareExpires', share.expiresAt);
        return `${baseUrl}?${params.toString()}`;
    };
    const btnCopyParentShareLink = document.getElementById('btn-copy-parent-share-link');
    const btnRotateParentShareLink = document.getElementById('btn-rotate-parent-share-link');
    const btnCopyRsvpReminder = document.getElementById('btn-copy-rsvp-reminder');
    if (parentSharePlayer) {
        renderParentShare();
        parentSharePlayer.onchange = () => { const share = ensureParentShareSettings(state.teamInfo); share.defaultPlayerId = parentSharePlayer.value; renderParentShare(); };
        if (parentShareExpires) parentShareExpires.onchange = () => { const share = ensureParentShareSettings(state.teamInfo); share.expiresAt = parentShareExpires.value; renderParentShare(); };
    }
    if (btnCopyParentShareLink) btnCopyParentShareLink.onclick = async () => {
        try {
            const url = buildParentShareUrl();
            await saveData();
            await copyText(url, '選手別の保護者共有リンクをコピーしました');
        } catch (error) { showToast(error.message || '共有リンクを作成できませんでした'); }
    };
    if (btnRotateParentShareLink) btnRotateParentShareLink.onclick = async () => {
        const proceed = await showCustomConfirm('新しい共有リンクを発行すると、以前のリンクは同じ端末上で無効として扱われます。新しいリンクを共有し直してください。', '保護者共有リンクを再発行', { okText: '再発行する', type: 'danger' });
        if (!proceed) return;
        const share = rotateParentShareLink(state.teamInfo || (state.teamInfo = {}), { expiresAt: parentShareExpires?.value || '' });
        if (parentSharePlayer?.value) share.defaultPlayerId = parentSharePlayer.value;
        await saveData();
        renderParentShare();
        showToast('新しい共有リンクを発行しました。必要に応じてコピーして共有してください');
    };
    if (btnCopyRsvpReminder) btnCopyRsvpReminder.onclick = async () => {
        const events = [...(state.matches || []), ...(state.practices || [])];
        const digest = buildPendingRsvpDigest(events, state.players || []);
        await copyText(digest.text, digest.pendingEvents.length ? '未回答者向けリマインド文をコピーしました' : '未回答がないことを確認しました');
    };

    const parentAccessLabel = document.getElementById('parent-access-label');
    const parentAccessInvites = document.getElementById('parent-access-invites');
    const buildParentAccessUrl = invite => {
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        const apiUrl = gasApiInput?.value.trim() || state.teamInfo?.gasApiUrl || '';
        const sheetName = gasSheetInput?.value.trim() || state.teamInfo?.gasSheetName || '';
        if (apiUrl) params.set('apiUrl', apiUrl);
        if (sheetName) params.set('sheetName', sheetName);
        if (getProtocolValue() === 'secure-v2') params.set('syncProtocol', 'secure-v2');
        params.set('parentPlayerId', invite.playerId);
        params.set('parentInviteId', invite.id);
        params.set('parentInviteToken', invite.token);
        return `${baseUrl}?${params.toString()}`;
    };
    const renderParentAccess = () => {
        if (!parentAccessInvites) return;
        const summary = getParentAccessSummary(state.teamInfo || (state.teamInfo = {}));
        const playerName = id => {
            const player = (state.players || []).find(item => String(item.id) === String(id));
            return player ? `${player.number ? `${player.number}. ` : ''}${player.name}` : '削除済みの選手';
        };
        const entries = [...summary.active.map(item => ({ ...item, displayStatus: 'active' })), ...summary.expired.map(item => ({ ...item, displayStatus: 'expired' })), ...summary.revoked.map(item => ({ ...item, displayStatus: 'revoked' }))];
        if (!entries.length) {
            parentAccessInvites.innerHTML = '<div class="parent-access-empty"><i class="fa-solid fa-user-shield"></i><span>個別招待はまだありません。</span></div>';
            return;
        }
        parentAccessInvites.innerHTML = entries.map(invite => {
            const scopeLabels = (invite.scopes || []).map(scope => PARENT_ACCESS_SCOPES.find(item => item.id === scope)?.label || scope).join('・');
            const statusLabel = invite.displayStatus === 'active' ? '有効' : invite.displayStatus === 'expired' ? '期限切れ' : '失効済み';
            return `<article class="parent-access-invite is-${escapeHtml(invite.displayStatus)}"><div><strong>${escapeHtml(invite.label || playerName(invite.playerId))}</strong><span>${escapeHtml(playerName(invite.playerId))} ・ ${escapeHtml(scopeLabels)}</span><small>${invite.expiresAt ? `期限 ${escapeHtml(invite.expiresAt)}` : '期限なし'}${invite.lastUsedAt ? ` ・ 最終利用 ${escapeHtml(new Date(invite.lastUsedAt).toLocaleDateString('ja-JP'))}` : ''}</small></div><div class="parent-access-invite-actions">${invite.displayStatus === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" data-parent-access-copy="${escapeHtml(invite.id)}"><i class="fa-solid fa-copy"></i> コピー</button><button type="button" class="btn btn-danger btn-sm" data-parent-access-revoke="${escapeHtml(invite.id)}"><i class="fa-solid fa-ban"></i> 失効</button>` : ''}<span class="parent-access-status">${statusLabel}</span></div></article>`;
        }).join('');
        parentAccessInvites.querySelectorAll('[data-parent-access-copy]').forEach(button => {
            button.onclick = () => {
                const invite = entries.find(item => item.id === button.dataset.parentAccessCopy);
                if (invite) void copyText(buildParentAccessUrl(invite), '個別保護者招待リンクをコピーしました');
            };
        });
        parentAccessInvites.querySelectorAll('[data-parent-access-revoke]').forEach(button => {
            button.onclick = async () => {
                const proceed = await showCustomConfirm('この招待リンクを失効します。新しいリンクを共有するまで、保護者画面は利用できません。', '保護者招待を失効', { okText: '失効する', type: 'danger' });
                if (!proceed) return;
                revokeParentAccessInvite(state.teamInfo, button.dataset.parentAccessRevoke);
                await saveData();
                renderParentAccess();
                showToast('保護者招待を失効しました');
            };
        });
    };
    const btnCreateParentAccess = document.getElementById('btn-create-parent-access');
    if (btnCreateParentAccess) btnCreateParentAccess.onclick = async () => {
        try {
            const playerId = parentSharePlayer?.value || '';
            const scopes = [...document.querySelectorAll('.parent-access-scopes input:checked')].map(input => input.value);
            const invite = createParentAccessInvite(state.teamInfo || (state.teamInfo = {}), { playerId, label: parentAccessLabel?.value || '', scopes, expiresAt: parentShareExpires?.value || '' });
            await saveData();
            renderParentAccess();
            await copyText(buildParentAccessUrl(invite), '個別保護者招待リンクをコピーしました');
        } catch (error) { showToast(error?.message || '保護者招待を作成できませんでした'); }
    };
    renderParentAccess();

    const btnCopyInviteLink = document.getElementById('btn-copy-invite-link');
    if (btnCopyInviteLink) {
        btnCopyInviteLink.onclick = () => {
            const urlVal = gasApiInput ? gasApiInput.value.trim() : (state.teamInfo.gasApiUrl || '');
            const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : (state.teamInfo.gasSheetName || '');
            const protocolVal = getProtocolValue();

            if (!urlVal) {
                alert('Web API URL が設定されていません。入力して保存した後に実行してください。');
                return;
            }

            const baseUrl = window.location.origin + window.location.pathname;
            const params = new URLSearchParams();
            params.set('apiUrl', urlVal);
            if (sheetVal) params.set('sheetName', sheetVal);
            if (protocolVal === 'secure-v2') params.set('syncProtocol', protocolVal);

            const inviteUrl = `${baseUrl}?${params.toString()}`;

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inviteUrl).then(() => {
                        showToast('保護者用リンクをコピーしました。認証情報は含まれていません。');
                    });
                } else {
                    prompt('以下の招待用URLをコピーして保護者に共有してください:', inviteUrl);
                }
            } catch (e) {
                prompt('以下の招待用URLをコピーして保護者に共有してください:', inviteUrl);
            }
        };
    }

    function renderList(listId, stateArray, itemLabelFunc = (x) => x) {
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = stateArray.map((item, index) => {
            const isCustomForm = listId === 'custom-formation-list';
            const editBtnClass = isCustomForm ? 'btn-edit-custom-formation' : 'btn-edit-master-item';
            const editBtn = `<button type="button" class="u-ext-171 btn btn-secondary ${editBtnClass}" data-list="${listId}" data-index="${index}" ><i class="fa-solid fa-pen"></i> 編集</button>`;
            return `
                <li class="u-ext-172" >
                    <span>${itemLabelFunc(item)}</span>
                    <div>
                        ${editBtn}
                        <button type="button" class="u-ext-173 btn btn-danger btn-delete-item" data-list="${listId}" data-index="${index}" ><i class="fa-solid fa-trash"></i></button>
                    </div>
                </li>
            `;
        }).join('');
    }

    renderList('match-type-list', state.matchTypes);
    renderList('menu-category-list', state.menuCategories);
    renderList('tactics-category-list', state.tacticsCategories);
    renderList('analysis-tag-list', state.analysisTags);
    renderList('skill-metric-list', state.skillMetrics);
    renderList('position-list', state.positions);
    renderList('position-cat2-list', state.positionsCat2);
    renderList('custom-formation-list', state.customFormations, (item) => `${item.name} (${item.coords.length}人制)`);

    document.querySelectorAll('.btn-edit-master-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const listId = e.currentTarget.dataset.list;
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            let currentVal = '';
            let targetArray = null;

            if (listId === 'match-type-list') targetArray = state.matchTypes;
            else if (listId === 'menu-category-list') targetArray = state.menuCategories;
            else if (listId === 'tactics-category-list') targetArray = state.tacticsCategories;
            else if (listId === 'analysis-tag-list') targetArray = state.analysisTags;
            else if (listId === 'skill-metric-list') targetArray = state.skillMetrics;
            else if (listId === 'position-list') targetArray = state.positions;
            else if (listId === 'position-cat2-list') targetArray = state.positionsCat2;

            if (!targetArray) return;
            currentVal = targetArray[idx];

            const newVal = prompt('名称を編集してください:', currentVal);
            if (newVal !== null && newVal.trim() !== '' && newVal.trim() !== currentVal) {
                const trimmed = newVal.trim();
                const oldVal = targetArray[idx];
                targetArray[idx] = trimmed;

                if (listId === 'match-type-list') {
                    state.matches.forEach(m => { if (m.type === oldVal) m.type = trimmed; });
                } else if (listId === 'menu-category-list') {
                    state.practices.forEach(p => {
                        if (p.menus) p.menus.forEach(m => { if (m.category === oldVal) m.category = trimmed; });
                    });
                    state.menuLibrary.forEach(m => { if (m.category === oldVal) m.category = trimmed; });
                } else if (listId === 'tactics-category-list') {
                    state.tactics.forEach(t => { if (t.category === oldVal) t.category = trimmed; });
                } else if (listId === 'position-list' || listId === 'position-cat2-list') {
                    state.players.forEach(p => {
                        if (Array.isArray(p.position)) {
                            p.position = p.position.map(pos => pos === oldVal ? trimmed : pos);
                        } else if (p.position === oldVal) {
                            p.position = trimmed;
                        }
                    });
                } else if (listId === 'analysis-tag-list') {
                    state.matches.forEach(m => {
                        if (m.formations) m.formations.forEach(f => {
                            if (f.analysisMemos) f.analysisMemos.forEach(memo => {
                                if (memo.tag === oldVal) memo.tag = trimmed;
                            });
                        });
                    });
                }

                saveData();
                initSettings();
            }
        });
    });

    document.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const listId = e.currentTarget.dataset.list;
            const idx = parseInt(e.currentTarget.dataset.index, 10);

            let label = "";
            let inUse = false;

            if (listId === 'match-type-list') {
                label = state.matchTypes[idx];
                inUse = state.matches.some(m => m.type === label);
            } else if (listId === 'menu-category-list') {
                label = state.menuCategories[idx];
                inUse = state.practices.some(p => p.menus.some(m => m.category === label)) ||
                    state.menuLibrary.some(m => m.category === label);
            } else if (listId === 'tactics-category-list') {
                label = state.tacticsCategories[idx];
                inUse = state.tactics.some(t => t.category === label);
            } else if (listId === 'skill-metric-list') {
                label = state.skillMetrics[idx];
                inUse = state.players.some(p => p.history && p.history.some(h => h.skills && h.skills.length > idx));
            } else if (listId === 'position-list') {
                label = state.positions[idx];
                inUse = state.players.some(p => {
                    const posList = Array.isArray(p.position) ? p.position : [p.position];
                    return posList.includes(label);
                });
            } else if (listId === 'position-cat2-list') {
                label = state.positionsCat2[idx];
                inUse = state.players.some(p => {
                    const posList = Array.isArray(p.position) ? p.position : [p.position];
                    return posList.includes(label);
                });
            } else if (listId === 'analysis-tag-list') {
                label = state.analysisTags[idx];
                inUse = state.matches.some(m => m.formations && m.formations.some(f => f.analysisMemos && f.analysisMemos.some(memo => memo.tag === label)));
            } else if (listId === 'custom-formation-list') {
                label = state.customFormations[idx].name;
                inUse = state.matches.some(m => m.formations && m.formations.some(f => f.system === label));
            }

            if (inUse) {
                const proceed = await showCustomConfirm(`「${label}」は現在使用中、または関連するデータが存在します。本当に削除しますか？\n(削除すると過去のデータの一部が表示されなくなる可能性があります)`, '項目の削除', { okText: '削除する', type: 'danger' });
                if (!proceed) {
                    return;
                }
            } else {
                const proceed = await showCustomConfirm(`「${label}」を削除しますか？`, '項目の削除', { okText: '削除する', type: 'danger' });
                if (!proceed) {
                    return;
                }
            }

            if (listId === 'match-type-list') state.matchTypes.splice(idx, 1);
            if (listId === 'menu-category-list') state.menuCategories.splice(idx, 1);
            if (listId === 'tactics-category-list') state.tacticsCategories.splice(idx, 1);
            if (listId === 'skill-metric-list') state.skillMetrics.splice(idx, 1);
            if (listId === 'position-list') state.positions.splice(idx, 1);
            if (listId === 'position-cat2-list') state.positionsCat2.splice(idx, 1);
            if (listId === 'analysis-tag-list') state.analysisTags.splice(idx, 1);
            if (listId === 'custom-formation-list') state.customFormations.splice(idx, 1);

            saveData();
            initSettings();
        });
    });

    const openCustomFormationModal = (editIndex = null) => {
        const form = document.getElementById('form-custom-formation');
        if (form) form.reset();

        const titleEl = document.querySelector('#modal-custom-formation h2');
        if (titleEl) {
            titleEl.innerHTML = editIndex !== null
                ? `<i class="fa-solid fa-street-view"></i> カスタムフォーメーション編集`
                : `<i class="fa-solid fa-street-view"></i> カスタムフォーメーション作成`;
        }

        const pitchCanvas = document.getElementById('custom-formation-pitch-canvas');
        if (pitchCanvas) pitchCanvas.querySelectorAll('.pitch-node').forEach(n => n.remove());

        const editorList = document.getElementById('custom-formation-nodes-editor-list');
        if (editorList) editorList.innerHTML = `<p class="u-ext-174 text-secondary" >ピッチをクリックしてポジションを追加してください。</p>`;

        const selectCount = document.getElementById('custom-formation-player-count');
        const maxCountLabel = document.getElementById('custom-formation-max-count');

        let placedNodes = [];

        const drawAndBindNode = (node) => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'pitch-node';
            nodeEl.id = `custom-pitch-node-${node.index}`;
            nodeEl.style.top = node.top;
            nodeEl.style.left = node.left;
            nodeEl.style.cursor = 'grab';
            nodeEl.innerHTML = `
                <span class="pitch-node-role" id="custom-pitch-node-label-span-${node.index}">${node.label}</span>
                <span class="u-ext-175 pitch-node-number" id="custom-pitch-node-role-span-${node.index}" >${node.role}</span>
            `;
            if (pitchCanvas) pitchCanvas.appendChild(nodeEl);

            if (placedNodes.length === 1 && editorList) {
                editorList.innerHTML = '';
            }

            const cat1Roles = (state.positions && state.positions.length > 0) ? state.positions : ['GK', 'DF', 'MF', 'FW'];
            const cat2Roles = (state.positionsCat2 && state.positionsCat2.length > 0) ? state.positionsCat2 : ['CB', 'SB', 'CH', 'SH', 'ST', 'WG'];

            const cat1Options = cat1Roles.map(r => `<option value="${r}" ${node.role === r ? 'selected' : ''}>${r}</option>`).join('');
            const cat2Options = `<option value="">(選択なし)</option>` + cat2Roles.map(r => `<option value="${r}" ${node.label === r ? 'selected' : ''}>${r}</option>`).join('');

            const row = document.createElement('div');
            row.className = 'custom-formation-node-row';
            row.id = `custom-node-editor-row-${node.index}`;
            row.style = 'display:flex; gap:0.4rem; align-items:center; margin-bottom:0.4rem;';
            row.innerHTML = `
                <strong class="u-ext-176" >#${node.index + 1}</strong>
                <select class="u-ext-177 form-control custom-node-role-select" title="カテゴリ1" >
                    ${cat1Options}
                </select>
                <select class="u-ext-177 form-control custom-node-cat2-select" title="カテゴリ2" >
                    ${cat2Options}
                </select>
            `;

            const roleSelect = row.querySelector('.custom-node-role-select');
            const cat2Select = row.querySelector('.custom-node-cat2-select');

            const updateNodeLabels = () => {
                const c1 = roleSelect.value;
                const c2 = cat2Select.value;
                node.role = c1;
                node.label = c2 ? c2 : c1;

                const spanLabel = document.getElementById(`custom-pitch-node-label-span-${node.index}`);
                const spanRole = document.getElementById(`custom-pitch-node-role-span-${node.index}`);
                if (spanLabel) spanLabel.textContent = node.label;
                if (spanRole) spanRole.textContent = node.role;
            };

            if (roleSelect) roleSelect.onchange = updateNodeLabels;
            if (cat2Select) cat2Select.onchange = updateNodeLabels;

            if (editorList) editorList.appendChild(row);

            let isDragging = false;

            const handleStart = (e) => {
                isDragging = true;
                nodeEl.style.cursor = 'grabbing';
                e.stopPropagation();
                e.preventDefault();
            };

            const handleMove = (e) => {
                if (!isDragging || !pitchCanvas) return;
                const rect = pitchCanvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const x = clientX - rect.left;
                const y = clientY - rect.top;

                const snapToGrid = (val, step = 5) => Math.max(0, Math.min(100, Math.round(val / step) * step));

                let leftPercent = snapToGrid((x / rect.width) * 100, 5);
                let topPercent = snapToGrid((y / rect.height) * 100, 5);

                nodeEl.style.left = `${leftPercent}%`;
                nodeEl.style.top = `${topPercent}%`;
                node.left = `${leftPercent}%`;
                node.top = `${topPercent}%`;
            };

            const handleEnd = () => {
                if (isDragging) {
                    isDragging = false;
                    nodeEl.style.cursor = 'grab';
                }
            };

            nodeEl.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);

            nodeEl.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
        };

        if (editIndex !== null) {
            const formObj = state.customFormations[editIndex];
            const nameInp = document.getElementById('custom-formation-name');
            if (nameInp) nameInp.value = formObj.name;
            if (selectCount) selectCount.value = formObj.coords.length;
            if (maxCountLabel) maxCountLabel.textContent = formObj.coords.length;

            formObj.coords.forEach((coord, i) => {
                const node = {
                    index: i,
                    top: coord.top,
                    left: coord.left,
                    label: coord.label,
                    role: coord.role
                };
                placedNodes.push(node);
                drawAndBindNode(node);
            });
        } else if (maxCountLabel && selectCount) {
            maxCountLabel.textContent = selectCount.value;
        }

        const clearBoard = () => {
            placedNodes = [];
            if (pitchCanvas) pitchCanvas.querySelectorAll('.pitch-node').forEach(n => n.remove());
            if (editorList) editorList.innerHTML = `<p class="u-ext-174 text-secondary" >ピッチをクリックしてポジションを追加してください。</p>`;
        };

        if (selectCount) {
            selectCount.onchange = () => {
                if (maxCountLabel) maxCountLabel.textContent = selectCount.value;
                clearBoard();
            };
        }

        const btnClearAll = document.getElementById('btn-custom-formation-clear-all');
        if (btnClearAll) btnClearAll.onclick = clearBoard;

        if (pitchCanvas) {
            pitchCanvas.onclick = (e) => {
                if (e.target.closest('.pitch-node')) return;

                const maxCount = selectCount ? parseInt(selectCount.value, 10) : 8;
                if (placedNodes.length >= maxCount) {
                    alert(`ポジションは最大 ${maxCount} 箇所まで設定可能です。`);
                    return;
                }

                const snapToGrid = (val, step = 5) => Math.max(0, Math.min(100, Math.round(val / step) * step));
                const leftPercent = snapToGrid(((e.clientX - rect.left) / rect.width) * 100, 5);
                const topPercent = snapToGrid(((e.clientY - rect.top) / rect.height) * 100, 5);

                const nodeIndex = placedNodes.length;
                const defaultLabel = nodeIndex === 0 ? 'GK' : `P${nodeIndex}`;
                const defaultRole = nodeIndex === 0 ? 'GK' : 'DF';

                const newNode = {
                    index: nodeIndex,
                    top: `${topPercent}%`,
                    left: `${leftPercent}%`,
                    label: defaultLabel,
                    role: defaultRole
                };

                placedNodes.push(newNode);
                drawAndBindNode(newNode);
            };
        }

        const formCustomForm = document.getElementById('form-custom-formation');
        if (formCustomForm) {
            formCustomForm.onsubmit = (e) => {
                e.preventDefault();
                const nameInp = document.getElementById('custom-formation-name');
                const name = nameInp ? nameInp.value.trim() : '';
                const maxCount = selectCount ? parseInt(selectCount.value, 10) : 8;

                if (placedNodes.length !== maxCount) {
                    alert(`指定された人数（${maxCount}人）分のポジションを設定してください。（現在: ${placedNodes.length}箇所）`);
                    return;
                }

                const finalCoords = placedNodes.map(node => {
                    const rowEl = document.getElementById(`custom-node-editor-row-${node.index}`);
                    const role = rowEl.querySelector('.custom-node-role-select').value;
                    const cat2Val = rowEl.querySelector('.custom-node-cat2-select').value;
                    const label = cat2Val ? cat2Val : role;

                    // ピッチ上のパーセンテージ位置（例: "50%"）から数値（0〜100）を抽出
                    const xVal = parseFloat(node.left) || 50;
                    const yVal = parseFloat(node.top) || 50;

                    return {
                        role,
                        label,
                        top: node.top,
                        left: node.left,
                        x: xVal, // 画面描画用およびミニピッチ用のx座標
                        y: yVal  // 画面描画用およびミニピッチ用のy座標
                    };
                });

                if (editIndex !== null) {
                    state.customFormations[editIndex] = { name, coords: finalCoords };
                    showToast(`フォーメーション「${name}」を更新しました`);
                } else {
                    state.customFormations.push({ name, coords: finalCoords });
                    showToast(`フォーメーション「${name}」を登録しました`);
                }

                saveData();
                const customModal = document.getElementById('modal-custom-formation');
                if (customModal) customModal.classList.add('hidden');
                initSettings();
            };
        }

        openModal('modal-custom-formation');
    };

    const btnAddCustomForm = document.getElementById('btn-add-custom-formation');
    if (btnAddCustomForm) {
        btnAddCustomForm.onclick = () => openCustomFormationModal();
    }

    document.querySelectorAll('.btn-edit-custom-formation').forEach(btn => {
        btn.onclick = (e) => {
            const index = parseInt(e.currentTarget.dataset.index, 10);
            openCustomFormationModal(index);
        };
    });

    function setupAddForm(formId, inputId, stateArray) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.onsubmit = (e) => {
            e.preventDefault();
            const inputEl = document.getElementById(inputId);
            const newVal = inputEl ? inputEl.value.trim() : '';
            if (newVal && !stateArray.includes(newVal)) {
                stateArray.push(newVal);
                saveData();
                initSettings();
            }
        };
    }

    setupAddForm('form-add-match-type', 'new-match-type', state.matchTypes);
    setupAddForm('form-add-menu-category', 'new-menu-category', state.menuCategories);
    setupAddForm('form-add-tactics-category', 'new-tactics-category', state.tacticsCategories);
    setupAddForm('form-add-skill-metric', 'new-skill-metric', state.skillMetrics);
    setupAddForm('form-add-position', 'new-position', state.positions);
    setupAddForm('form-add-position-cat2', 'new-position-cat2', state.positionsCat2);
    setupAddForm('form-add-analysis-tag', 'new-analysis-tag', state.analysisTags);

    const btnResetTacticsCat = document.getElementById('btn-reset-tactics-categories');
    if (btnResetTacticsCat) {
        btnResetTacticsCat.onclick = async () => {
            const proceed = await showCustomConfirm('戦術カテゴリを新デフォルト（8項目）に洗い替えますか？\n（既存の戦術データも新カテゴリに自動移行されます）', 'カテゴリの洗い替え', { okText: '洗い替える' });
            if (proceed) {
                state.tacticsCategories = [
                    '攻撃：ビルドアップ（自陣）',
                    '攻撃：前進・崩し（中盤〜敵陣）',
                    '守備：ハイプレス（前線）',
                    '守備：ブロック・ゴール前（自陣）',
                    '切り替え：攻→守（奪われたとき）',
                    '切り替え：守→攻（奪ったとき）',
                    'セットプレー',
                    'その他'
                ];
                const catMap = {
                    'ビルドアップ': '攻撃：ビルドアップ（自陣）',
                    '攻撃': '攻撃：前進・崩し（中盤〜敵陣）',
                    'プレッシング': '守備：ハイプレス（前線）',
                    '守備': '守備：ブロック・ゴール前（自陣）',
                    'トランジション': '切り替え：攻→守（奪われたとき）',
                    'セットプレー': 'セットプレー'
                };
                if (state.tactics) {
                    state.tactics.forEach(t => {
                        if (t.category && catMap[t.category]) {
                            t.category = catMap[t.category];
                        } else if (t.category && !state.tacticsCategories.includes(t.category)) {
                            t.category = 'その他';
                        }
                    });
                }
                saveData();
                initSettings();
                showToast('戦術カテゴリを新デフォルトに洗い替えました');
            }
        };
    }

    function setupResetMasterButton(btnId, itemName, defaultArray) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.onclick = async () => {
            const proceed = await showCustomConfirm(`「${itemName}」を初期デフォルト設定に洗い替えますか？`, 'マスターデータの洗い替え', { okText: '洗い替える' });
            if (proceed) {
                if (btnId === 'btn-reset-match-types') state.matchTypes = [...defaultArray];
                else if (btnId === 'btn-reset-menu-categories') state.menuCategories = [...defaultArray];
                else if (btnId === 'btn-reset-skill-metrics') state.skillMetrics = [...defaultArray];
                else if (btnId === 'btn-reset-positions') state.positions = [...defaultArray];
                else if (btnId === 'btn-reset-positions-cat2') state.positionsCat2 = [...defaultArray];
                else if (btnId === 'btn-reset-analysis-tags') state.analysisTags = [...defaultArray];

                saveData();
                initSettings();
                showToast(`「${itemName}」を初期デフォルト設定に洗い替えました`);
            }
        };
    }

    setupResetMasterButton('btn-reset-match-types', '試合種別', ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯']);
    setupResetMasterButton('btn-reset-menu-categories', '練習カテゴリ', ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他']);
    setupResetMasterButton('btn-reset-skill-metrics', 'スキル評価項目', ['止める・蹴る', '運ぶ・駆け引き', '認知・スキャニング', '判断・ポジショニング', '切り替え・連続性', 'チャレンジ姿勢']);
    setupResetMasterButton('btn-reset-positions', 'ポジション (大分類)', ['GK', 'DF', 'MF', 'FW']);
    setupResetMasterButton('btn-reset-positions-cat2', 'ポジション (詳細)', ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH']);
    setupResetMasterButton('btn-reset-analysis-tags', '動画分析タグ', ['チャンス', '得点', '失点', 'ビルドアップ', '課題/反省', 'メモ']);

    initData();
}