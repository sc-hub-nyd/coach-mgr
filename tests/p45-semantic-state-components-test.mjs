import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [tokens, standard, components, dashboard, utils, index, app, practices, system] = await Promise.all([
    read('../CSS/tokens.css'),
    read('../CSS/components-standard.css'),
    read('../CSS/components.css'),
    read('../CSS/dashboard.css'),
    read('../utils.js'),
    read('../index.html'),
    read('../app.js'),
    read('../practices.js'),
    read('../CSS/components-system.css')
]);

const requireAll = (text, values, label) => values.forEach(value => {
    assert.ok(text.includes(value), `${label}に必要な契約がありません: ${value}`);
});

requireAll(tokens, [
    '--color-status: var(--color-brand);',
    '--color-status-surface: var(--color-brand-surface);',
    '--color-notice-border:',
    '--color-overlay-scrim:',
    '--color-toast-surface:',
    '--color-toast-text:'
], '状態トークン');

requireAll(standard, [
    '.c-status {',
    'background: var(--color-status-surface);',
    '.c-status--success {',
    '.c-status--warning {',
    '.c-status--danger {',
    '.c-status--info {',
    '.c-notice {',
    '.c-notice--success {',
    '.c-notice--warning {',
    '.c-notice--danger {',
    '.c-notice--info {',
    '.toast.c-toast {',
    '.toast.c-toast--success {',
    '.toast.c-toast--warning {',
    '.toast.c-toast--danger {',
    '.toast.c-toast--info {',
    '.c-state-icon--danger {'
], '共通状態コンポーネント');

const toastRule = components.match(/\.toast\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(toastRule, /(?:#ffffff|#22c55e|rgba\(15, 23, 42)/,
    'レガシーtoastに直接指定色を残してはいけません');

requireAll(utils, [
    'const TOAST_TYPES = {',
    "success: { icon: 'ti-circle-check', role: 'status' }",
    "danger: { icon: 'ti-alert-circle', role: 'alert' }",
    "toast.className = `toast c-toast c-toast--${normalizedType}`;",
    "text.textContent = String(message ?? '');",
    "iconEl.className = `confirm-modal-icon c-state-icon c-state-icon--${confirmType}`;",
    "btnOk.classList.toggle('c-button--danger', confirmType === 'danger');"
], '実行時状態UI');
assert.doesNotMatch(utils, /iconEl\.style\.(?:background|color)/,
    '確認ダイアログの状態色をJavaScriptインラインスタイルへ戻してはいけません');

requireAll(index, [
    'id="toast-container" class="toast-container" aria-live="polite" aria-atomic="false"',
    'id="modal-global-confirm"',
    'role="dialog" aria-modal="true"',
    'aria-labelledby="global-confirm-title" aria-describedby="global-confirm-message"',
    'confirm-modal-icon c-state-icon c-state-icon--info'
], '状態UIのアクセシビリティ');

requireAll(dashboard, [
    'background: var(--color-brand-surface);',
    'color: var(--color-brand);',
    'background: var(--color-success-surface);',
    'color: var(--color-success);',
    'background: var(--color-danger-surface);',
    'color: var(--color-danger);',
    'background: var(--color-info-surface);',
    'color: var(--color-info);',
    'background: var(--color-status-muted-surface);'
], 'ダッシュボードの状態表現');

requireAll(practices, [
    "navigate('practices', { pulse: 'complete', pulsePracticeId: practice?.id });"
], '練習保存後の成功遷移');
requireAll(app, [
    "triggerTransientMotion(practiceCard, 'is-pulse-complete', '--duration-settle');"
], '保存済み練習の成功着地');
requireAll(system, [
    '#view-container .c-practice-card.is-pulse-complete',
    'var(--color-motion-complete-surface)'
], '成功着地の意味的状態色');

console.log('P45 semantic state component contracts passed');
