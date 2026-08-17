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

export const PARENT_ACCESS_SCOPES = Object.freeze([
    { id: 'schedule', label: '予定・試合結果' },
    { id: 'attendance', label: '出欠状況' },
    { id: 'development', label: '本人の成長ログ' }
]);

function normalizeScopes(scopes) {
    const allowed = new Set(PARENT_ACCESS_SCOPES.map(scope => scope.id));
    const values = Array.isArray(scopes) ? scopes : [];
    const normalized = [...new Set(values.filter(scope => allowed.has(scope)))];
    return normalized.length ? normalized : ['schedule', 'attendance', 'development'];
}

export function ensureParentAccessRegistry(teamInfo = {}) {
    if (!teamInfo.parentAccess || typeof teamInfo.parentAccess !== 'object') teamInfo.parentAccess = { version: 1, invites: [] };
    if (!Array.isArray(teamInfo.parentAccess.invites)) teamInfo.parentAccess.invites = [];
    if (!teamInfo.parentAccess.version) teamInfo.parentAccess.version = 1;
    return teamInfo.parentAccess;
}

export function createParentAccessInvite(teamInfo, { playerId, label = '', scopes, expiresAt = '' } = {}) {
    if (playerId === null || playerId === undefined || playerId === '') throw new Error('対象選手を選択してください');
    const registry = ensureParentAccessRegistry(teamInfo);
    const now = new Date().toISOString();
    const invite = {
        id: `parent-${randomToken().slice(0, 16)}`,
        token: randomToken(),
        playerId: String(playerId),
        label: String(label || '').trim(),
        scopes: normalizeScopes(scopes),
        expiresAt: String(expiresAt || ''),
        status: 'active',
        createdAt: now,
        revokedAt: null,
        lastUsedAt: null
    };
    registry.invites.unshift(invite);
    return invite;
}

export function revokeParentAccessInvite(teamInfo, inviteId) {
    const registry = ensureParentAccessRegistry(teamInfo);
    const invite = registry.invites.find(item => String(item.id) === String(inviteId));
    if (!invite) return null;
    invite.status = 'revoked';
    invite.revokedAt = new Date().toISOString();
    return invite;
}

export function getParentAccessInvite(teamInfo, { inviteId, token, now = new Date() } = {}) {
    const registry = ensureParentAccessRegistry(teamInfo || {});
    const invite = registry.invites.find(item => String(item.id) === String(inviteId) && String(item.token) === String(token));
    if (!invite || invite.status !== 'active') return null;
    if (invite.expiresAt && toTimestamp(`${invite.expiresAt}T23:59:59`) < now.getTime()) return null;
    return { ...invite, scopes: normalizeScopes(invite.scopes) };
}

export function markParentAccessUsed(teamInfo, inviteId) {
    const registry = ensureParentAccessRegistry(teamInfo || {});
    const invite = registry.invites.find(item => String(item.id) === String(inviteId));
    if (invite) invite.lastUsedAt = new Date().toISOString();
    return invite || null;
}

export function getParentAccessSummary(teamInfo = {}) {
    const registry = ensureParentAccessRegistry(teamInfo);
    const now = new Date();
    const active = registry.invites.filter(invite => invite.status === 'active' && (!invite.expiresAt || toTimestamp(`${invite.expiresAt}T23:59:59`) >= now.getTime()));
    const expired = registry.invites.filter(invite => invite.status === 'active' && invite.expiresAt && toTimestamp(`${invite.expiresAt}T23:59:59`) < now.getTime());
    return { active, expired, revoked: registry.invites.filter(invite => invite.status === 'revoked') };
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
