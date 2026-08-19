// app.js - エントリーポイント
import { state, uiState } from './state.js';
import { escapeHtml, encryptData, decryptData, showToast, showCustomConfirm, setupScoreCounters, getNendo } from './utils.js';
import { initPractices, openPracticeModal, renderPracticeRoster } from './practices.js';
import { initMatches, openMatchModal, openMatchDetail, initMatchDetailView, getMatchStatus, copyMatchShareText, releaseFieldCompanionSession } from './matches.js';
import { initPlayers, openPlayerDetail, initPlayerDetailView } from './players.js';
import { initLibrary } from './library.js';
import { initTactics } from './tactics.js';
import { initSettings, initData, applyCurrentTeamTheme } from './settings.js';
import { initAnimation, cleanupCanvasEvents, drawPitchToCtx } from './drawing.js';
import { cleanupScope } from './event-manager.js';
import { APP_VERSION, RELEASE_DATE, RELEASE_NOTES } from './version.js';
import { loadPersistedSnapshot, savePersistedSnapshot, createStateSnapshot, createCloudSnapshot, loadSyncAudit, loadSyncOutbox, saveSyncAudit, saveSyncOutbox } from './repository.js';
import { pushCloud, pullCloud, restoreCloudRecovery as restoreCloudRecoveryRequest, withRetry } from './sync-service.js';
import { ensureSyncMeta, markLocalChange, markSyncAttempt, markSyncAcknowledged, markSyncFailure, hasSyncConflict, applyRemoteSnapshot, getExpectedCloudRevision, buildSyncSummary, getSyncStatusLabel } from './sync-controller.js';
import { showSyncConflictDialog } from './sync-conflict-dialog.js';
import { buildOperationalDiagnostics } from './operations-service.js';
import { getParentAccessInvite, isParentShareValid, markParentAccessUsed } from './parent-operations-service.js';
import { ensureWorkspaceState, hydrateActiveWorkspace } from './workspace-service.js';
import { mergeSnapshotsByRecord, touchRecordsForSave } from './record-service.js';
import { acknowledgeSyncOutboxItem, appendSyncAudit, enqueueSyncSnapshot, ensureSyncOutbox, getNextSyncItem, hydrateSyncOutbox, markSyncOutboxFailed, markSyncOutboxSending, refreshSyncOutboxItem } from './sync-outbox-service.js';
import { configureAppContext } from './app-context.js';
import { buildCoachActionCenter, buildParentHomeAgenda, buildPracticePlanDraft, ensurePracticePlan, savePracticePlan, loadUiPreferences, saveUiPreferences, applyUiPreferences } from './experience-service.js';

function renderEmptyState({ icon = 'fa-inbox', title, description = '', actionLabel = '', actionId = '', compact = false }) {
    const action = actionLabel && actionId
        ? `<button type="button" class="btn btn-primary" id="${actionId}">${actionLabel}</button>`
        : '';
    const modifier = compact ? ' c-empty-state--compact' : '';
    return `<section class="c-empty-state${modifier}" role="status"><div class="c-empty-state__body"><i class="c-empty-state__icon fa-solid ${icon}" aria-hidden="true"></i><h3 class="c-empty-state__title">${title}</h3>${description ? `<p class="c-empty-state__text">${description}</p>` : ''}${action}</div></section>`;
}

function resetPracticeListFilters() {
    uiState.currentPracticeNendo = 'all';
    uiState.currentPracticeMonth = 'all';
    uiState.currentPracticeCategory = 'all';
    uiState.currentPracticePlayer = 'all';
    uiState.currentPracticeSearch = '';
    uiState.currentPracticePage = 1;
}

function setupGlobalUi() {
    document.querySelectorAll('button[title]:not([aria-label]), [role="button"][title]:not([aria-label])').forEach(element => {
        const title = element.getAttribute('title');
        if (title) element.setAttribute('aria-label', title);
    });
    document.querySelectorAll('.btn-close-modal:not([aria-label])').forEach(element => element.setAttribute('aria-label', '閉じる'));
    let liveRegion = document.getElementById('global-live-region');
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'global-live-region';
        liveRegion.className = 'sr-only';
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        document.body.appendChild(liveRegion);
    }
    document.addEventListener('pointerdown', event => {
        const button = event.target.closest('button, .btn, .nav-item');
        if (button && !button.hasAttribute('disabled')) button.classList.add('is-pressing');
    }, { passive: true });
    document.addEventListener('pointerup', event => event.target.closest('button, .btn, .nav-item')?.classList.remove('is-pressing'), { passive: true });
    document.addEventListener('pointercancel', event => event.target.closest('button, .btn, .nav-item')?.classList.remove('is-pressing'), { passive: true });
}

let lastSyncTimeStr = uiState.lastSyncTimeStr;
let saveDataQueue = Promise.resolve();

// --- ミニピッチアニメーション Observer ---
const miniPitchObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const canvas = entry.target;
        if (entry.isIntersecting) {
            startMiniPitchLoop(canvas);
        } else {
            stopMiniPitchLoop(canvas);
        }
    });
}, { root: null, threshold: 0.1 });

if (!window.miniPitchIntervalsMap) {
    window.miniPitchIntervalsMap = new Map();
}

function startMiniPitchLoop(canvas) {
    if (window.miniPitchIntervalsMap.has(canvas)) return;
    const framesData = canvas._animationFrames;
    const template = canvas._pitchTemplate || 'full';
    if (!framesData || framesData.length <= 1) return;

    let frameIdx = 0;
    const ctx = canvas.getContext('2d');
    drawPitchToCtx(framesData[frameIdx], canvas, ctx, template);

    const intervalId = setInterval(() => {
        frameIdx = (frameIdx + 1) % framesData.length;
        drawPitchToCtx(framesData[frameIdx], canvas, ctx, template);
    }, 1200);

    window.miniPitchIntervalsMap.set(canvas, intervalId);
}

function stopMiniPitchLoop(canvas) {
    if (window.miniPitchIntervalsMap.has(canvas)) {
        clearInterval(window.miniPitchIntervalsMap.get(canvas));
        window.miniPitchIntervalsMap.delete(canvas);
    }
}

export function clearAllMiniPitchIntervals() {
    window.miniPitchIntervalsMap.forEach((intervalId, canvas) => {
        clearInterval(intervalId);
        miniPitchObserver.unobserve(canvas);
    });
    window.miniPitchIntervalsMap.clear();
}

export async function loadData() {
    try {
        const parsed = await loadPersistedSnapshot({ decryptData });
        if (parsed) {
                state.matches = parsed.matches || [];
                state.practices = parsed.practices || [];
                state.matches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
                state.practices.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
                state.players = parsed.players || [];
                state.menuLibrary = parsed.menuLibrary || [];
                state.tactics = parsed.tactics || [];
                state.practiceTemplates = parsed.practiceTemplates || [];
                state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
                state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
                const newTacticsDefaults = ['攻撃：ビルドアップ（自陣）', '攻撃：前進・崩し（中盤〜敵陣）', '守備：ハイプレス（前線）', '守備：ブロック・ゴール前（自陣）', '切り替え：攻→守（奪われたとき）', '切り替え：守→攻（奪ったとき）', 'セットプレー', 'その他'];
                const loadedTacticsCat = parsed.tacticsCategories || [];
                const isOldTacticsCat = loadedTacticsCat.length === 0 ||
                    loadedTacticsCat.includes('トランジション') ||
                    loadedTacticsCat.includes('プレッシング') ||
                    (loadedTacticsCat.includes('攻撃') && !loadedTacticsCat.includes('攻撃：ビルドアップ（自陣）'));

                if (isOldTacticsCat) {
                    state.tacticsCategories = [...newTacticsDefaults];
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
                            } else if (t.category && !newTacticsDefaults.includes(t.category)) {
                                t.category = 'その他';
                            }
                        });
                    }
                } else {
                    state.tacticsCategories = loadedTacticsCat;
                }

                state.analysisTags = parsed.analysisTags || ['チャンス', '得点', '失点', 'ビルドアップ', '課題/反省', 'メモ'];
                state.skillMetrics = parsed.skillMetrics || ['止める・蹴る', '運ぶ・駆け引き', '認知・スキャニング', '判断・ポジショニング', '切り替え・連続性', 'チャレンジ姿勢'];
                state.positions = parsed.positions || ['GK', 'DF', 'MF', 'FW'];
                state.positionsCat2 = parsed.positionsCat2 || ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'];
                state.teamInfo = parsed.teamInfo || { name: 'My Team', color: '#f23932', passcode: '7064' };
                if (!state.teamInfo.passcode) state.teamInfo.passcode = '7064';
                state.customFormations = parsed.customFormations || state.customFormations;
                state.teamFocus = parsed.teamFocus || {}; // ★【追加】チーム強化テーマの読み込み
                state.teams = parsed.teams || [];
                state.workspaces = parsed.workspaces || {};
                state.activeTeamId = parsed.activeTeamId || null;
                state.activeSeasonId = parsed.activeSeasonId || null;
                state.syncMeta = parsed.syncMeta || state.syncMeta;
                resetPracticeListFilters();
            }
            ensureWorkspaceState(state);
            hydrateActiveWorkspace(state, { preferTopLevel: true });
            state.matches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
            state.practices.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
            ensureSyncMeta(state);
            const [outbox, audit] = await Promise.all([
                loadSyncOutbox({ decryptData }),
                loadSyncAudit({ decryptData })
            ]);
            hydrateSyncOutbox(state, { outbox, audit });
        // セッション中にロールが未設定の場合のみ初期値（保護者モード）をセット
        if (!state.currentUserRole) {
            state.currentUserRole = 'parent';
        }
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

async function persistSyncQueues() {
    ensureSyncOutbox(state);
    await Promise.all([
        saveSyncOutbox(state.syncOutbox, { encryptData }),
        saveSyncAudit(state.syncAudit, { encryptData })
    ]);
}

export function saveData({ sync = true, markChange = true } = {}) {
    saveDataQueue = saveDataQueue.then(async () => {
        state.matches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
        state.practices.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''));
        if (markChange) {
            touchRecordsForSave(state);
            markLocalChange(state);
            if (state.currentUserRole === 'coach' && state.teamInfo?.gasApiUrl) {
                const queued = enqueueSyncSnapshot(state, createCloudSnapshot(state), { expectedRevision: getExpectedCloudRevision(state) });
                appendSyncAudit(state, { type: 'queued', itemId: queued.id, message: 'ローカル変更を同期待ちキューへ追加しました' });
            }
        }

        const snapshot = createStateSnapshot(state);

        try {
            await savePersistedSnapshot(snapshot, { encryptData });
            await persistSyncQueues();
            setSyncStateUI(navigator.onLine === false ? 'offline' : 'local');
            if (sync && state.currentUserRole === 'coach' && state.teamInfo && state.teamInfo.gasApiUrl) {
                void syncPushGasCloud(true).catch(error => {
                    console.error('Background sync failed after save:', error);
                });
            }
        } catch (error) {
            console.error('Failed to save data:', error);
            showToast('保存に失敗しました。データを変更せず、もう一度お試しください');
            throw error;
        }
    }).catch(error => {
        // 1件の失敗で後続の保存キューを止めない
        console.error('Save queue error:', error);
    });
    return saveDataQueue;
}

function setSyncStateUI(status) {
    const icon = document.getElementById('sync-status-icon');
    const dot = document.getElementById('sync-status-dot');
    const timeEl = document.getElementById('sync-last-time');
    const textEl = document.getElementById('sync-status-text');
    const sidebarQuickTime = document.getElementById('sidebar-sync-quick-time');
    const mobileIcon = document.getElementById('mobile-sync-icon');
    const mobileBtnText = document.getElementById('mobile-sync-btn-text');
    const mobileTimeEl = document.getElementById('mobile-sync-last-time');
    const mobileDot = document.getElementById('mobile-sync-status-dot');
    const isCoach = state.currentUserRole === 'coach';
    window.__coachMgrSyncStatus = status;
    if (textEl) textEl.textContent = getSyncStatusLabel(status);

    if (status === 'syncing') {
        if (icon) icon.className = 'fa-solid fa-rotate fa-spin';
        if (mobileIcon) mobileIcon.className = 'fa-solid fa-rotate fa-spin';
        if (mobileBtnText) mobileBtnText.textContent = '同期中...';
        if (dot) dot.className = 'sync-status-dot syncing';
        if (mobileDot) mobileDot.className = 'sync-status-dot syncing';
    } else if (status === 'success') {
        const iconClass = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        if (icon) icon.className = iconClass;
        if (mobileIcon) mobileIcon.className = iconClass;
        if (mobileBtnText) mobileBtnText.textContent = 'データを同期する';
        if (dot) dot.className = 'sync-status-dot';
        if (mobileDot) mobileDot.className = 'sync-status-dot';
        const now = new Date();
        lastSyncTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (timeEl) timeEl.textContent = `本日 ${lastSyncTimeStr}`;
        if (sidebarQuickTime) sidebarQuickTime.textContent = lastSyncTimeStr;
        if (mobileTimeEl) mobileTimeEl.textContent = `最終同期: 本日 ${lastSyncTimeStr}`;
    } else if (status === 'local') {
        if (icon) icon.className = 'fa-solid fa-hard-drive';
        if (mobileIcon) mobileIcon.className = 'fa-solid fa-hard-drive';
        if (mobileBtnText) mobileBtnText.textContent = 'ローカル保存済み';
        if (dot) dot.className = 'sync-status-dot';
        if (mobileDot) mobileDot.className = 'sync-status-dot';
    } else if (status === 'offline') {
        if (icon) icon.className = 'fa-solid fa-mobile-screen-button';
        if (mobileIcon) mobileIcon.className = 'fa-solid fa-mobile-screen-button';
        if (mobileBtnText) mobileBtnText.textContent = 'オフライン';
        if (dot) dot.className = 'sync-status-dot error';
        if (mobileDot) mobileDot.className = 'sync-status-dot error';
    } else if (status === 'conflict') {
        if (icon) icon.className = 'fa-solid fa-triangle-exclamation';
        if (mobileIcon) mobileIcon.className = 'fa-solid fa-triangle-exclamation';
        if (mobileBtnText) mobileBtnText.textContent = '同期の競合が発生';
        if (dot) dot.className = 'sync-status-dot error';
        if (mobileDot) mobileDot.className = 'sync-status-dot error';
    } else if (status === 'error') {
        const iconClass = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        if (icon) icon.className = iconClass;
        if (mobileIcon) mobileIcon.className = iconClass;
        if (mobileBtnText) mobileBtnText.textContent = '再試行する';
        if (dot) dot.className = 'sync-status-dot error';
        if (mobileDot) mobileDot.className = 'sync-status-dot error';
    }
}

