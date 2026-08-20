import { escapeHtml } from './utils.js';

function formatDateTime(value) {
    const timestamp = new Date(value || 0).getTime();
    if (!Number.isFinite(timestamp) || !timestamp) return '不明';
    return new Intl.DateTimeFormat('ja-JP', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
}

function renderSummary(label, summary = {}, emphasis = false) {
    return `<article class="c-data-list__item${emphasis ? ' c-data-list__item--selected' : ''}">
        <strong class="c-data-list__identity">${escapeHtml(label)}</strong>
        <span class="c-data-list__meta">更新：${escapeHtml(formatDateTime(summary.updatedAt))}</span>
        <span class="c-data-list__meta">選手 ${Number(summary.players || 0)}名 ・ 試合 ${Number(summary.matches || 0)}件 ・ 練習 ${Number(summary.practices || 0)}件</span>
    </article>`;
}

/**
 * 自動マージを行わず、利用者が安全な解決方法を選ぶための競合ダイアログ。
 * @returns {Promise<'cloud'|'merge'|'keep-local'|'cancel'>}
 */
export function showSyncConflictDialog({ localSummary, remoteSummary, cloudRevision = 0 } = {}) {
    return new Promise(resolve => {
        const dialog = document.createElement('div');
        dialog.className = 'c-modal-overlay c-modal-overlay--critical';
        dialog.setAttribute('role', 'presentation');
        dialog.innerHTML = `<section class="c-modal c-modal--sync-conflict" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
            <div class="c-modal__header">
                <div class="c-modal__heading-group">
                    <span class="c-modal__context-icon" aria-hidden="true"><i class="ti ti-git-compare"></i></span>
                    <h2 class="c-modal__title" id="sync-conflict-title">同期の競合を確認</h2>
                </div>
            </div>
            <div class="c-modal__body">
                <p class="c-modal__intro">この端末とクラウドの両方に未同期の変更があります。レコード単位で新しい更新を採用する「安全に統合」、または残す側を選択してください。</p>
                <div class="c-data-list c-data-list--conflict" aria-label="変更概要">
                    ${renderSummary('この端末', localSummary, true)}
                    ${renderSummary(`クラウド（世代 ${Number(cloudRevision || remoteSummary?.cloudRevision || 0)}）`, remoteSummary)}
                </div>
                <p class="c-modal__notice"><i class="ti ti-shield-heart" aria-hidden="true"></i><span>クラウドを復元する場合も、この端末の直前状態は自動復旧ポイントへ保存されます。</span></p>
            </div>
            <div class="c-modal__footer">
                <button type="button" class="c-button btn c-button--secondary btn-secondary" data-action="cancel">あとで確認</button>
                <button type="button" class="c-button btn c-button--secondary btn-secondary" data-action="cloud"><i class="ti ti-cloud-download"></i> クラウドを復元</button>
                <button type="button" class="c-button btn c-button--secondary btn-secondary" data-action="merge"><i class="ti ti-git-branch"></i> 安全に統合</button>
                <button type="button" class="c-button btn c-button--primary btn-primary" data-action="keep-local"><i class="ti ti-server"></i> 端末版を残す</button>
            </div>
        </section>`;

        const close = action => {
            document.removeEventListener('keydown', onKeydown);
            dialog.remove();
            resolve(action);
        };
        const onKeydown = event => {
            if (event.key === 'Escape') close('cancel');
        };
        dialog.addEventListener('click', event => {
            if (event.target === dialog) close('cancel');
        });
        dialog.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', () => close(button.dataset.action));
        });
        document.addEventListener('keydown', onKeydown);
        document.body.appendChild(dialog);
        dialog.querySelector('[data-action="keep-local"]')?.focus();
    });
}
