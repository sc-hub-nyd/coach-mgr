import { getAttendanceSummary } from './team-operations-service.js';

function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function randomToken() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function ensureParentShareSettings(teamInfo = {}) {
    if (!teamInfo.parentShare || typeof teamInfo.parentShare !== 'object') {
        teamInfo.parentShare = { version: 1, token: randomToken(), expiresAt: '' };
    }
    if (!teamInfo.parentShare.version) teamInfo.parentShare.version = 1;
    if (!teamInfo.parentShare.token) teamInfo.parentShare.token = randomToken();
    if (typeof teamInfo.parentShare.expiresAt !== 'string') teamInfo.parentShare.expiresAt = '';
    return teamInfo.parentShare;
}

export function rotateParentShareLink(teamInfo, { expiresAt = '' } = {}) {
    const settings = ensureParentShareSettings(teamInfo);
    settings.version = Number(settings.version || 0) + 1;
    settings.token = randomToken();
    settings.expiresAt = String(expiresAt || '');
    settings.rotatedAt = new Date().toISOString();
    return settings;
}

export function isParentShareValid(teamInfo, { version, token, now = new Date() } = {}) {
    const settings = ensureParentShareSettings(teamInfo || {});
    if (String(version || '') !== String(settings.version)) return false;
    if (String(token || '') !== String(settings.token)) return false;
    if (settings.expiresAt && toTimestamp(`${settings.expiresAt}T23:59:59`) < now.getTime()) return false;
    return true;
}

export function getRsvpDeadlineStatus(event, { now = new Date() } = {}) {
    const deadline = event?.rsvpDeadline || '';
    const summary = getAttendanceSummary(event);
    const pending = summary.pending;
    if (!deadline) return { deadline: '', pending, status: pending ? 'attention' : 'ready', label: pending ? `未回答 ${pending}名（期限未設定）` : '全員回答済み' };
    const overdue = toTimestamp(`${deadline}T23:59:59`) < now.getTime();
    return {
        deadline,
        pending,
        overdue,
        status: pending && overdue ? 'overdue' : pending ? 'attention' : 'ready',
        label: pending ? `未回答 ${pending}名 ・ 回答期限 ${deadline}${overdue ? '（期限超過）' : ''}` : `回答完了 ・ 期限 ${deadline}`
    };
}

export function buildRsvpReminderText(event, players = [], kind = '予定') {
    const summary = getAttendanceSummary(event);
    const pendingNames = (event?.callUpPlayerIds || [])
        .filter(id => event?.attendanceByPlayer?.[String(id)]?.status === 'pending')
        .map(id => players.find(player => Number(player.id) === Number(id))?.name)
        .filter(Boolean);
    const lines = [
        `【${kind}の出欠確認】`,
        event?.date ? `日付：${event.date}` : '',
        event?.opponent ? `対戦相手：${event.opponent}` : '',
        event?.location ? `場所：${event.location}` : '',
        event?.rsvpDeadline ? `回答期限：${event.rsvpDeadline}` : '回答期限：未設定',
        `未回答：${summary.pending}名`,
        pendingNames.length ? `対象：${pendingNames.join('、')}` : '',
        '',
        'ご都合を確認のうえ、参加または欠席のご回答をお願いします。'
    ];
    return lines.filter(line => line !== undefined).join('\n');
}

export function buildPendingRsvpDigest(events = [], players = [], now = new Date()) {
    const pendingEvents = events
        .map(event => ({ event, status: getRsvpDeadlineStatus(event, { now }) }))
        .filter(item => item.status.pending > 0)
        .sort((a, b) => String(a.event.date || '').localeCompare(String(b.event.date || '')));
    const lines = ['【未回答RSVP一覧】'];
    pendingEvents.forEach(({ event, status }) => {
        lines.push(`${event.date || '日付未定'} ${event.opponent ? `vs ${event.opponent}` : event.location ? `練習（${event.location}）` : '予定'}：未回答 ${status.pending}名${status.deadline ? ` / 期限 ${status.deadline}${status.overdue ? '（期限超過）' : ''}` : ''}`);
    });
    if (!pendingEvents.length) lines.push('未回答の予定はありません。');
    return { text: lines.join('\n'), pendingEvents };
}
