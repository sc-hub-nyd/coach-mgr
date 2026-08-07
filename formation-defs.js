// formation-defs.js
// Formation coordinate definitions extracted from drawing.js for modularity.
// Each formation defines player positions as normalized coordinates (0-1 range).

/**
 * Returns an array of player coordinate objects for the given formation key.
 * @param {string} formationKey - e.g. '3-3-1', '4-4-2', 'custom_0'
 * @param {Array} [customFormations] - Optional array of custom formation objects from state.customFormations
 * @returns {Array<{x: number, y: number, num: string}>}
 */
export function getFormationPlayerList(formationKey, customFormations) {
    const formationDefs = {
        '3-3-1': [
            { x: 0.08, y: 0.50, num: '1' },
            { x: 0.25, y: 0.22, num: '2' }, { x: 0.23, y: 0.50, num: '3' }, { x: 0.25, y: 0.78, num: '4' },
            { x: 0.55, y: 0.22, num: '5' }, { x: 0.52, y: 0.50, num: '6' }, { x: 0.55, y: 0.78, num: '7' },
            { x: 0.82, y: 0.50, num: '8' }
        ],
        '2-4-1': [
            { x: 0.08, y: 0.50, num: '1' },
            { x: 0.25, y: 0.33, num: '2' }, { x: 0.25, y: 0.67, num: '3' },
            { x: 0.55, y: 0.15, num: '4' }, { x: 0.52, y: 0.38, num: '5' }, { x: 0.52, y: 0.62, num: '6' }, { x: 0.55, y: 0.85, num: '7' },
            { x: 0.82, y: 0.50, num: '8' }
        ],
        '3-2-2': [
            { x: 0.08, y: 0.50, num: '1' },
            { x: 0.25, y: 0.22, num: '2' }, { x: 0.23, y: 0.50, num: '3' }, { x: 0.25, y: 0.78, num: '4' },
            { x: 0.52, y: 0.35, num: '5' }, { x: 0.52, y: 0.65, num: '6' },
            { x: 0.80, y: 0.35, num: '7' }, { x: 0.80, y: 0.65, num: '8' }
        ],
        '2-3-2': [
            { x: 0.08, y: 0.50, num: '1' },
            { x: 0.25, y: 0.33, num: '2' }, { x: 0.25, y: 0.67, num: '3' },
            { x: 0.55, y: 0.22, num: '4' }, { x: 0.52, y: 0.50, num: '5' }, { x: 0.55, y: 0.78, num: '6' },
            { x: 0.80, y: 0.35, num: '7' }, { x: 0.80, y: 0.65, num: '8' }
        ],
        '4-4-2': [
            { x: 0.06, y: 0.50, num: '1' },
            { x: 0.22, y: 0.15, num: '2' }, { x: 0.20, y: 0.38, num: '3' }, { x: 0.20, y: 0.62, num: '4' }, { x: 0.22, y: 0.85, num: '5' },
            { x: 0.50, y: 0.15, num: '6' }, { x: 0.48, y: 0.38, num: '7' }, { x: 0.48, y: 0.62, num: '8' }, { x: 0.50, y: 0.85, num: '9' },
            { x: 0.80, y: 0.38, num: '10' }, { x: 0.80, y: 0.62, num: '11' }
        ],
        '4-3-3': [
            { x: 0.06, y: 0.50, num: '1' },
            { x: 0.22, y: 0.15, num: '2' }, { x: 0.20, y: 0.38, num: '3' }, { x: 0.20, y: 0.62, num: '4' }, { x: 0.22, y: 0.85, num: '5' },
            { x: 0.48, y: 0.25, num: '6' }, { x: 0.45, y: 0.50, num: '7' }, { x: 0.48, y: 0.75, num: '8' },
            { x: 0.80, y: 0.15, num: '9' }, { x: 0.83, y: 0.50, num: '10' }, { x: 0.80, y: 0.85, num: '11' }
        ]
    };

    let playerList = formationDefs[formationKey];
    if (!playerList && formationKey && formationKey.startsWith('custom_')) {
        const idx = parseInt(formationKey.replace('custom_', ''), 10);
        const customForm = customFormations ? customFormations[idx] : null;
        if (customForm && customForm.coords) {
            playerList = customForm.coords.map((c, i) => ({
                x: (100 - (typeof c.y !== 'undefined' ? c.y : 50)) / 100,
                y: (typeof c.x !== 'undefined' ? c.x : 50) / 100,
                num: String(i + 1)
            }));
        }
    }
    return playerList || formationDefs['3-3-1'];
}

/**
 * Returns an array of all available formation keys (built-in).
 * @returns {string[]}
 */
export function getBuiltInFormationKeys() {
    return ['3-3-1', '2-4-1', '3-2-2', '2-3-2', '4-4-2', '4-3-3'];
}
