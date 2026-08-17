import { getFieldPlayingSeconds } from './field-companion-service.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStatus(event, playerId) {
    const status = event?.attendanceByPlayer?.[String(playerId)]?.status;
    if (['attending', 'absent', 'pending'].includes(status)) return status;
    return asArray(event?.presentPlayerIds).includes(playerId) ? 'attending' : 'pending';
}

function dateInRange(date, days, now = new Date()) {
    if (!days || days === 'all') return true;
    const eventTime = toTimestamp(date);
    if (!eventTime) return false;
    const from = now.getTime() - (Number(days) * 24 * 60 * 60 * 1000);
    return eventTime >= from && eventTime <= now.getTime();
}

function getMatchEvents(match) {
    return asArray(match?.formations).flatMap((period, periodIndex) => {
        const history = asArray(period?.eventHistory);
        const rawEvents = history.length ? history : asArray(period?.goalRecords).map((goal, index) => ({
            id: `legacy-goal-${match.id}-${periodIndex}-${index}`,
            type: goal.isOpponent || goal.isConcede ? 'concede' : 'score',
            scorerId: goal.scorerId || goal.playerId || null,
            assistId: goal.assistId || null,
            occurredAt: goal.occurredAt || null
        }));
        return rawEvents.map(event => ({
            ...event,
            periodIndex,
            date: match.date,
            matchId: match.id,
            opponent: match.opponent || '対戦相手未設定',
            typeLabel: '試合'
        }));
    });
}

function getPracticeEvents(practice) {
    return asArray(practice?.menus).map(menu => ({
        id: `practice-${practice.id}-${menu.id}`,
        type: 'practice-menu',
        date: practice.date,
        practiceId: practice.id,
        focus: menu.focus || '練習メニュー',
        location: practice.location || '',
        typeLabel: '練習'
    }));
}

function resolveMatchScore(match) {
    let us = 0;
    let them = 0;
    asArray(match?.formations).forEach(period => {
        asArray(period?.eventHistory).forEach(event => {
            if (event.type === 'score') us += 1;
            if (event.type === 'concede') them += 1;
        });
        if (asArray(period?.eventHistory).length === 0) {
            us += asArray(period?.goalRecords).filter(goal => !goal.isOpponent && !goal.isConcede).length;
            them += asArray(period?.goalRecords).filter(goal => goal.isOpponent || goal.isConcede).length;
        }
    });
    return { us, them };
}

export function buildTeamInsights(state, { days = 90, now = new Date() } = {}) {
    const matches = asArray(state?.matches).filter(match => dateInRange(match.date, days, now));
    const practices = asArray(state?.practices).filter(practice => dateInRange(practice.date, days, now));
    const matchEvents = matches.flatMap(getMatchEvents);
    const practiceEvents = practices.flatMap(getPracticeEvents);
    const goals = matchEvents.filter(event => event.type === 'score').length;
    const conceded = matchEvents.filter(event => event.type === 'concede').length;
    const cards = matchEvents.filter(event => event.type === 'card').length;
    const attendance = { attending: 0, absent: 0, pending: 0 };
    [...matches, ...practices].forEach(event => {
        Object.values(event.attendanceByPlayer || {}).forEach(response => {
            const status = response?.status;
            if (attendance[status] !== undefined) attendance[status] += 1;
        });
    });
    const results = matches.reduce((summary, match) => {
        const score = resolveMatchScore(match);
        if (score.us > score.them) summary.wins += 1;
        else if (score.us < score.them) summary.losses += 1;
        else summary.draws += 1;
        return summary;
    }, { wins: 0, draws: 0, losses: 0 });
    const timeline = [...matchEvents, ...practiceEvents]
        .sort((a, b) => toTimestamp(b.occurredAt || b.date) - toTimestamp(a.occurredAt || a.date))
        .slice(0, 24);

    return {
        rangeDays: days,
        matches: matches.length,
        practices: practices.length,
        goals,
        conceded,
        goalDifference: goals - conceded,
        cards,
        attendance,
        results,
        timeline
    };
}

