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
                { role: 'GK', label: 'GK', top: '88%', left: '50%', x: 50, y: 88 },
                { role: 'DF', label: 'LCB', top: '72%', left: '25%', x: 25, y: 72 },
                { role: 'DF', label: 'CCB', top: '75%', left: '50%', x: 50, y: 75 },
                { role: 'DF', label: 'RCB', top: '72%', left: '75%', x: 75, y: 72 },
                { role: 'MF', label: 'LM', top: '48%', left: '20%', x: 20, y: 48 },
                { role: 'MF', label: 'CM', top: '50%', left: '50%', x: 50, y: 50 },
                { role: 'MF', label: 'RM', top: '48%', left: '80%', x: 80, y: 48 },
                { role: 'FW', label: 'ST', top: '22%', left: '50%', x: 50, y: 22 }
            ]
        },
        {
            name: '2-4-1',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%', x: 50, y: 88 },
                { role: 'DF', label: 'LCB', top: '74%', left: '35%', x: 35, y: 74 },
                { role: 'DF', label: 'RCB', top: '74%', left: '65%', x: 65, y: 74 },
                { role: 'MF', label: 'LM', top: '50%', left: '15%', x: 15, y: 50 },
                { role: 'MF', label: 'LCM', top: '52%', left: '38%', x: 38, y: 52 },
                { role: 'MF', label: 'RCM', top: '52%', left: '62%', x: 62, y: 52 },
                { role: 'MF', label: 'RM', top: '50%', left: '85%', x: 85, y: 50 },
                { role: 'FW', label: 'ST', top: '22%', left: '50%', x: 50, y: 22 }
            ]
        },
        {
            name: '3-2-2',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%', x: 50, y: 88 },
                { role: 'DF', label: 'LCB', top: '72%', left: '25%', x: 25, y: 72 },
                { role: 'DF', label: 'CCB', top: '75%', left: '50%', x: 50, y: 75 },
                { role: 'DF', label: 'RCB', top: '72%', left: '75%', x: 75, y: 72 },
                { role: 'MF', label: 'LCM', top: '48%', left: '35%', x: 35, y: 48 },
                { role: 'MF', label: 'RCM', top: '48%', left: '65%', x: 65, y: 48 },
                { role: 'FW', label: 'LST', top: '22%', left: '35%', x: 35, y: 22 },
                { role: 'FW', label: 'RST', top: '22%', left: '65%', x: 65, y: 22 }
            ]
        },
        {
            name: '2-3-2',
            coords: [
                { role: 'GK', label: 'GK', top: '88%', left: '50%', x: 50, y: 88 },
                { role: 'DF', label: 'LCB', top: '74%', left: '35%', x: 35, y: 74 },
                { role: 'DF', label: 'RCB', top: '74%', left: '65%', x: 65, y: 74 },
                { role: 'MF', label: 'LM', top: '50%', left: '20%', x: 20, y: 50 },
                { role: 'MF', label: 'CM', top: '52%', left: '50%', x: 50, y: 52 },
                { role: 'MF', label: 'RM', top: '50%', left: '80%', x: 80, y: 50 },
                { role: 'FW', label: 'LST', top: '22%', left: '35%', x: 35, y: 22 },
                { role: 'FW', label: 'RST', top: '22%', left: '65%', x: 65, y: 22 }
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
