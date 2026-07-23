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
    }

    if (state.matches.length === 0 && state.practices.length === 0 && state.players.length === 0) {
        populateSampleData();
    }
}

function populateSampleData() {
    state.players = [
        {
            id: 1001,
            name: '山田 太郎',
            number: 10,
            grade: '6年',
            position: ['FW', 'ST'],
            history: [
                { id: 1, date: '2026-07-01', comment: '【ポジティブ】\n得点感覚が非常に高く、シュートの意識が良い。\n\n【ネクストステップ】\n守備時のファーストプレスの角度を改善する。', skills: [5, 4, 4, 3, 4, 5] }
            ],
            goals: { shortTerm: '毎試合2シュート以上放つ', longTerm: 'チームの得点王になる' },
            notes1on1: [
                { id: 1, date: '2026-07-10', content: 'キャプテンとしての自覚が芽生えてきた。前線からの声かけを継続すること。' }
            ]
        },
        {
            id: 1002,
            name: '佐藤 健太',
            number: 7,
            grade: '5年',
            position: ['MF', 'CH'],
            history: [
                { id: 2, date: '2026-07-01', comment: '【ポジティブ】\n視野が広くスルーパスの精度が高い。\n\n【ネクストステップ】\n運動量を増やしセカンドボールの回収率を上げる。', skills: [4, 5, 4, 4, 3, 4] }
            ]
        },
        {
            id: 1003,
            name: '鈴木 陸',
            number: 4,
            grade: '6年',
            position: ['DF', 'CB'],
            history: [
                { id: 3, date: '2026-07-01', comment: '【ポジティブ】\n対人の強さとヘディングの競り合いで貢献。\n\n【ネクストステップ】\nビルドアップ時のパスの質を高める。', skills: [2, 4, 3, 5, 5, 4] }
            ]
        },
        {
            id: 1004,
            name: '高橋 翔',
            number: 1,
            grade: '5年',
            position: ['GK'],
            history: [
                { id: 4, date: '2026-07-01', comment: '【ポジティブ】\nキャッチングの安定感とセービング反応が良い。\n\n【ネクストステップ】\nバックパス受け時のフィードキック向上。', skills: [1, 3, 2, 5, 4, 4] }
            ]
        }
    ];

    state.matches = [
        {
            id: 2001,
            date: '2026-07-20',
            opponent: 'FC東京Jr',
            type: 'リーグ戦',
            tournament: 'U-12リーグ 第5節',
            result: '3-1',
            comments: '【ポジティブ】\n前線からの積極的なプレスで奪ってからのショートカウンターが機能した。\n\n【ネクストステップ】\n後半のスタミナ消費に伴うライン下がりを声かけで修正する。',
            goalRecords: [
                { scorerId: 1001, assistId: 1002 },
                { scorerId: 1001, assistId: null },
                { scorerId: 1002, assistId: 1001 }
            ],
            scorers: '山田 太郎 (アシ:佐藤 健太), 山田 太郎, 佐藤 健太 (アシ:山田 太郎)'
        },
        {
            id: 2002,
            date: '2026-07-15',
            opponent: '横浜フレンズ',
            type: 'カップ戦',
            tournament: '夏季交流カップ 準決勝',
            result: '1-0',
            comments: '【ポジティブ】\nサイド攻撃から見事なセンタリングで先制・逃げ切り成功。\n\n【ネクストステップ】\nシュート本数を増やし、決め切る精度を上げる。',
            goalRecords: [
                { scorerId: 1001, assistId: 1003 }
            ],
            scorers: '山田 太郎 (アシ:鈴木 陸)'
        },
        {
            id: 2003,
            date: '2026-07-28',
            opponent: '埼玉ユナイテッド',
            type: 'トレーニングマッチ',
            tournament: '',
            result: '',
            comments: '',
            goalRecords: [],
            scorers: ''
        }
    ];

    state.practices = [
        {
            id: 3001,
            date: '2026-07-18',
            attendance: '4/4',
            presentPlayerIds: [1001, 1002, 1003, 1004],
            menus: [
                { id: 301, focus: '3vs1 ポゼッション', category: 'ポゼッション', organize: '15m x 15mグリッド', keyfactor: '体の向きとファーストタッチ' }
            ]
        },
        {
            id: 3002,
            date: '2026-07-26',
            attendance: '4/4',
            presentPlayerIds: [1001, 1002, 1003, 1004],
            menus: [
                { id: 302, focus: 'シュート＆リバウンド', category: 'シュート', organize: 'PA手前', keyfactor: '枠を捉える強いシュート' }
            ]
        }
    ];

    state.menuLibrary = [
        { id: 401, focus: '3vs1 ポゼッション', category: 'ポゼッション', organize: '15m x 15mグリッド', keyfactor: '体の向きとファーストタッチ', options: 'フリータッチ / 2タッチ制限' },
        { id: 402, focus: 'シュート＆リバウンド', category: 'シュート', organize: 'PA手前', keyfactor: '枠を捉える強いシュート', options: 'こぼれ球への詰め' }
    ];

    saveData();
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
