// App State & Persistence Module

export const state = {
    matches: [],
    practices: [],
    players: [],
    menuLibrary: [],
    matchTypes: ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'],
    menuCategories: ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'],
    skillMetrics: ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'],
    positions: ['GK', 'DF', 'MF', 'FW'],
    positionsCat2: ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'],
    teamInfo: { name: 'My Team', color: '#f23932', passcode: '7064' },
    currentUserRole: 'parent',
    customFormations: [
        {
            name: '3-3-1',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%' },
                { role: 'DF', label: 'LCB', top: '72%', left: '25%' },
                { role: 'DF', label: 'CCB', top: '75%', left: '50%' },
                { role: 'DF', label: 'RCB', top: '72%', left: '75%' },
                { role: 'MF', label: 'LM', top: '48%', left: '20%' },
                { role: 'MF', label: 'CM', top: '50%', left: '50%' },
                { role: 'MF', label: 'RM', top: '48%', left: '80%' },
                { role: 'FW', label: 'ST', top: '22%', left: '50%' }
            ]
        },
        {
            name: '2-4-1',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%' },
                { role: 'DF', label: 'LCB', top: '74%', left: '35%' },
                { role: 'DF', label: 'RCB', top: '74%', left: '65%' },
                { role: 'MF', label: 'LM', top: '50%', left: '15%' },
                { role: 'MF', label: 'LCM', top: '52%', left: '38%' },
                { role: 'MF', label: 'RCM', top: '52%', left: '62%' },
                { role: 'MF', label: 'RM', top: '50%', left: '85%' },
                { role: 'FW', label: 'ST', top: '22%', left: '50%' }
            ]
        },
        {
            name: '3-2-2',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%' },
                { role: 'DF', label: 'LCB', top: '72%', left: '25%' },
                { role: 'DF', label: 'CCB', top: '75%', left: '50%' },
                { role: 'DF', label: 'RCB', top: '72%', left: '75%' },
                { role: 'MF', label: 'LCM', top: '48%', left: '35%' },
                { role: 'MF', label: 'RCM', top: '48%', left: '65%' },
                { role: 'FW', label: 'LST', top: '22%', left: '35%' },
                { role: 'FW', label: 'RST', top: '22%', left: '65%' }
            ]
        },
        {
            name: '2-3-2',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%' },
                { role: 'DF', label: 'LCB', top: '74%', left: '35%' },
                { role: 'DF', label: 'RCB', top: '74%', left: '65%' },
                { role: 'MF', label: 'LM', top: '50%', left: '20%' },
                { role: 'MF', label: 'CM', top: '52%', left: '50%' },
                { role: 'MF', label: 'RM', top: '50%', left: '80%' },
                { role: 'FW', label: 'LST', top: '22%', left: '35%' },
                { role: 'FW', label: 'RST', top: '22%', left: '65%' }
            ]
        }
    ],
    currentRoute: 'dashboard'
};

export const filters = {
    currentMatchNendo: 'all',
    currentPracticeNendo: 'all',
    currentLibraryCategory: 'all'
};

export function getNendo(dateStr) {
    const d = new Date(dateStr);
    let year = d.getFullYear();
    if (d.getMonth() < 3) year--; // Jan, Feb, Mar
    return year;
}

export function loadData() {
    const saved = localStorage.getItem('coachMgrData');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.matches = parsed.matches || [];
        state.practices = parsed.practices || [];
        state.players = parsed.players || [];
        state.menuLibrary = parsed.menuLibrary || [];
        state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
        state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
        state.skillMetrics = parsed.skillMetrics || ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
        state.positions = parsed.positions || ['GK', 'DF', 'MF', 'FW'];
        state.positionsCat2 = parsed.positionsCat2 || ['CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'];
        state.teamInfo = parsed.teamInfo || { name: 'My Team', color: '#f23932', passcode: '7064' };
        if (!state.teamInfo.passcode) state.teamInfo.passcode = '7064';
        state.customFormations = parsed.customFormations || state.customFormations;

        // Migrations
        state.matches.forEach(m => {
            if (!m.playerFeedback) m.playerFeedback = [];
            if (!m.formations) m.formations = [];
            if (!m.type) m.type = 'リーグ戦';
        });

        state.practices = state.practices.map(p => {
            if (p.focus) {
                return {
                    id: p.id,
                    date: p.date,
                    attendance: p.attendance,
                    menus: [{ id: Date.now(), focus: p.focus, category: 'その他', frames: p.frames }]
                };
            }
            return p;
        });

        state.menuLibrary.forEach(m => {
            if (!m.category) {
                if (m.focus && m.focus.includes('ポゼッション')) m.category = 'ポゼッション';
                else if (m.focus && m.focus.includes('パス')) m.category = 'パス＆コントロール';
                else if (m.focus && m.focus.includes('シュート')) m.category = 'シュート';
                else if (m.focus && (m.focus.includes('ゲーム') || m.focus.includes('戦'))) m.category = 'ゲーム';
                else m.category = 'その他';
            }
        });

        state.practices.forEach(p => {
            if (p.menus) {
                p.menus.forEach(m => {
                    if (!m.category) {
                        if (m.focus && m.focus.includes('ポゼッション')) m.category = 'ポゼッション';
                        else if (m.focus && m.focus.includes('パス')) m.category = 'パス＆コントロール';
                        else if (m.focus && m.focus.includes('シュート')) m.category = 'シュート';
                        else if (m.focus && (m.focus.includes('ゲーム') || m.focus.includes('戦'))) m.category = 'ゲーム';
                        else m.category = 'その他';
                    }
                });
            }
        });

        state.players.forEach(p => {
            if (p.skills && !p.history) {
                p.history = [{ id: Date.now(), date: new Date().toISOString().split('T')[0], comment: '旧データ移行', skills: p.skills }];
                delete p.skills;
            }
        });
    } else {
        state.matches = [];
        state.practices = [];
        state.players = [];
        state.menuLibrary = [];
    }
}

export function saveData() {
    localStorage.setItem('coachMgrData', JSON.stringify({
        matches: state.matches,
        practices: state.practices,
        players: state.players,
        menuLibrary: state.menuLibrary,
        matchTypes: state.matchTypes,
        menuCategories: state.menuCategories,
        skillMetrics: state.skillMetrics,
        positions: state.positions,
        positionsCat2: state.positionsCat2,
        teamInfo: state.teamInfo,
        customFormations: state.customFormations
    }));
}
