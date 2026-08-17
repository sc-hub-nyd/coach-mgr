// settings.js
import { state } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, showCustomConfirm } from './utils.js';
import { createBackupPayload, parseBackupPayload, savePersistedSnapshot, loadRecoverySnapshot, clearPersistedSnapshot } from './repository.js';
import { markBackupCreated, buildOperationalDiagnostics, buildOperationsShareText } from './operations-service.js';
import { listCloudRecoveries } from './sync-service.js';
import { ensureParentShareSettings, rotateParentShareLink, buildPendingRsvpDigest } from './parent-operations-service.js';

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
                document.documentElement.style.setProperty('--primary', state.teamInfo.color);
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

export function applyThemePreset(preset = 'field-green') {
    const body = document.body;
        body.classList.remove('theme-midnight', 'theme-high-visibility', 'theme-ocean-blue', 'theme-redline', 'theme-warm-notebook');
    if (preset === 'midnight') body.classList.add('theme-midnight');
    if (preset === 'high-visibility') body.classList.add('theme-high-visibility');
    if (preset === 'ocean-blue') body.classList.add('theme-ocean-blue');
    if (preset === 'redline') body.classList.add('theme-redline');
    if (preset === 'warm-notebook') body.classList.add('theme-warm-notebook');
    localStorage.setItem('coachMgrThemePreset', preset);
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

    const diagnosticsContainer = document.getElementById('operations-diagnostics');
    const refreshOperationalDiagnostics = () => {
        if (!diagnosticsContainer) return;
        const diagnostics = buildOperationalDiagnostics(state);
        const icons = { backup: 'fa-box-archive', sync: 'fa-cloud', cloudRecovery: 'fa-clock-rotate-left', recovery: 'fa-clock-rotate-left', team: 'fa-people-group', storage: 'fa-hard-drive' };
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
    const themePresetInput = document.getElementById('theme-preset');

    if (teamNameInput && teamColorInput) {
        teamNameInput.value = state.teamInfo.name;
        teamColorInput.value = state.teamInfo.color || '#13795b';
        if (themePresetInput) {
            themePresetInput.value = localStorage.getItem('coachMgrThemePreset') || 'field-green';
            themePresetInput.onchange = () => applyThemePreset(themePresetInput.value);
        }
        if (teamPasscodeInput) teamPasscodeInput.value = state.teamInfo.passcode || '7064';

        const formTeamInfo = document.getElementById('form-team-info');
        if (formTeamInfo) {
            formTeamInfo.onsubmit = (e) => {
                e.preventDefault();
                state.teamInfo.name = document.getElementById('team-info-name').value;
                state.teamInfo.color = document.getElementById('team-info-color').value;
                const newPasscode = document.getElementById('team-info-passcode') ? document.getElementById('team-info-passcode').value.trim() : '';
                if (newPasscode) {
                    state.teamInfo.passcode = newPasscode;
                }
                saveData();
                showToast('チーム基本情報を保存しました');
                applyThemePreset(themePresetInput ? themePresetInput.value : (localStorage.getItem('coachMgrThemePreset') || 'field-green'));
                document.documentElement.style.setProperty('--primary', state.teamInfo.color || '#13795b');
                const sidebarTitle = document.querySelector('.sidebar-header h2');
                if (sidebarTitle) {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-futbol';
                    sidebarTitle.replaceChildren(icon, document.createTextNode(` ${state.teamInfo.name}`));
                }
            };
        }
    }

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