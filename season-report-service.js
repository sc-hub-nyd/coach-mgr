function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function parseScore(result) {
    const found = String(result || '').match(/(\d+)\s*-\s*(\d+)/);
    return found ? { us: Number(found[1]), them: Number(found[2]) } : null;
}

function goalRecords(match) {
    if (Array.isArray(match.goalRecords)) return match.goalRecords;
    return (match.formations || []).flatMap(period => period?.goalRecords || []);
}

function eventAttendance(event, playerId) {
    const item = event?.attendanceByPlayer?.[String(playerId)];
    if (item?.status) return item.status;
    if ((event?.presentPlayerIds || []).some(id => String(id) === String(playerId))) return 'attending';
    return (event?.callUpPlayerIds || []).some(id => String(id) === String(playerId)) ? 'pending' : null;
}

function collectPlayerStats(state) {
    const eventList = [...(state.matches || []), ...(state.practices || [])];
    const goalCount = new Map();
    const assistCount = new Map();
    (state.matches || []).forEach(match => goalRecords(match).forEach(record => {
        if (record?.scorerId !== null && record?.scorerId !== undefined) goalCount.set(String(record.scorerId), (goalCount.get(String(record.scorerId)) || 0) + 1);
        if (record?.assistId !== null && record?.assistId !== undefined) assistCount.set(String(record.assistId), (assistCount.get(String(record.assistId)) || 0) + 1);
    }));
    return (state.players || []).filter(player => !player.deletedAt).map(player => {
        const statuses = eventList.map(event => eventAttendance(event, player.id)).filter(Boolean);
        const attending = statuses.filter(status => status === 'attending').length;
        const absent = statuses.filter(status => status === 'absent').length;
        const pending = statuses.filter(status => status === 'pending').length;
        return {
            id: player.id, number: player.number || '', name: player.name || '名称未設定',
            invited: statuses.length, attending, absent, pending,
            attendanceRate: statuses.length ? Math.round((attending / statuses.length) * 100) : 0,
            goals: goalCount.get(String(player.id)) || 0,
            assists: assistCount.get(String(player.id)) || 0
        };
    }).sort((a, b) => a.number - b.number || a.name.localeCompare(b.name, 'ja'));
}

export function buildSeasonReport(state, { teamName = '', seasonName = '' } = {}) {
    const matches = (state.matches || []).filter(match => !match.deletedAt);
    const practices = (state.practices || []).filter(practice => !practice.deletedAt);
    const scores = matches.map(match => parseScore(match.result)).filter(Boolean);
    const results = scores.reduce((acc, score) => {
        acc.goalsFor += score.us; acc.goalsAgainst += score.them;
        if (score.us > score.them) acc.wins += 1;
        else if (score.us < score.them) acc.losses += 1;
        else acc.draws += 1;
        return acc;
    }, { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 });
    const completed = results.wins + results.losses + results.draws;
    const players = collectPlayerStats(state);
    const attendanceAverage = players.length ? Math.round(players.reduce((sum, player) => sum + player.attendanceRate, 0) / players.length) : 0;
    return {
        generatedAt: new Date().toISOString(), teamName: teamName || state.teamInfo?.name || 'チーム', seasonName: seasonName || '',
        summary: { matches: matches.length, completed, practices: practices.length, players: players.length, attendanceAverage, ...results, winRate: completed ? Math.round((results.wins / completed) * 100) : 0 },
        players, matches: matches.map(match => ({ date: match.date || '', opponent: match.opponent || '', type: match.type || '', result: match.result || '', rsvpDeadline: match.rsvpDeadline || '' })),
        practices: practices.map(practice => ({ date: practice.date || '', location: practice.location || '', rsvpDeadline: practice.rsvpDeadline || '' }))
    };
}

export function buildSeasonReportCsv(report) {
    const rows = [
        ['CoachMgr シーズンレポート', report.teamName, report.seasonName],
        ['作成日時', report.generatedAt],
        [],
        ['チーム集計'],
        ['試合数', report.summary.matches], ['完了試合', report.summary.completed], ['勝', report.summary.wins], ['分', report.summary.draws], ['敗', report.summary.losses], ['得点', report.summary.goalsFor], ['失点', report.summary.goalsAgainst], ['勝率', `${report.summary.winRate}%`], ['練習数', report.summary.practices], ['平均出席率', `${report.summary.attendanceAverage}%`],
        [],
        ['選手別集計'],
        ['背番号', '選手名', '招集', '参加', '欠席', '未回答', '出席率', '得点', 'アシスト'],
        ...report.players.map(player => [player.number, player.name, player.invited, player.attending, player.absent, player.pending, `${player.attendanceRate}%`, player.goals, player.assists]),
        [],
        ['試合一覧'], ['日付', '対戦相手', '種別', '結果', 'RSVP期限'],
        ...report.matches.map(match => [match.date, match.opponent, match.type, match.result, match.rsvpDeadline]),
        [],
        ['練習一覧'], ['日付', '場所', 'RSVP期限'],
        ...report.practices.map(practice => [practice.date, practice.location, practice.rsvpDeadline])
    ];
    return `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
}

export function buildSeasonReportPrintHtml(report) {
    const summary = report.summary;
    const playerRows = report.players.map(player => `<tr><td>${escapeHtml(player.number)}</td><td>${escapeHtml(player.name)}</td><td>${player.attending}/${player.invited}</td><td>${player.attendanceRate}%</td><td>${player.goals}</td><td>${player.assists}</td></tr>`).join('');
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(report.teamName)} ${escapeHtml(report.seasonName)} シーズンレポート</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#17211d;margin:32px;line-height:1.5}h1{margin:0 0 4px;color:#13795b}h2{margin-top:28px;border-bottom:2px solid #13795b;padding-bottom:5px}.meta{color:#52635b;font-size:12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.metric{border:1px solid #cddbd2;border-radius:8px;padding:10px}.metric small{display:block;color:#52635b}.metric strong{font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cddbd2;padding:7px;text-align:left}th{background:#eef6f0}@media print{body{margin:12mm}.no-print{display:none}}</style></head><body><h1>${escapeHtml(report.teamName)}</h1><p class="meta">${escapeHtml(report.seasonName)} シーズンレポート / 作成: ${escapeHtml(new Date(report.generatedAt).toLocaleString('ja-JP'))}</p><h2>チーム集計</h2><section class="grid"><div class="metric"><small>試合</small><strong>${summary.matches}</strong></div><div class="metric"><small>成績</small><strong>${summary.wins}勝 ${summary.draws}分 ${summary.losses}敗</strong></div><div class="metric"><small>得失点</small><strong>${summary.goalsFor}-${summary.goalsAgainst}</strong></div><div class="metric"><small>平均出席率</small><strong>${summary.attendanceAverage}%</strong></div></section><h2>選手別集計</h2><table><thead><tr><th>#</th><th>選手</th><th>参加/招集</th><th>出席率</th><th>得点</th><th>アシスト</th></tr></thead><tbody>${playerRows || '<tr><td colspan="6">選手データがありません。</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
}
