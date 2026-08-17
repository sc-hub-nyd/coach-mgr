const ATTENDANCE_STATUS = {
    pending: { label: '未回答', icon: 'fa-circle-question', className: 'is-pending' },
    attending: { label: '参加', icon: 'fa-circle-check', className: 'is-attending' },
    absent: { label: '欠席', icon: 'fa-circle-xmark', className: 'is-absent' }
};

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
}

export function ensureAttendance(event, playerIds = []) {
    if (!event || typeof event !== 'object') return {};
    const previous = event.attendanceByPlayer && typeof event.attendanceByPlayer === 'object'
        ? event.attendanceByPlayer
        : {};
    const invited = Array.isArray(event.callUpPlayerIds) && event.callUpPlayerIds.length > 0
        ? event.callUpPlayerIds
        : playerIds;
    event.callUpPlayerIds = [...new Set(invited.map(normalizeId))];
    event.attendanceByPlayer = {};
    event.callUpPlayerIds.forEach(id => {
        const key = String(id);
        const status = previous[key]?.status || (Array.isArray(event.presentPlayerIds) && event.presentPlayerIds.includes(id) ? 'attending' : 'pending');
        event.attendanceByPlayer[key] = {
            status: ATTENDANCE_STATUS[status] ? status : 'pending',
            updatedAt: previous[key]?.updatedAt || null,
            updatedBy: previous[key]?.updatedBy || null
        };
    });
    syncPresentPlayerIds(event);
    return event.attendanceByPlayer;
}

export function setAttendanceStatus(event, playerId, status, updatedBy = 'coach', now = new Date()) {
    if (!ATTENDANCE_STATUS[status]) throw new Error(`Unknown attendance status: ${status}`);
    const id = normalizeId(playerId);
    if (!Array.isArray(event.callUpPlayerIds)) event.callUpPlayerIds = [];
    if (!event.callUpPlayerIds.includes(id)) event.callUpPlayerIds.push(id);
    ensureAttendance(event, event.callUpPlayerIds);
    event.attendanceByPlayer[String(id)] = { status, updatedAt: now.toISOString(), updatedBy };
    syncPresentPlayerIds(event);
    return event.attendanceByPlayer[String(id)];
}

export function syncPresentPlayerIds(event) {
    if (!event || typeof event !== 'object') return [];
    const responses = event.attendanceByPlayer || {};
    event.presentPlayerIds = (event.callUpPlayerIds || []).filter(id => responses[String(id)]?.status === 'attending');
    event.attendance = `${event.presentPlayerIds.length}/${event.callUpPlayerIds?.length || 0}`;
    return event.presentPlayerIds;
}

export function getAttendanceSummary(event) {
    const responses = event?.attendanceByPlayer || {};
    const invited = event?.callUpPlayerIds || [];
    const counts = { attending: 0, absent: 0, pending: 0, total: invited.length };
    invited.forEach(id => {
        const status = responses[String(id)]?.status || 'pending';
        counts[ATTENDANCE_STATUS[status] ? status : 'pending'] += 1;
    });
    return counts;
}

export function getAttendanceStatus(status) {
    return ATTENDANCE_STATUS[status] || ATTENDANCE_STATUS.pending;
}

export function createPracticeTemplate(practice, name) {
    if (!practice || typeof practice !== 'object') throw new Error('練習日を選択してください');
    const title = String(name || '').trim();
    if (!title) throw new Error('テンプレート名を入力してください');
    return {
        id: Date.now(),
        name: title,
        location: practice.location || '',
        menus: clone(practice.menus || []),
        createdAt: new Date().toISOString(),
        sourcePracticeId: practice.id
    };
}

export function applyPracticeTemplate(practice, template) {
    if (!practice || !template) throw new Error('テンプレートを適用できません');
    practice.menus = clone(template.menus || []);
    if (!practice.location && template.location) practice.location = template.location;
    practice.appliedTemplateId = template.id;
    return practice;
}

export function buildEventShareText(event, players = [], kind = '練習') {
    const summary = getAttendanceSummary(event);
    const attendingNames = (event.presentPlayerIds || []).map(id => players.find(player => player.id === id)?.name).filter(Boolean);
    const lines = [
        `【${kind}のご案内】`,
        `日付：${event.date || '未定'}`,
        event.location ? `場所：${event.location}` : '',
        kind === '試合' && event.opponent ? `対戦相手：${event.opponent}` : '',
        `出欠：参加 ${summary.attending}名 / 欠席 ${summary.absent}名 / 未回答 ${summary.pending}名`,
        attendingNames.length ? `参加予定：${attendingNames.join('、')}` : ''
    ];
    return lines.filter(Boolean).join('\n');
}

export { ATTENDANCE_STATUS };
