function createFieldPeriod() {
    return {
        id: Date.now(),
        name: '試合中記録',
        system: '',
        scoreUs: 0,
        scoreThem: 0,
        goalRecords: [],
        substitutions: [],
        pkKickerRecords: [],
        videoUrl: '',
        videoUrls: [],
        lineup: [],
        initialActivePlayerIds: [],
        positionChanges: [],
        analysisMemos: [],
        cardRecords: [],
        eventHistory: [],
        fieldClockSeconds: 0,
        fieldClockRunning: false,
        fieldClockStartedAt: null,
        summary: '',
        boardData: []
    };
}

function normalizeId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
}

function uniqueIds(ids = []) {
    return [...new Set(ids.filter(id => id !== null && id !== undefined && id !== '').map(normalizeId))];
}

function lineupPlayerIds(period) {
    if (Array.isArray(period?.lineup) && period.lineup.length) {
        return uniqueIds(period.lineup.map(item => typeof item === 'object' ? item.playerId : item));
    }
    return uniqueIds(Object.values(period?.positions || {}));
}

export function ensureFieldPeriod(match, periodIndex = 0) {
    if (!match.formations) match.formations = [];
    while (match.formations.length <= periodIndex) {
        match.formations.push(createFieldPeriod());
    }
    const period = match.formations[periodIndex];
    if (!period.goalRecords) period.goalRecords = [];
    if (!period.substitutions) period.substitutions = [];
    if (!period.positionChanges) period.positionChanges = [];
    if (!period.analysisMemos) period.analysisMemos = [];
    if (!period.cardRecords) period.cardRecords = [];
    if (!period.eventHistory) period.eventHistory = [];
    if (!Array.isArray(period.initialActivePlayerIds)) period.initialActivePlayerIds = lineupPlayerIds(period);
    if (!Number.isFinite(Number(period.fieldClockSeconds))) period.fieldClockSeconds = 0;
    if (typeof period.fieldClockRunning !== 'boolean') period.fieldClockRunning = false;
    if (!period.fieldClockStartedAt) period.fieldClockStartedAt = null;
    return period;
}

export function initializeFieldRoster(period, playerIds = []) {
    if (!Array.isArray(period.initialActivePlayerIds) || period.initialActivePlayerIds.length === 0) {
        period.initialActivePlayerIds = lineupPlayerIds(period);
    }
    const registeredIds = uniqueIds(playerIds);
    period.initialActivePlayerIds = uniqueIds(period.initialActivePlayerIds).filter(id => !registeredIds.length || registeredIds.includes(id));
    return getCurrentFieldRoster(period, registeredIds);
}

export function getCurrentFieldRoster(period, playerIds = []) {
    const registeredIds = uniqueIds(playerIds);
    const initial = uniqueIds(period?.initialActivePlayerIds?.length ? period.initialActivePlayerIds : lineupPlayerIds(period));
    const active = new Set(initial);
    const substitutions = (period?.eventHistory || [])
        .filter(event => event.type === 'substitution')
        .sort((a, b) => Number(a.elapsedSeconds || 0) - Number(b.elapsedSeconds || 0));
    substitutions.forEach(event => {
        const playerOutId = normalizeId(event.playerOutId);
        const playerInId = normalizeId(event.playerInId);
        if (playerOutId !== null && playerOutId !== undefined) active.delete(playerOutId);
        if (playerInId !== null && playerInId !== undefined) active.add(playerInId);
    });
    const activePlayerIds = [...active];
    const playerPool = registeredIds.length ? registeredIds : uniqueIds([...initial, ...substitutions.flatMap(event => [event.playerOutId, event.playerInId])]);
    return {
        activePlayerIds,
        benchPlayerIds: playerPool.filter(id => !active.has(id)),
        initialActivePlayerIds: initial
    };
}

