const WORKSPACE_FIELDS = [
    'matches', 'practices', 'players', 'menuLibrary', 'tactics', 'practiceTemplates',
    'matchTypes', 'menuCategories', 'tacticsCategories', 'analysisTags', 'skillMetrics',
    'positions', 'positionsCat2', 'customFormations', 'teamInfo', 'teamFocus'
];

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getSeasonLabel(date = new Date()) {
    const year = date.getFullYear() - (date.getMonth() < 3 ? 1 : 0);
    return `${year}年度`;
}

function readWorkspace(state) {
    return WORKSPACE_FIELDS.reduce((workspace, key) => {
        workspace[key] = clone(state[key]);
        return workspace;
    }, {});
}

function writeWorkspace(state, workspace) {
    WORKSPACE_FIELDS.forEach(key => {
        if (workspace[key] !== undefined) state[key] = clone(workspace[key]);
    });
}

function normalizeWorkspace(workspace) {
    const normalized = workspace && typeof workspace === 'object' ? workspace : {};
    normalized.matches = Array.isArray(normalized.matches) ? normalized.matches : [];
    normalized.practices = Array.isArray(normalized.practices) ? normalized.practices : [];
    normalized.players = Array.isArray(normalized.players) ? normalized.players : [];
    normalized.menuLibrary = Array.isArray(normalized.menuLibrary) ? normalized.menuLibrary : [];
    normalized.tactics = Array.isArray(normalized.tactics) ? normalized.tactics : [];
    normalized.practiceTemplates = Array.isArray(normalized.practiceTemplates) ? normalized.practiceTemplates : [];
    normalized.matchTypes = Array.isArray(normalized.matchTypes) ? normalized.matchTypes : [];
    normalized.menuCategories = Array.isArray(normalized.menuCategories) ? normalized.menuCategories : [];
    normalized.tacticsCategories = Array.isArray(normalized.tacticsCategories) ? normalized.tacticsCategories : [];
    normalized.analysisTags = Array.isArray(normalized.analysisTags) ? normalized.analysisTags : [];
    normalized.skillMetrics = Array.isArray(normalized.skillMetrics) ? normalized.skillMetrics : [];
    normalized.positions = Array.isArray(normalized.positions) ? normalized.positions : [];
    normalized.positionsCat2 = Array.isArray(normalized.positionsCat2) ? normalized.positionsCat2 : [];
    normalized.customFormations = Array.isArray(normalized.customFormations) ? normalized.customFormations : [];
    normalized.teamInfo = normalized.teamInfo && typeof normalized.teamInfo === 'object' ? normalized.teamInfo : {};
    normalized.teamFocus = normalized.teamFocus && typeof normalized.teamFocus === 'object' ? normalized.teamFocus : {};
    return normalized;
}

export function ensureWorkspaceState(state) {
    if (!Array.isArray(state.teams) || !state.teams.length || !state.workspaces || typeof state.workspaces !== 'object') {
        const teamId = createId('team');
        const seasonId = createId('season');
        state.teams = [{
            id: teamId,
            name: state.teamInfo?.name || 'My Team',
            color: state.teamInfo?.theme?.seed || state.teamInfo?.color || '#ef3340',
            theme: clone(state.teamInfo?.theme) || { seed: state.teamInfo?.color || '#ef3340', algorithm: 'coachmgr-tonal-v1', algorithmVersion: 1 },
            createdAt: new Date().toISOString(),
            archivedAt: null,
            seasons: [{ id: seasonId, name: getSeasonLabel(), startsOn: '', endsOn: '', archivedAt: null, createdAt: new Date().toISOString() }]
        }];
        state.workspaces = { [`${teamId}:${seasonId}`]: normalizeWorkspace(readWorkspace(state)) };
        state.activeTeamId = teamId;
        state.activeSeasonId = seasonId;
        return state;
    }

    state.teams = state.teams.map(team => ({
        ...team,
        color: team.theme?.seed || team.color || '#ef3340',
        theme: clone(team.theme) || { seed: team.color || '#ef3340', algorithm: 'coachmgr-tonal-v1', algorithmVersion: 1 },
        id: team.id || createId('team'),
        seasons: Array.isArray(team.seasons) && team.seasons.length ? team.seasons.map(season => ({
            ...season,
            id: season.id || createId('season'),
            name: season.name || getSeasonLabel()
        })) : [{ id: createId('season'), name: getSeasonLabel(), startsOn: '', endsOn: '', archivedAt: null, createdAt: new Date().toISOString() }]
    }));
    const activeTeam = state.teams.find(team => team.id === state.activeTeamId) || state.teams[0];
    const activeSeason = activeTeam.seasons.find(season => season.id === state.activeSeasonId) || activeTeam.seasons[0];
    state.activeTeamId = activeTeam.id;
    state.activeSeasonId = activeSeason.id;
    const key = workspaceKey(activeTeam.id, activeSeason.id);
    if (!state.workspaces[key]) state.workspaces[key] = normalizeWorkspace(readWorkspace(state));
    state.workspaces[key] = normalizeWorkspace(state.workspaces[key]);
    return state;
}