export function buildPlayerInsights(state, playerId, { days = 90 } = {}) {
    const id = Number(playerId);
    const player = asArray(state?.players).find(item => Number(item.id) === id);
    const matches = asArray(state?.matches).filter(match => dateInRange(match.date, days));
    const practices = asArray(state?.practices).filter(practice => dateInRange(practice.date, days));
    const attendance = { invited: 0, attending: 0, absent: 0, pending: 0, matches: 0, practices: 0 };
    const activities = [];

    [...matches, ...practices].forEach(event => {
        const invited = asArray(event.callUpPlayerIds).some(value => Number(value) === id)
            || asArray(event.presentPlayerIds).some(value => Number(value) === id);
        if (!invited) return;
        const status = getStatus(event, id);
        attendance.invited += 1;
        attendance[status] += 1;
        if (matches.includes(event)) attendance.matches += 1;
        else attendance.practices += 1;
        activities.push({
            kind: matches.includes(event) ? 'match-attendance' : 'practice-attendance',
            date: event.date,
            status,
            title: matches.includes(event) ? `vs ${event.opponent || '対戦相手未設定'}` : `${event.location || '練習'}の練習`,
            id: event.id
        });
    });

    let goals = 0;
    let assists = 0;
    let cards = 0;
    let substitutionsIn = 0;
    let substitutionsOut = 0;
    matches.forEach(match => {
        getMatchEvents(match).forEach(event => {
            if (Number(event.scorerId) === id && event.type === 'score') {
                goals += 1;
                activities.push({ kind: 'goal', date: match.date, title: `vs ${match.opponent || '対戦相手未設定'}で得点`, id: event.id });
            }
            if (Number(event.assistId) === id) assists += 1;
            if (Number(event.playerId) === id && event.type === 'card') cards += 1;
            if (Number(event.playerInId) === id && event.type === 'substitution') substitutionsIn += 1;
            if (Number(event.playerOutId) === id && event.type === 'substitution') substitutionsOut += 1;
        });
    });
    const attendanceRate = attendance.invited ? Math.round((attendance.attending / attendance.invited) * 100) : 0;
    return {
        player,
        attendance: { ...attendance, rate: attendanceRate },
        performance: { goals, assists, cards, substitutionsIn, substitutionsOut },
        activities: activities.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date)).slice(0, 30)
    };
}

export function getTimelinePresentation(event, players = []) {
    const findPlayer = id => players.find(player => Number(player.id) === Number(id))?.name || '選手未指定';
    const typeMap = {
        score: { icon: 'fa-futbol', label: `${findPlayer(event.scorerId)}が得点`, className: 'is-positive' },
        concede: { icon: 'fa-arrow-down', label: '失点', className: 'is-negative' },
        substitution: { icon: 'fa-arrows-rotate', label: `${findPlayer(event.playerOutId)} → ${findPlayer(event.playerInId)}`, className: 'is-neutral' },
        card: { icon: 'fa-square', label: `${findPlayer(event.playerId)}に${event.cardType === 'red' ? '退場' : '警告'}`, className: 'is-warning' },
        memo: { icon: 'fa-note-sticky', label: event.text || event.tag || 'メモ', className: 'is-neutral' },
        'practice-menu': { icon: 'fa-clipboard-list', label: event.focus, className: 'is-practice' }
    };
    return typeMap[event.type] || { icon: 'fa-circle', label: '記録', className: 'is-neutral' };
}

function dateInWindow(date, from, to) {
    const value = toTimestamp(date);
    return value >= from.getTime() && value <= to.getTime();
}

function buildTeamInsightsForWindow(state, { from, to }) {
    const matches = asArray(state?.matches).filter(match => dateInWindow(match.date, from, to));
    const practices = asArray(state?.practices).filter(practice => dateInWindow(practice.date, from, to));
    const events = matches.flatMap(getMatchEvents);
    const goals = events.filter(event => event.type === 'score').length;
    const conceded = events.filter(event => event.type === 'concede').length;
    const results = matches.reduce((summary, match) => {
        const score = resolveMatchScore(match);
        if (score.us > score.them) summary.wins += 1;
        else if (score.us < score.them) summary.losses += 1;
        else summary.draws += 1;
        return summary;
    }, { wins: 0, draws: 0, losses: 0 });
    return { matches: matches.length, practices: practices.length, goals, conceded, goalDifference: goals - conceded, results };
}

function getPrimaryPosition(player = {}) {
    return player.position || player.position1 || player.primaryPosition || player.positionCategory || '未設定';
}

