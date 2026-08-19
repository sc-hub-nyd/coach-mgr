import { buildPeriodComparison, buildPositionParticipation, buildCoachingRecommendations } from './insights-service.js';

export const UI_PREFERENCES_KEY = 'coachMgrUiPreferences';

export const DEFAULT_UI_PREFERENCES = Object.freeze({
    colorMode: 'light',
    fontScale: 'normal',
    reduceMotion: false,
    compactMode: false
});

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toDate(value) {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function normalizeEvents(state) {
    const matches = safeArray(state?.matches).map(item => ({ ...item, kind: 'match', title: item.opponent ? `vs ${item.opponent}` : '試合' }));
    const practices = safeArray(state?.practices).map(item => ({ ...item, kind: 'practice', title: item.title || item.name || '練習' }));
    return [...matches, ...practices].filter(item => item?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function getAttendanceCounts(event) {
    const invited = safeArray(event?.callUpPlayerIds);
    const attendance = event?.attendanceByPlayer && typeof event.attendanceByPlayer === 'object' ? event.attendanceByPlayer : {};
    const pending = invited.filter(id => attendance[String(id)]?.status === 'pending').length;
    const attending = invited.filter(id => attendance[String(id)]?.status === 'attending').length;
    return { invited: invited.length, pending, attending };
}

export function buildCoachActionCenter(state, { now = new Date() } = {}) {
    const today = dateKey(now);
    const events = normalizeEvents(state);
    const nextEvent = events.find(event => event.date >= today) || null;
    const actions = [];
    const outboxCount = safeArray(state?.syncOutbox?.items).length;

    if (outboxCount) {
        actions.push({
            id: 'sync-outbox',
            tone: 'attention',
            icon: 'fa-cloud-arrow-up',
            title: `同期を確認する（${outboxCount}件待機）`,
            description: '端末には保存済みです。クラウド受領を確認すると待機キューが完了します。',
            action: 'settings-sync'
        });
    }

    if (nextEvent) {
        const counts = getAttendanceCounts(nextEvent);
        const daysUntil = Math.max(0, Math.round((toDate(nextEvent.date) - toDate(today)) / 86400000));
        if (counts.pending) {
            actions.push({
                id: `attendance-${nextEvent.kind}-${nextEvent.id}`,
                tone: 'attention',
                icon: 'fa-user-clock',
                title: `${nextEvent.title}の出欠を確認`,
                description: `${nextEvent.date}${daysUntil === 0 ? '（本日）' : `（あと${daysUntil}日）`}・未回答 ${counts.pending}/${counts.invited}名`,
                action: nextEvent.kind === 'match' ? 'open-match' : 'open-practice',
                targetId: nextEvent.id
            });
        } else {
            actions.push({
                id: `event-${nextEvent.kind}-${nextEvent.id}`,
                tone: daysUntil === 0 ? 'primary' : 'neutral',
                icon: nextEvent.kind === 'match' ? 'fa-futbol' : 'fa-calendar-check',
                title: daysUntil === 0 ? `${nextEvent.title}は本日です` : `次の予定：${nextEvent.title}`,
                description: `${nextEvent.date}・参加予定 ${counts.attending}/${counts.invited || 0}名`,
                action: nextEvent.kind === 'match' ? 'open-match' : 'open-practice',
                targetId: nextEvent.id
            });
        }
    } else {
        actions.push({
            id: 'create-event',
            tone: 'primary',
            icon: 'fa-calendar-plus',
            title: '次の予定を作成する',
            description: '練習または試合を登録すると、招集と振り返りをつなげられます。',
            action: 'create-event'
        });
    }

    const recommendations = buildCoachingRecommendations(state, { now });
    const recommendation = recommendations.find(item => item?.state !== 'empty');
    if (recommendation) {
        actions.push({
            id: 'coaching-plan',
            tone: recommendation.tone === 'attention' ? 'attention' : 'neutral',
            icon: 'fa-clipboard-list',
            title: '次の練習案を作成する',
            description: recommendation.title,
            action: 'create-practice-plan',
            recommendation
        });
    }

    return {
        headline: actions[0]?.title || '今日の優先事項はありません',
        actions: actions.slice(0, 4),
        nextEvent
    };
}

export function buildParentHomeAgenda(state, { playerId = null, scopes = [] } = {}) {
    const today = dateKey();
    const allowed = new Set(safeArray(scopes));
    const events = normalizeEvents(state).filter(event => event.date >= today).slice(0, 3);
    const agenda = [];

    if (allowed.has('attendance')) {
        events.forEach(event => {
            const record = event?.attendanceByPlayer?.[String(playerId)] || {};
            if (record.status === 'pending') {
                agenda.push({
                    id: `rsvp-${event.kind}-${event.id}`,
                    icon: 'fa-reply',
                    title: `${event.kind === 'match' ? '試合' : '練習'}の出欠を回答`,
                    description: `${event.date} ${event.title}`,
                    action: event.kind === 'match' ? 'open-match' : 'open-practice',
                    targetId: event.id
                });
            }
        });
    }

    if (allowed.has('schedule') && events[0]) {
        agenda.push({
            id: `schedule-${events[0].kind}-${events[0].id}`,
            icon: 'fa-calendar-day',
            title: '次の予定を確認',
            description: `${events[0].date} ${events[0].title}`,
            action: events[0].kind === 'match' ? 'open-match' : 'open-practice',
            targetId: events[0].id
        });
    }

    if (allowed.has('development') && playerId) {
        agenda.push({
            id: 'development',
            icon: 'fa-seedling',
            title: '成長ログを見る',
            description: '本人の出欠・活動・振り返りを確認できます。',
            action: 'open-insights'
        });
    }

    return agenda.slice(0, 3);
}

export function buildPracticePlanDraft(state, { recommendation = null, date = '', durationMinutes = 75 } = {}) {
    const selected = recommendation || buildCoachingRecommendations(state).find(item => item?.state !== 'empty') || null;
    const theme = selected?.title || '次の練習テーマ';
    const reason = selected?.description || '記録をもとに、次の練習で確認したいテーマです。';
    const total = Math.max(30, Math.min(180, Number(durationMinutes) || 75));
    const warmup = Math.round(total * 0.2);
    const core = Math.round(total * 0.55);
    const game = total - warmup - core;
    return {
        title: theme,
        date,
        durationMinutes: total,
        source: selected ? 'coaching-recommendation' : 'manual',
        purpose: reason,
        blocks: [
            { id: 'warmup', label: '導入・ウォームアップ', minutes: warmup, note: 'テーマに必要な基礎動作と観察ポイントを共有します。' },
            { id: 'core', label: 'メインメニュー', minutes: core, note: `${theme}を小さな判断の反復で練習します。` },
            { id: 'game', label: 'ゲーム・振り返り', minutes: game, note: 'ゲーム形式で試し、できたことと次回への気づきを残します。' }
        ],
        equipment: [],
        contingency: '雨天・人数不足時は、対面パスと判断ゲームへ縮小します。'
    };
}

export function ensurePracticePlan(state) {
    if (!state.teamInfo || typeof state.teamInfo !== 'object') state.teamInfo = {};
    if (!Array.isArray(state.teamInfo.practicePlans)) state.teamInfo.practicePlans = [];
    return state.teamInfo.practicePlans;
}

export function savePracticePlan(state, draft, { now = new Date() } = {}) {
    const plans = ensurePracticePlan(state);
    const plan = {
        id: draft?.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: String(draft?.title || '練習計画').trim(),
        date: draft?.date || '',
        durationMinutes: Number(draft?.durationMinutes) || 75,
        purpose: String(draft?.purpose || '').trim(),
        blocks: safeArray(draft?.blocks).map(block => ({ ...block, minutes: Number(block.minutes) || 0 })),
        equipment: safeArray(draft?.equipment),
        contingency: String(draft?.contingency || '').trim(),
        source: draft?.source || 'manual',
        updatedAt: now.toISOString()
    };
    const index = plans.findIndex(item => item.id === plan.id);
    if (index >= 0) plans[index] = plan;
    else plans.unshift(plan);
    return plan;
}

export function buildDecisionCards(state, { rangeDays = 30, now = new Date() } = {}) {
    const comparison = buildPeriodComparison(state, { days: rangeDays, now });
    const positions = buildPositionParticipation(state, { days: rangeDays, now });
    const recommendations = buildCoachingRecommendations(state, { days: rangeDays, now });
    const cards = [];

    const activityCount = Number(comparison?.current?.matches || 0) + Number(comparison?.current?.practices || 0);
    if (activityCount) {
        const delta = Number(comparison?.deltas?.goalDifference || 0);
        cards.push({
            id: 'period-comparison',
            tone: delta < 0 ? 'attention' : 'positive',
            icon: delta < 0 ? 'fa-arrow-trend-down' : 'fa-chart-line',
            title: `得失点差 ${comparison.current.goalDifference >= 0 ? '+' : ''}${comparison.current.goalDifference}`,
            evidence: `直近${rangeDays}日・活動 ${activityCount}件。前期間比 ${delta >= 0 ? '+' : ''}${delta}。`,
            actionLabel: '振り返りを開く',
            action: 'open-insights'
        });
    }

    const lowestPosition = safeArray(positions).sort((a, b) => Number(a.minutes || 0) - Number(b.minutes || 0))[0];
    if (lowestPosition && Number(lowestPosition.minutes || 0) > 0) {
        cards.push({
            id: 'position-load',
            tone: 'neutral',
            icon: 'fa-people-arrows-left-right',
            title: `${lowestPosition.position}の出場経験を確認`,
            evidence: `${lowestPosition.minutes}分・${lowestPosition.playerCount}名の記録があります。出場記録が少ない選手のローテーションを確認します。`,
            actionLabel: '試合記録を開く',
            action: 'open-matches'
        });
    }

    recommendations.filter(item => item?.state !== 'empty').slice(0, 2).forEach((item, index) => {
        cards.push({
            id: `recommendation-${index}`,
            tone: item.tone || 'neutral',
            icon: 'fa-clipboard-check',
            title: item.title,
            evidence: item.description || item.reason || '直近の記録をもとにした練習提案です。',
            actionLabel: '練習案を作る',
            action: 'create-practice-plan',
            recommendation: item
        });
    });

    return cards.slice(0, 4);
}

export function loadUiPreferences(storage = globalThis.localStorage) {
    try {
        const parsed = JSON.parse(storage?.getItem?.(UI_PREFERENCES_KEY) || '{}');
        return { ...DEFAULT_UI_PREFERENCES, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch (_error) {
        return { ...DEFAULT_UI_PREFERENCES };
    }
}

export function saveUiPreferences(preferences, storage = globalThis.localStorage) {
    const next = { ...DEFAULT_UI_PREFERENCES, ...(preferences && typeof preferences === 'object' ? preferences : {}) };
    storage?.setItem?.(UI_PREFERENCES_KEY, JSON.stringify(next));
    return next;
}

export function applyUiPreferences(preferences, root = document.documentElement) {
    const next = { ...DEFAULT_UI_PREFERENCES, ...(preferences && typeof preferences === 'object' ? preferences : {}) };
    if (!root) return next;
    root.dataset.colorMode = next.colorMode === 'dark' ? 'dark' : 'light';
    root.dataset.fontScale = ['normal', 'large', 'xlarge'].includes(next.fontScale) ? next.fontScale : 'normal';
    root.dataset.reduceMotion = next.reduceMotion ? 'true' : 'false';
    root.dataset.compactMode = next.compactMode ? 'true' : 'false';
    return next;
}
