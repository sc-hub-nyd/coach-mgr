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

export function ensureFieldPeriod(match, periodIndex = 0) {
    if (!match.formations) match.formations = [];
    while (match.formations.length <= periodIndex) {
        match.formations.push(createFieldPeriod());
    }
    const period = match.formations[periodIndex];
    if (!period.goalRecords) period.goalRecords = [];
    if (!period.substitutions) period.substitutions = [];
    if (!period.analysisMemos) period.analysisMemos = [];
    if (!period.cardRecords) period.cardRecords = [];
    if (!period.eventHistory) period.eventHistory = [];
    if (!Number.isFinite(Number(period.fieldClockSeconds))) period.fieldClockSeconds = 0;
    if (typeof period.fieldClockRunning !== 'boolean') period.fieldClockRunning = false;
    if (!period.fieldClockStartedAt) period.fieldClockStartedAt = null;
    return period;
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

export function removeFieldEvent(period, eventId) {
    if (!period?.eventHistory) return null;
    const eventIndex = period.eventHistory.findIndex(event => event.id === eventId);
    if (eventIndex < 0) return null;
    const [event] = period.eventHistory.splice(eventIndex, 1);
    if (event.type === 'score') {
        period.scoreUs = Math.max(0, Number(period.scoreUs || 0) - 1);
        period.goalRecords = (period.goalRecords || []).filter(record => record.eventId !== eventId);
    }
    if (event.type === 'concede') {
        period.scoreThem = Math.max(0, Number(period.scoreThem || 0) - 1);
    }
    if (event.type === 'substitution') {
        period.substitutions = (period.substitutions || []).filter(record => record.eventId !== eventId);
    }
    if (event.type === 'card') {
        period.cardRecords = (period.cardRecords || []).filter(record => record.eventId !== eventId);
    }
    if (event.type === 'memo') {
        period.analysisMemos = (period.analysisMemos || []).filter(record => record.eventId !== eventId);
    }
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
