let wakeLockSentinel = null;
let fieldSessionActive = false;
let visibilityHandlerBound = false;

function getNavigator(navigatorRef) {
    return navigatorRef || globalThis.navigator || null;
}

function getDocument(documentRef) {
    return documentRef || globalThis.document || null;
}

export async function setFieldSessionActive(active, { navigatorRef, documentRef } = {}) {
    fieldSessionActive = Boolean(active);
    const nav = getNavigator(navigatorRef);
    const doc = getDocument(documentRef);

    if (!fieldSessionActive) {
        if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
            try { await wakeLockSentinel.release(); } catch (_error) { }
        }
        wakeLockSentinel = null;
        return false;
    }

    if (wakeLockSentinel || !nav?.wakeLock?.request || doc?.visibilityState === 'hidden') return Boolean(wakeLockSentinel);
    try {
        wakeLockSentinel = await nav.wakeLock.request('screen');
        wakeLockSentinel?.addEventListener?.('release', () => {
            wakeLockSentinel = null;
        });
        return true;
    } catch (_error) {
        wakeLockSentinel = null;
        return false;
    }
}

export function bindFieldSessionVisibility({ navigatorRef, documentRef } = {}) {
    const doc = getDocument(documentRef);
    if (!doc || visibilityHandlerBound || typeof doc.addEventListener !== 'function') return;
    visibilityHandlerBound = true;
    doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'visible' && fieldSessionActive) {
            void setFieldSessionActive(true, { navigatorRef, documentRef: doc });
        }
    });
}

export function triggerFieldHaptic(kind = 'record', { navigatorRef } = {}) {
    const patterns = {
        timerStart: [12],
        timerStop: [8, 30, 8],
        record: [12, 24, 12],
        caution: [20, 35, 20],
        undo: [10, 30, 10]
    };
    const nav = getNavigator(navigatorRef);
    if (!nav || typeof nav.vibrate !== 'function') return false;
    try {
        return Boolean(nav.vibrate(patterns[kind] || patterns.record));
    } catch (_error) {
        return false;
    }
}

export function isFieldWakeLockActive() {
    return Boolean(wakeLockSentinel);
}

export async function resetFieldSessionForTest() {
    await setFieldSessionActive(false);
    fieldSessionActive = false;
    visibilityHandlerBound = false;
}
