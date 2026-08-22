import { buildDevelopmentTimeline } from './player-development-service.js';
import { captureActiveWorkspace, ensureWorkspaceState, getActiveTeam, workspaceKey } from './workspace-service.js';
import { getNendo } from './utils.js';

function samePlayerId(left, right) {
    return String(left) === String(right);
}

function nendoFromSeason(season, fallbackDate) {
    const matched = String(season?.name || '').match(/(\d{4})年度/);
    return matched ? matched[1] : getNendo(fallbackDate || new Date().toISOString().slice(0, 10));
}

function timestamp(value) {
    const result = new Date(value || 0).getTime();
    return Number.isFinite(result) ? result : 0;
}

/**
 * Build an archive for the same player across every season of the active team.
 * The returned entries retain their source workspace so a drill-down action can
 * safely open the relevant season or mutate only the record that owns a note.
 */
export function buildPlayerTimelineArchive(state, player) {
    ensureWorkspaceState(state);
    captureActiveWorkspace(state);
    const team = getActiveTeam(state);
    const activeSeasonId = state.activeSeasonId;
    const sources = (team?.seasons || []).map(season => {
        const workspace = state.workspaces?.[workspaceKey(team.id, season.id)];
        const seasonPlayer = workspace?.players?.find(candidate => samePlayerId(candidate.id, player.id));
        if (!workspace || !seasonPlayer) return null;
        return {
            seasonId: season.id,
            seasonName: season.name,
            nendo: nendoFromSeason(season),
            isActiveSeason: season.id === activeSeasonId,
            player: seasonPlayer,
            matches: Array.isArray(workspace.matches) ? workspace.matches : [],
            practices: Array.isArray(workspace.practices) ? workspace.practices : []
        };
    }).filter(Boolean);

    const rawItems = sources.flatMap(source => buildDevelopmentTimeline(source.player, {
        matches: source.matches,
        practices: source.practices
    }).map(item => ({
        ...item,
        id: `${source.seasonId}:${item.kind}:${item.id}`,
        sourceItemId: item.id,
        sourceSeasonId: source.seasonId,
        sourceSeasonName: source.seasonName,
        sourceNendo: source.nendo,
        sourcePlayer: source.player,
        sourcePlayerGrade: source.player.grade || '',
        isActiveSeason: source.isActiveSeason
    })));
    const canonicalItems = new Map();
    rawItems.forEach(item => {
        const recordNendo = getNendo(item.date);
        const key = ['note', 'observation'].includes(item.kind)
            ? `${item.kind}:${item.sourceItemId}`
            : `${item.kind}:${item.sourceSeasonId}:${item.sourceItemId}`;
        const existing = canonicalItems.get(key);
        const itemMatchesRecordSeason = String(item.sourceNendo) === String(recordNendo);
        const existingMatchesRecordSeason = existing && String(existing.sourceNendo) === String(getNendo(existing.date));
        if (!existing || (itemMatchesRecordSeason && !existingMatchesRecordSeason)) canonicalItems.set(key, item);
    });

    return {
        activeSeasonId,
        sources,
        items: [...canonicalItems.values()].sort((left, right) => timestamp(right.date) - timestamp(left.date))
    };
}
