import { getMatchGoalRecords, isPlayerInMatch } from './player-statistics-service.js';
import { buildPlayerTimelineArchive } from './player-timeline-service.js';
import { getNendo } from './utils.js';

function toTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getResultState(result) {
    const matched = String(result || '').match(/(\d+)\s*-\s*(\d+)/);
    if (!matched) return 'unknown';
    const goalsFor = Number(matched[1]);
    const goalsAgainst = Number(matched[2]);
    if (goalsFor === goalsAgainst) return 'draw';
    return goalsFor > goalsAgainst ? 'win' : 'loss';
}

function getMilestones(matches, timelineItems) {
    const ascendingMatches = [...matches].sort((left, right) => toTimestamp(left.date) - toTimestamp(right.date));
    const firstAppearance = ascendingMatches[0];
    const firstGoal = ascendingMatches.find(match => match.goalCount > 0);
    const firstAssist = ascendingMatches.find(match => match.assistCount > 0);
    const itemsByMonth = timelineItems.reduce((groups, item) => {
        const monthKey = String(item.date || '').slice(0, 7);
        if (!monthKey) return groups;
        groups.set(monthKey, (groups.get(monthKey) || 0) + 1);
        return groups;
    }, new Map());
    const recordRichMonth = [...itemsByMonth.entries()]
        .filter(([, count]) => count >= 3)
        .sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0], 'ja'))[0];

    return [
        firstAppearance && { kind: 'appearance', label: '初出場', date: firstAppearance.date, matchId: firstAppearance.id },
        firstGoal && { kind: 'goal', label: '初得点', date: firstGoal.date, matchId: firstGoal.id },
        firstAssist && { kind: 'assist', label: '初アシスト', date: firstAssist.date, matchId: firstAssist.id },
        recordRichMonth && { kind: 'records', label: `${recordRichMonth[0]}：${recordRichMonth[1]}件の記録`, date: `${recordRichMonth[0]}-01`, matchId: '' }
    ].filter(Boolean);
}

/**
 * Derives an experience-focused match archive without changing saved match data.
 * Every item retains the workspace metadata required to open a historic match safely.
 */
export function buildPlayerExperienceArchive(state, player) {
    const timelineArchive = buildPlayerTimelineArchive(state, player);
    const items = timelineArchive.sources.flatMap(source => source.matches
        .filter(match => isPlayerInMatch(match, source.player.id))
        .map(match => {
            const goalRecords = getMatchGoalRecords(match);
            const goalCount = goalRecords.filter(record => String(record?.scorerId) === String(source.player.id)).length;
            const assistCount = goalRecords.filter(record => String(record?.assistId) === String(source.player.id)).length;
            return {
                id: `${source.seasonId}:match:${match.id}`,
                sourceItemId: match.id,
                sourceSeasonId: source.seasonId,
                sourceNendo: source.nendo || getNendo(match.date),
                sourcePlayer: source.player,
                isActiveSeason: source.isActiveSeason,
                date: match.date || '',
                opponent: match.opponent || '対戦相手未定',
                type: match.type || '',
                result: match.result || '',
                resultState: getResultState(match.result),
                goalCount,
                assistCount,
                hasFormation: (match.formations || []).some(formation => Array.isArray(formation?.slots) && formation.slots.length > 0)
            };
        }));
    const sortedItems = items.sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date));
    return {
        items: sortedItems,
        milestones: getMilestones(sortedItems, timelineArchive.items)
    };
}
