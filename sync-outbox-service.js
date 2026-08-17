const MAX_AUDIT_ENTRIES = 40;

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function ensureSyncOutbox(state) {
    if (!state.syncOutbox || typeof state.syncOutbox !== 'object') state.syncOutbox = { items: [] };
    if (!Array.isArray(state.syncOutbox.items)) state.syncOutbox.items = [];
    if (!Array.isArray(state.syncAudit)) state.syncAudit = [];
    return state.syncOutbox;
}

export function hydrateSyncOutbox(state, { outbox, audit } = {}) {
    state.syncOutbox = outbox && typeof outbox === 'object' ? outbox : { items: [] };
    state.syncAudit = Array.isArray(audit) ? audit : [];
    ensureSyncOutbox(state);
    return state.syncOutbox;
}

export function enqueueSyncSnapshot(state, payload, { expectedRevision = 0, reason = 'local-change' } = {}) {
    const outbox = ensureSyncOutbox(state);
    const now = new Date().toISOString();
    const latest = outbox.items[outbox.items.length - 1];
    if (latest && latest.status !== 'sending') {
        latest.payload = clone(payload);
        latest.expectedRevision = Number(expectedRevision || 0);
        latest.reason = reason;
        latest.updatedAt = now;
        latest.status = 'pending';
        latest.lastError = null;
        return latest;
    }
    const item = { id: createId('sync'), payload: clone(payload), expectedRevision: Number(expectedRevision || 0), reason, createdAt: now, updatedAt: now, attempts: 0, status: 'pending', lastError: null };
    outbox.items.push(item);
    return item;
}

export function getNextSyncItem(state) {
    return ensureSyncOutbox(state).items.find(item => item.status !== 'sending') || null;
}

export function markSyncOutboxSending(state, itemId) {
    const item = ensureSyncOutbox(state).items.find(entry => entry.id === itemId);
    if (!item) return null;
    item.status = 'sending';
    item.attempts = Number(item.attempts || 0) + 1;
    item.updatedAt = new Date().toISOString();
    return item;
}

export function markSyncOutboxFailed(state, itemId, error) {
    const item = ensureSyncOutbox(state).items.find(entry => entry.id === itemId);
    if (!item) return null;
    item.status = 'pending';
    item.updatedAt = new Date().toISOString();
    item.lastError = { kind: error?.kind || 'unknown', message: String(error?.message || '同期に失敗しました').slice(0, 240), at: item.updatedAt };
    return item;
}

export function acknowledgeSyncOutboxItem(state, itemId) {
    const outbox = ensureSyncOutbox(state);
    const index = outbox.items.findIndex(entry => entry.id === itemId);
    if (index < 0) return null;
    return outbox.items.splice(index, 1)[0];
}

export function refreshSyncOutboxItem(state, itemId, payload, expectedRevision = 0) {
    const item = ensureSyncOutbox(state).items.find(entry => entry.id === itemId);
    if (!item) return null;
    item.payload = clone(payload);
    item.expectedRevision = Number(expectedRevision || 0);
    item.status = 'pending';
    item.updatedAt = new Date().toISOString();
    return item;
}

export function appendSyncAudit(state, entry) {
    ensureSyncOutbox(state);
    const audit = { id: createId('audit'), at: new Date().toISOString(), ...entry };
    state.syncAudit.unshift(audit);
    state.syncAudit = state.syncAudit.slice(0, MAX_AUDIT_ENTRIES);
    return audit;
}

export function getSyncOutboxSummary(state) {
    const outbox = ensureSyncOutbox(state);
    const pending = outbox.items.filter(item => item.status !== 'sending');
    const latest = state.syncAudit?.[0] || null;
    return { pendingCount: pending.length, sendingCount: outbox.items.length - pending.length, latest, lastError: pending.find(item => item.lastError)?.lastError || null };
}