function createConflictError(message, code = 'revision_conflict') {
    const error = new Error(message);
    error.kind = 'conflict';
    error.code = code;
    return error;
}

async function persistRemoteSnapshot(remoteData, { toast = true } = {}) {
    applyRemoteSnapshot(state, remoteData);
    ensureWorkspaceState(state);
    hydrateActiveWorkspace(state, { preferTopLevel: true });
    resetPracticeListFilters();
    markSyncAcknowledged(state, new Date(), remoteData.syncMeta || {});
    await saveData({ sync: false, markChange: false });
    if (toast) showToast('クラウドから最新データを復元しました！');
    setSyncStateUI('success');
    navigate(state.currentRoute || 'dashboard');
    return remoteData;
}

async function resolveSyncConflict(remoteData, { isSilent = false, errorMeta = null } = {}) {
    setSyncStateUI('conflict');
    if (isSilent) throw createConflictError('端末とクラウドの両方に未同期の変更があります');

    const action = await showSyncConflictDialog({
        localSummary: buildSyncSummary(createCloudSnapshot(state)),
        remoteSummary: buildSyncSummary(remoteData),
        cloudRevision: errorMeta?.revision ?? remoteData?.syncMeta?.cloudRevision
    });
    if (action === 'cloud') return persistRemoteSnapshot(remoteData);
    if (action === 'merge') {
        const merged = mergeSnapshotsByRecord(createCloudSnapshot(state), remoteData);
        applyRemoteSnapshot(state, merged);
        ensureWorkspaceState(state);
        hydrateActiveWorkspace(state, { preferTopLevel: true });
        resetPracticeListFilters();
        await saveData({ sync: false, markChange: true });
        const expectedRevision = Number(errorMeta?.revision ?? remoteData?.syncMeta?.cloudRevision ?? getExpectedCloudRevision(state));
        return syncPushGasCloud(false, { force: true, expectedRevision, resolvedConflict: true });
    }
    if (action === 'keep-local') {
        const expectedRevision = Number(errorMeta?.revision ?? remoteData?.syncMeta?.cloudRevision ?? getExpectedCloudRevision(state));
        return syncPushGasCloud(false, { force: true, expectedRevision, resolvedConflict: true });
    }

    const cancelled = createConflictError('同期の競合はまだ解決されていません', 'manual_review');
    markSyncFailure(state, cancelled);
    await saveData({ sync: false, markChange: false });
    setSyncStateUI('conflict');
    return null;
}

export async function syncPushGasCloud(isSilent = false, { force = false, expectedRevision = getExpectedCloudRevision(state), resolvedConflict = false } = {}) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        if (!isSilent) alert('Google Apps Script の Web API URL が設定されていません。');
        throw new Error('No URL');
    }
    if (!isSilent) showToast(force ? '端末版をクラウドへ保存中...' : 'クラウドへ同期中...');
    let item = getNextSyncItem(state);
    if (!item) item = enqueueSyncSnapshot(state, createCloudSnapshot(state), { expectedRevision });
    if (force) item = refreshSyncOutboxItem(state, item.id, createCloudSnapshot(state), expectedRevision) || item;
    markSyncOutboxSending(state, item.id);
    appendSyncAudit(state, { type: 'sending', itemId: item.id, message: `同期待機キューを送信中（${Number(item.attempts || 0) + 1}回目）` });
    await persistSyncQueues();
    markSyncAttempt(state);
    setSyncStateUI('syncing');
    try {
        const result = await withRetry(() => pushCloud({
            teamInfo: state.teamInfo,
            data: item.payload,
            expectedRevision: force ? expectedRevision : Number(item.expectedRevision || expectedRevision),
            force
        }), {
            onRetry: (_error, attempt) => {
                if (!isSilent) showToast(`同期を再試行しています（${attempt}回目）...`);
            }
        });
        acknowledgeSyncOutboxItem(state, item.id);
        appendSyncAudit(state, { type: 'acknowledged', itemId: item.id, message: 'クラウド受領を確認し、同期待機キューを確定しました', revision: result.meta?.revision ?? result.meta?.cloudRevision ?? null });
        markSyncAcknowledged(state, new Date(), result.meta || result);
        await saveData({ sync: false, markChange: false });
        if (!isSilent) showToast(resolvedConflict ? '端末版をクラウドへ保存しました' : 'クラウドへの送信が完了しました！');
        setSyncStateUI('success');
        return result;
    } catch (error) {
        let err = error;
        markSyncOutboxFailed(state, item.id, err);
        appendSyncAudit(state, { type: err?.kind === 'conflict' ? 'conflict' : 'failed', itemId: item.id, message: String(err?.message || '同期に失敗しました').slice(0, 240), kind: err?.kind || 'unknown' });
        await persistSyncQueues();
        if (err?.kind === 'conflict' && !force && !isSilent) {
            try {
                const remoteData = await pullCloud({ teamInfo: state.teamInfo });
                return await resolveSyncConflict(remoteData, { isSilent, errorMeta: err.meta });
            } catch (resolutionError) {
                err = resolutionError;
            }
        }
        console.error('GAS Sync Push Error:', err);
        markSyncFailure(state, err);
        await saveData({ sync: false, markChange: false });
        setSyncStateUI(err?.kind === 'conflict' ? 'conflict' : 'error');
        if (!isSilent && err?.code !== 'manual_review') alert(`クラウド送信に失敗しました:\n${err.message || err}`);
        throw err;
    }
}

export async function restoreCloudRecovery(revision) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        throw new Error('Google Apps Script の Web API URL が設定されていません。');
    }
    markSyncAttempt(state);
    setSyncStateUI('syncing');
    try {
        const result = await withRetry(() => restoreCloudRecoveryRequest({
            teamInfo: state.teamInfo,
            revision,
            expectedRevision: getExpectedCloudRevision(state)
        }));
        // 復元成功後は、意図的な復元操作として競合確認を挟まずクラウド確定版を適用する。
        const remoteData = await withRetry(() => pullCloud({ teamInfo: state.teamInfo }));
        await persistRemoteSnapshot(remoteData, { toast: false });
        markSyncAcknowledged(state, new Date(), result.meta || result);
        await saveData({ sync: false, markChange: false });
        showToast(`クラウド世代 ${Number(revision)} を復元しました`);
        return remoteData;
    } catch (err) {
        console.error('GAS recovery restore error:', err);
        markSyncFailure(state, err);
        await saveData({ sync: false, markChange: false });
        setSyncStateUI(err?.kind === 'conflict' ? 'conflict' : 'error');
        throw err;
    }
}

export async function syncPullGasCloud(isSilent = false) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        const error = new Error('Google Apps Script の Web API URL が設定されていません。');
        if (!isSilent) alert(error.message);
        throw error;
    }

    if (!isSilent) showToast('クラウドからデータを受信中...');
    markSyncAttempt(state);
    setSyncStateUI('syncing');
    try {
        const remoteData = await withRetry(() => pullCloud({ teamInfo: state.teamInfo }), {
            onRetry: (_error, attempt) => {
                if (!isSilent) showToast(`同期を再試行しています（${attempt}回目）...`);
            }
        });
        if (hasSyncConflict(state, remoteData)) {
            return resolveSyncConflict(remoteData, { isSilent });
        }
        return persistRemoteSnapshot(remoteData, { toast: !isSilent });
    } catch (err) {
        console.error('GAS Sync Pull Error:', err);
        markSyncFailure(state, err);
        await saveData({ sync: false, markChange: false });
        setSyncStateUI(err?.kind === 'conflict' ? 'conflict' : 'error');
        if (!isSilent && err?.code !== 'manual_review') alert(`クラウドからの復元に失敗しました:\n${err.message || err}`);
        throw err;
    }
}

export function openModal(id) {
    if (id === 'modal-menu') {
        const catSel = document.getElementById('menu-category');
        if (catSel) {
            const currentVal = catSel.value;
            catSel.innerHTML = state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
            if (state.menuCategories.includes(currentVal)) catSel.value = currentVal;
            else if (state.menuCategories.length > 0) catSel.value = state.menuCategories[0];
        }
    }
    const modalEl = document.getElementById(id);
    if (modalEl) {
        modalEl.classList.remove('hidden');
        document.body.classList.add('modal-open');

        // ★ 修正: select() を除外し、完全にフォーカスのみにする
        setTimeout(() => {
            const firstInput = modalEl.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput && typeof firstInput.focus === 'function') {
                firstInput.focus();
            }
        }, 100);
    }
}

