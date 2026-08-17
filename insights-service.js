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

function dateInRange(date, days) {
    if (!days || days === 'all') return true;
    const eventTime = toTimestamp(date);
    if (!eventTime) return false;
    const from = Date.now() - (Number(days) * 24 * 60 * 60 * 1000);
    return eventTime >= from;
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

export function buildTeamInsights(state, { days = 90 } = {}) {
    const matches = asArray(state?.matches).filter(match => dateInRange(match.date, days));
    const practices = asArray(state?.practices).filter(practice => dateInRange(practice.date, days));
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