export function getFieldPlayingSeconds(period, playerIds = [], now = Date.now()) {
    const ids = uniqueIds(playerIds);
    const secondsByPlayer = Object.fromEntries(ids.map(id => [String(id), 0]));
    const roster = getCurrentFieldRoster({ ...period, eventHistory: [] }, ids);
    const active = new Set(roster.activePlayerIds);
    const substitutions = (period?.eventHistory || [])
        .filter(event => event.type === 'substitution')
        .sort((a, b) => Number(a.elapsedSeconds || 0) - Number(b.elapsedSeconds || 0));
    let cursor = 0;
    const closeSegment = end => {
        const duration = Math.max(0, Number(end || 0) - cursor);
        active.forEach(id => { secondsByPlayer[String(id)] = (secondsByPlayer[String(id)] || 0) + duration; });
        cursor = Math.max(cursor, Number(end || 0));
    };
    substitutions.forEach(event => {
        closeSegment(event.elapsedSeconds);
        active.delete(normalizeId(event.playerOutId));
        active.add(normalizeId(event.playerInId));
    });
    closeSegment(getFieldClockSeconds(period, now));
    return secondsByPlayer;
}

export function getFieldClockSeconds(period, now = Date.now()) {
    const base = Number(period?.fieldClockSeconds || 0);
    if (!period?.fieldClockRunning || !period.fieldClockStartedAt) return base;
    const elapsed = Math.max(0, Math.floor((now - new Date(period.fieldClockStartedAt).getTime()) / 1000));
    return base + elapsed;
}

export function appendFieldEvent(period, event, now = new Date()) {
    if (!period.eventHistory) period.eventHistory = [];
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `event-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
        id,
        recordedAt: now.toISOString(),
        elapsedSeconds: getFieldClockSeconds(period, now.getTime()),
        ...event
    };
    period.eventHistory.push(record);
    return record;
}

export function recordFieldSubstitution(period, playerOutId, playerInId, playerIds = [], now = new Date()) {
    const roster = initializeFieldRoster(period, playerIds);
    const outId = normalizeId(playerOutId);
    const inId = normalizeId(playerInId);
    if (!roster.activePlayerIds.includes(outId)) throw new Error('OUT選手は現在出場中の選手から選択してください');
    if (roster.activePlayerIds.includes(inId)) throw new Error('IN選手はベンチの選手から選択してください');
    const event = appendFieldEvent(period, { type: 'substitution', playerOutId: outId, playerInId: inId }, now);
    period.substitutions.push({ playerOutId: outId, playerInId: inId, eventId: event.id, elapsedSeconds: event.elapsedSeconds });
    return event;
}

export function recordFieldPositionChange(period, playerId, position, now = new Date()) {
    const event = appendFieldEvent(period, { type: 'position', playerId: normalizeId(playerId), position: String(position || '').trim() }, now);
    period.positionChanges.push({ playerId: event.playerId, position: event.position, eventId: event.id, elapsedSeconds: event.elapsedSeconds });
    return event;
}

export function removeFieldEvent(period, eventId) {
    if (!period?.eventHistory) return null;
    const eventIndex = period.eventHistory.findIndex(event => event.id === eventId);
    if (eventIndex < 0) return null;
    const [event] = period.eventHistory.splice(eventIndex, 1);
    if (event.type === 'score') {
        period.scoreUs = Math.max(0, Number(period.scoreUs || 0) - 1);
        period.goalRecords = (period.goalRecords || []).filter(record => record.eventId !== eventId);
    }
    if (event.type === 'concede') period.scoreThem = Math.max(0, Number(period.scoreThem || 0) - 1);
    if (event.type === 'substitution') period.substitutions = (period.substitutions || []).filter(record => record.eventId !== eventId);
    if (event.type === 'position') period.positionChanges = (period.positionChanges || []).filter(record => record.eventId !== eventId);
    if (event.type === 'card') period.cardRecords = (period.cardRecords || []).filter(record => record.eventId !== eventId);
    if (event.type === 'memo') period.analysisMemos = (period.analysisMemos || []).filter(record => record.eventId !== eventId);
    return event;
}

export function setFieldClockRunning(period, running, now = new Date()) {
    if (running) {
        period.fieldClockRunning = true;
        period.fieldClockStartedAt = now.toISOString();
    } else {
        period.fieldClockSeconds = getFieldClockSeconds(period, now.getTime());
        period.fieldClockRunning = false;
        period.fieldClockStartedAt = null;
    }
    return period;
}
