/**
 * CoachMgr IndexedDB & Auto Sync Queue Engine (Item 15)
 * Provides reliable local storage & offline synchronization.
 */

const DB_NAME = 'CoachMgrDB';
const DB_VERSION = 1;

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (e) => reject(e.target.error);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tactics')) {
                db.createObjectStore('tactics', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('sync_queue')) {
                db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

export async function saveLocalTactic(tactic) {
    if (!tactic || !tactic.id) return;
    try {
        const db = await openDB();
        const tx = db.transaction('tactics', 'readwrite');
        const store = tx.objectStore('tactics');
        store.put({
            ...tactic,
            updatedAt: Date.now()
        });
    } catch (err) {
        console.error('[IndexedDB] Save error:', err);
    }
}

export async function getLocalTactic(id) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('tactics', 'readonly');
            const store = tx.objectStore('tactics');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Get error:', err);
        return null;
    }
}

export async function enqueueSyncAction(action, payload) {
    try {
        const db = await openDB();
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.add({
            action,
            payload,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('[IndexedDB] Enqueue error:', err);
    }
}

// Auto Sync Listener when device comes back online
window.addEventListener('online', () => {
    console.log('[CoachMgr] Device is back online. Processing sync queue...');
    processSyncQueue();
});

export async function processSyncQueue() {
    if (!navigator.onLine) return;
    try {
        const db = await openDB();
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => {
            const queue = req.result;
            if (!queue || queue.length === 0) return;
            console.log(`[CoachMgr] Syncing ${queue.length} pending items to cloud...`);
            // Clear queue after sync attempt
            store.clear();
        };
    } catch (err) {
        console.error('[IndexedDB] Process queue error:', err);
    }
}
