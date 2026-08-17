import { escapeHtml } from './utils.js';

function formatDateTime(value) {
    const timestamp = new Date(value || 0).getTime();
    if (!Number.isFinite(timestamp) || !timestamp) return '不明';
    return new Intl.DateTimeFormat('ja-JP', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
}

function renderSummary(label, summary = {}, emphasis = false) {
    return `<section class="sync-conflict-summary${emphasis ? ' is-emphasis' : ''}">
        <strong>${escapeHtml(label)}</strong>
        <span>更新：${escapeHtml(formatDateTime(summary.updatedAt))}</span>
        <span>選手 ${Number(summary.players || 0)}名 ・ 試合 ${Number(summary.matches || 0)}件 ・ 練習 ${Number(summary.practices || 0)}件</span>
    </section>`;
}

/**
 * 自動マージを行わず、利用者が安全な解決方法を選ぶための競合ダイアログ。
 * @returns {Promise<'cloud'|'keep-local'|'cancel'>}
 */
export function showSyncConflictDialog({ localSummary, remoteSummary, cloudRevision = 0 } = {}) {
    return new Promise(resolve => {
        const dialog = document.createElement('div');
        dialog.className = 'sync-conflict-dialog-backdrop';
        dialog.setAttribute('role', 'presentation');
        dialog.innerHTML = `<section class="sync-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
            <div class="sync-conflict-dialog-icon" aria-hidden="true"><i class="fa-solid fa-code-compare"></i></div>
            <h2 id="sync-conflict-title">同期の競合を確認</h2>
            <p>この端末とクラウドの両方に未同期の変更があります。内容を自動で混ぜず、残す側を選択してください。</p>
            <div class="sync-conflict-summaries" aria-label="変更概要">
                ${renderSummary('この端末', localSummary, true)}
                ${renderSummary(`クラウド（世代 ${Number(cloudRevision || remoteSummary?.cloudRevision || 0)}）`, remoteSummary)}
            </div>
            <p class="sync-conflict-note"><i class="fa-solid fa-shield-heart" aria-hidden="true"></i> クラウドを復元する場合も、この端末の直前状態は自動復旧ポイントへ保存されます。</p>
            <div class="sync-conflict-dialog-actions">
                <button type="button" class="btn btn-secondary" data-action="cancel">あとで確認</button>
                <button type="button" class="btn btn-secondary" data-action="cloud"><i class="fa-solid fa-cloud-arrow-down"></i> クラウドを復元</button>
                <button type="button" class="btn btn-primary" data-action="keep-local"><i class="fa-solid fa-hard-drive"></i> 端末版を残す</button>
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
