// event-manager.js
// Centralized event listener registration and cleanup manager.
// Each listener is registered with a "scope" (typically the view/route name).
// On route navigation, cleanupScope(previousRoute) removes all listeners for that scope.

const listenerRegistry = new Map(); // scope -> Set of { element, event, handler, options }

/**
 * Register an event listener with a named scope for automatic cleanup.
 * @param {string} scope - The scope name (e.g., 'matches', 'practices', 'drawing')
 * @param {EventTarget} element - The DOM element or document/window to attach to
 * @param {string} event - The event type (e.g., 'click', 'keydown')
 * @param {Function} handler - The event handler function
 * @param {Object|boolean} [options] - Optional addEventListener options
 */
export function registerListener(scope, element, event, handler, options) {
    if (!listenerRegistry.has(scope)) {
        listenerRegistry.set(scope, new Set());
    }
    element.addEventListener(event, handler, options);
    listenerRegistry.get(scope).add({ element, event, handler, options });
}

/**
 * Remove all event listeners registered under the given scope.
 * @param {string} scope - The scope to clean up
 */
export function cleanupScope(scope) {
    const listeners = listenerRegistry.get(scope);
    if (!listeners) return;
    for (const entry of listeners) {
        entry.element.removeEventListener(entry.event, entry.handler, entry.options);
    }
    listeners.clear();
    listenerRegistry.delete(scope);
}

/**
 * Remove all event listeners across all scopes.
 */
export function cleanupAll() {
    for (const [scope] of listenerRegistry) {
        cleanupScope(scope);
    }
}

/**
 * Get the count of registered listeners for a scope (useful for debugging).
 * @param {string} scope
 * @returns {number}
 */
export function getListenerCount(scope) {
    const listeners = listenerRegistry.get(scope);
    return listeners ? listeners.size : 0;
}