export function openLeaderRankingModal(type = 'all') {
    window.openLeaderRankingModal = openLeaderRankingModal;
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                if (f.goalRecords) {
                    f.goalRecords.forEach(r => {
                        if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                        if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                    });
                }
            });
        } else if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
            });
        }
    });

    const allScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)));

    const allAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)));

    const renderRankingItem = (item, idx, value = item.count, unit = '', accent = false) => {
        const numStr = item.p.number ? `#${item.p.number}` : '';
        return `
            <button type="button" class="c-data-list__item c-data-list__item--button dash-ranking-item" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                <span class="c-data-list__header">
                    <span class="c-data-list__identity"><span class="c-data-list__rank">${idx + 1}.</span><span class="rank-player-num">${numStr}</span> <span class="rank-player-name">${escapeHtml(item.p.name)}</span></span>
                    <span class="c-data-list__value-group"><strong class="c-data-list__value${accent ? ' c-data-list__value--accent' : ''}">${value}${unit}</strong></span>
                </span>
            </button>
        `;
    };

    // 1. 出席率集計 (過去1ヶ月間)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

    const recentPractices = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
    const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
    const totalRecentEvents = recentPractices.length + recentMatches.length;

    const attendanceCount = {};
    recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));
    recentMatches.forEach(m => (m.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));

    const allAttendance = state.players.map(p => {
        const count = attendanceCount[p.id] || 0;
        const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
        return { p, count, pct };
    }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0));

    // 2. 出場時間集計 (直近5試合)
    const recent5Matches = state.matches
        .filter(m => m && m.date && m.date <= todayStr && m.result)
        .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
        .slice(0, 5);

    const playerPlayTimes = {};
    state.players.forEach(p => { playerPlayTimes[p.id] = 0; });
    let totalPeriods = 0;

    recent5Matches.forEach(m => {
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                if (f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'))) return;
                totalPeriods++;

                const starterPlayerIds = new Set();
                if (f.lineup && Array.isArray(f.lineup)) {
                    f.lineup.forEach(l => { if (l.playerId) starterPlayerIds.add(parseInt(l.playerId, 10)); });
                } else if (f.positions) {
                    Object.values(f.positions).forEach(pid => { if (pid) starterPlayerIds.add(parseInt(pid, 10)); });
                }

                const outPlayerIds = new Set();
                const inPlayerIds = new Set();
                if (f.substitutions && Array.isArray(f.substitutions)) {
                    f.substitutions.forEach(sub => {
                        if (sub.playerOutId) outPlayerIds.add(parseInt(sub.playerOutId, 10));
                        if (sub.playerInId) inPlayerIds.add(parseInt(sub.playerInId, 10));
                    });
                }

                state.players.forEach(p => {
                    const isStarter = starterPlayerIds.has(p.id);
                    const isOut = outPlayerIds.has(p.id);
                    const isIn = inPlayerIds.has(p.id);

                    if (isStarter && isOut) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                    } else if (isStarter) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 1.0;
                    } else if (isIn) {
                        playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                    }
                });
            });
        }
    });

    const allPlaytimes = state.players.map(p => {
        const count = playerPlayTimes[p.id] || 0;
        const pct = totalPeriods > 0 ? Math.round((count / totalPeriods) * 100) : 0;
        return { p, count, pct };
    }).sort((a, b) => a.pct - b.pct || a.count - b.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0)); // 少ない順(ケア対象が上)

    // UI描画
    const elRankingScorers = document.getElementById('ranking-scorers-list');
    if (elRankingScorers) {
        elRankingScorers.innerHTML = allScorers.length > 0
            ? allScorers.map((item, idx) => renderRankingItem(item, idx, item.count)).join('')
            : renderEmptyState({ icon: 'fa-futbol', title: '得点記録がありません。', compact: true });
    }

    const elRankingAssists = document.getElementById('ranking-assists-list');
    if (elRankingAssists) {
        elRankingAssists.innerHTML = allAssists.length > 0
            ? allAssists.map((item, idx) => renderRankingItem(item, idx, item.count)).join('')
            : renderEmptyState({ icon: 'fa-shoe-prints', title: 'アシスト記録がありません。', compact: true });
    }

    const elRankingAttendance = document.getElementById('ranking-attendance-list');
    if (elRankingAttendance) {
        elRankingAttendance.innerHTML = totalRecentEvents > 0 && allAttendance.some(item => item.count > 0)
            ? allAttendance.map((item, idx) => renderRankingItem(item, idx, item.pct, '%', true)).join('')
            : renderEmptyState({ icon: 'fa-users', title: '過去1か月の出席データがありません。', compact: true });
    }

    const elRankingPlaytime = document.getElementById('ranking-playtime-list');
    if (elRankingPlaytime) {
        elRankingPlaytime.innerHTML = totalPeriods > 0
            ? allPlaytimes.map((item, idx) => `
                <button type="button" class="c-data-list__item c-data-list__item--button dash-ranking-item" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                    <span class="c-data-list__header">
                        <span class="c-data-list__identity"><span class="c-data-list__rank">${idx + 1}.</span>${item.p.number ? '#' + item.p.number : ''} ${escapeHtml(item.p.name)}</span>
                        <span class="c-data-list__value-group"><strong class="c-data-list__value${item.pct < 30 ? ' c-data-list__value--accent' : ''}">${item.pct}%</strong><span>(${item.count}P / ${totalPeriods}P)</span></span>
                    </span>
                    <span class="c-progress-bar" aria-hidden="true"><span class="c-progress-bar__indicator${item.pct < 30 ? ' c-progress-bar__indicator--attention' : ''}" style="width:${item.pct}%"></span></span>
                </button>
            `).join('')
            : renderEmptyState({ icon: 'fa-stopwatch', title: '直近5試合のピリオド記録がありません。', compact: true });
    }

    // 表示ターゲットに応じた表示切り替え ＆ 縦並び2列（マルチカラム）化
    const gridCols = document.getElementById('leader-ranking-grid-cols');
    const modalTitle = document.querySelector('#modal-leader-ranking h2');

    if (gridCols && gridCols.children.length >= 4) {
        const colScorers = gridCols.children[0];
        const colAssists = gridCols.children[1];
        const colAttendance = gridCols.children[2];
        const colPlaytime = gridCols.children[3];

        const listScorers = document.getElementById('ranking-scorers-list');
        const listAssists = document.getElementById('ranking-assists-list');
        const listAttendance = document.getElementById('ranking-attendance-list');
        const listPlaytime = document.getElementById('ranking-playtime-list');

        // 各項目の見出し（h4）取得
        const h4Scorers = colScorers.querySelector('h4');
        const h4Assists = colAssists.querySelector('h4');
        const h4Attendance = colAttendance.querySelector('h4');
        const h4Playtime = colPlaytime.querySelector('h4');

        // スタイルリセット
        [colScorers, colAssists, colAttendance, colPlaytime].forEach(col => col.style.display = 'none');
        [h4Scorers, h4Assists, h4Attendance, h4Playtime].forEach(h => { if (h) h.style.display = 'block'; });
        [listScorers, listAssists, listAttendance, listPlaytime].forEach(list => {
            if (list) {
                list.style.display = 'block';
                list.style.columnCount = 'auto';
            }
        });
        gridCols.style.display = 'block';

        // 共通の2列マルチカラム設定関数（縦順並び）
        const applyColumnStyle = (listEl) => {
            if (listEl) {
                listEl.style.display = 'block';
                listEl.style.columnCount = '2';
                listEl.style.columnGap = '1.5rem';
            }
        };

        // 選択されたランキングのみを表示し、上から下への縦並び2列化
        if (type === 'scorers') {
            colScorers.style.display = 'block';
            if (h4Scorers) h4Scorers.style.display = 'none';
            applyColumnStyle(listScorers);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-fire" style="color:#ef4444;"></i> 得点ランキング詳細';
        } else if (type === 'assists') {
            colAssists.style.display = 'block';
            if (h4Assists) h4Assists.style.display = 'none';
            applyColumnStyle(listAssists);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-shoe-prints" style="color:#22c55e;"></i> アシストランキング詳細';
        } else if (type === 'attendance') {
            colAttendance.style.display = 'block';
            if (h4Attendance) h4Attendance.style.display = 'none';
            applyColumnStyle(listAttendance);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-users" style="color:#3b82f6;"></i> 出席率ランキング詳細 (過去1ヶ月)';
        } else if (type === 'playtime') {
            colPlaytime.style.display = 'block';
            if (h4Playtime) h4Playtime.style.display = 'none';
            applyColumnStyle(listPlaytime);
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-stopwatch" style="color:#eab308;"></i> 出場時間・出場率詳細 (直近5試合)';
        } else {
            // 全項目一覧モード
            [colScorers, colAssists, colAttendance, colPlaytime].forEach(col => col.style.display = 'block');
            gridCols.style.display = 'grid';
            gridCols.style.gridTemplateColumns = 'repeat(2, 1fr)';
            gridCols.style.gap = '1rem';
            if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-trophy" style="color:var(--primary);"></i> 個人ランキング一覧';
        }
    }

    openModal('modal-leader-ranking');
}

export function openSeasonRecordModal() {
    window.openSeasonRecordModal = openSeasonRecordModal;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentNendo = getNendo(todayStr);

    // 有効なスコアがある完了した全試合
    const completedMatches = state.matches.filter(m => {
        return m.result && /([\d]+)\s*-\s*([\d]+)/.test(m.result) && m.date <= todayStr;
    });

    // ── 1. 試合種別ごとの成績 (今年度) ──
    const thisYearMatches = completedMatches.filter(m => getNendo(m.date) === currentNendo);
    const typeStats = {}; // { 公式戦: { win, loss, draw, goals, concede } }

    thisYearMatches.forEach(m => {
        const type = m.type || '未分類';
        if (!typeStats[type]) {
            typeStats[type] = { win: 0, loss: 0, draw: 0, goals: 0, concede: 0 };
        }
        const status = getMatchStatus(m);
        if (status === 'win') typeStats[type].win++;
        else if (status === 'loss') typeStats[type].loss++;
        else if (status === 'draw') typeStats[type].draw++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            typeStats[type].goals += parseInt(mt[1], 10);
            typeStats[type].concede += parseInt(mt[2], 10);
        }
    });

    const elTypesList = document.getElementById('season-detail-types-list');
    if (elTypesList) {
        const typeKeys = Object.keys(typeStats);
        elTypesList.innerHTML = typeKeys.length > 0
            ? typeKeys.map(type => {
                const stat = typeStats[type];
                const total = stat.win + stat.loss + stat.draw;
                const winRate = total > 0 ? Math.round((stat.win / total) * 100) : 0;
                return `
                    <div class="c-data-list__item">
                        <div class="c-data-list__header">
                            <span class="c-data-list__identity">${escapeHtml(type)}</span>
                            <span class="c-data-list__value-group"><strong class="c-data-list__value c-data-list__value--accent">${stat.win}勝</strong><span>${stat.loss}敗 ${stat.draw}分</span></span>
                        </div>
                        <span class="c-data-list__meta">得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%</span>
                    </div>
                `;
            }).join('')
            : renderEmptyState({ icon: 'fa-chart-pie', title: '今年度の試合データがありません。', compact: true });
    }

    // ── 2. 過去年度の成績推移 ──
    const yearStats = {}; // { 2025: { win, loss, draw, goals, concede } }
    completedMatches.forEach(m => {
        const year = getNendo(m.date);
        if (!yearStats[year]) {
            yearStats[year] = { win: 0, loss: 0, draw: 0, goals: 0, concede: 0 };
        }
        const status = getMatchStatus(m);
        if (status === 'win') yearStats[year].win++;
        else if (status === 'loss') yearStats[year].loss++;
        else if (status === 'draw') yearStats[year].draw++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            yearStats[year].goals += parseInt(mt[1], 10);
            yearStats[year].concede += parseInt(mt[2], 10);
        }
    });

    const elYearsList = document.getElementById('season-detail-years-list');
    if (elYearsList) {
        const sortedYears = Object.keys(yearStats).sort((a, b) => b - a); // 降順
        elYearsList.innerHTML = sortedYears.length > 0
            ? sortedYears.map(year => {
                const stat = yearStats[year];
                const total = stat.win + stat.loss + stat.draw;
                const winRate = total > 0 ? Math.round((stat.win / total) * 100) : 0;
                const isCurrent = parseInt(year, 10) === currentNendo;
                return `
                    <div class="c-data-list__item${isCurrent ? ' c-data-list__item--selected' : ''}">
                        <div class="c-data-list__header">
                            <span class="c-data-list__identity">${year}年度${isCurrent ? ' <span class="c-data-list__kind">今年度</span>' : ''}</span>
                            <span class="c-data-list__value-group"><strong class="c-data-list__value${isCurrent ? ' c-data-list__value--accent' : ''}">${stat.win}勝</strong><span>${stat.loss}敗 ${stat.draw}分</span></span>
                        </div>
                        <span class="c-data-list__meta">得失: ${stat.goals}-${stat.concede} / 勝率: ${winRate}%</span>
                    </div>
                `;
            }).join('')
            : renderEmptyState({ icon: 'fa-history', title: '試合履歴データがありません。', compact: true });
    }

    openModal('modal-season-record-detail');
}

export function openTeamFocusModal() {
    const focus = state.teamFocus || {};
    const inputMain = document.getElementById('input-focus-main-theme');
    const inputPt1 = document.getElementById('input-focus-point-1');
    const inputPt2 = document.getElementById('input-focus-point-2');
    const inputPt3 = document.getElementById('input-focus-point-3');
    const inputNote = document.getElementById('input-focus-note');

    if (inputMain) inputMain.value = focus.mainTheme || '';
    if (inputPt1) inputPt1.value = (focus.points && focus.points[0]) || '';
    if (inputPt2) inputPt2.value = (focus.points && focus.points[1]) || '';
    if (inputPt3) inputPt3.value = (focus.points && focus.points[2]) || '';
    if (inputNote) inputNote.value = focus.note || '';

    openModal('modal-edit-team-focus');
}

// ★ 保護者向けマイ選手選択モーダルの起動（windowにグローバル公開）
export function openMyPlayerSelectModal() {
    const pmlTitle = document.getElementById('pml-title');
    const pmlContent = document.getElementById('pml-content');
    if (!pmlTitle || !pmlContent) return;

    pmlTitle.innerHTML = '<i class="fa-solid fa-user-gear"></i> マイ選手の選択';

    const currentId = localStorage.getItem('coachMgrMyPlayerId') || '';

    if (!state.players || state.players.length === 0) {
        pmlContent.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">選択可能な選手が登録されていません。</p>';
    } else {
        pmlContent.innerHTML = `
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.8rem;">
                表示対象の選手（お子様）を選択してください。この設定は端末に保存されます。
            </p>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
                ${state.players.map(p => `
                    <button type="button" class="btn ${p.id.toString() === currentId ? 'btn-primary' : 'btn-secondary'}"
                        style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; text-align:left;"
                        onclick="selectMyPlayer(${p.id})">
                        <span><strong>${escapeHtml(p.name)}</strong> (${p.number})</span>
                        ${p.id.toString() === currentId ? '<i class="fa-solid fa-check"></i>' : ''}
                    </button>
                `).join('')}
            </div>
        `;
    }

    openModal('modal-player-matches-list');
}
window.openMyPlayerSelectModal = openMyPlayerSelectModal;

// マイ選手選択確定処理
window.selectMyPlayer = function (playerId) {
    localStorage.setItem('coachMgrMyPlayerId', playerId.toString());
    const modal = document.getElementById('modal-player-matches-list');
    if (modal) modal.classList.add('hidden');
    if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
        document.body.classList.remove('modal-open');
    }
    initDashboard();
};

function setupModals() {
    const closeBtns = document.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
            if (openModals.length > 0) {
                openModals[openModals.length - 1].classList.add('hidden');
                if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                    document.body.classList.remove('modal-open');
                }
            }
        }
    });

    const formFocus = document.getElementById('form-edit-team-focus');
    if (formFocus) {
        formFocus.onsubmit = (e) => {
            e.preventDefault();
            const mainTheme = document.getElementById('input-focus-main-theme')?.value.trim() || '';
            const pt1 = document.getElementById('input-focus-point-1')?.value.trim() || '';
            const pt2 = document.getElementById('input-focus-point-2')?.value.trim() || '';
            const pt3 = document.getElementById('input-focus-point-3')?.value.trim() || '';
            const note = document.getElementById('input-focus-note')?.value.trim() || '';

            const points = [pt1, pt2, pt3].filter(Boolean);

            state.teamFocus = {
                mainTheme,
                points,
                note,
                updatedAt: new Date().toISOString()
            };

            saveData();
            document.getElementById('modal-edit-team-focus')?.classList.add('hidden');
            if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                document.body.classList.remove('modal-open');
            }
            showToast('チーム強化テーマを保存しました！');
            initDashboard();
        };
    }

    const btnClearFocus = document.getElementById('btn-clear-team-focus');
    if (btnClearFocus) {
        btnClearFocus.onclick = () => {
            state.teamFocus = { mainTheme: '', points: [], note: '', updatedAt: '' };
            saveData();
            document.getElementById('modal-edit-team-focus')?.classList.add('hidden');
            if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
                document.body.classList.remove('modal-open');
            }
            showToast('チーム重点テーマをクリアしました');
            initDashboard();
        };
    }

    setupScoreCounters();
}

async function runDashboardPreflightAction(action) {
    if (action === 'backup') {
        const { exportBackupData } = await import('./settings.js');
        exportBackupData();
        return;
    }
    if (action === 'sync') {
        await syncPushGasCloud(false);
        return;
    }
    if (action === 'recoveries' || action === 'local-recovery' || action === 'settings') {
        navigate('settings');
    }
}