export function workspaceKey(teamId, seasonId) {
    return `${teamId}:${seasonId}`;
}

export function captureActiveWorkspace(state) {
    ensureWorkspaceState(state);
    state.workspaces[workspaceKey(state.activeTeamId, state.activeSeasonId)] = normalizeWorkspace(readWorkspace(state));
    return state.workspaces[workspaceKey(state.activeTeamId, state.activeSeasonId)];
}

export function hydrateActiveWorkspace(state) {
    ensureWorkspaceState(state);
    const workspace = normalizeWorkspace(state.workspaces[workspaceKey(state.activeTeamId, state.activeSeasonId)]);
    state.workspaces[workspaceKey(state.activeTeamId, state.activeSeasonId)] = workspace;
    writeWorkspace(state, workspace);
    return workspace;
}

export function getActiveTeam(state) {
    ensureWorkspaceState(state);
    return state.teams.find(team => team.id === state.activeTeamId) || state.teams[0];
}

export function getActiveSeason(state) {
    const team = getActiveTeam(state);
    return team.seasons.find(season => season.id === state.activeSeasonId) || team.seasons[0];
}

export function switchWorkspace(state, teamId, seasonId) {
    ensureWorkspaceState(state);
    const team = state.teams.find(item => item.id === teamId);
    if (!team) throw new Error('切り替え先のチームが見つかりません');
    const season = team.seasons.find(item => item.id === seasonId);
    if (!season) throw new Error('切り替え先のシーズンが見つかりません');
    captureActiveWorkspace(state);
    state.activeTeamId = teamId;
    state.activeSeasonId = seasonId;
    const key = workspaceKey(teamId, seasonId);
    if (!state.workspaces[key]) state.workspaces[key] = normalizeWorkspace({});
    hydrateActiveWorkspace(state);
    return { team, season };
}

export function createTeam(state, { name, color = '#ef3340', theme = null }) {
    ensureWorkspaceState(state);
    const teamTheme = clone(theme) || { seed: color, algorithm: 'coachmgr-tonal-v1', algorithmVersion: 1 };
    const team = { id: createId('team'), name: String(name || '').trim() || '新しいチーム', color: teamTheme.seed || color, theme: teamTheme, createdAt: new Date().toISOString(), archivedAt: null, seasons: [] };
    const season = { id: createId('season'), name: getSeasonLabel(), startsOn: '', endsOn: '', archivedAt: null, createdAt: new Date().toISOString() };
    team.seasons.push(season);
    state.teams.push(team);
    state.workspaces[workspaceKey(team.id, season.id)] = normalizeWorkspace({
        ...readWorkspace(state), matches: [], practices: [], players: [], menuLibrary: [], tactics: [], practiceTemplates: [],
        teamInfo: { ...clone(state.teamInfo), name: team.name, color: team.color, theme: clone(team.theme) }, teamFocus: {}
    });
    return switchWorkspace(state, team.id, season.id);
}

export function createSeason(state, { name, copyPlayers = true, copyTeamSetup = true } = {}) {
    ensureWorkspaceState(state);
    const source = captureActiveWorkspace(state);
    // captureActiveWorkspace内の正規化で配列参照が置き換わるため、保存後に現行チームを取り直す。
    const team = getActiveTeam(state);
    const season = { id: createId('season'), name: String(name || '').trim() || getSeasonLabel(), startsOn: '', endsOn: '', archivedAt: null, createdAt: new Date().toISOString() };
    team.seasons.push(season);
    const clean = normalizeWorkspace({
        matches: [], practices: [], players: copyPlayers ? clone(source.players) : [],
        menuLibrary: copyTeamSetup ? clone(source.menuLibrary) : [], tactics: copyTeamSetup ? clone(source.tactics) : [],
        practiceTemplates: copyTeamSetup ? clone(source.practiceTemplates) : [], matchTypes: clone(source.matchTypes),
        menuCategories: clone(source.menuCategories), tacticsCategories: clone(source.tacticsCategories), analysisTags: clone(source.analysisTags),
        skillMetrics: clone(source.skillMetrics), positions: clone(source.positions), positionsCat2: clone(source.positionsCat2),
        customFormations: copyTeamSetup ? clone(source.customFormations) : [], teamInfo: clone(source.teamInfo), teamFocus: {}
    });
    state.workspaces[workspaceKey(team.id, season.id)] = clean;
    return switchWorkspace(state, team.id, season.id);
}

export function archiveSeason(state, teamId, seasonId) {
    ensureWorkspaceState(state);
    const team = state.teams.find(item => item.id === teamId);
    const season = team?.seasons.find(item => item.id === seasonId);
    if (!team || !season) throw new Error('対象シーズンが見つかりません');
    if (team.seasons.filter(item => !item.archivedAt).length <= 1 && !season.archivedAt) throw new Error('利用中のシーズンをすべてアーカイブすることはできません');
    season.archivedAt = season.archivedAt ? null : new Date().toISOString();
    return season;
}