export function buildPeriodComparison(state, { days = 90, now = new Date() } = {}) {
    if (days === 'all') return { current: buildTeamInsights(state, { days: 'all', now }), previous: null, days: 'all' };
    const windowDays = Math.max(1, Number(days) || 90);
    const currentTo = new Date(now);
    const currentFrom = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const previousTo = new Date(currentFrom.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const current = buildTeamInsightsForWindow(state, { from: currentFrom, to: currentTo });
    const previous = buildTeamInsightsForWindow(state, { from: previousFrom, to: previousTo });
    return {
        days: windowDays,
        current,
        previous,
        deltas: {
            activities: (current.matches + current.practices) - (previous.matches + previous.practices),
            goalDifference: current.goalDifference - previous.goalDifference,
            wins: current.results.wins - previous.results.wins,
            conceded: current.conceded - previous.conceded
        }
    };
}

export function buildPositionParticipation(state, { days = 90, now = new Date() } = {}) {
    const players = asArray(state?.players).filter(player => !player.deletedAt);
    const playerIds = players.map(player => player.id);
    const positions = new Map(players.map(player => [String(player.id), getPrimaryPosition(player)]));
    const totals = new Map();
    asArray(state?.matches).filter(match => dateInRange(match.date, days, now)).forEach(match => {
        asArray(match.formations).forEach(period => {
            const seconds = getFieldPlayingSeconds(period, playerIds, now.getTime());
            Object.entries(seconds).forEach(([id, value]) => {
                const position = positions.get(String(id)) || '未設定';
                const item = totals.get(position) || { position, seconds: 0, players: new Set() };
                item.seconds += Number(value || 0);
                if (Number(value || 0) > 0) item.players.add(String(id));
                totals.set(position, item);
            });
        });
    });
    return [...totals.values()]
        .map(item => ({ position: item.position, minutes: Math.round(item.seconds / 60), playerCount: item.players.size }))
        .sort((a, b) => b.minutes - a.minutes || a.position.localeCompare(b.position, 'ja'));
}

export function buildCoachingRecommendations(state, { days = 90, now = new Date() } = {}) {
    const insights = buildTeamInsights(state, { days, now });
    const recommendations = [];
    if (!insights.matches && !insights.practices) return [{ tone: 'neutral', title: '記録を増やして分析を開始', reason: '対象期間の試合・練習がまだありません。', action: '最初の練習または試合を記録してください。' }];
    if (insights.conceded > insights.goals || insights.goalDifference < 0) {
        recommendations.push({ tone: 'attention', title: '守備の再現性を高める', reason: `対象期間は ${insights.goals}得点・${insights.conceded}失点です。`, action: '切り替え直後の帰陣、ゴール前のマーク、ボールを失った直後の3秒をテーマにした少人数ゲームを設定してください。' });
    }
    if (insights.results.losses > insights.results.wins) {
        recommendations.push({ tone: 'attention', title: '試合の入りを整える', reason: `${insights.results.losses}敗で、勝利数を上回っています。`, action: '最初の5分の守備原則と、ボール保持時の最初の前進ルートを短時間で確認してからゲーム形式へ移行してください。' });
    }
    const responseTotal = insights.attendance.attending + insights.attendance.absent + insights.attendance.pending;
    if (responseTotal && insights.attendance.pending / responseTotal >= 0.25) {
        recommendations.push({ tone: 'neutral', title: '出欠確認を早める', reason: `未回答が ${insights.attendance.pending} 件あります。`, action: '次回予定に回答期限を設定し、未回答リマインドを練習前に共有してください。' });
    }
    if (!recommendations.length) {
        recommendations.push({ tone: 'positive', title: '現在のテーマを継続', reason: '得失点・成績・出欠に大きな注意信号はありません。', action: '直近の成功場面を動画・メモで振り返り、同じ原則を制約付きゲームで再現してください。' });
    }
    return recommendations.slice(0, 3);
}

export function buildInsightsShareText(team, player, teamInsights, playerInsights) {
    const lines = [
        `【${team?.name || 'チーム'} 振り返り】`,
        `対象：直近${teamInsights.rangeDays === 'all' ? 'すべて' : `${teamInsights.rangeDays}日`}`,
        `活動：試合 ${teamInsights.matches}件 / 練習 ${teamInsights.practices}件`,
        `試合結果：${teamInsights.results.wins}勝 ${teamInsights.results.draws}分 ${teamInsights.results.losses}敗`,
        `得失点：${teamInsights.goals}得点 / ${teamInsights.conceded}失点（差 ${teamInsights.goalDifference >= 0 ? '+' : ''}${teamInsights.goalDifference}）`,
        `出欠回答：参加 ${teamInsights.attendance.attending} / 未回答 ${teamInsights.attendance.pending} / 欠席 ${teamInsights.attendance.absent}`
    ];
    if (player && playerInsights) {
        lines.push(`\n【${player.name} 選手】`);
        lines.push(`出席率：${playerInsights.attendance.rate}%（参加 ${playerInsights.attendance.attending}/${playerInsights.attendance.invited}）`);
        lines.push(`得点：${playerInsights.performance.goals} / アシスト：${playerInsights.performance.assists} / カード：${playerInsights.performance.cards}`);
    }
    return lines.join('\n');
}