function renderDashboardPreflight() {
    const card = document.getElementById('dash-preflight-card');
    if (!card || state.currentUserRole !== 'coach') return;
    const diagnostics = buildOperationalDiagnostics(state);
    const preflight = diagnostics.preflight;
    const headline = document.getElementById('dash-preflight-headline');
    const progress = document.getElementById('dash-preflight-progress');
    const items = document.getElementById('dash-preflight-items');
    const primaryAction = document.getElementById('btn-dash-preflight-action');
    const settingsAction = document.getElementById('btn-dash-preflight-settings');
    const icons = { backup: 'fa-download', sync: 'fa-cloud-arrow-up', cloudRecovery: 'fa-clock-rotate-left', recovery: 'fa-shield-heart' };
    if (headline) headline.textContent = preflight.headline;
    if (progress) {
        progress.textContent = `${preflight.readyCount}/${preflight.items.length} 確認済み`;
        progress.className = `dash-preflight-progress is-${preflight.status}`;
    }
    if (items) {
        items.innerHTML = preflight.items.map(item => `
            <div class="dash-preflight-item is-${item.status}">
                <i class="fa-solid ${icons[item.key] || 'fa-circle-info'}" aria-hidden="true"></i>
                <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
            </div>`).join('');
    }
    if (primaryAction) {
        primaryAction.innerHTML = `<i class="fa-solid fa-play"></i> ${escapeHtml(preflight.nextAction.label)}`;
        primaryAction.onclick = async () => {
            primaryAction.disabled = true;
            try {
                await runDashboardPreflightAction(preflight.nextAction.action);
            } catch (error) {
                alert(`試合前チェックの操作に失敗しました。\n${error?.message || error}`);
            } finally {
                primaryAction.disabled = false;
            }
        };
    }
    if (settingsAction) settingsAction.onclick = () => navigate('settings');
}

