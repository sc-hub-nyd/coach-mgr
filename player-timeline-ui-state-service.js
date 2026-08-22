const playerTimelineStates = new Map();

export function getPlayerTimelineUiState(playerId, defaults = {}) {
    const key = String(playerId);
    if (!playerTimelineStates.has(key)) playerTimelineStates.set(key, { ...defaults });
    return playerTimelineStates.get(key);
}

export function patchPlayerTimelineUiState(playerId, patch) {
    const state = getPlayerTimelineUiState(playerId);
    Object.assign(state, patch);
    return state;
}

export function resetPlayerTimelineUiState(playerId) {
    playerTimelineStates.delete(String(playerId));
}
