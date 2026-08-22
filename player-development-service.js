function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeRating(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5 ? numeric : null;
}

export function ensureDevelopmentNotes(player) {
    if (!player || typeof player !== 'object') return [];
    if (!Array.isArray(player.developmentNotes)) player.developmentNotes = [];
    return player.developmentNotes;
}

export function addDevelopmentNote(player, { date, focus = '', observation = '', nextStep = '', skillRatings = {} } = {}, now = new Date()) {
    if (!player) throw new Error('選手を選択してください');
    const notes = ensureDevelopmentNotes(player);
    const normalizedRatings = Object.fromEntries(Object.entries(skillRatings)
        .map(([metric, value]) => [metric, normalizeRating(value)])
        .filter(([, value]) => value !== null));
    const note = {
        id: `development-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        date: date || now.toISOString().slice(0, 10),
        focus: String(focus).trim(),
        observation: String(observation).trim(),
        nextStep: String(nextStep).trim(),
        skillRatings: normalizedRatings,
        createdAt: now.toISOString()
    };
    if (!note.observation && !note.nextStep && Object.keys(normalizedRatings).length === 0) {
        throw new Error('観察メモ、次の一歩、またはスキル評価を入力してください');
    }
    notes.push(note);
    notes.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date) || toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
    return note;
}

export function removeDevelopmentNote(player, noteId) {
    const notes = ensureDevelopmentNotes(player);
    const index = notes.findIndex(note => String(note.id) === String(noteId));
    if (index < 0) return null;
    return notes.splice(index, 1)[0];
}

export function getSkillTrend(player, metrics = []) {
    const notes = [...ensureDevelopmentNotes(player)].sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date));
    return metrics.map(metric => {
        const ratings = notes
            .map(note => ({ date: note.date, value: normalizeRating(note.skillRatings?.[metric]) }))
            .filter(item => item.value !== null);
        const latest = ratings.at(-1) || null;
        const previous = ratings.length > 1 ? ratings.at(-2) : null;
        return {
            metric,
            latest: latest?.value ?? null,
            previous: previous?.value ?? null,
            delta: latest && previous ? latest.value - previous.value : null,
            count: ratings.length
        };
    });
}

export function buildDevelopmentTimeline(player, { matches = [], practices = [] } = {}) {
    const playerId = Number(player?.id);
    const notes = ensureDevelopmentNotes(player).map(note => ({
        kind: 'note', date: note.date, id: note.id, title: note.focus || '育成ノート', detail: note.observation || note.nextStep || '記録', note
    }));
    const observations = (player?.history || []).map(item => ({
        kind: 'observation', date: item.date, id: item.id, title: '観察メモ', detail: item.comment || '記録'
    }));
    const matchActivities = matches
        .filter(match => (match.presentPlayerIds || []).some(id => Number(id) === playerId) || (match.playerFeedback || []).some(item => Number(item.playerId) === playerId))
        .map(match => ({ kind: 'match', date: match.date, id: match.id, title: `試合：vs ${match.opponent || '対戦相手未設定'}`, detail: match.playerFeedback?.find(item => Number(item.playerId) === playerId)?.comment || '参加記録' }));
    const practiceActivities = practices
        .filter(practice => (practice.presentPlayerIds || []).some(id => Number(id) === playerId))
        .map(practice => ({ kind: 'practice', date: practice.date, id: practice.id, title: '練習に参加', detail: practice.location || '練習記録' }));
    return [...notes, ...observations, ...matchActivities, ...practiceActivities]
        .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
}

export function buildDevelopmentSummary(player, options = {}) {
    const timeline = buildDevelopmentTimeline(player, options);
    const notes = ensureDevelopmentNotes(player);
    return {
        noteCount: notes.length,
        latestNote: notes[0] || null,
        timeline,
        skillTrend: getSkillTrend(player, options.metrics || [])
    };
}