function initDashboard() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isCoach = state.currentUserRole === 'coach';
    renderDashboardPreflight();

    // ── P0: 初回セットアップチェックリスト ──
    const setupChecklist = document.getElementById('dash-setup-checklist');
    const setupItems = document.getElementById('dash-setup-items');
    const setupProgress = document.getElementById('dash-setup-progress');
    if (setupChecklist && setupItems && setupProgress) {
        const hasTeam = Boolean(state.teamInfo && (state.teamInfo.name || state.teamInfo.teamName));
        const hasPlayers = Array.isArray(state.players) && state.players.length > 0;
        const hasFirstRecord = (Array.isArray(state.matches) && state.matches.length > 0)
            || (Array.isArray(state.practices) && state.practices.length > 0);
        const setupSteps = [
            { done: hasTeam, icon: 'fa-flag', title: 'チーム情報を設定', description: 'チーム名やシーズンを登録', action: 'settings', label: '設定する' },
            { done: hasPlayers, icon: 'fa-users', title: '選手を登録', description: '選手一覧をチームに追加', action: 'players', label: '登録する' },
            { done: hasFirstRecord, icon: 'fa-futbol', title: '最初の記録を作成', description: '試合または練習を登録', action: 'matches', label: '始める' }
        ];
        const completed = setupSteps.filter(step => step.done).length;
        setupProgress.textContent = `${completed}/${setupSteps.length} 完了`;
        setupItems.innerHTML = setupSteps.map(step => `
            <div class="setup-checklist-item${step.done ? ' is-complete' : ''}">
                <span class="setup-checklist-icon"><i class="fa-solid ${step.done ? 'fa-check' : step.icon}"></i></span>
                <span class="setup-checklist-copy"><strong>${step.title}</strong><span>${step.done ? '設定済み' : step.description}</span></span>
                ${step.done ? '' : `<button type="button" class="btn btn-secondary btn-setup-action" data-setup-route="${step.action}">${step.label}</button>`}
            </div>
        `).join('');
        setupItems.querySelectorAll('.btn-setup-action').forEach(button => {
            button.addEventListener('click', () => navigate(button.dataset.setupRoute));
        });
        setupChecklist.classList.toggle('hidden', !isCoach || completed === setupSteps.length);
    }

    // ── コーチ専用要素の表示制御 ──
    document.querySelectorAll('.coach-only').forEach(el => {
        if (isCoach) {
            el.style.removeProperty('display');
        } else {
            el.style.setProperty('display', 'none', 'important');
        }
    });

    // ── 保護者専用要素の表示制御と「マイ選手」ロジック（案1：未選択スタート＋端末固定） ──
    const myPlayerBanner = document.getElementById('dash-myplayer-banner');
    const myPlayerContent = document.getElementById('dash-myplayer-content');

    if (!isCoach && myPlayerBanner) {
        myPlayerBanner.style.removeProperty('display');

        // 保存済みのマイ選手IDを取得（※初回は自動補完せず空文字のままにする）
        const savedPlayerId = localStorage.getItem('coachMgrMyPlayerId') || '';

        const renderMyPlayerStats = (playerId) => {
            // 1. 選手データが1件も未登録の場合
            if (state.players.length === 0) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1.2rem 0; text-align:center;">
                        <p style="margin-bottom:0.6rem; color:var(--text-secondary); font-size:0.85rem;">チームに選手が登録されていません。</p>
                        <p style="font-size:0.75rem; color:var(--text-secondary);">※コーチモードに切り替えて「選手管理」から選手を登録してください。</p>
                    </div>
                `;
                return;
            }

            // 2. 選手は登録されているが、マイ選手が「未選択」の場合
            if (!playerId) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1.2rem 0; text-align:center;">
                        <p style="margin-bottom:0.6rem; color:var(--text-primary); font-weight:700; font-size:0.9rem;">表示するマイ選手が未設定です</p>
                        <button type="button" class="btn btn-primary btn-sm" onclick="openMyPlayerSelectModal()" style="padding:0.4rem 1rem; font-size:0.82rem;">
                            <i class="fa-solid fa-user-check"></i> マイ選手（我が子）を選択する
                        </button>
                    </div>
                `;
                return;
            }

            // 3. 選択された選手IDに対応する選手データを検索
            const player = state.players.find(p => p.id === parseInt(playerId, 10));
            if (!player) {
                myPlayerContent.innerHTML = `
                    <div class="dash-no-data" style="padding:1rem 0; text-align:center;">
                        <p style="margin-bottom:0.5rem; color:var(--text-secondary);">該当する選手が見つかりません。</p>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openMyPlayerSelectModal()">
                            <i class="fa-solid fa-rotate"></i> 別の選手を選択する
                        </button>
                    </div>
                `;
                return;
            }

            // ── 以下、選手が正しく選択されている場合の描画処理 ──
            const currentNendo = getNendo(todayStr);

            // 今年度の全試合・全練習
            const thisYearMatches = state.matches.filter(m => getNendo(m.date) === currentNendo);
            const thisYearPractices = state.practices.filter(p => getNendo(p.date) === currentNendo);
            const totalThisYearEvents = thisYearMatches.length + thisYearPractices.length;

            // 今年度の参加記録
            const attendedMatches = thisYearMatches.filter(m => (m.presentPlayerIds || []).includes(player.id));
            const attendedPractices = thisYearPractices.filter(p => (p.presentPlayerIds || []).includes(player.id));
            const attendedThisYearCount = attendedMatches.length + attendedPractices.length;

            // 出席率の算出
            const attendancePct = totalThisYearEvents > 0
                ? Math.round((attendedThisYearCount / totalThisYearEvents) * 100)
                : 0;

            // 通算（全期間）得点・アシストの集計
            let playerGoals = 0;
            let playerAssists = 0;
            state.matches.forEach(m => {
                if (m.goalRecords) {
                    m.goalRecords.forEach(r => {
                        if (r.scorerId === player.id) playerGoals++;
                        if (r.assistId === player.id) playerAssists++;
                    });
                }
            });

            // 最新フィードバックの抽出
            let timeline = [];
            if (player.history) {
                player.history.forEach(h => {
                    timeline.push({ type: 'assessment', date: h.date, comment: h.comment, data: h });
                });
            }
            state.matches.forEach(m => {
                if (m.playerFeedback) {
                    m.playerFeedback.forEach(fb => {
                        if (fb.playerId === player.id) {
                            timeline.push({
                                type: 'match',
                                date: m.date,
                                matchDetails: `${m.type}${m.tournament ? ` (${m.tournament})` : ''} vs ${m.opponent}`,
                                comment: fb.comment,
                                matchId: m.id
                            });
                        }
                    });
                }
            });
            timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

            const latestFeedbackItem = timeline.find(t => t.type === 'match' || t.type === 'assessment');
            let latestFeedbackHTML = '';
            if (latestFeedbackItem) {
                const labelStr = latestFeedbackItem.type === 'match' ? '試合評価' : '観察メモ';
                latestFeedbackHTML = `
                    <div style="margin-top:0.2rem; margin-bottom:0.2rem; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08)); border-left:4px solid var(--primary); border-radius:8px; padding:0.6rem 0.8rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                            <span style="font-size:0.75rem; font-weight:700; color:var(--primary);"><i class="fa-solid fa-comment-dots"></i> コーチからの最新フィードバック</span>
                            <span style="font-size:0.68rem; color:var(--text-secondary);">${latestFeedbackItem.date} (${labelStr})</span>
                        </div>
                        <p style="font-size:0.8rem; font-weight:600; color:var(--text-primary); margin:0; line-height:1.35;">
                            ${escapeHtml(latestFeedbackItem.comment)
                        .trim()
                        .replace(/\n\s*\n/g, '\n')
                        .replace(/\n/g, '<br>')
                    }
                        </p>
                    </div>
                `;
            }

            // ストロングポイントのHTML生成
            const strongPointsHtml = player.strongPoints && player.strongPoints.length > 0
                ? player.strongPoints.map(sp => `
                    <div style="margin-bottom:0.2rem;">
                        <span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; font-size:0.65rem; padding:0.08rem 0.28rem; display:inline-block;">
                            <i class="fa-solid fa-check"></i> ${escapeHtml(sp.key)}
                        </span>
                        <div style="font-size:0.75rem; color:var(--text-primary); line-height:1.2; margin-top:0.1rem;">${escapeHtml(sp.text)}</div>
                    </div>
                `).join('')
                : '<span style="font-size:0.75rem; color:var(--text-secondary);">未設定</span>';

            // UI生成
            myPlayerContent.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.6rem; padding:0.2rem 0;">

                    <!-- ヘッダー（名前・背番号・ポジション・変更ボタン） -->
                    <div class="dash-myplayer-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.1rem 0;">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <div class="player-number" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--primary);color:var(--color-text-on-action);border-radius:50%;font-weight:900;font-size:0.9rem;">
                                ${player.number}
                            </div>
                            <div style="display:flex; align-items:baseline; gap:0.4rem;">
                                <h2 style="margin:0; font-size:1.05rem; color:var(--text-primary); font-weight:800; letter-spacing:-0.02em;">
                                    ${escapeHtml(player.name)}
                                </h2>
                                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">
                                    (${(Array.isArray(player.position) ? player.position : [player.position]).join(', ')})
                                </span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-change-myplayer" style="font-size:0.72rem; padding:0.2rem 0.55rem;">
                            <i class="fa-solid fa-rotate"></i> 選手変更
                        </button>
                    </div>

                    <!-- コーチからの最新フィードバック -->
                    ${latestFeedbackHTML}

                    <!-- スタッツボタンエリア -->
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem;">
                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-att"
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-user-check" style="color:#3b82f6;"></i> 出席率
                            </span>
                            <div style="display:flex; align-items:baseline; gap:0.2rem;">
                                <strong style="font-size:0.88rem; color:var(--text-primary);">${attendancePct}%</strong>
                                <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:normal;">(${attendedThisYearCount}/${totalThisYearEvents})</span>
                            </div>
                        </button>

                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-goals"
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-futbol" style="color:var(--primary);"></i> 通算得点
                            </span>
                            <strong style="font-size:0.88rem; color:var(--primary);">${playerGoals}<span style="font-size:0.65rem; font-weight:normal;">点</span></strong>
                        </button>

                        <button type="button" class="btn btn-secondary" id="dash-btn-myplayer-assists"
                            style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer;">
                            <span style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-shoe-prints" style="color:#22c55e; transform:rotate(45deg);"></i> 通算アシスト
                            </span>
                            <strong style="font-size:0.88rem; color:#22c55e;">${playerAssists}<span style="font-size:0.65rem; font-weight:normal;">回</span></strong>
                        </button>
                    </div>

                    <!-- プロファイルアコーディオン -->
                    <details style="background:rgba(0,0,0,0.015); border:1px solid var(--surface-border); border-radius:6px; padding:0.3rem 0.6rem;">
                        <summary style="cursor:pointer; font-size:0.78rem; font-weight:700; display:flex; align-items:center; justify-content:space-between; outline:none; user-select:none;">
                            <span><i class="fa-solid fa-sliders" style="color:var(--primary);"></i> 選手詳細プロファイル (スタイル / 強み / IDP)</span>
                        </summary>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem; margin-top:0.4rem; padding-top:0.2rem;">
                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-tag"></i> プレースタイル
                                </strong>
                                <div style="font-size:0.78rem; font-weight:700; color:var(--text-primary); line-height:1.3;">
                                    ${escapeHtml(player.playStyle || '未設定')}
                                </div>
                            </div>

                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-shield-halved"></i> ストロングポイント
                                </strong>
                                ${strongPointsHtml}
                            </div>

                            <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem;">
                                <strong style="font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem;">
                                    <i class="fa-solid fa-bullseye"></i> 個人目標 (IDP)
                                </strong>
                                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                                    <div>
                                        <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:bold;">[短期]</span>
                                        <span style="font-size:0.75rem; color:var(--text-primary); line-height:1.2;">${player.goals && player.goals.short ? escapeHtml(player.goals.short) : '未設定'}</span>
                                    </div>
                                    <div>
                                        <span style="font-size:0.62rem; color:var(--text-secondary); font-weight:bold;">[長期]</span>
                                        <span style="font-size:0.75rem; color:var(--text-primary); line-height:1.2;">${player.goals && player.goals.long ? escapeHtml(player.goals.long) : '未設定'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            `;

            // イベントバインド
            const btnChange = document.getElementById('btn-change-myplayer');
            if (btnChange) btnChange.onclick = () => openMyPlayerSelectModal();

            const btnAtt = document.getElementById('dash-btn-myplayer-att');
            if (btnAtt) {
                btnAtt.onclick = () => {
                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<i class="fa-solid fa-user-check" style="color:#3b82f6;"></i> ${escapeHtml(player.name)} の参加記録 (${currentNendo}年度)`;

                    let html = '';
                    if (attendedMatches.length === 0 && attendedPractices.length === 0) {
                        html = '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">今年度の参加記録はありません。</p>';
                    } else {
                        attendedMatches.forEach(m => {
                            html += `
                                <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;"
                                    onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                                    <div>
                                        <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                        <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | 試合 ${m.type ? `(${escapeHtml(m.type)})` : ''}</div>
                                    </div>
                                    <div style="font-size:0.85rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                                </div>
                            `;
                        });
                        attendedPractices.forEach(p => {
                            html += `
                                <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;"
                                    onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('practices', { date: '${p.date}' });">
                                    <div>
                                        <strong>練習 ${p.location ? `(${escapeHtml(p.location)})` : ''}</strong>
                                        <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${p.date}</div>
                                    </div>
                                    <div style="font-size:0.85rem; font-weight:bold; color:var(--text-secondary);">練習記録 <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                                </div>
                            `;
                        });
                    }

                    pmlContent.innerHTML = html;
                    openModal('modal-player-matches-list');
                };
            }

            const btnGoals = document.getElementById('dash-btn-myplayer-goals');
            if (btnGoals) {
                btnGoals.onclick = () => {
                    const matchesWithGoals = state.matches.filter(m =>
                        m.goalRecords && m.goalRecords.some(r => r.scorerId === player.id)
                    );

                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<i class="fa-solid fa-futbol" style="color:var(--primary);"></i> ${escapeHtml(player.name)} の得点した試合 (通算)`;
                    pmlContent.innerHTML = matchesWithGoals.length > 0 ? matchesWithGoals.map(m => `
                        <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;"
                            onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                            <div>
                                <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${escapeHtml(m.type || '')}</div>
                            </div>
                            <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                        </div>
                    `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">得点した試合はありません。</p>';

                    openModal('modal-player-matches-list');
                };
            }

            const btnAssists = document.getElementById('dash-btn-myplayer-assists');
            if (btnAssists) {
                btnAssists.onclick = () => {
                    const matchesWithAssists = state.matches.filter(m =>
                        m.goalRecords && m.goalRecords.some(r => r.assistId === player.id)
                    );

                    const pmlTitle = document.getElementById('pml-title');
                    const pmlContent = document.getElementById('pml-content');
                    if (!pmlTitle || !pmlContent) return;

                    pmlTitle.innerHTML = `<span style="display:inline-block; transform:rotate(45deg); color:#22c55e;"><i class="fa-solid fa-shoe-prints"></i></span> ${escapeHtml(player.name)} のアシストした試合 (通算)`;
                    pmlContent.innerHTML = matchesWithAssists.length > 0 ? matchesWithAssists.map(m => `
                        <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer;"
                            onclick="document.getElementById('modal-player-matches-list').classList.add('hidden'); navigate('matches'); setTimeout(() => openMatchDetail(${m.id}), 100);">
                            <div>
                                <strong>vs ${escapeHtml(m.opponent || '対戦相手未定')}</strong>
                                <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${escapeHtml(m.type || '')}</div>
                            </div>
                            <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${escapeHtml(m.result || '詳細')} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;"></i></div>
                        </div>
                    `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">アシストした試合はありません。</p>';

                    openModal('modal-player-matches-list');
                };
            }
        };

        // ロード描画（※保存されているIDがあればその選手を表示、なければ「未選択」状態の画面を描画）
        renderMyPlayerStats(savedPlayerId);
    } else if (myPlayerBanner) {
        myPlayerBanner.style.setProperty('display', 'none', 'important');
    }

    // ── チーム重点課題・強化テーマ ロジック ──
    const teamFocusContent = document.getElementById('dash-team-focus-content');
    const btnEditFocus = document.getElementById('dash-btn-edit-focus');

    if (teamFocusContent) {
        const focus = state.teamFocus || {};
        if (focus.mainTheme) {
            let pointsHtml = '';
            if (focus.points && focus.points.filter(Boolean).length > 0) {
                pointsHtml = `
                    <div class="c-step-list">
                        ${focus.points.filter(Boolean).map((pt, idx) => `
                            <div class="c-step-list__item">
                                <span class="c-step-list__index">${idx + 1}</span>
                                <span>${escapeHtml(pt)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            teamFocusContent.innerHTML = `
                <div class="c-focus-summary">
                    <div class="c-focus-summary__kicker"><i class="fa-solid fa-bullseye" aria-hidden="true"></i> 強化テーマ</div>
                    <div class="c-focus-summary__title">${escapeHtml(focus.mainTheme)}</div>
                    ${pointsHtml}
                    ${focus.note ? `<div class="c-focus-summary__note"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${escapeHtml(focus.note)}</div>` : ''}
                </div>
            `;
        } else {
            teamFocusContent.innerHTML = renderEmptyState({
                icon: 'fa-bullseye',
                title: 'チーム強化テーマが未設定です',
                actionLabel: 'テーマを設定する',
                actionId: 'dash-btn-set-focus-empty',
                compact: true
            });
            const btnEmpty = document.getElementById('dash-btn-set-focus-empty');
            if (btnEmpty) btnEmpty.onclick = () => openTeamFocusModal();
        }
    }

    if (btnEditFocus) {
        btnEditFocus.onclick = () => openTeamFocusModal();
    }

    // ── 選手コンディション・出場時間平準化アラート ──
    const playtimeContent = document.getElementById('dash-playtime-content');
    if (playtimeContent) {
        // 直近5試合を抽出
        const recent5Matches = state.matches
            .filter(m => m && m.date && m.date <= todayStr && m.result)
            .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
            .slice(0, 5);

        if (recent5Matches.length > 0) {
            // 各選手の出場ピリオド数を集計する
            const playerPlayTimes = {};
            state.players.forEach(p => { playerPlayTimes[p.id] = 0; });

            let totalPeriods = 0;
            recent5Matches.forEach(m => {
                if (m.formations && m.formations.length > 0) {
                    m.formations.forEach(f => {
                        if (f.name && (f.name.trim() === 'PK戦' || f.name.toLowerCase().includes('pk'))) return;

                        totalPeriods++;

                        const starterPlayerIds = new Set();
                        if (f.lineup && Array.isArray(f.lineup)) {
                            f.lineup.forEach(l => { if (l.playerId) starterPlayerIds.add(parseInt(l.playerId, 10)); });
                        } else if (f.positions) {
                            Object.values(f.positions).forEach(pid => { if (pid) starterPlayerIds.add(parseInt(pid, 10)); });
                        }

                        const outPlayerIds = new Set();
                        const inPlayerIds = new Set();
                        if (f.substitutions && Array.isArray(f.substitutions)) {
                            f.substitutions.forEach(sub => {
                                if (sub.playerOutId) outPlayerIds.add(parseInt(sub.playerOutId, 10));
                                if (sub.playerInId) inPlayerIds.add(parseInt(sub.playerInId, 10));
                            });
                        }

                        state.players.forEach(p => {
                            const isStarter = starterPlayerIds.has(p.id);
                            const isOut = outPlayerIds.has(p.id);
                            const isIn = inPlayerIds.has(p.id);

                            if (isStarter && isOut) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                            } else if (isStarter) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 1.0;
                            } else if (isIn) {
                                playerPlayTimes[p.id] = (playerPlayTimes[p.id] || 0) + 0.5;
                            }
                        });
                    });
                }
            });

            const playRateList = state.players.map(p => {
                const count = playerPlayTimes[p.id] || 0;
                const pct = totalPeriods > 0 ? Math.round((count / totalPeriods) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => a.pct - b.pct);

            // 出場時間が特に少ない下位3名を表示（他ランキングと100%構造・高さを統一）
            const alertPlayers = playRateList.slice(0, 3);
            if (alertPlayers.length > 0 && totalPeriods > 0) {
                playtimeContent.className = 'c-data-list dash-rank-list';
                playtimeContent.innerHTML = alertPlayers.map((item, idx) => `
                    <article class="c-data-list__item dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                        <div class="c-data-list__header">
                            <div class="c-data-list__identity"><span class="dash-rank-medal">⚠️</span>${item.p.number} ${escapeHtml(item.p.name)}</div>
                            <div class="c-data-list__metric ${item.pct < 30 ? 'is-danger' : ''}">
                                <span class="c-data-list__metric-label">出場率</span>
                                <span class="c-data-list__metric-value">${item.pct}%</span>
                            </div>
                        </div>
                    </article>
                `).join('');
            } else {
                playtimeContent.innerHTML = renderEmptyState({ icon: 'fa-people-group', title: 'フォーメーション登録データがありません', compact: true });
            }
        } else {
            playtimeContent.innerHTML = renderEmptyState({ icon: 'fa-chart-column', title: '出場時間の集計対象となる最近の試合データがありません', compact: true });
        }
    }


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 1: アラートバナー（コーチ専用）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const alertBanner = document.getElementById('dash-alert-banner');
    const alertText = document.getElementById('dash-alert-text');
    const alertAction = document.getElementById('dash-alert-action');
    if (isCoach && alertBanner) {
        // ピリオド（formations）が未登録の過去試合を検出
        const pendingMatches = state.matches.filter(m => {
            if (!m.date || m.date > todayStr) return false; // 未来の試合は対象外
            return !m.formations || m.formations.length === 0; // ピリオド未登録
        });
        if (pendingMatches.length > 0) {
            alertBanner.style.removeProperty('display'); // coach-only で表示されるよう inline style を除去
            if (alertText) alertText.textContent = `ピリオドが未登録の試合が ${pendingMatches.length} 件あります`;
            if (alertAction) {
                alertAction.onclick = () => {
                    // 最初の未登録試合の詳細を開く
                    const firstPending = pendingMatches.sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))[0];
                    if (firstPending) openMatchDetail(firstPending.id);
                    else navigate('matches');
                };
            }
        } else {
            alertBanner.style.setProperty('display', 'none', 'important');
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 2-left: 次の予定カード
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allFutureEvents = [];
    state.practices.forEach(p => allFutureEvents.push({
        type: 'practice', date: p.date, id: p.id, title: '練習'
    }));
    state.matches.forEach(m => allFutureEvents.push({
        type: 'match', date: m.date, id: m.id,
        title: `vs ${m.opponent || '対戦相手'}`,
        subType: m.type, tournament: m.tournament
    }));

    const nextEvent = allFutureEvents
        .filter(e => e && e.date && e.date >= todayStr)
        .sort((a, b) => ((a && a.date) || '').localeCompare((b && b.date) || ''))[0];

    const nextEventContent = document.getElementById('dash-next-event-content');
    const nextEventCard = document.getElementById('dash-next-event-card');
    if (nextEventContent) {
        if (nextEvent) {
            const dateObj = new Date(nextEvent.date + 'T00:00:00');
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const dateLabel = `${nextEvent.date.replace(/-/g, '/')} (${dayNames[dateObj.getDay()]})`;
            const todayObj = new Date(todayStr + 'T00:00:00');
            const diffDays = Math.round((dateObj - todayObj) / (1000 * 60 * 60 * 24));
            const countdownLabel = diffDays === 0 ? '今日！' : diffDays === 1 ? '明日' : `あと${diffDays}日`;
            const typeClass = nextEvent.type === 'match' ? 'match' : 'practice';
            const typeLabel = nextEvent.type === 'match' ? '試合' : '練習';
            const subLine = nextEvent.subType
                ? nextEvent.subType + (nextEvent.tournament ? ` (${nextEvent.tournament})` : '')
                : '';

            nextEventContent.innerHTML = `
                <span class="dash-next-event-type ${typeClass}">${typeLabel}</span>
                <div class="dash-next-event-title">${escapeHtml(nextEvent.title)}</div>
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.1rem;">
                    <span class="dash-next-event-date">${dateLabel}${subLine ? ' · ' + escapeHtml(subLine) : ''}</span>
                    <span class="dash-next-event-countdown">${countdownLabel}</span>
                </div>
`;
            if (nextEventCard) {
                nextEventCard.style.cursor = 'pointer';
                nextEventCard.onclick = () => nextEvent.type === 'match'
                    ? openMatchDetail(nextEvent.id)
                    : navigate('practices', { date: nextEvent.date });
            }
        } else {
            nextEventContent.innerHTML = renderEmptyState({ icon: 'fa-calendar', title: '予定はありません', compact: true });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 2-right: 今季成績カード
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 今年度（今日の日付基準の年度）を求める
    const currentNendo = getNendo(todayStr);

    const completedMatches = state.matches.filter(m => {
        if (!m.result || !(/([\d]+)\s*-\s*([\d]+)/.test(m.result))) return false;
        return m.date <= todayStr;
    });

    // 今年度の試合のみ抽出
    const thisYearMatches = completedMatches.filter(m => getNendo(m.date) === currentNendo);

    let wins = 0, losses = 0, draws = 0, totalGoals = 0, totalConceded = 0;
    thisYearMatches.forEach(m => {
        const status = getMatchStatus(m);
        if (status === 'win') wins++;
        else if (status === 'loss') losses++;
        else if (status === 'draw') draws++;

        const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
        if (mt) {
            totalGoals += parseInt(mt[1], 10);
            totalConceded += parseInt(mt[2], 10);
        }
    });

    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    setEl('dash-record-win', wins);
    setEl('dash-record-loss', losses);
    setEl('dash-record-draw', draws);
    setHtml('dash-record-goals', `<i class="fa-solid fa-futbol"></i> 得点: ${totalGoals}`);
    setHtml('dash-record-concede', `<i class="fa-solid fa-shield-halved"></i> 失点: ${totalConceded}`);
    setEl('dash-db-record', `勝率 ${winRate}%`);
    const elBar = document.getElementById('dash-db-record-bar');
    if (elBar) elBar.style.width = `${winRate}%`;
    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) cardMatches.onclick = () => openSeasonRecordModal();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 3: 直近フォームバー
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const formBar = document.getElementById('dash-form-bar');
    if (formBar) {
        const recentMatches = [...completedMatches]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 7);
        if (recentMatches.length > 0) {
            formBar.innerHTML = recentMatches.map(m => {
                const mt = m.result ? m.result.match(/([\d]+)\s*-\s*([\d]+)/) : null;
                const us = mt ? parseInt(mt[1], 10) : 0;
                const them = mt ? parseInt(mt[2], 10) : 0;
                const status = getMatchStatus(m);
                let cls = 'draw', label = '分';
                if (status === 'win') { cls = 'win'; label = '勝'; }
                else if (status === 'loss') { cls = 'loss'; label = '負'; }
                const oppShort = (m.opponent || '').replace(/AFC|SFC|FC|SC/gi, '').trim().slice(0, 4) || 'vs';
                return `
                    <div class="dash-form-item" title="${escapeHtml(m.opponent)} ${m.result}" onclick="openMatchDetail(${m.id})">
                        <div class="dash-form-badge-lg ${cls}">${label}</div>
                        <div class="dash-form-score">${us}-${them}</div>
                        <div class="dash-form-opponent">${escapeHtml(oppShort)}</div>
                    </div>
                `;
            }).join('');
        } else {
            formBar.innerHTML = renderEmptyState({ icon: 'fa-futbol', title: '試合記録がありません', description: '最初の試合を登録すると、ここに結果と学びが表示されます。', actionLabel: '試合を追加', actionId: 'dash-empty-add-match' });
            document.getElementById('dash-empty-add-match')?.addEventListener('click', () => openMatchModal());
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 4: 得点 / アシストランキング
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
        if (m.formations && m.formations.length > 0) {
            m.formations.forEach(f => {
                (f.goalRecords || []).forEach(r => {
                    if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                    if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                });
            });
        } else {
            (m.goalRecords || []).forEach(r => {
                if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
            });
        }
    });

    const medals = ['🥇', '🥈', '🥉'];
    const renderRankList = (counts, unit, containerId) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        const top = Object.entries(counts)
            .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id, 10)), count }))
            .filter(x => x.p)
            .sort((a, b) => b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0))
            .slice(0, 3);
        el.innerHTML = top.length > 0
            ? top.map((item, idx) => `
                <article class="c-data-list__item dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                    <div class="c-data-list__header">
                        <div class="c-data-list__identity"><span class="dash-rank-medal">${medals[idx] || (idx + 1) + '.'}</span>${item.p.number} ${escapeHtml(item.p.name)}</div>
                        <div class="c-data-list__metric">
                            <span class="c-data-list__metric-label">${unit}</span>
                            <span class="c-data-list__metric-value">${item.count}</span>
                        </div>
                    </div>
                </article>
            `).join('')
            : renderEmptyState({ icon: 'fa-chart-line', title: '記録なし', compact: true });
    };
    renderRankList(scorerCounts, '得点', 'dash-top-scorers');
    renderRankList(assistCounts, 'A', 'dash-top-assists');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 5: 直近の予定・実績 (降順・最大7件・直近の試合と完全同一サイズ)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scheduleList = document.getElementById('dash-schedule-list');
    if (scheduleList) {
        const allEvents = [];

        // 1. 練習イベントの収集
        state.practices.forEach(p => allEvents.push({
            type: 'practice',
            date: p.date,
            id: p.id,
            subText: p.location || '場所未設定' // 2行目: 練習場所
        }));

        // 2. 試合イベントの収集
        state.matches.forEach(m => allEvents.push({
            type: 'match',
            date: m.date,
            id: m.id,
            subText: m.opponent ? `vs ${m.opponent}` : '対戦相手未定' // 2行目: 対戦相手
        }));

        // 3. 全イベントを日付の【降順】でソートし、最大7件に制限
        const sortedEvents = allEvents
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 7); // ★ 7個まで表示

        if (sortedEvents.length > 0) {
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

            const formatDateLabel = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr.replace(/-/g, '/'));
                const m = d.getMonth() + 1;
                const day = d.getDate();
                return `${m}/${day}(${dayNames[d.getDay()]})`;
            };

            // 「直近の試合」と全く同じ dash-form-item 構造・クラスでHTMLを出力
            scheduleList.innerHTML = sortedEvents.map(e => {
                const isMatch = e.type === 'match';
                const badgeClass = isMatch ? 'dash-circle-match' : 'dash-circle-practice';
                const badgeText = isMatch ? '試' : '練';
                const clickAction = isMatch
                    ? `openMatchDetail(${e.id})`
                    : `navigate('practices', { date: '${e.date}' })`;

                return `
                    <div class="dash-form-item" onclick="${clickAction}" style="cursor: pointer;">
                        <div class="dash-form-badge-lg ${badgeClass}">${badgeText}</div>
                        <div class="dash-form-score">${formatDateLabel(e.date)}</div>
                        <div class="dash-form-opponent" title="${escapeHtml(e.subText)}">${escapeHtml(e.subText)}</div>
                    </div>
                `;
            }).join('');
        } else {
            scheduleList.innerHTML = renderEmptyState({ icon: 'fa-calendar-days', title: '予定・実績はありません', description: '次の練習や試合を登録して、チームの予定を整理しましょう。', actionLabel: '試合を追加', actionId: 'dash-empty-add-schedule' });
            document.getElementById('dash-empty-add-schedule')?.addEventListener('click', () => openMatchModal());
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ROW 5: コーチ専用 — 出席率ランキング & 練習テーマ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (isCoach) {
        // 過去1ヶ月（30日前まで）の基準日を計算
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        const oneMonthAgoStr = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;

        const recentPractices = state.practices.filter(p => p.date >= oneMonthAgoStr && p.date <= todayStr);
        const recentMatches = state.matches.filter(m => m.date >= oneMonthAgoStr && m.date <= todayStr);
        const totalRecentEvents = recentPractices.length + recentMatches.length;

        const attendanceCount = {};
        recentPractices.forEach(p => (p.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));
        recentMatches.forEach(m => (m.presentPlayerIds || []).forEach(id => { attendanceCount[id] = (attendanceCount[id] || 0) + 1; }));

        const attendanceRankEl = document.getElementById('dash-attendance-rank');
        if (attendanceRankEl) {
            const top = state.players.map(p => {
                const count = attendanceCount[p.id] || 0;
                const pct = totalRecentEvents > 0 ? Math.round((count / totalRecentEvents) * 100) : 0;
                return { p, count, pct };
            }).sort((a, b) => b.pct - a.pct || b.count - a.count || (parseInt(a.p.number, 10) || 0) - (parseInt(b.p.number, 10) || 0))
                .slice(0, 3);

            attendanceRankEl.innerHTML = totalRecentEvents > 0 && top.some(item => item.count > 0)
                ? top.map((item, idx) => `
                    <article class="c-data-list__item dash-rank-item" onclick="event.stopPropagation(); openPlayerDetail(${item.p.id})">
                        <div class="c-data-list__header">
                            <div class="c-data-list__identity"><span class="dash-rank-medal">${medals[idx] || (idx + 1) + '.'}</span>${item.p.number} ${escapeHtml(item.p.name)}</div>
                            <div class="c-data-list__metric">
                                <span class="c-data-list__metric-label">出席率</span>
                                <span class="c-data-list__metric-value">${item.pct}%</span>
                            </div>
                        </div>
                    </article>
                `).join('')
                : renderEmptyState({ icon: 'fa-user-check', title: '過去1か月の出席記録なし', compact: true });
        }

        const practiceFocusEl = document.getElementById('dash-recent-practice-focus');
        if (practiceFocusEl) {
            const displayPractices = [...state.practices]
                .filter(p => p && p.date && p.date <= todayStr)
                .sort((a, b) => ((b && b.date) || '').localeCompare((a && a.date) || ''))
                .slice(0, 3);
            practiceFocusEl.innerHTML = displayPractices.length > 0
                ? displayPractices.map(p => {
                    const focuses = p.menus && p.menus.length > 0
                        ? p.menus.map(mn => escapeHtml(mn.focus)).join(' / ')
                        : 'メニュー未記録';
                    return `
                        <article class="c-data-list__item dash-rank-item" onclick="event.stopPropagation(); navigate('practices', { date: '${p.date}' })">
                            <div class="c-data-list__meta">${p.date}</div>
                            <div class="c-data-list__body">${focuses}</div>
                        </article>
                    `;
                }).join('')
                : renderEmptyState({ icon: 'fa-clipboard', title: '練習記録なし', compact: true });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ボタンイベント設定
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const btnGoMatches = document.getElementById('dash-btn-go-matches');
    const btnGoPlayers = document.getElementById('dash-btn-go-players');
    const btnAddPrac = document.getElementById('dash-btn-add-practice');
    const btnAddMatch = document.getElementById('dash-btn-add-match');

    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');
    if (btnGoPlayers) btnGoPlayers.onclick = () => openLeaderRankingModal();
    if (btnAddPrac) btnAddPrac.onclick = () => openPracticeModal(null);
    if (btnAddMatch) btnAddMatch.onclick = () => openMatchModal(null);
}

function renderExperienceDashboard() {
    const isCoach = state.currentUserRole === 'coach';
    const actionCenter = document.getElementById('dash-action-center');
    const actionList = document.getElementById('dash-action-center-list');
    const actionCount = document.getElementById('dash-action-center-count');

    if (isCoach && actionCenter && actionList) {
        const center = buildCoachActionCenter(state);
        actionCount.textContent = `${center.actions.length}件`;
        actionList.innerHTML = center.actions.length ? center.actions.map(item => `
            <button type="button" class="dash-action-item is-${escapeHtml(item.tone || 'neutral')}" data-experience-action="${escapeHtml(item.action)}" data-experience-id="${escapeHtml(String(item.targetId || ''))}">
                <span class="dash-action-icon"><i class="fa-solid ${escapeHtml(item.icon || 'fa-arrow-right')}"></i></span>
                <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>`).join('') : '<div class="dash-no-data">今すぐ対応が必要な項目はありません。</div>';
        actionList.querySelectorAll('[data-experience-action]').forEach(button => {
            button.onclick = () => runExperienceAction(button.dataset.experienceAction, button.dataset.experienceId || null, center.actions.find(item => item.action === button.dataset.experienceAction)?.recommendation || null);
        });
    }

    const parentAgenda = document.getElementById('dash-parent-agenda-list');
    if (!isCoach && parentAgenda) {
        const playerId = localStorage.getItem('coachMgrMyPlayerId');
        const agenda = buildParentHomeAgenda(state, { playerId, scopes: getParentAccessScopes() });
        parentAgenda.innerHTML = agenda.length ? agenda.map(item => `
            <button type="button" class="dash-action-item is-neutral" data-parent-agenda-action="${escapeHtml(item.action)}" data-parent-agenda-id="${escapeHtml(String(item.targetId || ''))}">
                <span class="dash-action-icon"><i class="fa-solid ${escapeHtml(item.icon)}"></i></span>
                <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>`).join('') : '<div class="dash-no-data">次の予定や回答待ちはありません。</div>';
        parentAgenda.querySelectorAll('[data-parent-agenda-action]').forEach(button => {
            button.onclick = () => runExperienceAction(button.dataset.parentAgendaAction, button.dataset.parentAgendaId || null);
        });
    }
}

function setupEventListeners() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelectorAll('.nav-links li');
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            navigate(route);
            closeSidebar();
        });
    });

    bottomNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = e.currentTarget.dataset.route;
            if (route) {
                navigate(route);
            }
        });
    });

    const btnBottomNavMore = document.getElementById('btn-bottom-nav-more');
    if (btnBottomNavMore) {
        btnBottomNavMore.addEventListener('click', () => {
            openModal('modal-mobile-more');
        });
    }

    document.querySelectorAll('.mobile-more-item[data-mobile-route]').forEach(item => {
        item.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.mobileRoute;
            if (route) {
                const modal = document.getElementById('modal-mobile-more');
                if (modal) modal.classList.add('hidden');
                document.body.classList.remove('modal-open');
                navigate(route);
            }
        });
    });

    const mobileBtnMyPlayer = document.getElementById('mobile-btn-my-player');
    if (mobileBtnMyPlayer) {
        mobileBtnMyPlayer.addEventListener('click', () => {
            const modal = document.getElementById('modal-mobile-more');
            if (modal) modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
            openMyPlayerSelectModal();
        });
    }

    const mobileBtnSyncNow = document.getElementById('mobile-btn-sync-now');
    if (mobileBtnSyncNow) {
        mobileBtnSyncNow.addEventListener('click', () => {
            setSyncStateUI('syncing');
            const isCoach = state.currentUserRole === 'coach';
            if (isCoach) {
                syncPushGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            } else {
                syncPullGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            }
        });
    }

    const mobileTopBarRoleBadge = document.getElementById('mobile-topbar-role-badge');
    if (mobileTopBarRoleBadge) {
        mobileTopBarRoleBadge.addEventListener('click', () => {
            openModal('modal-mobile-more');
        });
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (sidebar) {
                const isOpen = sidebar.classList.toggle('open');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('open', isOpen);
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    const handleToggleRoleClick = (e) => {
        e.preventDefault();

        // モバイルその他メニューが開いていれば閉じる
        const mobileModal = document.getElementById('modal-mobile-more');
        if (mobileModal) mobileModal.classList.add('hidden');
        document.body.classList.remove('modal-open');

        // 現在がコーチモードの場合：パスコード不要で保護者モードへ
        if (state.currentUserRole === 'coach') {
            state.currentUserRole = 'parent';
            localStorage.removeItem('currentUserRole');

            updateRoleUI();
            if (typeof renderCurrentView === 'function') {
                renderCurrentView();
            } else if (typeof navigate === 'function' && uiState.currentRoute) {
                navigate(uiState.currentRoute);
            }

            showToast('保護者モード（閲覧専用）に切り替えました');
        }
        // 現在が保護者モードの場合：パスコードモーダルを開く
        else {
            const errorMsg = document.getElementById('passcode-error-msg');
            const inputPass = document.getElementById('input-coach-passcode');

            if (errorMsg) errorMsg.style.display = 'none';
            if (inputPass) inputPass.value = '';

            openModal('modal-coach-passcode');
        }
    };

    const btnToggleRole = document.getElementById('btn-toggle-role');
    if (btnToggleRole) {
        btnToggleRole.onclick = handleToggleRoleClick;
    }

    const mobileBtnToggleRole = document.getElementById('mobile-btn-toggle-role');
    if (mobileBtnToggleRole) {
        mobileBtnToggleRole.onclick = handleToggleRoleClick;
    }

    const modalPasscode = document.getElementById('modal-coach-passcode');
    const formPasscode = document.getElementById('form-coach-passcode');
    const inputPasscode = document.getElementById('input-coach-passcode');
    const errorMsg = document.getElementById('passcode-error-msg');

    if (formPasscode) {
        formPasscode.onsubmit = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const val = inputPasscode ? inputPasscode.value.trim() : '';
            const targetPass = (state.teamInfo && state.teamInfo.passcode) ? state.teamInfo.passcode : '7064';

            if (!val) {
                return false;
            }

            if (val === targetPass) {
                state.currentUserRole = 'coach';
                localStorage.removeItem('currentUserRole');
                if (modalPasscode) modalPasscode.classList.add('hidden');
                document.body.classList.remove('modal-open');
                updateRoleUI();
                navigate('dashboard');
                showToast('コーチモード（編集可能）に切り替えました');
            } else {
                if (errorMsg) errorMsg.style.display = 'block';
                if (inputPasscode) {
                    inputPasscode.focus();
                }
            }
            return false;
        };
    }
}

function retryPendingSyncOutbox() {
    if (state.currentUserRole !== 'coach' || !state.teamInfo?.gasApiUrl || navigator.onLine === false || !getNextSyncItem(state)) return;
    void syncPushGasCloud(true).catch(error => console.error('Outbox retry failed:', error));
}

function getParentAccessScopes() {
    try {
        const scopes = JSON.parse(localStorage.getItem('coachMgrParentAccessScopes') || 'null');
        return Array.isArray(scopes) && scopes.length ? scopes : ['schedule', 'attendance', 'development'];
    } catch (_error) {
        return ['schedule', 'attendance', 'development'];
    }
}

export function updateRoleUI() {
    const badge = document.getElementById('user-role-badge');
    const btnToggle = document.getElementById('btn-toggle-role');
    const mobileRoleLabel = document.getElementById('mobile-user-role-label');
    const mobileTopBarRole = document.getElementById('mobile-topbar-role-badge');
    const isCoach = state.currentUserRole === 'coach';

    if (badge) {
        if (isCoach) {
            badge.style.background = 'rgba(242, 57, 50, 0.15)';
            badge.style.color = '#ef4444';
            badge.innerHTML = '<i class="fa-solid fa-user-shield" aria-hidden="true"></i> <span>コーチモード</span>';
        } else {
            badge.style.background = 'rgba(34, 197, 94, 0.15)';
            badge.style.color = '#15803d';
            badge.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i> <span>保護者モード</span>';
        }
    }

    if (mobileTopBarRole) {
        if (isCoach) {
            mobileTopBarRole.classList.add('is-coach');
            mobileTopBarRole.innerHTML = '<i class="fa-solid fa-user-shield" aria-hidden="true"></i> <span>コーチ</span>';
        } else {
            mobileTopBarRole.classList.remove('is-coach');
            mobileTopBarRole.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i> <span>保護者</span>';
        }
    }

    if (mobileRoleLabel) {
        mobileRoleLabel.textContent = isCoach ? 'コーチモード（編集可能）' : '保護者モード（閲覧専用）';
    }

    if (btnToggle) {
        btnToggle.innerHTML = '<i class="fa-solid fa-right-left" aria-hidden="true"></i> <span>切替</span>';
    }

    const btnSyncStatus = document.getElementById('btn-topbar-sync-status');
    const syncPopover = document.getElementById('sync-popover');
    const btnSyncNow = document.getElementById('btn-popover-sync-now');
    const mobileSyncCard = document.getElementById('mobile-sync-card');
    const icon = document.getElementById('sync-status-icon');
    const mobileIcon = document.getElementById('mobile-sync-icon');
    const hasUrl = state.teamInfo && state.teamInfo.gasApiUrl;

    if (mobileSyncCard) {
        mobileSyncCard.style.display = hasUrl ? 'block' : 'none';
        if (mobileIcon && !mobileIcon.classList.contains('fa-spin')) {
            mobileIcon.className = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        }
    }

    if (btnSyncStatus) {
        btnSyncStatus.style.display = hasUrl ? 'inline-flex' : 'none';
        if (icon && !icon.classList.contains('fa-spin')) {
            icon.className = isCoach ? 'fa-solid fa-cloud-arrow-up' : 'fa-solid fa-cloud-arrow-down';
        }
        btnSyncStatus.onclick = (e) => {
            e.stopPropagation();
            if (syncPopover) syncPopover.classList.toggle('hidden');
        };

        const syncRow = document.querySelector('.sidebar-sync-row');
        if (syncRow && !syncRow._outsideClickBound) {
            syncRow._outsideClickBound = true;
            document.addEventListener('click', (e) => {
                if (syncPopover && !syncPopover.classList.contains('hidden')) {
                    if (!syncRow.contains(e.target)) {
                        syncPopover.classList.add('hidden');
                    }
                }
            });
        }
    }

    if (btnSyncNow) {
        btnSyncNow.onclick = () => {
            setSyncStateUI('syncing');
            if (isCoach) {
                syncPushGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            } else {
                syncPullGasCloud(false).then(() => setSyncStateUI('success')).catch(() => setSyncStateUI('error'));
            }
        };
    }


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PCサイドバー、スマホボトムバー、モバイルシートのリンク制御
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const parentScopes = getParentAccessScopes();
    document.body.dataset.parentScopes = isCoach ? 'coach' : parentScopes.join(',');

    // PCサイドバー
    const playersLink = document.querySelector('.nav-links li[data-route="players"]');
    if (playersLink) playersLink.style.display = isCoach ? 'flex' : 'none';

    const settingsLink = document.querySelector('.nav-links li[data-route="settings"]');
    if (settingsLink) settingsLink.style.display = isCoach ? 'flex' : 'none';
    const matchesLink = document.querySelector('.nav-links li[data-route="matches"]');
    const practicesLink = document.querySelector('.nav-links li[data-route="practices"]');
    if (!isCoach) {
        if (matchesLink) matchesLink.style.display = parentScopes.includes('schedule') ? 'flex' : 'none';
        if (practicesLink) practicesLink.style.display = parentScopes.includes('schedule') ? 'flex' : 'none';
    }

    // スマホボトムバー
    document.querySelectorAll('#bottom-nav .coach-only').forEach(el => {
        el.style.display = isCoach ? 'flex' : 'none';
    });
    const bottomMatches = document.querySelector('#bottom-nav [data-route="matches"]');
    const bottomPractices = document.querySelector('#bottom-nav [data-route="practices"]');
    if (!isCoach) {
        if (bottomMatches) bottomMatches.style.display = parentScopes.includes('schedule') ? 'flex' : 'none';
        if (bottomPractices) bottomPractices.style.display = parentScopes.includes('schedule') ? 'flex' : 'none';
    } else {
        if (bottomMatches) bottomMatches.style.display = 'flex';
        if (bottomPractices) bottomPractices.style.display = 'flex';
    }

    // モバイルその他メニュー内の coach-only / parent-only 表示制御
    document.querySelectorAll('#modal-mobile-more .coach-only').forEach(el => {
        el.style.display = isCoach ? 'flex' : 'none';
    });
    document.querySelectorAll('#modal-mobile-more .parent-only').forEach(el => {
        el.style.display = !isCoach ? 'flex' : 'none';
    });

    const libraryLink = document.querySelector('.nav-links li[data-route="library"]');
    if (libraryLink) libraryLink.style.display = isCoach ? 'flex' : 'none';

    const tacticsLink = document.querySelector('.nav-links li[data-route="tactics"]');
    if (tacticsLink) tacticsLink.style.display = isCoach ? 'flex' : 'none';

    const dataLink = document.querySelector('.nav-links li[data-route="data"]');
    if (dataLink) dataLink.style.display = isCoach ? 'flex' : 'none';


    const goalShort = document.getElementById('player-goal-short');
    const goalLong = document.getElementById('player-goal-long');
    if (goalShort) {
        if (isCoach) goalShort.removeAttribute('readonly');
        else goalShort.setAttribute('readonly', 'true');
    }
    if (goalLong) {
        if (isCoach) goalLong.removeAttribute('readonly');
        else goalLong.setAttribute('readonly', 'true');
    }

    if (isCoach) {
        document.body.classList.remove('role-read-only');
        retryPendingSyncOutbox();
    } else {
        document.body.classList.add('role-read-only');

        // 保護者モード切り替え時に選手管理画面を開いていた場合はダッシュボードへ退避
        if (uiState.currentRoute === 'players') {
            navigate('dashboard');
            return;
        }
    }

    // ロール切り替え完了後、現在ダッシュボード表示中なら即時再描画（ウィジェット切り替え）
    if (uiState.currentRoute === 'dashboard') {
        initDashboard();
    }
}


export function navigateBack() {
    const current = uiState.currentRoute;
    const detailRoutes = ['player-detail', 'match-detail'];

    if (detailRoutes.includes(current)) {
        // 詳細画面の場合：直前の親画面（ダッシュボード または 各一覧画面）へ戻る
        if (!state.navHistory) state.navHistory = [];
        while (state.navHistory.length > 0) {
            const prev = state.navHistory.pop();
            if (prev && prev.route && prev.route !== current && prev.route !== 'animation') {
                navigate(prev.route, prev.params, true);
                return;
            }
        }
        // フォールバック
        if (current === 'player-detail') {
            navigate('players', null, true);
        } else if (current === 'match-detail') {
            navigate('matches', null, true);
        } else {
            navigate('dashboard', null, true);
        }
    } else {
        // 主要一覧画面（matches, practices, library, tactics, players, settings等）の場合：
        // どのメニューを経由してきたかに関わらず、戻るボタン押下時は常に「ダッシュボード」へ復帰
        state.navHistory = [];
        navigate('dashboard', null, true);
    }
}

export function navigate(route, params = null, isBack = false) {
    if (uiState.currentRoute === 'match-detail' && route !== 'match-detail') releaseFieldCompanionSession();
    cleanupCanvasEvents();
    // Cleanup scoped event listeners from the previous view
    if (uiState.currentRoute) {
        cleanupScope(uiState.currentRoute);
    }
    // 画面遷移時にYouTube音声を停止・破棄する
    if (typeof window.stopAndCleanupYouTube === 'function') {
        window.stopAndCleanupYouTube();
    }
    // 画面遷移時にクラウド同期ポップオーバーを閉じる
    const syncPopoverOnNav = document.getElementById('sync-popover');
    if (syncPopoverOnNav) syncPopoverOnNav.classList.add('hidden');

    if (state.currentUserRole !== 'coach') {
        const coachOnlyRoutes = ['tactics', 'library', 'settings', 'players'];
        const parentScopes = getParentAccessScopes();
        const scheduleRoutes = ['matches', 'match-detail', 'practices'];
        if (coachOnlyRoutes.includes(route)
            || (scheduleRoutes.includes(route) && !parentScopes.includes('schedule'))) {
            route = 'dashboard';
        }
    }

    // 履歴スタックの管理（詳細画面への遷移時のみ直前の親画面を記録、主要メニュー遷移時はリセット）
    const detailRoutes = ['player-detail', 'match-detail'];
    if (!state.navHistory) state.navHistory = [];
    if (detailRoutes.includes(route) && !isBack) {
        state.navHistory.push({
            route: uiState.currentRoute || 'dashboard',
            params: uiState.currentParams || null
        });
    } else if (!detailRoutes.includes(route) && !isBack && route !== 'animation') {
        state.navHistory = [];
    }

    state.currentRoute = route;
    uiState.currentRoute = route;
    uiState.currentParams = params;

    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    document.body.classList.remove('modal-open');
    document.body.setAttribute('data-route', route);

    const topbarTitle = document.getElementById('topbar-title');
    const topbarBack = document.getElementById('topbar-back');
    const navLinks = document.querySelectorAll('.nav-links li');
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');

    if (topbarBack) {
        if (route === 'dashboard') {
            topbarBack.classList.add('hidden');
            topbarBack.onclick = null;
        } else {
            topbarBack.classList.remove('hidden');
            topbarBack.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                navigateBack();
            };
        }
    }

    navLinks.forEach(link => {
        const isActive = link.dataset.route === route || (route === 'match-detail' && link.dataset.route === 'matches') || (route === 'player-detail' && link.dataset.route === 'players');
        link.classList.toggle('active', isActive);
        if (isActive && topbarTitle) {
            topbarTitle.textContent = (route === 'match-detail') ? '試合詳細' : (route === 'player-detail') ? '選手カルテ' : link.textContent.trim();
        }
    });

    const topbarBreadcrumb = document.getElementById('topbar-breadcrumb');
    if (topbarBreadcrumb) {
        if (route === 'dashboard') {
            topbarBreadcrumb.innerHTML = '';
        } else if (route === 'match-detail') {
            topbarBreadcrumb.innerHTML = `<a href="#" onclick="event.preventDefault(); navigate('dashboard');" style="color:var(--text-secondary); text-decoration:none;">ダッシュボード</a> <i class="fa-solid fa-angle-right" style="font-size:0.65rem; margin:0 0.3rem;"></i> <a href="#" onclick="event.preventDefault(); navigate('matches');" style="color:var(--text-secondary); text-decoration:none;">試合記録</a> <i class="fa-solid fa-angle-right" style="font-size:0.65rem; margin:0 0.3rem;"></i> <span>試合詳細</span>`;
        } else if (route === 'player-detail') {
            topbarBreadcrumb.innerHTML = `<a href="#" onclick="event.preventDefault(); navigate('dashboard');" style="color:var(--text-secondary); text-decoration:none;">ダッシュボード</a> <i class="fa-solid fa-angle-right" style="font-size:0.65rem; margin:0 0.3rem;"></i> <a href="#" onclick="event.preventDefault(); navigate('players');" style="color:var(--text-secondary); text-decoration:none;">選手管理</a> <i class="fa-solid fa-angle-right" style="font-size:0.65rem; margin:0 0.3rem;"></i> <span>選手カルテ</span>`;
        } else {
            const routeNames = {
                matches: '試合記録',
                practices: '練習管理',
                library: 'メニュー管理',
                tactics: '戦術管理',
                players: '選手管理',
                settings: '設定'
            };
            const currentName = routeNames[route] || route;
            topbarBreadcrumb.innerHTML = `<a href="#" onclick="event.preventDefault(); navigate('dashboard');" style="color:var(--text-secondary); text-decoration:none;">ダッシュボード</a> <i class="fa-solid fa-angle-right" style="font-size:0.65rem; margin:0 0.3rem;"></i> <span>${currentName}</span>`;
        }
    }

    bottomNavLinks.forEach(link => {
        const isActive = link.dataset.route === route || (route === 'match-detail' && link.dataset.route === 'matches') || (route === 'player-detail' && link.dataset.route === 'players');
        link.classList.toggle('active', isActive);
    });


    const viewContainer = document.getElementById('view-container');

    // ★ match-detail や player-detail の場合は専用テンプレートを参照
    const templateId = (route === 'match-detail') ? 'tpl-match-detail' : (route === 'player-detail') ? 'tpl-player-detail' : `tpl-${route}`;
    const template = document.getElementById(templateId);

    if (template && viewContainer) {
        viewContainer.innerHTML = '';
        viewContainer.appendChild(template.content.cloneNode(true));

        // 画面遷移時はスクロール位置をトップにリセット
        viewContainer.scrollTop = 0;
        window.scrollTo(0, 0);

        // 画面遷移のたびに各フィルタリング情報を初期状態にリセット
        uiState.currentMatchNendo = 'all';
        uiState.currentMatchPage = 1;
        uiState.currentPracticeNendo = 'all';
        uiState.currentPracticeMonth = 'all';
        uiState.currentPracticePage = 1;
        uiState.currentLibraryCategory = 'all';
        uiState.currentTacticsCategory = 'all';
        uiState.currentTacticsPage = 1;
        uiState.currentTacticsSearch = '';

        if (route === 'dashboard') {
            try {
                initDashboard();
            } catch (err) {
                console.error('initDashboard error:', err);
            }
        }
        if (route === 'practices') {
            if (params && params.date) {
                const parts = params.date.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const monthNum = parseInt(parts[1], 10);
                    const nendo = (monthNum >= 4) ? year : year - 1;
                    uiState.currentPracticeNendo = String(nendo);
                    uiState.currentPracticeMonth = parts[1];
                }
            }
            initPractices(miniPitchObserver);
        }
        if (route === 'matches') initMatches();
        if (route === 'tactics') initTactics(miniPitchObserver);
        // ★ IDを数値型(parseInt)にキャストして確実に渡す
        if (route === 'match-detail') {
            const rawId = params ? (params.matchId || params.id) : null;
            const matchId = rawId ? parseInt(rawId, 10) : null;
            initMatchDetailView(matchId);
        }
        if (route === 'players') initPlayers();
        if (route === 'player-detail') {
            const rawId = params ? (params.playerId || params.id) : null;
            const playerId = rawId ? parseInt(rawId, 10) : null;
            initPlayerDetailView(playerId);
        }
        if (route === 'library') initLibrary(miniPitchObserver);
        if (route === 'settings') initSettings();
        if (route === 'data') initData();
        if (route === 'animation') initAnimation(params, navigate, openModal);
    }

    updateRoleUI();
}

async function init() {
    try {
        window.openLeaderRankingModal = openLeaderRankingModal;
        window.openSeasonRecordModal = openSeasonRecordModal;
        window.openPlayerDetail = openPlayerDetail;
        window.openTeamFocusModal = openTeamFocusModal;
        window.openMyPlayerSelectModal = openMyPlayerSelectModal;
        window.navigate = navigate;
        await loadData();
    } catch (e) {
        console.error('loadData error in init:', e);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paramApiUrl = urlParams.get('apiUrl');
    const paramSheetName = urlParams.get('sheetName');
    const paramSyncProtocol = urlParams.get('syncProtocol');
    const parentPlayerId = urlParams.get('parentPlayerId');
    const parentShareVersion = urlParams.get('parentShareVersion');
    const parentShareToken = urlParams.get('parentShareToken');
    const parentInviteId = urlParams.get('parentInviteId');
    const parentInviteToken = urlParams.get('parentInviteToken');
    const hadLegacyAuthToken = urlParams.has('authToken');

    let isFromInviteLink = false;
    if (paramApiUrl) {
        if (!state.teamInfo) state.teamInfo = {};
        state.teamInfo.gasApiUrl = paramApiUrl;
        if (paramSheetName) state.teamInfo.gasSheetName = paramSheetName;
        if (paramSyncProtocol === 'secure-v2') state.teamInfo.gasSyncProtocol = 'secure-v2';
        isFromInviteLink = true;

        try {
            const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) { }
    }

    if (hadLegacyAuthToken) {
        showToast('安全のため、共有URLに含まれる認証情報は使用せず削除しました');
    }

    if (parentPlayerId) {
        const individualInvite = parentInviteId ? getParentAccessInvite(state.teamInfo || {}, { inviteId: parentInviteId, token: parentInviteToken }) : null;
        const shareValid = individualInvite ? String(individualInvite.playerId) === String(parentPlayerId) : isParentShareValid(state.teamInfo || {}, { version: parentShareVersion, token: parentShareToken });
        const playerExists = (state.players || []).some(player => String(player.id) === String(parentPlayerId));
        if (shareValid && playerExists) {
            const scopes = individualInvite?.scopes || ['schedule', 'attendance', 'development'];
            localStorage.setItem('coachMgrMyPlayerId', String(parentPlayerId));
            localStorage.setItem('coachMgrParentAccessScopes', JSON.stringify(scopes));
            if (individualInvite) {
                localStorage.setItem('coachMgrParentAccessInviteId', individualInvite.id);
                markParentAccessUsed(state.teamInfo, individualInvite.id);
            } else {
                localStorage.removeItem('coachMgrParentAccessInviteId');
            }
            state.currentUserRole = 'parent';
            isFromInviteLink = true;
            showToast(individualInvite ? '個別保護者招待の閲覧範囲を適用しました' : '保護者用の選手別表示を適用しました');
        } else {
            showToast('この保護者共有リンクは無効・期限切れ、またはこの端末に最新データがありません');
        }
    }

    setupEventListeners();
    setupModals();
    setupGlobalUi();
    if (!window.__coachMgrOutboxOnlineBound) {
        window.__coachMgrOutboxOnlineBound = true;
        window.addEventListener('online', () => retryPendingSyncOutbox());
    }
    retryPendingSyncOutbox();

    // P33: 表示設定は端末単位、チーム種色は共有データとして独立して合成する。
    const uiPreferences = applyUiPreferences(loadUiPreferences());
    applyCurrentTeamTheme({ colorMode: uiPreferences.colorMode });
    // v1.19.0: 屋外高コントラストモードは通常のlight/darkテーマのコントラスト保証へ統合。
    localStorage.removeItem('high_contrast_mode');
    document.body.classList.remove('high-contrast-mode');

    const toggleColorModeBtn = document.getElementById('btn-toggle-color-mode');
    const mobileToggleColorModeBtn = document.getElementById('mobile-btn-toggle-color-mode');
    const mobileColorModeText = document.getElementById('mobile-color-mode-text');

    const updateColorModeToggle = mode => {
        const isDark = mode === 'dark';
        if (toggleColorModeBtn) {
            toggleColorModeBtn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>`;
            toggleColorModeBtn.setAttribute('aria-label', `${isDark ? 'ライト' : 'ダーク'}表示へ切り替えます`);
            toggleColorModeBtn.title = `${isDark ? 'ライト' : 'ダーク'}表示へ切り替えます`;
        }
        if (mobileToggleColorModeBtn) {
            mobileToggleColorModeBtn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i> <span>${isDark ? 'ライト表示' : 'ダーク表示'}</span>`;
        }
    };
    updateColorModeToggle(uiPreferences.colorMode);
    window.addEventListener('coachmgr:color-mode-changed', event => updateColorModeToggle(event.detail?.colorMode));

    const handleColorModeToggle = () => {
        const current = loadUiPreferences();
        const next = { ...current, colorMode: current.colorMode === 'dark' ? 'light' : 'dark' };
        saveUiPreferences(next);
        applyUiPreferences(next);
        applyCurrentTeamTheme({ colorMode: next.colorMode });
        updateColorModeToggle(next.colorMode);
        showToast(`${next.colorMode === 'dark' ? 'ダーク' : 'ライト'}表示に切り替えました`);
    };

    if (toggleColorModeBtn) {
        toggleColorModeBtn.onclick = handleColorModeToggle;
    }
    if (mobileToggleColorModeBtn) {
        mobileToggleColorModeBtn.onclick = handleColorModeToggle;
    }

    const sidebarTitle = document.querySelector('.sidebar-header h2');
    if (sidebarTitle && state.teamInfo) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${escapeHtml(state.teamInfo.name || 'My Team')}`;

    // バージョン表示とリリースノートモーダル初期化
    const topbarVersionText = document.getElementById('topbar-version-text');
    if (topbarVersionText) topbarVersionText.textContent = `${APP_VERSION}`;
    const mobileVersionText = document.getElementById('mobile-version-text');
    if (mobileVersionText) mobileVersionText.textContent = `${APP_VERSION}`;

    window.openReleaseNotesModal = openReleaseNotesModal;


    navigate('dashboard');

    if (state.teamInfo && state.teamInfo.gasApiUrl) {
        if (isFromInviteLink) showToast('招待リンクよりクラウド設定を適用しました！同期中...');
        syncPullGasCloud(true).catch(() => { });
    }
}

export function openReleaseNotesModal() {
    const modal = document.getElementById('modal-release-notes');
    const container = document.getElementById('release-notes-content');
    if (!modal || !container) return;

    container.innerHTML = RELEASE_NOTES.map(item => `
        <div style="margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span class="badge" style="background:rgba(16,185,129,0.15); color:var(--primary); font-size:0.85rem; font-weight:700;">${item.version}</span>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${item.date}</span>
            </div>
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.4rem; color:var(--text-primary);">${escapeHtml(item.title)}</div>
            <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                ${item.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    modal.classList.remove('hidden');
}

configureAppContext({
    saveData,
    navigate,
    openModal,
    loadData,
    updateRoleUI,
    syncPushGasCloud,
    syncPullGasCloud,
    restoreCloudRecovery,
    clearAllMiniPitchIntervals
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.saveData = saveData;
window.navigate = navigate;
window.openMatchDetail = openMatchDetail;
window.openPlayerDetail = openPlayerDetail;
window.openPracticeModal = openPracticeModal;
window.openMatchModal = openMatchModal;
window.openModal = openModal;
window.renderPracticeRoster = renderPracticeRoster;
window.initMatchDetailView = initMatchDetailView;
window.openTeamFocusModal = openTeamFocusModal;
window.openMyPlayerSelectModal = openMyPlayerSelectModal;
window.copyMatchShareText = copyMatchShareText;