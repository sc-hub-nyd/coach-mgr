// state.js

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

// UI・フィルター用の一時ステート
export const uiState = {
    lastSyncTimeStr: '未実施',
    currentMatchNendo: 'all',
    currentPracticeNendo: 'all',
    currentPracticeMonth: 'all',
    currentLibraryCategory: 'all',
    currentMatchPage: 1,
    currentPracticePage: 1,
    ITEMS_PER_PAGE: 10,
    currentView: 'dashboard', // または 'matches', 'match-analysis' など
    activeMatchId: null,
    activePeriodIndex: 0
};
