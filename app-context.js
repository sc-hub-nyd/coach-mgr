let actions = {};

export function configureAppContext(nextActions) {
    actions = { ...actions, ...nextActions };
}

function requireAction(name) {
    const action = actions[name];
    if (typeof action !== 'function') {
        throw new Error(`App context action is not configured: ${name}`);
    }
    return action;
}

export const saveData = (...args) => requireAction('saveData')(...args);
export const navigate = (...args) => requireAction('navigate')(...args);
export const openModal = (...args) => requireAction('openModal')(...args);
export const loadData = (...args) => requireAction('loadData')(...args);
export const updateRoleUI = (...args) => requireAction('updateRoleUI')(...args);
export const syncPushGasCloud = (...args) => requireAction('syncPushGasCloud')(...args);
export const syncPullGasCloud = (...args) => requireAction('syncPullGasCloud')(...args);
export const clearAllMiniPitchIntervals = (...args) => requireAction('clearAllMiniPitchIntervals')(...args);
