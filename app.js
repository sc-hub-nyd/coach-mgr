// App State & Data
let state = {
    matches: [
        { id: 1, date: '2026-07-15', opponent: 'FC Tokyo U15', result: '2-1', type: 'League', scorers: '10番, 9番', comments: '前半は押し込まれたが、後半システム変更から逆転。', playerFeedback: [] },
        { id: 2, date: '2026-07-10', opponent: 'Yokohama U15', result: '0-0', type: 'Friendly', scorers: '', comments: '決定力不足。守備陣はよく耐えた。', playerFeedback: [] }
    ],
    practices: [
        { 
            id: 1, date: '2026-07-16', attendance: '20/22', 
            menus: [
                { id: 101, focus: 'ポゼッション', organize: '20m x 20m グリッド\n4 vs 4 + 1フリーマン', keyfactor: '・ボールを受ける前の首振り\n・サポートの角度と距離', options: '・パスが5本繋がったら1点\n・慣れたら2タッチ制限', frames: null },
                { id: 102, focus: '紅白戦', organize: 'ハーフコート 8 vs 8', keyfactor: '・攻守の切り替えのスピード\n・前線からの連動したプレス', options: '', frames: null }
            ]
        }
    ],
    players: [
        { id: 1, name: '山田 太郎', number: 10, position: 'FW', history: [{ id: 101, date: '2026-07-01', comment: '入部時評価', skills: [4, 3, 5, 2, 4, 3] }] },
        { id: 2, name: '佐藤 次郎', number: 5, position: 'DF', history: [{ id: 102, date: '2026-07-01', comment: '入部時評価', skills: [2, 4, 3, 5, 4, 4] }] }
    ],
    menuLibrary: [
        { id: 201, focus: 'ポゼッション 4vs4+フリーマン', organize: '20m x 20m グリッド\n4 vs 4 + 1フリーマン', keyfactor: '・ボールを受ける前の首振り\n・サポートの角度と距離', options: '・パスが5本繋がったら1点\n・慣れたら2タッチ制限', frames: null }
    ],
    matchTypes: ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'],
    menuCategories: ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'],
    skillMetrics: ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'],
    positions: ['FW', 'MF', 'DF', 'GK'],
    teamInfo: { name: 'My Team', color: '#f23932' },
    currentRoute: 'dashboard'
};

let currentMatchNendo = 'all';
let currentPracticeNendo = 'all';
let currentLibraryCategory = 'all';

function getNendo(dateStr) {
    const d = new Date(dateStr);
    let year = d.getFullYear();
    if (d.getMonth() < 3) year--; // Jan, Feb, Mar
    return year;
}

// LocalStorage Logic
function loadData() {
    const saved = localStorage.getItem('coachMgrData');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.matches = parsed.matches || [];
        state.practices = parsed.practices || [];
        state.players = parsed.players || [];
        state.matchTypes = parsed.matchTypes || ['リーグ戦', 'カップ戦', 'トレーニングマッチ', '招待杯'];
        state.menuCategories = parsed.menuCategories || ['ウォーミングアップ', 'パス＆コントロール', 'ポゼッション', 'シュート', '守備', 'ゲーム', 'その他'];
        state.skillMetrics = parsed.skillMetrics || ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
        state.positions = parsed.positions || ['FW', 'MF', 'DF', 'GK'];
        state.teamInfo = parsed.teamInfo || { name: 'My Team', color: '#f23932' };

        state.menuLibrary = parsed.menuLibrary || [
            { id: 201, focus: 'ポゼッション 4vs4+フリーマン', organize: '20m x 20m グリッド\n4 vs 4 + 1フリーマン', keyfactor: '・ボールを受ける前の首振り\n・サポートの角度と距離', options: '・パスが5本繋がったら1点\n・慣れたら2タッチ制限', category: 'ポゼッション', frames: null }
        ];

        // Migrate matches
        state.matches.forEach(m => {
            if (!m.playerFeedback) m.playerFeedback = [];
            if (!m.formations) m.formations = [];
            if (!m.type) m.type = 'リーグ戦';
        });

        // Migrate old practice data format if needed
        state.practices = state.practices.map(p => {
            if (p.focus) { // Old format detected
                return {
                    id: p.id,
                    date: p.date,
                    attendance: p.attendance,
                    menus: [{ id: Date.now(), focus: p.focus, category: 'その他', frames: p.frames }]
                };
            }
            return p;
        });

        // Migrate menus to include category
        state.menuLibrary.forEach(m => {
            if (!m.category) {
                if (m.focus.includes('ポゼッション')) m.category = 'ポゼッション';
                else if (m.focus.includes('パス')) m.category = 'パス＆コントロール';
                else if (m.focus.includes('シュート')) m.category = 'シュート';
                else if (m.focus.includes('ゲーム') || m.focus.includes('戦')) m.category = 'ゲーム';
                else m.category = 'その他';
            }
        });

        state.practices.forEach(p => {
            if (p.menus) {
                p.menus.forEach(m => {
                    if (!m.category) {
                        if (m.focus.includes('ポゼッション')) m.category = 'ポゼッション';
                        else if (m.focus.includes('パス')) m.category = 'パス＆コントロール';
                        else if (m.focus.includes('シュート')) m.category = 'シュート';
                        else if (m.focus.includes('ゲーム') || m.focus.includes('戦')) m.category = 'ゲーム';
                        else m.category = 'その他';
                    }
                });
            }
        });

        // Migrate players to use history
        state.players.forEach(p => {
            if (p.skills && !p.history) {
                p.history = [{ id: Date.now(), date: new Date().toISOString().split('T')[0], comment: '旧データ移行', skills: p.skills }];
                delete p.skills;
            }
        });
    } else {
        // Default seed data
        state.menuLibrary = [
            { id: 201, focus: 'ポゼッション 4vs4+フリーマン', organize: '20m x 20m グリッド\n4 vs 4 + 1フリーマン', keyfactor: '・ボールを受ける前の首振り\n・サポートの角度と距離', options: '・パスが5本繋がったら1点\n・慣れたら2タッチ制限', category: 'ポゼッション', frames: null }
        ];
    }
}

function saveData() {
    localStorage.setItem('coachMgrData', JSON.stringify({
        matches: state.matches,
        practices: state.practices,
        players: state.players,
        menuLibrary: state.menuLibrary,
        matchTypes: state.matchTypes,
        menuCategories: state.menuCategories,
        skillMetrics: state.skillMetrics,
        positions: state.positions,
        teamInfo: state.teamInfo
    }));
}

// Show a fallback modal with the JSON text for environments where download is not available (iOS, file://)
function _showExportFallbackModal(jsonStr) {
    const modal = document.getElementById('modal-export-fallback');
    const textarea = document.getElementById('export-json-textarea');
    const btnCopy = document.getElementById('btn-copy-export-json');
    const successMsg = document.getElementById('export-copy-success');
    if (!modal || !textarea) return;

    textarea.value = jsonStr;
    if (successMsg) successMsg.style.display = 'none';
    modal.classList.remove('hidden');

    if (btnCopy) {
        const newBtn = btnCopy.cloneNode(true);
        btnCopy.parentNode.replaceChild(newBtn, btnCopy);
        newBtn.addEventListener('click', () => {
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length); // for mobile
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(jsonStr).then(() => {
                        const msg = document.getElementById('export-copy-success');
                        if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2500); }
                    });
                } else {
                    document.execCommand('copy');
                    const msg = document.getElementById('export-copy-success');
                    if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 2500); }
                }
            } catch(e) {
                alert('コピーできませんでした。テキストを手動で選択してコピーしてください。');
            }
        });
    }
}

// DOM Elements
const viewContainer = document.getElementById('view-container');
const topbarTitle = document.getElementById('topbar-title');
const navLinks = document.querySelectorAll('.nav-links li');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// Initialization
function init() {
    try {
        loadData();
        
        // Apply Team Info Settings
        document.documentElement.style.setProperty('--primary', state.teamInfo.color);
        const sidebarTitle = document.querySelector('.sidebar-header h2');
        if(sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
        setupEventListeners();
        setupModals();
        navigate('dashboard');
    } catch (e) {
        console.error("Initialization error:", e);
        alert("初期化エラーが発生しました: " + e.message);
        // Attempt recovery navigation
        try {
            navigate('dashboard');
        } catch (err) {}
    }
}

// UI Helpers
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Routing & Navigation
function setupEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            navigate(route);
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

function navigate(route, params = null) {
    if (typeof stopAnimation === 'function') {
        stopAnimation();
    }
    canvas = null;
    ctx = null;
    state.currentRoute = route;
    
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.route === route);
        if (link.dataset.route === route) {
            topbarTitle.textContent = link.textContent.trim();
        }
    });

    // Auto-close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
    }

    const template = document.getElementById(`tpl-${route}`);
    if (template) {
        viewContainer.innerHTML = '';
        viewContainer.appendChild(template.content.cloneNode(true));
        
        if (route === 'dashboard') initDashboard();
        if (route === 'matches') initMatches();
        if (route === 'practices') initPractices();
        if (route === 'players') initPlayers();
        if (route === 'library') initLibrary();
        if (route === 'settings') initSettings();
        if (route === 'animation') initAnimation(params);
    }
}

// Modals & Forms
// Modals & Forms
function addGoalRecordRow(scorerId = null, assistId = null) {
    const container = document.getElementById('goal-records-list');
    if (!container) return;
    
    const rowId = 'goal-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const sortedPlayers = [...state.players].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
    });

    const scorerOptions = `<option value="">得点者なし/OG</option>` + 
        sortedPlayers.map(p => `<option value="${p.id}" ${p.id === scorerId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
        
    const assistOptions = `<option value="">アシストなし</option>` + 
        sortedPlayers.map(p => `<option value="${p.id}" ${p.id === assistId ? 'selected' : ''}>${p.number} ${p.name}</option>`).join('');
        
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'goal-record-row';
    div.style = 'display:flex; gap:0.5rem; align-items:center; width:100%;';
    div.innerHTML = `
        <select class="form-control goal-scorer-select" style="flex:1; padding:0.3rem; font-size:0.85rem;">
            ${scorerOptions}
        </select>
        <span style="font-size:0.8rem; color:var(--text-secondary);">アシ:</span>
        <select class="form-control goal-assist-select" style="flex:1; padding:0.3rem; font-size:0.85rem;">
            ${assistOptions}
        </select>
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.5rem; font-size:0.85rem;"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function setupModals() {
    const closeBtns = document.querySelectorAll('.btn-close-modal');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    });

    // Close modal when clicking outside (on the backdrop overlay)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });

    const btnAddGoalRecord = document.getElementById('btn-add-goal-record');
    if (btnAddGoalRecord) {
        btnAddGoalRecord.onclick = () => {
            addGoalRecordRow();
        };
    }

    const matchScoreUs = document.getElementById('match-score-us');
    if (matchScoreUs) {
        matchScoreUs.addEventListener('input', (e) => {
            const score = parseInt(e.target.value, 10) || 0;
            const container = document.getElementById('goal-records-list');
            if (container) {
                const currentRows = container.querySelectorAll('.goal-record-row').length;
                if (score > currentRows) {
                    const diff = score - currentRows;
                    for (let i = 0; i < diff; i++) {
                        addGoalRecordRow();
                    }
                }
            }
        });
    }

    document.getElementById('form-match').addEventListener('submit', (e) => {
        e.preventDefault();
        const scoreUs = document.getElementById('match-score-us').value;
        const scoreThem = document.getElementById('match-score-them').value;
        let goodStr = document.getElementById('match-comments-good').value.trim();
        let improveStr = document.getElementById('match-comments-improve').value.trim();
        let commentsStr = '';
        if (goodStr || improveStr) {
            commentsStr = '【ポジティブ】\n' + goodStr + '\n\n【ネクストステップ】\n' + improveStr;
        }
        
        // Collect goal records and generate scorers string
        const goalRecords = [];
        const rows = document.querySelectorAll('#goal-records-list .goal-record-row');
        const scorersList = [];
        
        rows.forEach(row => {
            const scorerVal = row.querySelector('.goal-scorer-select').value;
            const assistVal = row.querySelector('.goal-assist-select').value;
            const scorerId = scorerVal ? parseInt(scorerVal, 10) : null;
            const assistId = assistVal ? parseInt(assistVal, 10) : null;
            
            goalRecords.push({ scorerId, assistId });
            
            let text = '';
            if (scorerId) {
                const sPlayer = state.players.find(p => p.id === scorerId);
                text += sPlayer ? `${sPlayer.name}` : '不明な選手';
            } else {
                text += 'オウンゴール/その他';
            }
            if (assistId) {
                const aPlayer = state.players.find(p => p.id === assistId);
                text += aPlayer ? ` (アシスト:${aPlayer.name})` : '';
            }
            scorersList.push(text);
        });
        const scorersStr = scorersList.join(', ');

        const matchId = document.getElementById('match-edit-id').value;
        if (matchId) {
            const match = state.matches.find(m => m.id === parseInt(matchId));
            if (match) {
                match.date = document.getElementById('match-date').value;
                match.opponent = document.getElementById('match-opponent').value;
                match.type = document.getElementById('match-type').value;
                match.result = `${scoreUs}-${scoreThem}`;
                match.scorers = scorersStr;
                match.goalRecords = goalRecords;
                match.comments = commentsStr;
                showToast('試合情報を更新しました');
            }
        } else {
            const newMatch = {
                id: Date.now(),
                date: document.getElementById('match-date').value,
                opponent: document.getElementById('match-opponent').value,
                type: document.getElementById('match-type').value,
                result: `${scoreUs}-${scoreThem}`,
                scorers: scorersStr,
                goalRecords: goalRecords,
                comments: commentsStr,
                playerFeedback: [],
                formations: []
            };
            state.matches.unshift(newMatch);
            showToast('試合を記録しました');
        }
        
        saveData();
        document.getElementById('modal-match').classList.add('hidden');
        navigate('matches');
        
        if (matchId) {
            openMatchDetail(parseInt(matchId));
        }
        
        e.target.reset();
        document.getElementById('match-edit-id').value = '';
    });

    document.getElementById('form-practice').addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = document.getElementById('practice-edit-id').value;
        
        // Collect checked players
        const checkedBoxes = document.querySelectorAll('#practice-attendance-roster input[type="checkbox"]:checked');
        const presentIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
        const attendanceStr = `${presentIds.length}/${state.players.length}`;

        if (editId) {
            const practice = state.practices.find(p => p.id === parseInt(editId));
            if (practice) {
                practice.date = document.getElementById('practice-date').value;
                practice.attendance = attendanceStr;
                practice.presentPlayerIds = presentIds;
                showToast('練習日情報を更新しました');
            }
        } else {
            const newPractice = {
                id: Date.now(),
                date: document.getElementById('practice-date').value,
                attendance: attendanceStr,
                presentPlayerIds: presentIds,
                menus: []
            };
            state.practices.unshift(newPractice);
            showToast('練習日を記録しました');
        }
        
        saveData();
        document.getElementById('modal-practice').classList.add('hidden');
        navigate('practices');
        e.target.reset();
        document.getElementById('practice-edit-id').value = '';
    });

    // Populate Library Select when changed
    document.getElementById('menu-library-select').addEventListener('change', (e) => {
        const libId = parseInt(e.target.value);
        if(libId) {
            const libMenu = state.menuLibrary.find(m => m.id === libId);
            if(libMenu) {
                document.getElementById('menu-focus').value = libMenu.focus || '';
                document.getElementById('menu-organize').value = libMenu.organize || '';
                document.getElementById('menu-keyfactor').value = libMenu.keyfactor || '';
                document.getElementById('menu-options').value = libMenu.options || '';
                document.getElementById('menu-category').value = libMenu.category || 'その他';
                document.getElementById('menu-library-source-id').value = libMenu.id;
            }
        } else {
            // Reset fields
            document.getElementById('menu-focus').value = '';
            document.getElementById('menu-organize').value = '';
            document.getElementById('menu-keyfactor').value = '';
            document.getElementById('menu-options').value = '';
            document.getElementById('menu-category').value = 'ウォーミングアップ';
            document.getElementById('menu-library-source-id').value = '';
        }
    });

    document.getElementById('form-menu').addEventListener('submit', (e) => {
        e.preventDefault();
        const practiceId = document.getElementById('menu-practice-id').value;
        const sourceId = document.getElementById('menu-library-source-id').value;
        
        let frames = null;
        if(sourceId) {
            const src = state.menuLibrary.find(m => m.id === parseInt(sourceId));
            if(src && src.frames) {
                frames = JSON.parse(JSON.stringify(src.frames)); // deep copy frames
            }
        }

        const newMenuObj = {
            id: Date.now(),
            focus: document.getElementById('menu-focus').value,
            organize: document.getElementById('menu-organize').value,
            keyfactor: document.getElementById('menu-keyfactor').value,
            options: document.getElementById('menu-options').value,
            category: document.getElementById('menu-category').value,
            frames: frames
        };
        
        const editId = document.getElementById('menu-edit-id') ? document.getElementById('menu-edit-id').value : '';
        if (editId) {
            let targetMenu = null;
            if (practiceId === 'library') {
                targetMenu = state.menuLibrary.find(m => m.id === parseInt(editId));
            } else {
                const practice = state.practices.find(p => p.id === parseInt(practiceId));
                if (practice) {
                    targetMenu = practice.menus.find(m => m.id === parseInt(editId));
                }
            }
            if (targetMenu) {
                targetMenu.focus = newMenuObj.focus;
                targetMenu.organize = newMenuObj.organize;
                targetMenu.keyfactor = newMenuObj.keyfactor;
                targetMenu.options = newMenuObj.options;
                targetMenu.category = newMenuObj.category;
                saveData();
                showToast('メニューを更新しました');
                document.getElementById('modal-menu').classList.add('hidden');
                
                const animView = document.getElementById('view-animation');
                if (animView && animView.classList.contains('active')) {
                    document.getElementById('anim-menu-focus').textContent = targetMenu.focus || 'メニュー';
                    const orgDiv = document.getElementById('anim-menu-organize-container');
                    if (targetMenu.organize) { orgDiv.style.display = 'block'; document.getElementById('anim-menu-organize').textContent = targetMenu.organize; } else { orgDiv.style.display = 'none'; }
                    const kfDiv = document.getElementById('anim-menu-keyfactor-container');
                    if (targetMenu.keyfactor) { kfDiv.style.display = 'block'; document.getElementById('anim-menu-keyfactor').textContent = targetMenu.keyfactor; } else { kfDiv.style.display = 'none'; }
                    const optDiv = document.getElementById('anim-menu-options-container');
                    if (targetMenu.options) { optDiv.style.display = 'block'; document.getElementById('anim-menu-options').textContent = targetMenu.options; } else { optDiv.style.display = 'none'; }
                } else {
                    if (practiceId === 'library') navigate('library');
                    else navigate('practices');
                }
                
                e.target.reset();
                if(document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';
                document.getElementById('menu-library-source-id').value = '';
                return;
            }
        }

        if (practiceId === 'library') {
            state.menuLibrary.push(newMenuObj);
            saveData();
            showToast('ライブラリに保存しました');
            document.getElementById('modal-menu').classList.add('hidden');
            navigate('library');
        } else {
            const practice = state.practices.find(p => p.id === parseInt(practiceId));
            if (practice) {
                practice.menus.push(newMenuObj);
                saveData();
                showToast('メニューを追加しました');
                document.getElementById('modal-menu').classList.add('hidden');
                navigate('practices');
            }
        }
        e.target.reset();
        document.getElementById('menu-library-source-id').value = '';
    });

    const formPlayer = document.getElementById('form-player');
    if(formPlayer) {
        formPlayer.addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = document.getElementById('player-edit-id').value;
            const selectedPositions = [];
            document.querySelectorAll('.player-pos-checkbox:checked').forEach(cb => {
                selectedPositions.push(cb.value);
            });
            
            if (editId) {
                // Edit mode
                const player = state.players.find(p => p.id === parseInt(editId));
                if (player) {
                    player.name = document.getElementById('player-name').value;
                    player.number = parseInt(document.getElementById('player-number').value);
                    player.position = selectedPositions;
                    saveData();
                    showToast('選手情報を更新しました');
                    document.getElementById('modal-player').classList.add('hidden');
                    initPlayers();
                    openPlayerDetail(player.id); // Refresh detail modal
                }
            } else {
                // Create mode
                const skills = [];
                state.skillMetrics.forEach((metric, i) => {
                    const val = document.getElementById(`skill-initial-${i}`);
                    skills.push(val ? parseInt(val.value) : 3);
                });
                const newPlayer = {
                    id: Date.now(),
                    name: document.getElementById('player-name').value,
                    number: parseInt(document.getElementById('player-number').value),
                    position: selectedPositions,
                    history: [
                        {
                            id: Date.now(),
                            date: new Date().toISOString().split('T')[0],
                            comment: '【ポジティブ】\n' + document.getElementById('player-initial-good').value + '\n\n【ネクストステップ】\n' + document.getElementById('player-initial-improve').value,
                            skills: skills
                        }
                    ]
                };
                state.players.push(newPlayer);
                saveData();
                showToast('選手を登録しました');
                document.getElementById('modal-player').classList.add('hidden');
                navigate('players');
            }
            e.target.reset();
        });
    }

    const formMatchFeedback = document.getElementById('form-match-feedback');
    if(formMatchFeedback) {
        formMatchFeedback.addEventListener('submit', (e) => {
            e.preventDefault();
            const matchId = parseInt(document.getElementById('feedback-match-id').value);
            const match = state.matches.find(m => m.id === matchId);
            if(match) {
                const inputs = document.querySelectorAll('.bulk-feedback-good');
                let addedCount = 0;
                
                inputs.forEach(inputGood => {
                    const playerId = parseInt(inputGood.dataset.playerId);
                    const inputImprove = document.querySelector(`.bulk-feedback-improve[data-player-id="${playerId}"]`);
                    const good = inputGood.value.trim();
                    const improve = inputImprove ? inputImprove.value.trim() : '';
                    
                    if (good || improve) {
                        const comment = '【ポジティブ】\n' + good + '\n\n【ネクストステップ】\n' + improve;
                        const existingFb = match.playerFeedback.find(fb => fb.playerId === playerId);
                        if (existingFb) {
                            existingFb.comment = comment; // Update existing
                        } else {
                            match.playerFeedback.push({ id: Date.now() + addedCount, playerId, comment });
                        }
                        addedCount++;
                    }
                });
                
                if (addedCount > 0) {
                    saveData();
                    showToast(`${addedCount}件のフィードバックを保存しました`);
                    document.getElementById('modal-match-feedback').classList.add('hidden');
                    
                    // Re-render detail view if open
                    const btnDetail = document.querySelector(`.btn-detail-match[data-id="${matchId}"]`);
                    if(btnDetail) btnDetail.click();
                } else {
                    showToast('コメントが入力されていません');
                }
            }
        });
    }

    const formFormation = document.getElementById('form-formation');
    if (formFormation) {
        formFormation.addEventListener('submit', (e) => {
            e.preventDefault();
            const matchId = parseInt(document.getElementById('formation-match-id').value);
            const formationId = document.getElementById('formation-id').value;
            const match = state.matches.find(m => m.id === matchId);
            
            if(match) {
                const name = document.getElementById('formation-name').value;
                const system = document.getElementById('formation-system').value;
                
                const selects = document.querySelectorAll('.formation-pos-select');
                const lineup = [];
                selects.forEach(sel => {
                    const role = sel.value;
                    const playerId = parseInt(sel.dataset.playerId);
                    if (role) {
                        lineup.push({ playerId, role });
                    }
                });

                if (formationId) {
                    // Update
                    const formObj = match.formations.find(f => f.id === parseInt(formationId));
                    if (formObj) {
                        formObj.name = name;
                        formObj.system = system;
                        formObj.lineup = lineup;
                    }
                } else {
                    // Create new
                    match.formations.push({
                        id: Date.now(),
                        name,
                        system,
                        lineup,
                        boardData: []
                    });
                }
                
                saveData();
                showToast('フォーメーションを保存しました');
                document.getElementById('modal-formation').classList.add('hidden');
                
                // Re-render detail view
                const btnDetail = document.querySelector(`.btn-detail-match[data-id="${matchId}"]`);
                if(btnDetail) btnDetail.click();
            }
        });
    }

    const btnAnimFormation = document.getElementById('btn-anim-formation');
    if(btnAnimFormation) {
        btnAnimFormation.addEventListener('click', () => {
            const matchId = document.getElementById('formation-match-id').value;
            const formationId = document.getElementById('formation-id').value;
            if(!formationId) {
                alert('先に「保存する」ボタンを押してピリオドを作成してください。');
                return;
            }
            document.getElementById('modal-formation').classList.add('hidden');
            document.getElementById('modal-match-detail').classList.add('hidden');
            navigate('animation', { matchId: parseInt(matchId), formId: parseInt(formationId) });
        });
    }

    const formPlayerAssessment = document.getElementById('form-player-assessment');
    if(formPlayerAssessment) {
        formPlayerAssessment.addEventListener('submit', (e) => {
            e.preventDefault();
            const playerId = parseInt(document.getElementById('assessment-player-id').value);
            const player = state.players.find(p => p.id === playerId);
            if(player) {
                const skills = [];
                state.skillMetrics.forEach((metric, i) => {
                    const val = document.getElementById(`skill-ass-${i}`);
                    skills.push(val ? parseInt(val.value) : 3);
                });
                player.history.push({
                    id: Date.now(),
                    date: document.getElementById('assessment-date').value,
                    comment: '【ポジティブ】\n' + document.getElementById('assessment-good').value + '\n\n【ネクストステップ】\n' + document.getElementById('assessment-improve').value,
                    skills: skills
                });
                // Sort history by date descending
                player.history.sort((a,b) => new Date(b.date) - new Date(a.date));
                saveData();
                showToast('評価を記録しました');
                document.getElementById('modal-player-assessment').classList.add('hidden');
                
                // Refresh player detail view
                openPlayerDetail(playerId);
                
                // Re-render grid to update radar
                navigate('players');
            }
            e.target.reset();
        });
    }
}

function openModal(id) {
    if(id === 'modal-menu') {
        const catSel = document.getElementById('menu-category');
        if(catSel) {
            const currentVal = catSel.value;
            catSel.innerHTML = state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
            if(state.menuCategories.includes(currentVal)) catSel.value = currentVal;
            else if(state.menuCategories.length > 0) catSel.value = state.menuCategories[0];
        }
    }
    document.getElementById(id).classList.remove('hidden');
}

function initDashboard() {
    // 1. Calculate overall stats
    let wins = 0, losses = 0, draws = 0;
    state.matches.forEach(m => {
        const [us, them] = m.result.split('-').map(Number);
        if (us > them) wins++;
        else if (us < them) losses++;
        else draws++;
    });
    
    const dbRecord = document.getElementById('dash-db-record');
    const dbRecordBar = document.getElementById('dash-db-record-bar');
    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    
    if (dbRecord) dbRecord.innerHTML = `${wins}勝 ${losses}敗 ${draws}分 <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary); margin-left:0.25rem;">(勝率:${winRate}%)</span>`;
    if (dbRecordBar) dbRecordBar.style.width = `${winRate}%`;

    // 2. Set count cards
    const dbPractices = document.getElementById('dash-db-practices');
    if (dbPractices) dbPractices.textContent = `${state.practices.length}回`;

    const dbPlayers = document.getElementById('dash-db-players');
    if (dbPlayers) dbPlayers.textContent = `${state.players.length}名`;

    // Click handlers for stats cards to jump to corresponding views
    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) cardMatches.onclick = () => navigate('matches');
    
    const cardPractices = document.getElementById('dash-card-practices');
    if (cardPractices) cardPractices.onclick = () => navigate('practices');
    
    const cardPlayers = document.getElementById('dash-card-players');
    if (cardPlayers) cardPlayers.onclick = () => navigate('players');

    // Button navigations
    const btnGoPractices = document.getElementById('dash-btn-go-practices');
    if (btnGoPractices) btnGoPractices.onclick = () => navigate('practices');

    const btnGoMatches = document.getElementById('dash-btn-go-matches');
    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');

    const btnGoPlayers = document.getElementById('dash-btn-go-players');
    if (btnGoPlayers) btnGoPlayers.onclick = () => navigate('players');

    // 3. Render next/most recent practice
    const practiceContent = document.getElementById('dash-practice-content');
    if (practiceContent) {
        if (state.practices.length > 0) {
            // Sort practices by date descending to find the latest
            const sortedPractices = [...state.practices].sort((a,b) => new Date(b.date) - new Date(a.date));
            const p = sortedPractices[0];
            
            let menusHtml = p.menus && p.menus.length > 0 ? p.menus.map(menu => `
                <li class="practice-menu-item" style="margin-bottom: 0.35rem; padding: 0.6rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--primary); font-size:0.9rem;">${menu.focus}</span>
                        <button class="btn btn-secondary btn-dash-anim-practice" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.2rem 0.4rem; font-size:0.75rem;"><i class="fa-solid fa-person-running"></i> 作図</button>
                    </div>
                    ${menu.organize ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>オーガナイズ:</strong> ${menu.organize.split('\n')[0]}</div>` : ''}
                </li>
            `).join('') : '<li class="text-secondary" style="font-style:italic; padding:0.5rem 0; list-style:none;">メニュー登録なし</li>';
            
            practiceContent.innerHTML = `
                <div style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:12px; padding:1rem; box-sizing:border-box;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <div style="font-size:1.15rem; font-weight:bold;"><i class="fa-regular fa-calendar"></i> ${p.date}</div>
                        <div class="text-secondary" style="font-size:0.85rem;"><i class="fa-solid fa-users"></i> 出席: ${p.attendance}</div>
                    </div>
                    <ul class="practice-card-menu-list" style="max-height: 200px;">
                        ${menusHtml}
                    </ul>
                </div>
            `;
            
            // Add click handlers for menu diagrams
            document.querySelectorAll('.btn-dash-anim-practice').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const pid = parseInt(e.currentTarget.dataset.pid);
                    const mid = parseInt(e.currentTarget.dataset.mid);
                    navigate('animation', { practiceId: pid, menuId: mid });
                };
            });
        } else {
            practiceContent.innerHTML = `
                <div class="text-secondary" style="text-align:center; padding:1.5rem; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--surface-border);">
                    練習予定・記録がありません。<br>
                    <button class="btn btn-primary" id="dash-btn-add-first-practice" style="margin-top:0.8rem; font-size:0.8rem; padding:0.4rem 0.8rem;"><i class="fa-solid fa-plus"></i> 最初の練習日を追加</button>
                </div>
            `;
            const btnAddFirst = document.getElementById('dash-btn-add-first-practice');
            if (btnAddFirst) {
                btnAddFirst.onclick = () => {
                    navigate('practices');
                    setTimeout(() => {
                        const btnAdd = document.getElementById('btn-add-practice');
                        if (btnAdd) btnAdd.click();
                    }, 50);
                };
            }
        }
    }

    // 4. Render recent matches (latest 3)
    const matchesContent = document.getElementById('dash-matches-content');
    if (matchesContent) {
        if (state.matches.length > 0) {
            const sortedMatches = [...state.matches].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            matchesContent.innerHTML = sortedMatches.map(m => {
                const [us, them] = m.result.split('-').map(Number);
                let badgeClass = 'badge-sub';
                let resultLabel = 'D';
                if (us > them) { badgeClass = 'badge-fw'; resultLabel = 'W'; }
                else if (us < them) { badgeClass = 'badge-df'; resultLabel = 'L'; }
                
                return `
                    <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; cursor:pointer;" onclick="openMatchDetail(${m.id})">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <span class="player-position ${badgeClass}" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:0.75rem; font-weight:bold; padding:0;">${resultLabel}</span>
                            <div>
                                <strong style="font-size:0.9rem;">vs ${m.opponent}</strong>
                                <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                            </div>
                        </div>
                        <div style="font-size:1.1rem; font-weight:bold; color:var(--primary);">${m.result}</div>
                    </div>
                `;
            }).join('');
        } else {
            matchesContent.innerHTML = `
                <div class="text-secondary" style="text-align:center; padding:1.5rem; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--surface-border);">
                    試合記録がありません。<br>
                    <button class="btn btn-primary" id="dash-btn-add-first-match" style="margin-top:0.8rem; font-size:0.8rem; padding:0.4rem 0.8rem;"><i class="fa-solid fa-plus"></i> 最初の試合を記録</button>
                </div>
            `;
            const btnAddFirst = document.getElementById('dash-btn-add-first-match');
            if (btnAddFirst) {
                btnAddFirst.onclick = () => {
                    navigate('matches');
                    setTimeout(() => {
                        const btnAdd = document.getElementById('btn-add-match');
                        if (btnAdd) btnAdd.click();
                    }, 50);
                };
            }
        }
    }

    // 5. Render Top Scorers and Assists lists (Top 3)
    const scorerCounts = {};
    const assistCounts = {};
    state.matches.forEach(m => {
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId) scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                if (r.assistId) assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
            });
        }
    });

    const topScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a,b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)))
        .slice(0, 3);

    const topAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a,b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)))
        .slice(0, 3);

    const elTopScorers = document.getElementById('dash-top-scorers');
    if(elTopScorers) {
        elTopScorers.innerHTML = topScorers.length > 0 
            ? topScorers.map(item => `<li style="margin-bottom:0.25rem; cursor:pointer;" onclick="openPlayerDetail(${item.p.id})"><strong>${item.p.number} ${item.p.name}</strong> (${item.count}得点)</li>`).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">得点記録がありません。</div>';
    }

    const elTopAssists = document.getElementById('dash-top-assists');
    if(elTopAssists) {
        elTopAssists.innerHTML = topAssists.length > 0 
            ? topAssists.map(item => `<li style="margin-bottom:0.25rem; cursor:pointer;" onclick="openPlayerDetail(${item.p.id})"><strong>${item.p.number} ${item.p.name}</strong> (${item.count}アシスト)</li>`).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">アシスト記録がありません。</div>';
    }
}

// View Initializers
function initMatches() {
    // Nendo Filter Setup
    const matchNendos = [...new Set(state.matches.map(m => getNendo(m.date)))].sort((a,b) => b - a);
    const filterSelect = document.getElementById('filter-nendo-match');
    if (filterSelect) {
        let options = '<option value="all">すべての年度</option>';
        matchNendos.forEach(y => {
            options += `<option value="${y}" ${currentMatchNendo === String(y) ? 'selected' : ''}>${y}年度</option>`;
        });
        filterSelect.innerHTML = options;
        
        filterSelect.onchange = (e) => {
            currentMatchNendo = e.target.value;
            initMatches();
        };
    }

    const filteredMatches = currentMatchNendo === 'all' 
        ? state.matches 
        : state.matches.filter(m => String(getNendo(m.date)) === currentMatchNendo);

    // Stats Update
    let wins = 0, losses = 0, draws = 0, goals = 0;
    filteredMatches.forEach(m => {
        const [us, them] = m.result.split('-').map(Number);
        goals += us;
        if(us > them) wins++;
        else if(us < them) losses++;
        else draws++;
    });
    const elRecord = document.getElementById('dash-record');
    const elGoals = document.getElementById('dash-goals');
    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    if (elRecord) elRecord.innerHTML = `${wins}勝 ${losses}敗 ${draws}分 <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary); margin-left:0.25rem;">(勝率:${winRate}%)</span>`;
    if (elGoals) elGoals.textContent = goals;
    const bar = document.getElementById('dash-record-bar');
    if (bar) bar.style.width = `${winRate}%`;

    // Top 3 Scorers & Assists calculation
    const scorerCounts = {};
    const assistCounts = {};
    filteredMatches.forEach(m => {
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId) {
                    scorerCounts[r.scorerId] = (scorerCounts[r.scorerId] || 0) + 1;
                }
                if (r.assistId) {
                    assistCounts[r.assistId] = (assistCounts[r.assistId] || 0) + 1;
                }
            });
        }
    });

    const topScorers = Object.entries(scorerCounts)
        .map(([id, count]) => {
            const p = state.players.find(pl => pl.id === parseInt(id, 10));
            return { p, count };
        })
        .filter(x => x.p)
        .sort((a,b) => b.count - a.count || (parseInt(a.p.number) - parseInt(b.p.number)))
        .slice(0, 3);

    const topAssists = Object.entries(assistCounts)
        .map(([id, count]) => {
            const p = state.players.find(pl => pl.id === parseInt(id, 10));
            return { p, count };
        })
        .filter(x => x.p)
        .sort((a,b) => b.count - a.count || (parseInt(a.p.number) - parseInt(b.p.number)))
        .slice(0, 3);

    const topScorersList = document.getElementById('top-scorers-list');
    if (topScorersList) {
        topScorersList.innerHTML = topScorers.length > 0 
            ? topScorers.map(item => `<li>${item.p.name} (${item.count}点)</li>`).join('')
            : '<div style="color:var(--text-secondary); font-size:0.75rem;">-</div>';
    }

    const topAssistsList = document.getElementById('top-assists-list');
    if (topAssistsList) {
        topAssistsList.innerHTML = topAssists.length > 0 
            ? topAssists.map(item => `<li>${item.p.name} (${item.count}アシ)</li>`).join('')
            : '<div style="color:var(--text-secondary); font-size:0.75rem;">-</div>';
    }

    // List Update (Grouped by month grid, similar to practices)
    const matchList = document.getElementById('match-list');
    if (matchList) {
        const grouped = {};
        filteredMatches.forEach(m => {
            const ym = m.date.substring(0, 7).replace('-', '年') + '月';
            if (!grouped[ym]) grouped[ym] = [];
            grouped[ym].push(m);
        });

        const sortedMonths = Object.keys(grouped).sort().reverse();
        let html = '';
        sortedMonths.forEach(month => {
            html += `
                <div class="month-section">
                    <h3>${month}</h3>
                    <div class="library-grid">
            `;
            grouped[month].forEach(m => {
                html += `
                    <div class="card match-card">
                        <div class="match-card-header">
                            <div>
                                <div class="match-card-date"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                                <div class="match-card-opponent">vs ${m.opponent}</div>
                            </div>
                            <div class="match-card-result">${m.result}</div>
                        </div>
                        <div class="match-card-scorers" title="${m.scorers || '記録なし'}">
                            <i class="fa-solid fa-futbol" style="font-size:0.8rem;"></i> ${m.scorers || '記録なし'}
                        </div>
                        <div class="match-card-actions">
                            <button class="btn btn-secondary btn-detail-match" data-id="${m.id}"><i class="fa-solid fa-circle-info"></i> 詳細</button>
                            <button class="btn btn-danger btn-delete-match" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        });
        matchList.innerHTML = html || `
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-trophy"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">まだ試合記録がありません</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    チームの試合結果や得点者、フォーメーション、選手別振り返りメモを記録して、日々の成長を追跡しましょう。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-match" style="margin-top:0.5rem;"><i class="fa-solid fa-plus"></i> 最初の試合を追加</button>
            </div>
        `;
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-match');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-match');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    }

    // Match Modal
    document.getElementById('btn-add-match').addEventListener('click', () => {
        document.getElementById('form-match').reset();
        document.getElementById('match-edit-id').value = '';
        const goalRecordsList = document.getElementById('goal-records-list');
        if (goalRecordsList) goalRecordsList.innerHTML = '';
        const title = document.querySelector('#modal-match h2');
        if (title) title.textContent = '試合を追加';
        const select = document.getElementById('match-type');
        select.innerHTML = state.matchTypes.map(t => `<option value="${t}">${t}</option>`).join('');
        openModal('modal-match');
    });

    document.querySelectorAll('.btn-detail-match').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            openMatchDetail(id);
        });
    });

    document.querySelectorAll('.btn-delete-match').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('この試合記録を削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id);
                state.matches = state.matches.filter(m => m.id !== id);
                saveData();
                showToast('削除しました');
                initMatches();
            }
        });
    });
}

function openMatchDetail(id) {
    const m = state.matches.find(match => match.id === id);
    if(m) {
        // Tab logic
        const tabInfo = document.getElementById('tab-match-info');
        const tabFormation = document.getElementById('tab-match-formation');
        const contentInfo = document.getElementById('match-tab-info');
        const contentFormation = document.getElementById('match-tab-formation');

        tabInfo.onclick = () => {
            tabInfo.style.borderBottom = '2px solid var(--primary)';
            tabInfo.style.color = 'var(--text-primary)';
            tabInfo.classList.remove('text-secondary');
            tabFormation.style.borderBottom = '2px solid transparent';
            tabFormation.classList.add('text-secondary');
            tabFormation.style.color = '';
            contentInfo.classList.remove('hidden');
            contentFormation.classList.add('hidden');
        };

        tabFormation.onclick = () => {
            tabFormation.style.borderBottom = '2px solid var(--primary)';
            tabFormation.style.color = 'var(--text-primary)';
            tabFormation.classList.remove('text-secondary');
            tabInfo.style.borderBottom = '2px solid transparent';
            tabInfo.classList.add('text-secondary');
            tabInfo.style.color = '';
            contentFormation.classList.remove('hidden');
            contentInfo.classList.add('hidden');
        };

        // Default to Info tab
        tabInfo.click();

        // 1. Render Basic Info
        let scorersHtml = '記録なし';
        if (m.goalRecords && m.goalRecords.length > 0) {
            scorersHtml = m.goalRecords.map((r, idx) => {
                let scorerText = '';
                if (r.scorerId) {
                    const sPlayer = state.players.find(pl => pl.id === r.scorerId);
                    scorerText = sPlayer ? `<span class="player-link" data-id="${sPlayer.id}" style="cursor:pointer; font-weight:bold; color:var(--primary); text-decoration:underline;">${sPlayer.number} ${sPlayer.name}</span>` : '不明な選手';
                } else {
                    scorerText = 'オウンゴール/その他';
                }
                
                let assistText = '';
                if (r.assistId) {
                    const aPlayer = state.players.find(pl => pl.id === r.assistId);
                    assistText = aPlayer ? ` (アシ: <span class="player-link" data-id="${aPlayer.id}" style="cursor:pointer; font-weight:bold; color:var(--primary); text-decoration:underline;">${aPlayer.number} ${aPlayer.name}</span>)` : '';
                }
                return `<div style="margin-bottom:0.25rem;">${idx+1}. ${scorerText}${assistText}</div>`;
            }).join('');
        } else if (m.scorers) {
            scorersHtml = `<div>${m.scorers}</div>`;
        }

        const content = document.getElementById('match-detail-content');
        content.innerHTML = `
            <div style="font-size:1.2rem; font-weight:bold;">${m.date} | ${m.type}</div>
            <div style="font-size:1.5rem; color:var(--primary); margin-bottom:1rem;">vs ${m.opponent} (${m.result})</div>
            <div class="detail-box">
                <h4><i class="fa-solid fa-futbol"></i> 得点者・アシスト</h4>
                <div style="font-size:0.95rem; line-height:1.4;">${scorersHtml}</div>
            </div>
            <div class="detail-box">
                <h4><i class="fa-solid fa-comment-dots"></i> チーム振り返りメモ</h4>
                <p style="white-space:pre-wrap;">${m.comments || '記録なし'}</p>
            </div>
        `;
        
        // 2. Render Feedback List
        const feedbackList = document.getElementById('match-feedback-list');
        if (m.playerFeedback && m.playerFeedback.length > 0) {
            feedbackList.innerHTML = m.playerFeedback.map(fb => {
                const p = state.players.find(player => player.id === fb.playerId);
                const pname = p ? `${p.number} ${p.name}` : '不明な選手';
                return `
                    <div class="feedback-box">
                        <strong style="color:var(--primary); font-size:0.9rem;">${pname}</strong>
                        <p style="margin-top:0.3rem; font-size:0.95rem; white-space:pre-wrap;">${fb.comment}</p>
                    </div>
                `;
            }).join('');
        } else {
            feedbackList.innerHTML = '<p class="text-secondary" style="font-size:0.9rem;">まだフィードバックはありません。</p>';
        }

        // Setup bulk feedback button
        const btnAddFeedback = document.getElementById('btn-add-match-feedback');
        btnAddFeedback.onclick = () => {
            document.getElementById('feedback-match-id').value = m.id;
            const bulkList = document.getElementById('bulk-feedback-list');
            bulkList.innerHTML = state.players.map(p => {
                const existing = m.playerFeedback.find(fb => fb.playerId === p.id);
                let exGood = '';
                let exImprove = '';
                if (existing && existing.comment) {
                    if (existing.comment.includes('【ポジティブ】')) {
                        const parts = existing.comment.split('【ネクストステップ】');
                        exGood = parts[0] ? parts[0].replace('【ポジティブ】', '').trim() : '';
                        exImprove = parts[1] ? parts[1].trim() : '';
                    } else {
                        exGood = existing.comment;
                    }
                }
                return `
                    <div style="background:rgba(0,0,0,0.03); padding:0.8rem; border-radius:4px; border:1px solid var(--surface-border);">
                        <strong style="color:var(--text-primary); font-size:0.9rem; display:block; margin-bottom:0.5rem;">${p.number} ${p.name}</strong>
                        <div class="form-group" style="margin-bottom:0.5rem;">
                            <label style="font-size:0.75rem; color:var(--text-secondary);">ポジティブ</label>
                            <input type="text" class="form-control bulk-feed-good" data-player-id="${p.id}" value="${exGood}" placeholder="良かった点..." style="font-size:0.85rem; padding:0.25rem 0.5rem; height:auto;">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:0.75rem; color:var(--text-secondary);">ネクストステップ</label>
                            <input type="text" class="form-control bulk-feed-improve" data-player-id="${p.id}" value="${exImprove}" placeholder="改善点・課題..." style="font-size:0.85rem; padding:0.25rem 0.5rem; height:auto;">
                        </div>
                    </div>
                `;
            }).join('');
            openModal('modal-match-feedback');
        };

        // 3. Render Formations List
        const formList = document.getElementById('match-formation-list');
        if (m.formations && m.formations.length > 0) {
            formList.innerHTML = m.formations.map(f => {
                // Group lineup by role
                const roles = { 'FW': [], 'MF': [], 'DF': [], 'GK': [], 'SUB': [] };
                if(f.lineup) {
                    f.lineup.forEach(l => {
                        const p = state.players.find(pl => pl.id === l.playerId);
                        if (p && roles[l.role]) roles[l.role].push(p.name);
                    });
                }
                
                return `
                    <div class="card" style="margin-bottom:1rem; padding:1rem; cursor:pointer;" onclick="editFormation(${m.id}, ${f.id})">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong style="color:var(--primary); font-size:1.1rem;">${f.name}</strong>
                            <span class="badge">${f.system || '-'}</span>
                        </div>
                        <div style="display:flex; gap:1rem;">
                            ${f.boardData && f.boardData.length > 0 ? `
                                <div style="flex-shrink:0; width:200px; height:125px; background:#1e293b; border-radius:4px; overflow:hidden; position:relative;">
                                    <canvas id="mini-pitch-${f.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                                </div>
                            ` : `
                                <div style="flex-shrink:0; width:200px; height:125px; background:rgba(0,0,0,0.05); border-radius:4px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:0.8rem;">
                                    作図なし
                                </div>
                            `}
                            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:0.25rem; flex:1;">
                                ${roles.FW.length ? `<div><span style="color:#ef4444; width:30px; display:inline-block;">FW</span> ${roles.FW.join(', ')}</div>` : ''}
                                ${roles.MF.length ? `<div><span style="color:#facc15; width:30px; display:inline-block;">MF</span> ${roles.MF.join(', ')}</div>` : ''}
                                ${roles.DF.length ? `<div><span style="color:#3b82f6; width:30px; display:inline-block;">DF</span> ${roles.DF.join(', ')}</div>` : ''}
                                ${roles.GK.length ? `<div><span style="color:#10b981; width:30px; display:inline-block;">GK</span> ${roles.GK.join(', ')}</div>` : ''}
                                ${roles.SUB.length ? `<div style="margin-top:0.3rem; padding-top:0.3rem; border-top:1px solid var(--surface-border);"><span style="color:var(--text-secondary); width:30px; display:inline-block;">SUB</span> ${roles.SUB.join(', ')}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Draw mini pitches
            setTimeout(() => {
                m.formations.forEach(f => {
                    if(f.boardData && f.boardData.length > 0) {
                        const mCanv = document.getElementById(`mini-pitch-${f.id}`);
                        if(mCanv) {
                            const mCtx = mCanv.getContext('2d');
                            drawPitchToCtx(f.boardData, mCanv, mCtx, f.pitchTemplate || 'full');
                        }
                    }
                });
            }, 50);

        } else {
            formList.innerHTML = '<p class="text-secondary" style="font-size:0.9rem;">フォーメーション記録はありません。</p>';
        }

        // Setup add formation button
        const btnAddFormation = document.getElementById('btn-add-formation');
        btnAddFormation.onclick = () => {
            document.getElementById('form-formation').reset();
            document.getElementById('formation-match-id').value = m.id;
            document.getElementById('formation-id').value = '';
            
            const pList = document.getElementById('formation-player-list');
            pList.innerHTML = state.players.map(p => `
                <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(0,0,0,0.05); padding:0.4rem; border-radius:4px;">
                    <span style="font-size:0.9rem; flex:1;">${p.number} ${p.name}</span>
                    <select class="form-control formation-pos-select" data-player-id="${p.id}" style="width:70px; padding:0.2rem;">
                        <option value="">-</option>
                        <option value="FW">FW</option>
                        <option value="MF">MF</option>
                        <option value="DF">DF</option>
                        <option value="GK">GK</option>
                        <option value="SUB">SUB</option>
                    </select>
                </div>
            `).join('');

            openModal('modal-formation');
        };

        // Setup Edit Match details click handler
        const btnEditMatch = document.getElementById('btn-edit-match');
        if (btnEditMatch) {
            btnEditMatch.onclick = () => {
                document.getElementById('match-edit-id').value = m.id;
                document.getElementById('match-date').value = m.date;
                document.getElementById('match-opponent').value = m.opponent;
                
                const select = document.getElementById('match-type');
                select.innerHTML = state.matchTypes.map(t => `<option value="${t}">${t}</option>`).join('');
                select.value = m.type;
                
                const scores = m.result.split('-');
                document.getElementById('match-score-us').value = scores[0] || 0;
                document.getElementById('match-score-them').value = scores[1] || 0;
                
                // Clear and repopulate goal records list
                const goalRecordsList = document.getElementById('goal-records-list');
                if (goalRecordsList) {
                    goalRecordsList.innerHTML = '';
                    if (m.goalRecords && m.goalRecords.length > 0) {
                        m.goalRecords.forEach(r => {
                            addGoalRecordRow(r.scorerId, r.assistId);
                        });
                    }
                }
                
                // Parse comments
                let good = '';
                let improve = '';
                if (m.comments) {
                    const parts = m.comments.split('【ネクストステップ】');
                    if (parts.length > 1) {
                        good = parts[0].replace('【ポジティブ】', '').trim();
                        improve = parts[1].trim();
                    } else {
                        good = m.comments.replace('【ポジティブ】', '').trim();
                    }
                }
                document.getElementById('match-comments-good').value = good;
                document.getElementById('match-comments-improve').value = improve;
                
                // Modal swap
                document.getElementById('modal-match-detail').classList.add('hidden');
                
                const title = document.querySelector('#modal-match h2');
                if (title) title.textContent = '試合情報を編集';
                
                openModal('modal-match');
            };
        }

        // Bind player links click
        setTimeout(() => {
            const detailModal = document.getElementById('modal-match-detail');
            document.querySelectorAll('#modal-match-detail .player-link').forEach(link => {
                link.onclick = (e) => {
                    const pid = parseInt(e.currentTarget.dataset.id);
                    if (detailModal) detailModal.classList.add('hidden');
                    openPlayerDetail(pid);
                };
            });
        }, 50);

        openModal('modal-match-detail');
    }
}

let currentPracticeMonth = 'all';

function renderPracticeRoster(selectedPlayerIds = []) {
    const container = document.getElementById('practice-attendance-roster');
    if (!container) return;
    
    if (state.players.length === 0) {
        container.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; margin:0;">登録されている選手がいません。「選手一覧」から選手を登録してください。</p>';
        return;
    }
    
    // Sort players by number
    const sortedPlayers = [...state.players].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
    });

    container.innerHTML = sortedPlayers.map(p => {
        const isChecked = selectedPlayerIds.includes(p.id) ? 'checked' : '';
        return `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; cursor:pointer; padding:0.2rem 0;">
                <input type="checkbox" value="${p.id}" ${isChecked} style="width:16px; height:16px; cursor:pointer;">
                <span>${p.number} ${p.name}</span>
            </label>
        `;
    }).join('');
}

function initPractices() {
    // Nendo Filter Setup
    const practiceNendos = [...new Set(state.practices.map(p => getNendo(p.date)))].sort((a,b) => b - a);
    const filterSelect = document.getElementById('filter-nendo-practice');
    if (filterSelect) {
        let options = '<option value="all">すべての年度</option>';
        practiceNendos.forEach(y => {
            options += `<option value="${y}" ${currentPracticeNendo === String(y) ? 'selected' : ''}>${y}年度</option>`;
        });
        filterSelect.innerHTML = options;
        
        filterSelect.onchange = (e) => {
            currentPracticeNendo = e.target.value;
            currentPracticeMonth = 'all';
            initPractices();
        };
    }

    const filterMonthSelect = document.getElementById('filter-month-practice');
    if (filterMonthSelect) {
        const availablePractices = currentPracticeNendo === 'all' 
            ? state.practices 
            : state.practices.filter(p => String(getNendo(p.date)) === currentPracticeNendo);
        
        const practiceMonths = [...new Set(availablePractices.map(p => parseInt(p.date.substring(5, 7), 10)))].sort((a,b) => b - a);
        let options = '<option value="all">すべての月</option>';
        practiceMonths.forEach(m => {
            const mStr = m.toString().padStart(2, '0');
            options += `<option value="${mStr}" ${currentPracticeMonth === mStr ? 'selected' : ''}>${m}月</option>`;
        });
        filterMonthSelect.innerHTML = options;
        
        filterMonthSelect.onchange = (e) => {
            currentPracticeMonth = e.target.value;
            initPractices();
        };
    }

    const filteredPractices = state.practices.filter(p => {
        const matchNendo = currentPracticeNendo === 'all' || String(getNendo(p.date)) === currentPracticeNendo;
        const matchMonth = currentPracticeMonth === 'all' || p.date.substring(5, 7) === currentPracticeMonth;
        return matchNendo && matchMonth;
    });

    // Stats Update
    const elPractices = document.getElementById('dash-practices');
    if (elPractices) elPractices.textContent = filteredPractices.length;

    // List Update
    const practiceList = document.getElementById('practice-list');
    
    const grouped = {};
    filteredPractices.forEach(p => {
        const ym = p.date.substring(0, 7).replace('-', '年') + '月';
        if (!grouped[ym]) grouped[ym] = [];
        grouped[ym].push(p);
    });

    const sortedMonths = Object.keys(grouped).sort().reverse();
    let html = '';
    sortedMonths.forEach(month => {
        html += `
            <div class="month-section">
                <h3>${month}</h3>
                <div class="library-grid">
        `;
        grouped[month].forEach(p => {
            html += `
                <div class="card practice-card">
                    <div class="practice-card-header">
                        <div>
                            <div class="practice-card-header-title"><i class="fa-regular fa-calendar"></i> ${p.date}</div>
                            <div class="text-secondary" style="font-size:0.9rem; margin-top:0.15rem;" title="${p.presentPlayerIds && p.presentPlayerIds.length > 0 ? state.players.filter(pl => p.presentPlayerIds.includes(pl.id)).map(pl => `${pl.number} ${pl.name}`).join('、') : '出席者リストなし'}">
                                <i class="fa-solid fa-users"></i> ${p.presentPlayerIds ? `${p.presentPlayerIds.length}/${state.players.length}` : p.attendance}
                            </div>
                        </div>
                        <div style="display:flex; gap:0.3rem;">
                            <button class="btn btn-primary btn-add-menu" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="メニュー追加"><i class="fa-solid fa-plus"></i></button>
                            <button class="btn btn-secondary btn-edit-practice" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="練習日詳細を編集"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger btn-delete-practice" data-id="${p.id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <ul class="practice-card-menu-list">
                        ${p.menus.length > 0 ? p.menus.map(menu => `
                            <li class="practice-menu-item" style="padding: 0; border: none; list-style: none; margin-bottom: 0.5rem;">
                                <details class="practice-menu-details" style="background: rgba(0, 0, 0, 0.03); border: 1px solid var(--surface-border); border-radius: 12px; cursor: pointer; width: 100%;">
                                    <summary class="practice-menu-item-header" style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem; list-style:none; outline:none; box-sizing:border-box;">
                                        <span class="practice-menu-item-title" style="display:inline-flex; align-items:center; gap:0.5rem; font-size:0.95rem; font-weight:bold; color:var(--primary);"><i class="fa-solid fa-chevron-down" style="font-size:0.75rem; color:var(--text-secondary); transition:transform 0.2s;"></i> ${menu.focus}</span>
                                        <div style="display:flex; gap:0.3rem;" onclick="event.stopPropagation();">
                                            <button class="btn btn-secondary btn-edit-menu" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;" title="編集"><i class="fa-solid fa-pen"></i></button>
                                            <button class="btn btn-secondary btn-anim-practice" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;" title="作図"><i class="fa-solid fa-person-running"></i></button>
                                            <button class="btn btn-danger btn-delete-menu" data-pid="${p.id}" data-mid="${menu.id}" style="padding:0.3rem; font-size:0.8rem;"><i class="fa-solid fa-times"></i></button>
                                        </div>
                                    </summary>
                                    ${(menu.organize || menu.keyfactor || menu.options) ? `
                                    <div class="practice-menu-item-details" style="padding:0 0.8rem 0.8rem 0.8rem; border-top:1px solid rgba(0,0,0,0.05); font-size:0.85rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.5rem; margin-top:0.4rem;">
                                        ${menu.organize ? `<div><strong><i class="fa-solid fa-users"></i> オーガナイズ</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${menu.organize}</div></div>` : ''}
                                        ${menu.keyfactor ? `<div><strong><i class="fa-solid fa-key"></i> キーファクター</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${menu.keyfactor}</div></div>` : ''}
                                        ${menu.options ? `<div><strong><i class="fa-solid fa-sliders"></i> オプション</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${menu.options}</div></div>` : ''}
                                    </div>
                                    ` : '<div style="padding:0 0.8rem 0.8rem 0.8rem; font-size:0.8rem; color:var(--text-secondary);">詳細説明はありません。</div>'}
                                </details>
                            </li>
                        `).join('') : '<li class="text-secondary" style="font-style:italic; border-bottom:none; padding:0.5rem 0; list-style:none;">メニューなし</li>'}
                    </ul>
                </div>
            `;
        });
        html += `</div></div>`;
    });
    
    if (sortedMonths.length === 0) {
        html = `
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-calendar-check"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">まだ練習管理がありません</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    日々の練習日を作成し、テーマに応じたトレーニングメニューのアサインや、戦術ボードでの作図を行いましょう。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-practice" style="margin-top:0.5rem;"><i class="fa-solid fa-plus"></i> 最初の練習日を追加</button>
            </div>
        `;
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-practice');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-practice');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    }

    practiceList.innerHTML = html;

    document.getElementById('btn-add-practice').addEventListener('click', () => {
        document.getElementById('form-practice').reset();
        document.getElementById('practice-edit-id').value = '';
        const title = document.getElementById('practice-modal-title');
        if (title) title.textContent = '練習日を追加';
        const allPlayerIds = state.players.map(p => p.id);
        renderPracticeRoster(allPlayerIds);
        openModal('modal-practice');
    });

    document.querySelectorAll('.btn-edit-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const p = state.practices.find(prac => prac.id === id);
            if (p) {
                document.getElementById('practice-edit-id').value = p.id;
                document.getElementById('practice-date').value = p.date;
                const title = document.getElementById('practice-modal-title');
                if (title) title.textContent = '練習日情報を編集';
                
                let activeIds = p.presentPlayerIds;
                if (!activeIds && p.attendance) {
                    activeIds = state.players.map(pl => pl.id);
                } else if (!activeIds) {
                    activeIds = [];
                }
                
                renderPracticeRoster(activeIds);
                openModal('modal-practice');
            }
        });
    });

    document.querySelectorAll('.btn-add-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            document.getElementById('menu-practice-id').value = id;
            document.getElementById('menu-library-source-id').value = '';
            if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';
            
            // Populate select
            const select = document.getElementById('menu-library-select');
            select.innerHTML = '<option value="">（新規作成）</option>' + state.menuLibrary.map(m => `<option value="${m.id}">${m.focus}</option>`).join('');
            select.parentElement.style.display = 'block'; // Show select box

            const title = document.querySelector('#modal-menu h2');
            if(title) title.textContent = '練習メニューを追加';

            openModal('modal-menu');
        });
    });

    document.querySelectorAll('.btn-anim-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = parseInt(e.currentTarget.dataset.pid);
            const mid = parseInt(e.currentTarget.dataset.mid);
            navigate('animation', { practiceId: pid, menuId: mid });
        });
    });

    document.querySelectorAll('.btn-delete-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('この日の練習記録をすべて削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id);
                state.practices = state.practices.filter(p => p.id !== id);
                saveData();
                showToast('削除しました');
                initPractices();
            }
        });
    });

    document.querySelectorAll('.btn-delete-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('この練習メニューを削除しますか？')) {
                const pid = parseInt(e.currentTarget.dataset.pid);
                const mid = parseInt(e.currentTarget.dataset.mid);
                const practice = state.practices.find(p => p.id === pid);
                if(practice) {
                    practice.menus = practice.menus.filter(m => m.id !== mid);
                    saveData();
                    showToast('メニューを削除しました');
                    initPractices();
                }
            }
        });
    });

    document.querySelectorAll('.btn-edit-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = parseInt(e.currentTarget.dataset.pid);
            const mid = parseInt(e.currentTarget.dataset.mid);
            const practice = state.practices.find(p => p.id === pid);
            if(practice) {
                const menu = practice.menus.find(m => m.id === mid);
                if (menu) {
                    document.getElementById('menu-practice-id').value = pid;
                    document.getElementById('menu-library-source-id').value = '';
                    if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = mid;
                    
                    document.getElementById('menu-focus').value = menu.focus || '';
                    document.getElementById('menu-category').value = menu.category || 'その他';
                    document.getElementById('menu-organize').value = menu.organize || '';
                    document.getElementById('menu-keyfactor').value = menu.keyfactor || '';
                    document.getElementById('menu-options').value = menu.options || '';

                    document.getElementById('menu-library-select').parentElement.style.display = 'none'; // hide library select
                    
                    const title = document.querySelector('#modal-menu h2');
                    if(title) title.textContent = '練習メニューを編集';
                    
                    openModal('modal-menu');
                }
            }
        });
    });
}

function editFormation(matchId, formId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    const formObj = match.formations.find(f => f.id === formId);
    if (!formObj) return;

    document.getElementById('formation-match-id').value = match.id;
    document.getElementById('formation-id').value = formObj.id;
    document.getElementById('formation-name').value = formObj.name;
    document.getElementById('formation-system').value = formObj.system || '';

    const pList = document.getElementById('formation-player-list');
    pList.innerHTML = state.players.map(p => {
        const lineup = formObj.lineup || [];
        const lineItem = lineup.find(l => l.playerId === p.id);
        const selVal = lineItem ? lineItem.role : '';
        return `
            <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(0,0,0,0.05); padding:0.4rem; border-radius:4px;">
                <span style="font-size:0.9rem; flex:1;">${p.number} ${p.name}</span>
                <select class="form-control formation-pos-select" data-player-id="${p.id}" style="width:70px; padding:0.2rem;">
                    <option value="" ${selVal === '' ? 'selected' : ''}>-</option>
                    <option value="FW" ${selVal === 'FW' ? 'selected' : ''}>FW</option>
                    <option value="MF" ${selVal === 'MF' ? 'selected' : ''}>MF</option>
                    <option value="DF" ${selVal === 'DF' ? 'selected' : ''}>DF</option>
                    <option value="GK" ${selVal === 'GK' ? 'selected' : ''}>GK</option>
                    <option value="SUB" ${selVal === 'SUB' ? 'selected' : ''}>SUB</option>
                </select>
            </div>
        `;
    }).join('');

    openModal('modal-formation');
}

function initPlayers() {
    const elDashPlayers = document.getElementById('dash-players');
    if (elDashPlayers) elDashPlayers.textContent = state.players.length + '名';

    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) return;
    
    if (state.players.length === 0) {
        playerGrid.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-users"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">登録選手がいません</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    選手を登録して、スキル評価のレーダーチャート作成や、試合での出場ポジション設定、成長履歴の管理を始めましょう。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-player" style="margin-top:0.5rem;"><i class="fa-solid fa-user-plus"></i> 最初の選手を追加</button>
            </div>
        `;
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-player');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-player');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    } else {
        playerGrid.innerHTML = state.players.map(p => {
            return `
                <div class="player-card" style="cursor:pointer;" onclick="openPlayerDetail(${p.id})">
                    <div class="player-card-header">
                        <div>
                            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-bottom:0.3rem;">
                                ${(Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
                                    if (!pos) return '';
                                    const lower = pos.toLowerCase();
                                    let badgeClass = 'badge-sub';
                                    if (lower === 'fw') badgeClass = 'badge-fw';
                                    else if (lower === 'mf') badgeClass = 'badge-mf';
                                    else if (lower === 'df') badgeClass = 'badge-df';
                                    else if (lower === 'gk') badgeClass = 'badge-gk';
                                    return `<span class="player-position ${badgeClass}" style="font-size:0.7rem; padding:0.1rem 0.35rem; border-radius:12px; font-weight:600; display:inline-block;">${pos}</span>`;
                                }).join('')}
                            </div>
                            <div style="font-size:1.2rem; font-weight:bold; margin-top:0.2rem;">${p.name}</div>
                        </div>
                        <div class="player-number">${p.number}</div>
                    </div>
                    <div class="radar-container">
                        <canvas id="radar-${p.id}" width="200" height="200"></canvas>
                    </div>
                </div>
            `;
        }).join('');

        // Draw Radar Charts
        state.players.forEach(p => {
            const currentSkills = p.history && p.history.length > 0 ? p.history[0].skills : [0,0,0,0,0,0];
            drawRadarChart(`radar-${p.id}`, currentSkills);
        });
    }

    const btnAdd = document.getElementById('btn-add-player');
    if(btnAdd) {
        // Refresh dynamically populated lists for the modal
        const posContainer = document.getElementById('player-position-container');
        if(posContainer) {
            posContainer.innerHTML = state.positions.map(p => `
                <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }
        
        const initSkills = document.getElementById('player-initial-skills-container');
        if(initSkills) {
            initSkills.innerHTML = state.skillMetrics.map((m, i) => `
                <div class="form-group"><label>${m}</label><input type="number" id="skill-initial-${i}" class="form-control" min="1" max="5" value="3" required></div>
            `).join('');
        }

        btnAdd.addEventListener('click', () => {
            document.getElementById('player-edit-id').value = '';
            document.getElementById('player-modal-title').textContent = '選手を登録';
            document.getElementById('player-initial-assessment-section').classList.remove('hidden');
            document.getElementById('player-initial-good').setAttribute('required', 'true');
            document.getElementById('player-initial-improve').setAttribute('required', 'true');
            
            // Uncheck all position boxes
            document.querySelectorAll('.player-pos-checkbox').forEach(cb => cb.checked = false);
            
            openModal('modal-player');
        });
    }
}

// Menu Library Logic
function initLibrary() {
    const filterSelect = document.getElementById('filter-library-category');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">すべてのカテゴリ</option>' + state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
        if (state.menuCategories.includes(currentLibraryCategory) || currentLibraryCategory === 'all') {
            filterSelect.value = currentLibraryCategory;
        } else {
            currentLibraryCategory = 'all';
            filterSelect.value = 'all';
        }
        
        filterSelect.onchange = (e) => {
            currentLibraryCategory = e.target.value;
            initLibrary();
        };
    }

    const filteredMenus = currentLibraryCategory === 'all' 
        ? state.menuLibrary 
        : state.menuLibrary.filter(m => m.category === currentLibraryCategory);

    const elLibrary = document.getElementById('dash-library');
    if (elLibrary) elLibrary.textContent = filteredMenus.length + '個';

    const libraryList = document.getElementById('library-list');
    
    // Group menus by category
    const grouped = {};
    filteredMenus.forEach(m => {
        const cat = m.category || 'その他';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    });

    // Sort categories based on state.menuCategories order
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const idxA = state.menuCategories.indexOf(a);
        const idxB = state.menuCategories.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    if (filteredMenus.length === 0) {
        libraryList.innerHTML = `
            <div class="card" style="padding:3rem 2rem; text-align:center; border: 1.5px dashed var(--surface-border); display:flex; flex-direction:column; align-items:center; gap:1rem; width:100%; box-sizing:border-box;">
                <div style="font-size:3rem; color:var(--text-secondary); opacity:0.6;"><i class="fa-solid fa-book"></i></div>
                <h3 style="font-size:1.15rem; margin:0; color:var(--text-primary); font-weight:600;">メニューライブラリが空です</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); max-width:340px; margin:0; line-height:1.4;">
                    練習のテーマ、オーガナイズ、キーファクターをライブラリ化し、戦術ボードで作図しておくことで、いつでも練習日へコピーして計画を立てられます。
                </p>
                <button class="btn btn-primary" id="btn-empty-add-library" style="margin-top:0.5rem;"><i class="fa-solid fa-plus"></i> 最初のライブラリ作成</button>
            </div>
        `;
        setTimeout(() => {
            const btnEmptyAdd = document.getElementById('btn-empty-add-library');
            if (btnEmptyAdd) {
                btnEmptyAdd.onclick = () => {
                    const btnAdd = document.getElementById('btn-add-library-menu');
                    if (btnAdd) btnAdd.click();
                };
            }
        }, 50);
    } else {
        libraryList.innerHTML = sortedCategories.map(cat => {
            const menus = grouped[cat];
            const cardsHtml = menus.map(m => {
                return `
                <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; min-height: auto;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem;">
                            <span class="badge" style="background:rgba(242, 57, 50, 0.15); color:var(--primary); font-weight:600; padding:0.25rem 0.5rem; border-radius:6px; margin:0; font-size:0.75rem;">${cat}</span>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn btn-secondary btn-assign-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="練習日にアサイン"><i class="fa-solid fa-calendar-plus"></i></button>
                                <button class="btn btn-secondary btn-edit-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="編集"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-secondary btn-anim-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;" title="${m.frames && m.frames.length > 0 ? '作図を編集' : '作図する'}"><i class="fa-solid fa-person-running"></i></button>
                                <button class="btn btn-danger btn-delete-library" data-id="${m.id}" style="padding:0.2rem 0.4rem; font-size:0.8rem;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--text-primary); line-height:1.3; margin-bottom:0.8rem;">${m.focus}</div>
                        
                        <div class="library-canvas-wrapper" style="width:100%; height:140px; background:#1e293b; border-radius:8px; overflow:hidden; position:relative; margin-bottom:0.8rem; cursor:pointer;" onclick="navigate('animation', { libraryId: ${m.id} })">
                            <canvas id="library-mini-pitch-${m.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                            <div class="canvas-hover-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:0.9rem; font-weight:bold; pointer-events:none;">
                                <i class="fa-solid fa-person-running" style="margin-right:0.3rem;"></i> 作図画面を開く
                            </div>
                            ${m.frames && m.frames.length > 1 ? `
                                <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:0.15rem 0.35rem; border-radius:4px; font-weight:bold; pointer-events:none; display:flex; align-items:center; gap:0.2rem;">
                                    <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%; animation: pulse 1.5s infinite;"></span>ANIM
                                </div>
                            ` : ''}
                        </div>

                        <details class="library-card-details" style="background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:8px; cursor:pointer;">
                            <summary style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.8rem; font-size:0.85rem; font-weight:bold; color:var(--text-secondary); list-style:none; outline:none; box-sizing:border-box;">
                                <i class="fa-solid fa-chevron-down" style="font-size:0.75rem; color:var(--text-secondary); transition:transform 0.2s;"></i> 詳細を表示
                            </summary>
                            <div style="padding:0.8rem; border-top:1px solid rgba(0,0,0,0.05); font-size:0.85rem; display:flex; flex-direction:column; gap:0.5rem; color:var(--text-secondary); cursor:default;" onclick="event.stopPropagation();">
                                ${m.organize ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-users"></i> オーガナイズ</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${m.organize}</div></div>` : ''}
                                ${m.keyfactor ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-key"></i> キーファクター</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${m.keyfactor}</div></div>` : ''}
                                ${m.options ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-plus"></i> オプション</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${m.options}</div></div>` : ''}
                                ${(!m.organize && !m.keyfactor && !m.options) ? '<div style="font-size:0.8rem; color:var(--text-secondary);">詳細説明はありません。</div>' : ''}
                            </div>
                        </details>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="category-section" style="margin-bottom:2rem;">
                <h3 style="margin-bottom: 1rem; border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; display:inline-block; font-size: 1.15rem; font-weight:600;">
                    ${cat} <span class="text-secondary" style="font-size:0.85rem; font-weight:normal; margin-left:0.5rem;">(${menus.length}件)</span>
                </h3>
                <div class="library-grid">
                    ${cardsHtml}
                </div>
            </div>`;
        }).join('');
    }

    // Clear old animation loops
    if (window.libraryMiniPitchIntervals) {
        window.libraryMiniPitchIntervals.forEach(clearInterval);
    }
    window.libraryMiniPitchIntervals = [];

    // Draw library mini pitches (always draw, with fallback to empty pitch, loop animation if present)
    setTimeout(() => {
        filteredMenus.forEach(m => {
            const mCanv = document.getElementById(`library-mini-pitch-${m.id}`);
            if (mCanv) {
                const mCtx = mCanv.getContext('2d');
                if (m.frames && m.frames.length > 0) {
                    if (m.frames.length > 1) {
                        let frameIdx = 0;
                        drawPitchToCtx(m.frames[frameIdx], mCanv, mCtx, m.pitchTemplate || 'full');
                        
                        const intervalId = setInterval(() => {
                            frameIdx = (frameIdx + 1) % m.frames.length;
                            drawPitchToCtx(m.frames[frameIdx], mCanv, mCtx, m.pitchTemplate || 'full');
                        }, 1200);
                        window.libraryMiniPitchIntervals.push(intervalId);
                    } else {
                        drawPitchToCtx(m.frames[0], mCanv, mCtx, m.pitchTemplate || 'full');
                    }
                } else {
                    // Draw a blank court template (fallback)
                    drawPitchToCtx([], mCanv, mCtx, m.pitchTemplate || 'full');
                }
            }
        });
    }, 50);

    const btnAdd = document.getElementById('btn-add-library-menu');
    if (btnAdd) {
        btnAdd.onclick = () => {
            document.getElementById('menu-practice-id').value = 'library';
            document.getElementById('menu-library-source-id').value = '';
            if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';
            document.getElementById('menu-library-select').parentElement.style.display = 'none'; // Hide select box
            document.getElementById('form-menu').reset();
            const title = document.querySelector('#modal-menu h2');
            if(title) title.textContent = '練習メニューを追加';
            openModal('modal-menu');
        };
    }

    document.querySelectorAll('.btn-edit-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const menu = state.menuLibrary.find(m => m.id === id);
            if (menu) {
                document.getElementById('menu-practice-id').value = 'library';
                document.getElementById('menu-library-source-id').value = '';
                if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = id;
                
                document.getElementById('menu-focus').value = menu.focus || '';
                document.getElementById('menu-category').value = menu.category || 'その他';
                document.getElementById('menu-organize').value = menu.organize || '';
                document.getElementById('menu-keyfactor').value = menu.keyfactor || '';
                document.getElementById('menu-options').value = menu.options || '';

                document.getElementById('menu-library-select').parentElement.style.display = 'none'; // hide library select
                
                const title = document.querySelector('#modal-menu h2');
                if(title) title.textContent = '練習メニューを編集';
                
                openModal('modal-menu');
            }
        });
    });

    document.querySelectorAll('.btn-delete-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('このライブラリを削除しますか？')) {
                const id = parseInt(e.currentTarget.dataset.id);
                state.menuLibrary = state.menuLibrary.filter(m => m.id !== id);
                saveData();
                showToast('削除しました');
                initLibrary();
            }
        });
    });

    document.querySelectorAll('.btn-anim-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            navigate('animation', { libraryId: id });
        });
    });

    document.querySelectorAll('.btn-assign-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            openAssignPracticeModal(id);
        });
    });
}

function openAssignPracticeModal(menuId) {
    const modal = document.getElementById('modal-assign-practice');
    const inputMenuId = document.getElementById('assign-menu-id');
    const practicesList = document.getElementById('assign-practices-list');
    if (!modal || !inputMenuId || !practicesList) return;

    inputMenuId.value = menuId;
    practicesList.innerHTML = '';

    if (state.practices.length > 0) {
        const sortedPractices = [...state.practices].sort((a, b) => new Date(b.date) - new Date(a.date));
        practicesList.innerHTML = sortedPractices.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:0.6rem; border-radius:8px; border:1px solid var(--surface-border);">
                <div>
                    <strong><i class="fa-regular fa-calendar"></i> ${p.date}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.15rem;"><i class="fa-solid fa-users"></i> ${p.attendance} | メニュー数: ${p.menus.length}</div>
                </div>
                <button class="btn btn-primary btn-execute-assign" data-pid="${p.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem;"><i class="fa-solid fa-check"></i> アサイン</button>
            </div>
        `).join('');

        // Bind assign buttons
        document.querySelectorAll('.btn-execute-assign').forEach(btn => {
            btn.onclick = (e) => {
                const pid = parseInt(e.currentTarget.dataset.pid);
                const mid = parseInt(inputMenuId.value);
                
                const practice = state.practices.find(p => p.id === pid);
                const libMenu = state.menuLibrary.find(m => m.id === mid);
                
                if (practice && libMenu) {
                    let frames = null;
                    if (libMenu.frames) {
                        frames = JSON.parse(JSON.stringify(libMenu.frames)); // Deep copy
                    }
                    
                    const newMenuObj = {
                        id: Date.now(),
                        focus: libMenu.focus,
                        organize: libMenu.organize,
                        keyfactor: libMenu.keyfactor,
                        options: libMenu.options,
                        category: libMenu.category || 'その他',
                        frames: frames
                    };
                    
                    practice.menus.push(newMenuObj);
                    saveData();
                    showToast(`「${libMenu.focus}」を ${practice.date} の練習にアサインしました`);
                    modal.classList.add('hidden');
                }
            };
        });
    } else {
        practicesList.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; text-align:center; padding:1rem;">練習予定・記録がありません。</p>';
    }

    // Add practice button inside modal
    const btnAddPractice = document.getElementById('btn-assign-add-practice');
    if (btnAddPractice) {
        btnAddPractice.onclick = () => {
            modal.classList.add('hidden');
            openModal('modal-practice');
        };
    }

    modal.classList.remove('hidden');
}


// Settings Logic
function initSettings() {
    // 1. Team Info
    const teamNameInput = document.getElementById('team-info-name');
    const teamColorInput = document.getElementById('team-info-color');
    if(teamNameInput && teamColorInput) {
        teamNameInput.value = state.teamInfo.name;
        teamColorInput.value = state.teamInfo.color;
        
        const formTeamInfo = document.getElementById('form-team-info');
        const newFormTeamInfo = formTeamInfo.cloneNode(true);
        formTeamInfo.parentNode.replaceChild(newFormTeamInfo, formTeamInfo);
        newFormTeamInfo.addEventListener('submit', (e) => {
            e.preventDefault();
            state.teamInfo.name = document.getElementById('team-info-name').value;
            state.teamInfo.color = document.getElementById('team-info-color').value;
            saveData();
            showToast('チーム基本情報を保存しました');
            // Update UI variables
            document.documentElement.style.setProperty('--primary', state.teamInfo.color);
            const sidebarTitle = document.querySelector('.sidebar-header h2');
            if(sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
        });
    }

    // Generic list renderer
    function renderList(listId, stateArray, itemLabelFunc = (x)=>x) {
        const list = document.getElementById(listId);
        if(!list) return;
        list.innerHTML = stateArray.map((item, index) => `
            <li style="display:flex; justify-content:space-between; align-items:center;">
                <span>${itemLabelFunc(item)}</span>
                <button class="btn btn-danger btn-delete-item" data-list="${listId}" data-index="${index}" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash"></i></button>
            </li>
        `).join('');
    }

    renderList('match-type-list', state.matchTypes);
    renderList('menu-category-list', state.menuCategories);
    renderList('skill-metric-list', state.skillMetrics);
    renderList('position-list', state.positions);

    // Generic delete handler
    document.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const listId = e.currentTarget.dataset.list;
            const idx = parseInt(e.currentTarget.dataset.index);
            
            let label = "";
            let inUse = false;
            
            if (listId === 'match-type-list') {
                label = state.matchTypes[idx];
                inUse = state.matches.some(m => m.type === label);
            } else if (listId === 'menu-category-list') {
                label = state.menuCategories[idx];
                inUse = state.practices.some(p => p.menus.some(m => m.category === label)) ||
                        state.menuLibrary.some(m => m.category === label);
            } else if (listId === 'skill-metric-list') {
                label = state.skillMetrics[idx];
                inUse = state.players.some(p => p.history && p.history.some(h => h.skills && h.skills.length > idx));
            } else if (listId === 'position-list') {
                label = state.positions[idx];
                inUse = state.players.some(p => {
                    const posList = Array.isArray(p.position) ? p.position : [p.position];
                    return posList.includes(label);
                });
            }

            if (inUse) {
                if (!confirm(`「${label}」は現在使用中、または関連するデータが存在します。本当に削除しますか？\n(削除すると過去のデータの一部が表示されなくなる可能性があります)`)) {
                    return;
                }
            } else {
                if (!confirm(`「${label}」を削除しますか？`)) {
                    return;
                }
            }

            if(listId === 'match-type-list') state.matchTypes.splice(idx, 1);
            if(listId === 'menu-category-list') state.menuCategories.splice(idx, 1);
            if(listId === 'skill-metric-list') state.skillMetrics.splice(idx, 1);
            if(listId === 'position-list') state.positions.splice(idx, 1);
            saveData();
            initSettings();
        });
    });

    // Generic add handler
    function setupAddForm(formId, inputId, stateArray) {
        const form = document.getElementById(formId);
        if(!form) return;
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newVal = document.getElementById(inputId).value.trim();
            if(newVal && !stateArray.includes(newVal)) {
                stateArray.push(newVal);
                saveData();
                initSettings();
            }
        });
    }

    setupAddForm('form-add-match-type', 'new-match-type', state.matchTypes);
    setupAddForm('form-add-menu-category', 'new-menu-category', state.menuCategories);
    setupAddForm('form-add-skill-metric', 'new-skill-metric', state.skillMetrics);
    setupAddForm('form-add-position', 'new-position', state.positions);

    // --- Data Export ---
    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const dataStr = JSON.stringify({
                matches: state.matches,
                practices: state.practices,
                players: state.players,
                menuLibrary: state.menuLibrary,
                matchTypes: state.matchTypes,
                menuCategories: state.menuCategories,
                skillMetrics: state.skillMetrics,
                positions: state.positions,
                teamInfo: state.teamInfo
            }, null, 2);

            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
            const filename = `coachMgrBackup_${dateStr}.json`;

            // Try programmatic download (works on desktop & Android Chrome)
            try {
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 500);
                showToast(`${filename} をダウンロードしました`);
            } catch (err) {
                // Fallback: show modal with JSON text to copy (iOS Safari / file://)
                _showExportFallbackModal(dataStr);
            }

            // iOS Safari: blob download silently fails without error, so also show modal
            // if the download anchor likely didn't work (detected via iOS UA)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                setTimeout(() => _showExportFallbackModal(dataStr), 300);
            }
        });
    }

    // --- Data Import ---
    const inputImport = document.getElementById('input-import-data');
    if (inputImport) {
        inputImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm('現在のデータがすべて上書きされます。インポートを実行してよろしいですか？')) {
                inputImport.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    // Validate basic structure
                    if (!parsed.matches && !parsed.players && !parsed.practices) {
                        alert('有効なデータファイルではありません。エクスポートしたJSONファイルを選択してください。');
                        return;
                    }
                    // Overwrite localStorage and reload state
                    localStorage.setItem('coachMgrData', JSON.stringify(parsed));
                    loadData();
                    // Re-apply team info
                    document.documentElement.style.setProperty('--primary', state.teamInfo.color);
                    const sidebarTitle = document.querySelector('.sidebar-header h2');
                    if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
                    showToast('データをインポートしました。ページを再読み込みします...');
                    setTimeout(() => location.reload(), 1500);
                } catch (err) {
                    alert('ファイルの読み込みに失敗しました。有効なJSONファイルを選択してください。');
                }
            };
            reader.readAsText(file);
        });
    }
}

let currentPlayerDetailId = null;

function openPlayerDetail(id) {
    const p = state.players.find(pl => pl.id === id);
    if(!p) return;
    
    currentPlayerDetailId = p.id;
    
    const pdPosition = document.getElementById('pd-position');
    if (pdPosition) {
        pdPosition.innerHTML = (Array.isArray(p.position) ? p.position : [p.position]).map(pos => {
            if (!pos) return '';
            const lower = pos.toLowerCase();
            let badgeClass = 'badge-sub';
            if (lower === 'fw') badgeClass = 'badge-fw';
            else if (lower === 'mf') badgeClass = 'badge-mf';
            else if (lower === 'df') badgeClass = 'badge-df';
            else if (lower === 'gk') badgeClass = 'badge-gk';
            return `<span class="player-position ${badgeClass}" style="font-size:0.8rem; padding:0.2rem 0.5rem; border-radius:12px; font-weight:600; display:inline-block; margin-right:0.25rem;">${pos}</span>`;
        }).join('');
        // Remove style borders on container itself
        pdPosition.style.background = 'transparent';
        pdPosition.style.border = 'none';
        pdPosition.style.padding = '0';
    }
    document.getElementById('pd-name').textContent = p.name;
    
    // Calculate player total goals and assists
    let playerGoals = 0;
    let playerAssists = 0;
    state.matches.forEach(m => {
        if (m.goalRecords) {
            m.goalRecords.forEach(r => {
                if (r.scorerId === p.id) playerGoals++;
                if (r.assistId === p.id) playerAssists++;
            });
        }
    });
    
    const elPdGoals = document.getElementById('pd-goals');
    const elPdAssists = document.getElementById('pd-assists');
    if (elPdGoals) elPdGoals.textContent = playerGoals;
    if (elPdAssists) elPdAssists.textContent = playerAssists;

    const btnPdGoals = document.getElementById('btn-pd-goals');
    if (btnPdGoals) {
        btnPdGoals.onclick = () => {
            const matchesWithGoals = state.matches.filter(m => 
                m.goalRecords && m.goalRecords.some(r => r.scorerId === p.id)
            );
            
            const pmlTitle = document.getElementById('pml-title');
            const pmlContent = document.getElementById('pml-content');
            if (pmlTitle && pmlContent) {
                pmlTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${p.name} の得点した試合`;
                pmlContent.innerHTML = matchesWithGoals.length > 0 ? matchesWithGoals.map(m => `
                    <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; cursor:pointer;" onclick="document.getElementById('modal-player-detail').classList.add('hidden'); document.getElementById('modal-player-matches-list').classList.add('hidden'); openMatchDetail(${m.id})">
                        <div>
                            <strong>vs ${m.opponent}</strong>
                            <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${m.result}</div>
                    </div>
                `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">得点した試合はありません。</p>';
                
                openModal('modal-player-matches-list');
            }
        };
    }

    const btnPdAssists = document.getElementById('btn-pd-assists');
    if (btnPdAssists) {
        btnPdAssists.onclick = () => {
            const matchesWithAssists = state.matches.filter(m => 
                m.goalRecords && m.goalRecords.some(r => r.assistId === p.id)
            );
            
            const pmlTitle = document.getElementById('pml-title');
            const pmlContent = document.getElementById('pml-content');
            if (pmlTitle && pmlContent) {
                pmlTitle.innerHTML = `<span style="display:inline-block; transform:rotate(45deg); color:#22c55e;"><i class="fa-solid fa-shoe-prints"></i></span> ${p.name} のアシストした試合`;
                pmlContent.innerHTML = matchesWithAssists.length > 0 ? matchesWithAssists.map(m => `
                    <div class="feedback-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; cursor:pointer;" onclick="document.getElementById('modal-player-detail').classList.add('hidden'); document.getElementById('modal-player-matches-list').classList.add('hidden'); openMatchDetail(${m.id})">
                        <div>
                            <strong>vs ${m.opponent}</strong>
                            <div style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}</div>
                        </div>
                        <div style="font-size:1.15rem; font-weight:bold; color:var(--primary);">${m.result}</div>
                    </div>
                `).join('') : '<p class="text-secondary" style="font-size:0.85rem; padding:1rem; text-align:center;">アシストした試合はありません。</p>';
                
                openModal('modal-player-matches-list');
            }
        };
    }

    
    // Collect all timeline events (Assessments + Match Feedbacks)
    let timeline = [];
    if(p.history) {
        p.history.forEach(h => {
            timeline.push({ type: 'assessment', date: h.date, comment: h.comment, data: h });
        });
    }
    
    // Find match feedbacks for this player
    state.matches.forEach(m => {
        if(m.playerFeedback) {
            m.playerFeedback.forEach(fb => {
                if(fb.playerId === p.id) {
                    timeline.push({ type: 'match', date: m.date, matchDetails: `${m.type} vs ${m.opponent}`, comment: fb.comment, matchId: m.id });
                }
            });
        }
    });
    
    // Sort timeline descending by date
    timeline.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const historyList = document.getElementById('pd-history-list');
    historyList.innerHTML = timeline.length > 0 ? timeline.map(item => {
        if (item.type === 'assessment') {
            return `
                <div class="timeline-item">
                    <div class="timeline-item-date">
                        ${item.date} <span class="timeline-item-badge">スキル評価</span>
                    </div>
                    <div class="timeline-item-comment">${item.comment}</div>
                    <div class="timeline-item-skills">S:${item.data ? item.data.skills[0] : item.skills[0]} P:${item.data ? item.data.skills[1] : item.skills[1]} D:${item.data ? item.data.skills[2] : item.skills[2]} DF:${item.data ? item.data.skills[3] : item.skills[3]} PH:${item.data ? item.data.skills[4] : item.skills[4]} M:${item.data ? item.data.skills[5] : item.skills[5]}</div>
                </div>
            `;
        } else {
            const matchingMatch = state.matches.find(m => m.id === item.matchId);
            const firstForm = (matchingMatch && matchingMatch.formations && matchingMatch.formations.length > 0) ? matchingMatch.formations[0] : null;
            const linkBtn = firstForm ? `<button class="btn btn-secondary btn-timeline-anim" data-match-id="${matchingMatch.id}" data-form-id="${firstForm.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; margin-top:0.35rem; display:inline-flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-person-running"></i> 作図を見る</button>` : '';
            return `
                <div class="timeline-item match-timeline-item">
                    <div class="timeline-item-date">
                        ${item.date} <span class="timeline-item-badge">試合評価</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">${item.matchDetails}</p>
                    <p>${item.comment}</p>
                    ${linkBtn}
                </div>
            `;
        }
    }).join('') : '<p class="text-secondary">記録がありません。</p>';

    document.querySelectorAll('.btn-timeline-anim').forEach(btn => {
        btn.onclick = (e) => {
            const matchId = parseInt(e.currentTarget.dataset.matchId, 10);
            const formId = parseInt(e.currentTarget.dataset.formId, 10);
            document.getElementById('modal-player-detail').classList.add('hidden');
            navigate('animation', { matchId, formId });
        };
    });

    openModal('modal-player-detail');
    
    // Draw current radar (first item in history, as history is sorted desc)
    const currentSkills = p.history && p.history.length > 0 ? (p.history[0].data ? p.history[0].data.skills : p.history[0].skills) : [0,0,0,0,0,0];
    const prevSkills = p.history && p.history.length > 1 ? (p.history[1].data ? p.history[1].data.skills : p.history[1].skills) : null;
    
    // Toggle legend based on prevSkills
    const legend = document.getElementById('pd-radar-legend');
    if(legend) {
        legend.style.display = prevSkills ? 'flex' : 'none';
    }

    setTimeout(() => {
        drawRadarChart('pd-radar', currentSkills, prevSkills);
    }, 50);

    // Add assessment btn
    document.getElementById('btn-add-assessment').onclick = () => {
        document.getElementById('assessment-player-id').value = p.id;
        document.getElementById('assessment-date').value = new Date().toISOString().split('T')[0];
        
        const assSkills = document.getElementById('assessment-skills-container');
        if(assSkills) {
            assSkills.innerHTML = state.skillMetrics.map((m, i) => `
                <div class="form-group"><label>${m}</label><input type="number" id="skill-ass-${i}" class="form-control" min="1" max="5" value="3" required></div>
            `).join('');
            
            if(currentSkills) {
                state.skillMetrics.forEach((m, i) => {
                    const el = document.getElementById(`skill-ass-${i}`);
                    if(el) el.value = currentSkills[i] || 3;
                });
            }
        }
        
        openModal('modal-player-assessment');
    };

    // Edit btn
    const btnEdit = document.getElementById('btn-edit-player-detail');
    btnEdit.onclick = () => {
        document.getElementById('player-edit-id').value = p.id;
        document.getElementById('player-modal-title').textContent = '選手情報を編集';
        document.getElementById('player-initial-assessment-section').classList.add('hidden');
        document.getElementById('player-initial-good').removeAttribute('required');
        document.getElementById('player-initial-improve').removeAttribute('required');
        
        document.getElementById('player-name').value = p.name;
        document.getElementById('player-number').value = p.number;
        
        // Populate and check checkbox list
        const posContainer = document.getElementById('player-position-container');
        if(posContainer) {
            posContainer.innerHTML = state.positions.map(pos => {
                const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
                return `
                    <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                        <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                    </label>
                `;
            }).join('');
        }
        
        document.getElementById('modal-player-detail').classList.add('hidden');
        openModal('modal-player');
    };

    // Delete btn
    const btnDel = document.getElementById('btn-delete-player-detail');
    btnDel.onclick = () => {
        if(confirm('この選手を削除しますか？')) {
            state.players = state.players.filter(pl => pl.id !== p.id);
            saveData();
            showToast('削除しました');
            document.getElementById('modal-player-detail').classList.add('hidden');
            initPlayers();
        }
    };
}

function drawRadarChart(canvasId, skills, prevSkills = null) {
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 25;
    
    ctx.clearRect(0, 0, w, h);
    
    const labels = state.skillMetrics || ['シュート', 'パス', 'ドリブル', '守備', 'フィジカル', 'メンタル'];
    const maxVal = 5;
    const numSides = labels.length;
    
    // Draw background rings
    for (let i = 1; i <= maxVal; i++) {
        ctx.beginPath();
        for (let j = 0; j <= numSides; j++) {
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * i;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();
        
        // Draw axis lines
        if (i === maxVal) {
            for (let j = 0; j < numSides; j++) {
                const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.stroke();
                
                // Labels
                const lx = cx + (radius + 15) * Math.cos(angle);
                const ly = cy + (radius + 15) * Math.sin(angle);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labels[j], lx, ly);
            }
        }
    }

    // Draw Previous Data Polygon
    if (prevSkills) {
        ctx.beginPath();
        for (let j = 0; j < numSides; j++) {
            const val = prevSkills[j] || 0;
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * val;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)'; // Slate-400 transparent
        ctx.fill();
        ctx.strokeStyle = '#64748b'; // Slate-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        for (let j = 0; j < numSides; j++) {
            const val = prevSkills[j] || 0;
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * val;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI*2);
            ctx.fillStyle = '#64748b';
            ctx.fill();
        }
    }
    
    // Draw Current Data Polygon
    ctx.beginPath();
    for (let j = 0; j < numSides; j++) {
        const val = skills[j] || 0;
        const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
        const r = (radius / maxVal) * val;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(242, 57, 50, 0.3)'; // Primary color transparent
    ctx.fill();
    ctx.strokeStyle = '#f23932'; // Primary color
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw Data Points
    for (let j = 0; j < numSides; j++) {
        const val = skills[j] || 0;
        const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
        const r = (radius / maxVal) * val;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI*2);
        ctx.fillStyle = '#f23932';
        ctx.fill();
    }
}

// Animation / Canvas Logic
let canvas, ctx;
let objects = [];
let currentTool = 'select';
let isDrawing = false;
let draggedObject = null;
let startX, startY;
let playerCounter = { red: 1, blue: 1 };
let objectIdCounter = 1;
let selectedObject = null;
let historyStack = [];
let isResizing = false;
let resizeHandle = null;

function saveHistory() {
    if (isPlaying) return;
    historyStack.push(JSON.parse(JSON.stringify(objects)));
    if (historyStack.length > 30) historyStack.shift();
}

function undoHistory() {
    if (isPlaying) return;
    if (historyStack.length > 1) {
        historyStack.pop();
        objects = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));
        selectedObject = null;
        drawPitch(objects);
    } else if (historyStack.length === 1) {
        historyStack.pop();
        objects = [];
        selectedObject = null;
        drawPitch(objects);
    }
}

function updateCanvasToolbar() {
    const btnDelete = document.getElementById('tool-delete');
    const btnRotate = document.getElementById('tool-rotate');
    const actionContainer = document.getElementById('sidebar-action-container');
    
    if (btnDelete) btnDelete.style.display = selectedObject ? 'inline-block' : 'none';
    if (btnRotate) btnRotate.style.display = (selectedObject && selectedObject.type === 'minigoal') ? 'inline-block' : 'none';
    
    if (actionContainer) {
        actionContainer.style.display = selectedObject ? 'flex' : 'none';
    }
}

function handleCanvasKeyDown(e) {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return; 
    }
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!canvasWrapper) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject) {
            e.preventDefault();
            objects = objects.filter(o => o.id !== selectedObject.id);
            selectedObject = null;
            saveHistory();
            drawPitch(objects);
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoHistory();
    }
}

// Animation State
let frames = [];
let isPlaying = false;
let animReqId = null;

let currentPracticeId = null;
let currentMenuId = null;
let currentMatchId = null;
let currentFormationId = null;

function initAnimation(params) {
    canvas = document.getElementById('pitch-canvas');
    if(!canvas) return;
    
    currentPracticeId = params && params.practiceId ? params.practiceId : null;
    currentMenuId = params && params.menuId ? params.menuId : null;
    currentMatchId = params && params.matchId ? params.matchId : null;
    currentFormationId = params && params.formId ? params.formId : null;
    let currentLibraryId = params && params.libraryId ? params.libraryId : null;
    
    let initialFrames = null;
    let isFormationMode = !!(currentMatchId && currentFormationId);
    let isLibraryMode = !!currentLibraryId;

    let targetMenu = null;

    if (currentPracticeId && currentMenuId) {
        const practice = state.practices.find(p => p.id === currentPracticeId);
        if (practice) {
            targetMenu = practice.menus.find(m => m.id === currentMenuId);
            if (targetMenu && targetMenu.frames) {
                initialFrames = JSON.parse(JSON.stringify(targetMenu.frames));
            }
        }
    } else if (isFormationMode) {
        const match = state.matches.find(m => m.id === currentMatchId);
        if (match) {
            const formObj = match.formations.find(f => f.id === currentFormationId);
            if (formObj && formObj.boardData && formObj.boardData.length > 0) {
                // Formations only have 1 frame technically
                initialFrames = [JSON.parse(JSON.stringify(formObj.boardData))];
            } else {
                initialFrames = []; // empty
            }
        }
    } else if (isLibraryMode) {
        targetMenu = state.menuLibrary.find(m => m.id === currentLibraryId);
        if (targetMenu && targetMenu.frames) {
            initialFrames = JSON.parse(JSON.stringify(targetMenu.frames));
        }
    }

    const infoContainer = document.getElementById('anim-menu-info');
    if (infoContainer) {
        // Collapsible Accordion Logic
        const infoHeader = document.getElementById('anim-menu-info-header');
        const infoContent = document.getElementById('anim-menu-info-content');
        const infoToggleBtn = document.getElementById('anim-menu-info-toggle-btn');
        if (infoHeader && infoContent && infoToggleBtn) {
            // Collapse by default
            infoContent.style.display = 'none';
            infoToggleBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> 詳細を表示';
            
            infoHeader.onclick = (e) => {
                // Prevent toggle if clicking edit button
                if (e.target.closest('#btn-edit-anim-menu')) return;
                
                const isHidden = infoContent.style.display === 'none';
                infoContent.style.display = isHidden ? 'block' : 'none';
                infoToggleBtn.innerHTML = isHidden 
                    ? '<i class="fa-solid fa-chevron-up"></i> 詳細を閉じる' 
                    : '<i class="fa-solid fa-chevron-down"></i> 詳細を表示';
            };
        }

        if (targetMenu && (targetMenu.organize || targetMenu.keyfactor || targetMenu.options)) {
            infoContainer.style.display = 'block';
            document.getElementById('anim-menu-focus').textContent = targetMenu.focus || 'メニュー';
            
            const orgDiv = document.getElementById('anim-menu-organize-container');
            if (targetMenu.organize) {
                orgDiv.style.display = 'flex';
                document.getElementById('anim-menu-organize').textContent = targetMenu.organize;
            } else {
                orgDiv.style.display = 'none';
            }
            
            const kfDiv = document.getElementById('anim-menu-keyfactor-container');
            if (targetMenu.keyfactor) {
                kfDiv.style.display = 'flex';
                document.getElementById('anim-menu-keyfactor').textContent = targetMenu.keyfactor;
            } else {
                kfDiv.style.display = 'none';
            }
            
            const optDiv = document.getElementById('anim-menu-options-container');
            if (targetMenu.options) {
                optDiv.style.display = 'flex';
                document.getElementById('anim-menu-options').textContent = targetMenu.options;
            } else {
                optDiv.style.display = 'none';
            }
        } else {
            infoContainer.style.display = 'none';
        }
        
        const btnEditAnim = document.getElementById('btn-edit-anim-menu');
        if (btnEditAnim && targetMenu) {
            // Replace with clone to remove old listeners
            const newBtn = btnEditAnim.cloneNode(true);
            btnEditAnim.parentNode.replaceChild(newBtn, btnEditAnim);
            newBtn.addEventListener('click', () => {
                document.getElementById('menu-practice-id').value = isLibraryMode ? 'library' : currentPracticeId;
                document.getElementById('menu-library-source-id').value = '';
                if (!document.getElementById('menu-edit-id')) {
                    const hidden = document.createElement('input');
                    hidden.type = 'hidden';
                    hidden.id = 'menu-edit-id';
                    document.getElementById('form-menu').appendChild(hidden);
                }
                document.getElementById('menu-edit-id').value = targetMenu.id;
                
                document.getElementById('menu-focus').value = targetMenu.focus || '';
                document.getElementById('menu-category').value = targetMenu.category || 'その他';
                document.getElementById('menu-organize').value = targetMenu.organize || '';
                document.getElementById('menu-keyfactor').value = targetMenu.keyfactor || '';
                document.getElementById('menu-options').value = targetMenu.options || '';

                document.getElementById('menu-library-select').parentElement.style.display = 'none';
                
                const title = document.querySelector('#modal-menu h2');
                if(title) title.textContent = '練習メニューを編集';
                
                openModal('modal-menu');
            });
        }
    }

    // Fixed internal resolution
    canvas.width = 800;
    canvas.height = 500;
    
    ctx = canvas.getContext('2d');
    frames = initialFrames || [];
    objects = frames.length > 0 ? JSON.parse(JSON.stringify(frames[frames.length - 1])) : [];
    isPlaying = false;
    historyStack = [];
    saveHistory();
    
    // Set custom number to next available by scanning, though user can change it
    let maxNum = 0;
    objects.forEach(o => {
        if (o.type === 'player') {
            const num = parseInt(o.number);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    const elPlayerNumber = document.getElementById('canvas-player-number');
    const elPlayerSelect = document.getElementById('canvas-player-select');
    if (elPlayerNumber) elPlayerNumber.value = maxNum + 1;
    
    if (isFormationMode) {
        if (elPlayerNumber) elPlayerNumber.classList.add('hidden');
        if (elPlayerSelect) {
            elPlayerSelect.classList.remove('hidden');
            const match = state.matches.find(m => m.id === currentMatchId);
            if (match) {
                const formObj = match.formations.find(f => f.id === currentFormationId);
                const lineup = formObj ? (formObj.lineup || []) : [];
                let options = '<option value="">- 選手を選択 -</option>';
                lineup.forEach(l => {
                    const p = state.players.find(pl => pl.id === l.playerId);
                    if (p) {
                        options += `<option value="${p.id}" data-num="${p.number}" data-name="${p.name}">${p.number} ${p.name}</option>`;
                    }
                });
                elPlayerSelect.innerHTML = options;
            }
        }
    } else {
        if (elPlayerNumber) elPlayerNumber.classList.remove('hidden');
        if (elPlayerSelect) elPlayerSelect.classList.add('hidden');
    }
    
    updateFrameCount();
    drawPitch(objects);

    const tools = ['select', 'red', 'blue', 'green', 'orange', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'text', 'line-move', 'line-pass', 'line-dribble'];
    tools.forEach(tool => {
        const el = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (!el) return;
        
        // Hide non-player tools in formation mode
        const isPlayerTool = ['select', 'red', 'blue', 'green', 'orange'].includes(tool);
        if (isFormationMode && !isPlayerTool) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }

        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        
        newEl.addEventListener('click', (e) => {
            currentTool = tool;
            document.querySelectorAll('.canvas-toolbar .tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
    const selectTool = document.querySelector('.tool-btn[data-tool="select"]');
    if(selectTool) selectTool.classList.add('active');
    
    const btnClear = document.getElementById('tool-clear');
    const newBtnClear = btnClear.cloneNode(true);
    btnClear.parentNode.replaceChild(newBtnClear, btnClear);
    newBtnClear.addEventListener('click', () => {
        stopAnimation();
        objects = [];
        frames = [];
        updateFrameCount();
        if (elPlayerNumber) elPlayerNumber.value = 1;
        saveHistory();
        drawPitch(objects);
    });

    const btnUndo = document.getElementById('tool-undo');
    if (btnUndo) {
        const newBtnUndo = btnUndo.cloneNode(true);
        btnUndo.parentNode.replaceChild(newBtnUndo, btnUndo);
        newBtnUndo.addEventListener('click', undoHistory);
    }

    const btnDelete = document.getElementById('tool-delete');
    if (btnDelete) {
        const newBtnDelete = btnDelete.cloneNode(true);
        btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
        newBtnDelete.addEventListener('click', () => {
            if (selectedObject) {
                objects = objects.filter(o => o.id !== selectedObject.id);
                selectedObject = null;
                saveHistory();
                drawPitch(objects);
            }
        });
    }

    const btnRotate = document.getElementById('tool-rotate');
    if (btnRotate) {
        const newBtnRotate = btnRotate.cloneNode(true);
        btnRotate.parentNode.replaceChild(newBtnRotate, btnRotate);
        newBtnRotate.addEventListener('click', () => {
            if (selectedObject && selectedObject.type === 'minigoal') {
                selectedObject.angle = ((selectedObject.angle || 0) + 90) % 360;
                saveHistory();
                drawPitch(objects);
            }
        });
    }

    document.removeEventListener('keydown', handleCanvasKeyDown);
    document.addEventListener('keydown', handleCanvasKeyDown);

    const btnAdd = document.getElementById('anim-add-frame');
    const newBtnAdd = btnAdd.cloneNode(true);
    btnAdd.parentNode.replaceChild(newBtnAdd, btnAdd);
    newBtnAdd.addEventListener('click', addFrame);

    const btnPlay = document.getElementById('anim-play');
    const newBtnPlay = btnPlay.cloneNode(true);
    btnPlay.parentNode.replaceChild(newBtnPlay, btnPlay);
    newBtnPlay.addEventListener('click', playAnimation);

    const btnStop = document.getElementById('anim-stop');
    const newBtnStop = btnStop.cloneNode(true);
    btnStop.parentNode.replaceChild(newBtnStop, btnStop);
    newBtnStop.addEventListener('click', stopAnimation);
    
    const countEl = document.getElementById('frame-count');

    // Save Button Logic
    let btnSave = document.getElementById('anim-save');
    if (!btnSave) {
        btnSave = document.createElement('button');
        btnSave.id = 'anim-save';
        btnSave.className = 'btn btn-primary';
        document.querySelector('.canvas-toolbar').appendChild(btnSave);
    }
    
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    // Cancel/Back Button Logic
    let btnBack = document.getElementById('anim-back');
    if (!btnBack) {
        btnBack = document.createElement('button');
        btnBack.id = 'anim-back';
        btnBack.className = 'btn btn-secondary';
        btnBack.innerHTML = '<i class="fa-solid fa-arrow-left"></i> 戻る';
        document.querySelector('.canvas-toolbar').appendChild(btnBack);
    }
    btnBack.onclick = () => {
        if(isFormationMode) {
            navigate('matches');
            setTimeout(() => {
                const btnDetail = document.querySelector(`.btn-detail-match[data-id="${currentMatchId}"]`);
                if(btnDetail) btnDetail.click();
                setTimeout(() => {
                    const tabFormation = document.getElementById('tab-match-formation');
                    if(tabFormation) tabFormation.click();
                }, 50);
            }, 50);
        } else if (isLibraryMode) {
            navigate('library');
        } else {
            navigate('practices');
        }
    };
    
    if (isFormationMode) {
        newBtnAdd.style.display = 'none';
        newBtnPlay.style.display = 'none';
        newBtnStop.style.display = 'none';
        if(countEl) countEl.style.display = 'none';
        
        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> フォーメーション保存';
        newBtnSave.addEventListener('click', () => {
            const match = state.matches.find(m => m.id === currentMatchId);
            if (match) {
                const formObj = match.formations.find(f => f.id === currentFormationId);
                if (formObj) {
                    formObj.boardData = JSON.parse(JSON.stringify(objects));
                    const templateEl = document.getElementById('canvas-pitch-template');
                    formObj.pitchTemplate = templateEl ? templateEl.value : 'full';
                    saveData();
                    showToast('フォーメーションを保存しました');
                    navigate('matches');
                    setTimeout(() => {
                        const btnDetail = document.querySelector(`.btn-detail-match[data-id="${currentMatchId}"]`);
                        if(btnDetail) btnDetail.click();
                        setTimeout(() => {
                            const tabFormation = document.getElementById('tab-match-formation');
                            if(tabFormation) tabFormation.click();
                        }, 50);
                    }, 50);
                }
            }
        });
    } else if (currentPracticeId && currentMenuId) {
        newBtnAdd.style.display = 'inline-block';
        newBtnPlay.style.display = 'inline-block';
        newBtnStop.style.display = 'inline-block';
        if(countEl) countEl.style.display = 'inline-block';
        
        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> 練習に保存';
        newBtnSave.addEventListener('click', () => {
            const practice = state.practices.find(p => p.id === currentPracticeId);
            if (practice) {
                const menu = practice.menus.find(m => m.id === currentMenuId);
                if (menu) {
                    if (frames.length === 0 && objects.length > 0) {
                        frames.push(JSON.parse(JSON.stringify(objects)));
                    }
                    menu.frames = JSON.parse(JSON.stringify(frames));
                    const templateEl = document.getElementById('canvas-pitch-template');
                    menu.pitchTemplate = templateEl ? templateEl.value : 'full';
                    saveData();
                    showToast('アニメーションを保存しました');
                    navigate('practices');
                }
            }
        });
    } else if (isLibraryMode) {
        newBtnAdd.style.display = 'inline-block';
        newBtnPlay.style.display = 'inline-block';
        newBtnStop.style.display = 'inline-block';
        if(countEl) countEl.style.display = 'inline-block';
        
        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> ライブラリに保存';
        newBtnSave.addEventListener('click', () => {
            const libMenu = state.menuLibrary.find(m => m.id === currentLibraryId);
            if (libMenu) {
                if (frames.length === 0 && objects.length > 0) {
                    frames.push(JSON.parse(JSON.stringify(objects)));
                }
                libMenu.frames = JSON.parse(JSON.stringify(frames));
                const templateEl = document.getElementById('canvas-pitch-template');
                libMenu.pitchTemplate = templateEl ? templateEl.value : 'full';
                saveData();
                showToast('作図を保存しました');
                navigate('library');
            }
        });
    } else {
        newBtnSave.style.display = 'none';
    }

    // Reset canvas listeners
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    ctx = canvas.getContext('2d');

    // Pitch Template Change Handler
    const templateSel = document.getElementById('canvas-pitch-template');
    if (templateSel) {
        let savedTemplate = 'full';
        if (targetMenu && targetMenu.pitchTemplate) {
            savedTemplate = targetMenu.pitchTemplate;
        } else if (isFormationMode) {
            const match = state.matches.find(m => m.id === currentMatchId);
            if (match) {
                const formObj = match.formations.find(f => f.id === currentFormationId);
                if (formObj && formObj.pitchTemplate) {
                    savedTemplate = formObj.pitchTemplate;
                }
            }
        }
        templateSel.value = savedTemplate;
        templateSel.onchange = () => {
            drawPitch(objects);
        };
    }
    
    drawPitch(objects);

    selectedObject = null; // Globals for canvas
    
    if(elPlayerNumber) {
        const newEl = elPlayerNumber.cloneNode(true);
        elPlayerNumber.parentNode.replaceChild(newEl, elPlayerNumber);
        newEl.addEventListener('input', (e) => {
            if (selectedObject && selectedObject.type === 'player') {
                selectedObject.number = e.target.value;
                drawPitch(objects);
            }
        });
    }

    if(elPlayerSelect) {
        const newEl = elPlayerSelect.cloneNode(true);
        elPlayerSelect.parentNode.replaceChild(newEl, elPlayerSelect);
        newEl.addEventListener('change', (e) => {
            if (selectedObject && selectedObject.type === 'player') {
                const opt = e.target.options[e.target.selectedIndex];
                if (opt.value) {
                    selectedObject.playerId = opt.value;
                    selectedObject.number = opt.dataset.num;
                    selectedObject.playerName = opt.dataset.name;
                    drawPitch(objects);
                }
            }
        });
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // --- Touch support (mobile) ---
    function getTouchPos(touchEvent) {
        const rect = canvas.getBoundingClientRect();
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        return {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
    }

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseDown({ clientX: pos.clientX, clientY: pos.clientY, button: 0 });
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseMove({ clientX: pos.clientX, clientY: pos.clientY });
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const pos = getTouchPos(e);
        handleMouseUp({ clientX: pos.clientX, clientY: pos.clientY });
    }, { passive: false });
}

function updateFrameCount() {
    const el = document.getElementById('frame-count');
    if(el) el.textContent = frames.length;
}

function addFrame() {
    frames.push(JSON.parse(JSON.stringify(objects)));
    updateFrameCount();
}

function stopAnimation() {
    isPlaying = false;
    if (animReqId) cancelAnimationFrame(animReqId);
    if (frames.length > 0) {
        objects = JSON.parse(JSON.stringify(frames[frames.length - 1]));
    }
    if (canvas) {
        drawPitch(objects);
    }
}

function playAnimation() {
    if (frames.length < 2) {
        alert('アニメーションを作成するには、少なくとも2つのシーンを記録してください。');
        return;
    }
    isPlaying = true;
    let currentFrameIdx = 0;
    let startTime = null;
    const duration = 1500; 

    function animate(timestamp) {
        if (!isPlaying) return;
        if (!startTime) startTime = timestamp;
        
        let progress = (timestamp - startTime) / duration;
        
        if (progress >= 1) {
            currentFrameIdx++;
            startTime = timestamp;
            progress = 0;
            if (currentFrameIdx >= frames.length - 1) {
                currentFrameIdx = 0;
            }
        }

        const currentFrame = frames[currentFrameIdx];
        const nextFrame = frames[currentFrameIdx + 1];
        
        const isStaticType = (type) => ['line', 'ladder', 'rect', 'cone', 'marker', 'minigoal'].includes(type);

        const interpolatedObjects = currentFrame.map(obj1 => {
            if (isStaticType(obj1.type)) return obj1; 
            const obj2 = nextFrame.find(o => o.id === obj1.id);
            if (!obj2) return obj1; 

            const p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
            
            return {
                ...obj1,
                x: obj1.x + (obj2.x - obj1.x) * p,
                y: obj1.y + (obj2.y - obj1.y) * p
            };
        });

        const staticObjs = currentFrame.filter(o => isStaticType(o.type));
        const drawList = [...interpolatedObjects.filter(o => !isStaticType(o.type)), ...staticObjs];

        drawPitch(drawList);
        animReqId = requestAnimationFrame(animate);
    }
    
    animReqId = requestAnimationFrame(animate);
}

function drawPitch(renderObjects) {
    const templateEl = document.getElementById('canvas-pitch-template');
    const template = templateEl ? templateEl.value : 'full';
    drawPitchToCtx(renderObjects, canvas, ctx, template);
    updateCanvasToolbar();
}

function drawPitchToCtx(renderObjects, targetCanvas, targetCtx, template = 'full') {
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    
    targetCtx.clearRect(0, 0, w, h);
    
    // Background - modern grey-white
    targetCtx.fillStyle = '#f1f5f9';
    targetCtx.fillRect(0, 0, w, h);
    
    // Proportions and Dimensions
    const pitchX = 20;
    const pitchY = 20;
    const pitchW = w - 40;
    const pitchH = h - 40;
    
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 1.5;
    
    // Outer boundary
    targetCtx.strokeRect(pitchX, pitchY, pitchW, pitchH);

    if (template === 'full' || template === 'grid') {
        const laneH = pitchH / 5;
        const penW = pitchW * 0.16;
        const penH = laneH * 3;
        const penY = pitchY + laneH;
        const goalAreaW = pitchW * 0.055;
        const goalAreaH = laneH;
        const goalAreaY = pitchY + laneH * 2;
        const goalH = goalAreaH * 0.4;
        const goalTopY = pitchY + pitchH / 2 - goalH / 2;
        const goalBotY = pitchY + pitchH / 2 + goalH / 2;
        const centerCircleR = pitchH * 0.135;
        const penSpotDist = pitchW * 0.105;

        // Grid Lines (5 Lanes & Bielsa lines)
        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        // 5 Lanes (Longitudinal)
        targetCtx.beginPath();
        [pitchY + laneH, pitchY + laneH * 2, pitchY + laneH * 3, pitchY + laneH * 4].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });
        
        // Transversal lines (mid-half zones and penalty box depth)
        const leftMidHalf = pitchX + penW + (pitchW / 2 - penW) / 2;
        const rightMidHalf = pitchX + pitchW / 2 + (pitchW / 2 - penW) / 2;
        [pitchX + penW, leftMidHalf, rightMidHalf, pitchX + pitchW - penW].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });
        
        // Bielsa lines
        let m, targetX;
        m = (penY - goalTopY) / penW;
        targetX = pitchX + (pitchY - goalTopY) / m;
        targetCtx.moveTo(pitchX, goalTopY);
        targetCtx.lineTo(targetX, pitchY);
        m = ((penY + penH) - goalBotY) / penW;
        targetX = pitchX + ((pitchY + pitchH) - goalBotY) / m;
        targetCtx.moveTo(pitchX, goalBotY);
        targetCtx.lineTo(targetX, pitchY + pitchH);
        m = (penY - goalTopY) / (-penW);
        targetX = (pitchX + pitchW) + (pitchY - goalTopY) / m;
        targetCtx.moveTo(pitchX + pitchW, goalTopY);
        targetCtx.lineTo(targetX, pitchY);
        m = ((penY + penH) - goalBotY) / (-penW);
        targetX = (pitchX + pitchW) + ((pitchY + pitchH) - goalBotY) / m;
        targetCtx.moveTo(pitchX + pitchW, goalBotY);
        targetCtx.lineTo(targetX, pitchY + pitchH);

        targetCtx.stroke();
        targetCtx.setLineDash([]); // Reset dash for main lines

        // Tactical Grid mode additional grids (vertical/horizontal lines)
        if (template === 'grid') {
            targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            targetCtx.lineWidth = 1;
            targetCtx.setLineDash([2, 2]);
            targetCtx.beginPath();
            // vertical grid lines (quarters)
            [pitchX + pitchW / 4, pitchX + pitchW * 3 / 4].forEach(x => {
                targetCtx.moveTo(x, pitchY);
                targetCtx.lineTo(x, pitchY + pitchH);
            });
            // horizontal grid lines (quarters)
            [pitchY + pitchH / 4, pitchY + pitchH * 3 / 4].forEach(y => {
                targetCtx.moveTo(pitchX, y);
                targetCtx.lineTo(pitchX + pitchW, y);
            });
            targetCtx.stroke();
            targetCtx.setLineDash([]);
        }

        // Main Pitch Lines - Dark grey
        targetCtx.strokeStyle = '#334155';
        targetCtx.lineWidth = 1.5;
        
        // Center line
        targetCtx.beginPath();
        targetCtx.moveTo(pitchX + pitchW / 2, pitchY);
        targetCtx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
        targetCtx.stroke();
        
        // Center circle
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, centerCircleR, 0, Math.PI * 2);
        targetCtx.stroke();
        
        // Center spot
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        // Penalty & Goal areas - Left
        targetCtx.strokeRect(pitchX, penY, penW, penH); // Penalty Area
        targetCtx.strokeRect(pitchX, goalAreaY, goalAreaW, goalAreaH); // Goal Area
        const arcAngle = Math.acos((penW - penSpotDist) / centerCircleR);
        targetCtx.beginPath();
        targetCtx.arc(pitchX + penSpotDist, pitchY + pitchH / 2, centerCircleR, -arcAngle, arcAngle);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(pitchX + penSpotDist, pitchY + pitchH / 2, 2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.strokeRect(pitchX - 10, goalTopY, 10, goalH);

        // Penalty & Goal areas - Right
        targetCtx.strokeRect(pitchX + pitchW - penW, penY, penW, penH);
        targetCtx.strokeRect(pitchX + pitchW - goalAreaW, goalAreaY, goalAreaW, goalAreaH);
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW - penSpotDist, pitchY + pitchH / 2, centerCircleR, Math.PI - arcAngle, Math.PI + arcAngle);
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(pitchX + pitchW - penSpotDist, pitchY + pitchH / 2, 2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.strokeRect(pitchX + pitchW, goalTopY, 10, goalH);

    } else if (template === 'half') {
        // Rotate half court to landscape (attacking upwards) and map coordinates exactly from full court
        const halfW = 760;
        const halfH = 460;
        
        // Exact mapped dimensions to align with full court outer boundaries (20, 20, 760, 460)
        const penX_left = 171.8;
        const penX_right = 627.2;
        const penY_half = 167.2;
        
        const goalAreaX_left = 297.5;
        const goalAreaX_right = 502.5;
        const goalAreaY_half = 70.6;
        
        const goalLeftX_half = 369.6;
        const goalRightX_half = 430.4;
        const goalW_half = goalRightX_half - goalLeftX_half;
        
        const penSpotY_half = 116.6;
        const circleR_halfX = 102.5;
        const circleR_halfY = 75.1;

        // Center line on the bottom side of the outer box
        targetCtx.beginPath();
        targetCtx.moveTo(pitchX, pitchY + pitchH);
        targetCtx.lineTo(pitchX + pitchW, pitchY + pitchH);
        targetCtx.stroke();

        // Center circle (half ellipse) centered at bottom
        targetCtx.beginPath();
        targetCtx.ellipse(400, pitchY + pitchH, circleR_halfX, circleR_halfY, 0, Math.PI, 0);
        targetCtx.stroke();

        // Center spot
        targetCtx.beginPath();
        targetCtx.arc(400, pitchY + pitchH, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        // Penalty & Goal areas
        targetCtx.strokeRect(penX_left, pitchY, penX_right - penX_left, penY_half - pitchY);
        targetCtx.strokeRect(goalAreaX_left, pitchY, goalAreaX_right - goalAreaX_left, goalAreaY_half - pitchY);

        // Penalty spot
        targetCtx.beginPath();
        targetCtx.arc(400, penSpotY_half, 2, 0, Math.PI * 2);
        targetCtx.fill();

        // Penalty arc (outside the box, half ellipse)
        const arcAngle_half = Math.acos((penY_half - penSpotY_half) / circleR_halfY);
        targetCtx.beginPath();
        targetCtx.ellipse(400, penSpotY_half, circleR_halfX, circleR_halfY, 0, arcAngle_half, Math.PI - arcAngle_half);
        targetCtx.stroke();

        // Goal
        targetCtx.strokeRect(goalLeftX_half, pitchY - 10, goalW_half, 10);

        // Grids & Bielsa lines (Faithfully reproduced for half court)
        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        // 5 Lanes (Longitudinal lines - vertical lines dividing 68m width)
        targetCtx.beginPath();
        const laneW_half = pitchW / 5;
        [pitchX + laneW_half, pitchX + laneW_half * 2, pitchX + laneW_half * 3, pitchX + laneW_half * 4].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });

        // Transversal grid lines (mid-half zones - horizontal lines)
        const midTransverseY = penY_half + (pitchH - (penY_half - pitchY)) / 2;
        [penY_half, midTransverseY].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });
        targetCtx.stroke();

        // Bielsa lines (diagonal lines from top goal posts to bottom corner bounds)
        targetCtx.beginPath();
        targetCtx.moveTo(goalLeftX_half, pitchY);
        targetCtx.lineTo(20, 280); // matches rotated bottom-left corner intersection

        targetCtx.moveTo(goalRightX_half, pitchY);
        targetCtx.lineTo(780, 280); // matches rotated bottom-right corner intersection

        targetCtx.stroke();
        targetCtx.setLineDash([]);

    } else if (template === 'half-bottom') {
        // Goal at the bottom patterns (vertically reflected half court)
        const halfW = 760;
        const halfH = 460;
        
        // Exact mapped dimensions reflected to bottom
        const penX_left = 171.8;
        const penX_right = 627.2;
        const penY_half = 332.8; // Reflected from 167.2 (500 - 167.2)
        
        const goalAreaX_left = 297.5;
        const goalAreaX_right = 502.5;
        const goalAreaY_half = 429.4; // Reflected from 70.6
        
        const goalLeftX_half = 369.6;
        const goalRightX_half = 430.4;
        const goalW_half = goalRightX_half - goalLeftX_half;
        
        const penSpotY_half = 383.4; // Reflected from 116.6
        const circleR_halfX = 102.5;
        const circleR_halfY = 75.1;

        // Center line on the top side of the outer box
        targetCtx.beginPath();
        targetCtx.moveTo(pitchX, pitchY);
        targetCtx.lineTo(pitchX + pitchW, pitchY);
        targetCtx.stroke();

        // Center circle (half ellipse) centered at top
        targetCtx.beginPath();
        targetCtx.ellipse(400, pitchY, circleR_halfX, circleR_halfY, 0, 0, Math.PI);
        targetCtx.stroke();

        // Center spot
        targetCtx.beginPath();
        targetCtx.arc(400, pitchY, 3, 0, Math.PI * 2);
        targetCtx.fillStyle = '#334155';
        targetCtx.fill();

        // Penalty & Goal areas (Y ranges from penY_half to pitchY + pitchH)
        targetCtx.strokeRect(penX_left, penY_half, penX_right - penX_left, (pitchY + pitchH) - penY_half);
        targetCtx.strokeRect(goalAreaX_left, goalAreaY_half, goalAreaX_right - goalAreaX_left, (pitchY + pitchH) - goalAreaY_half);

        // Penalty spot
        targetCtx.beginPath();
        targetCtx.arc(400, penSpotY_half, 2, 0, Math.PI * 2);
        targetCtx.fill();

        // Penalty arc (outside the box, half ellipse curving upwards)
        const arcAngle_half = Math.acos((penSpotY_half - penY_half) / circleR_halfY);
        targetCtx.beginPath();
        targetCtx.ellipse(400, penSpotY_half, circleR_halfX, circleR_halfY, 0, Math.PI + arcAngle_half, 2 * Math.PI - arcAngle_half);
        targetCtx.stroke();

        // Goal
        targetCtx.strokeRect(goalLeftX_half, pitchY + pitchH, goalW_half, 10);

        // Grids & Bielsa lines (Faithfully reproduced for half court)
        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        targetCtx.lineWidth = 1;
        targetCtx.setLineDash([4, 4]);

        // 5 Lanes (Longitudinal vertical lines)
        targetCtx.beginPath();
        const laneW_half = pitchW / 5;
        [pitchX + laneW_half, pitchX + laneW_half * 2, pitchX + laneW_half * 3, pitchX + laneW_half * 4].forEach(x => {
            targetCtx.moveTo(x, pitchY);
            targetCtx.lineTo(x, pitchY + pitchH);
        });

        // Transversal grid lines (mid-half zones - horizontal lines)
        const midTransverseY = 20 + 176.4; // Reflected from 323.6 (500 - 323.6 + 20? Wait, 500 - 323.6 = 176.4)
        [penY_half, midTransverseY].forEach(y => {
            targetCtx.moveTo(pitchX, y);
            targetCtx.lineTo(pitchX + pitchW, y);
        });
        targetCtx.stroke();

        // Bielsa lines (diagonal lines from bottom goal posts to top corner bounds)
        targetCtx.beginPath();
        targetCtx.moveTo(goalLeftX_half, pitchY + pitchH);
        targetCtx.lineTo(20, 220); // reflected from 280 (500 - 280)

        targetCtx.moveTo(goalRightX_half, pitchY + pitchH);
        targetCtx.lineTo(780, 220); // reflected from 280 (500 - 280)

        targetCtx.stroke();
        targetCtx.setLineDash([]);

    } else if (template === 'blank') {
        // Blank canvas: Do not draw any inner lines, only the outer box boundary
        // Boundary is already drawn by default outer boundary strokeRect block.
    }

    renderObjects.forEach(obj => {
        if(obj.type === 'line') {
            drawArrowToCtx(obj.x1, obj.y1, obj.x2, obj.y2, obj.lineType || 'pass', targetCtx);
        } else if (obj.type === 'ladder') {
            drawLadderToCtx(obj.x1, obj.y1, obj.x2, obj.y2, targetCtx);
        } else if (obj.type === 'rect') {
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]);
            targetCtx.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));
            targetCtx.setLineDash([]);
            
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                const s = 8;
                targetCtx.fillRect(obj.x1 - s/2, obj.y1 - s/2, s, s);
                targetCtx.fillRect(obj.x2 - s/2, obj.y1 - s/2, s, s);
                targetCtx.fillRect(obj.x1 - s/2, obj.y2 - s/2, s, s);
                targetCtx.fillRect(obj.x2 - s/2, obj.y2 - s/2, s, s);
            }
        } else if (obj.type === 'marker') {
            targetCtx.beginPath();
            targetCtx.ellipse(obj.x, obj.y, 8, 4, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = obj.color;
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
            
            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, 12, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 1.5;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'cone') {
            // Cone base
            targetCtx.beginPath();
            targetCtx.ellipse(obj.x, obj.y + obj.radius * 0.8, obj.radius * 0.8, 3, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = '#eab308';
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();

            // Cone body
            targetCtx.beginPath();
            targetCtx.moveTo(obj.x, obj.y - obj.radius * 1.2);
            targetCtx.lineTo(obj.x + obj.radius * 0.7, obj.y + obj.radius * 0.8);
            targetCtx.lineTo(obj.x - obj.radius * 0.7, obj.y + obj.radius * 0.8);
            targetCtx.closePath();
            targetCtx.fillStyle = obj.color;
            targetCtx.fill();
            targetCtx.stroke();

            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'minigoal') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            // Draw top-down mini goal
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 2.5;
            targetCtx.strokeRect(-15, -10, 30, 15);
            
            targetCtx.beginPath();
            targetCtx.lineWidth = 1;
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            for (let nx = -12; nx < 15; nx += 6) {
                targetCtx.moveTo(nx, -10);
                targetCtx.lineTo(nx, 5);
            }
            for (let ny = -8; ny < 5; ny += 4) {
                targetCtx.moveTo(-15, ny);
                targetCtx.lineTo(15, ny);
            }
            targetCtx.stroke();
            targetCtx.restore();

            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'text') {
            targetCtx.fillStyle = obj.color;
            targetCtx.font = 'bold 14px Inter, sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(obj.text || '', obj.x, obj.y);

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                const tw = targetCtx.measureText(obj.text || '').width;
                targetCtx.rect(obj.x - tw/2 - 4, obj.y - 12, tw + 8, 24);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 1.5;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'player') {
            targetCtx.beginPath();
            targetCtx.arc(obj.x + 2, obj.y + 2, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(0,0,0,0.3)';
            targetCtx.fill();
            
            targetCtx.beginPath();
            targetCtx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = obj.color;
            targetCtx.fill();
            targetCtx.strokeStyle = '#1e293b';
            targetCtx.lineWidth = 2;
            targetCtx.stroke();
            
            targetCtx.fillStyle = '#ffffff';
            targetCtx.font = 'bold 12px Inter';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            
            let label = obj.number || '';
            targetCtx.fillText(label, obj.x, obj.y + 1);
            
            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'ball') {
            // Draw shadow
            targetCtx.beginPath();
            targetCtx.arc(obj.x + 1, obj.y + 1, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(0,0,0,0.3)';
            targetCtx.fill();
            
            // Draw base white circle
            targetCtx.beginPath();
            targetCtx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fill();
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 1.5;
            targetCtx.stroke();
            
            // Draw pentagon in center
            const r = obj.radius;
            const pentRadius = r * 0.38;
            targetCtx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const px = obj.x + pentRadius * Math.cos(angle);
                const py = obj.y + pentRadius * Math.sin(angle);
                if (i === 0) targetCtx.moveTo(px, py);
                else targetCtx.lineTo(px, py);
            }
            targetCtx.closePath();
            targetCtx.fillStyle = '#1e293b';
            targetCtx.fill();
            
            // Draw lines radiating outward from pentagon corners to outer circle bounds
            targetCtx.beginPath();
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = 1.2;
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const px = obj.x + pentRadius * Math.cos(angle);
                const py = obj.y + pentRadius * Math.sin(angle);
                const ox = obj.x + r * Math.cos(angle);
                const oy = obj.y + r * Math.sin(angle);
                
                targetCtx.moveTo(px, py);
                targetCtx.lineTo(ox, oy);
            }
            
            // Draw boundary panel details (small lines linking outer parts)
            for (let i = 0; i < 5; i++) {
                const angle1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const angle2 = (Math.PI * 2 * (i + 1)) / 5 - Math.PI / 2;
                const midAngle = (angle1 + angle2) / 2;
                
                const ox1 = obj.x + r * Math.cos(angle1);
                const oy1 = obj.y + r * Math.sin(angle1);
                const oxMid = obj.x + r * Math.cos(midAngle);
                const oyMid = obj.y + r * Math.sin(midAngle);
                const ox2 = obj.x + r * Math.cos(angle2);
                const oy2 = obj.y + r * Math.sin(angle2);
                
                targetCtx.moveTo(ox1, oy1);
                targetCtx.lineTo(oxMid, oyMid);
                targetCtx.lineTo(ox2, oy2);
            }
            targetCtx.stroke();
            
            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius + 4, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        }
    });
}

function drawArrowToCtx(x1, y1, x2, y2, lineType, targetCtx) {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const color = (lineType === 'pass' || lineType === 'dribble') ? '#ea580c' : '#334155';
    
    targetCtx.beginPath();
    
    if (lineType === 'dribble') {
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([]);
        const dist = Math.sqrt(dx*dx + dy*dy);
        const steps = Math.floor(dist / 10);
        targetCtx.moveTo(x1, y1);
        if (steps > 0) {
            for(let i=1; i<=steps; i++) {
                const px = x1 + (dx / steps) * i;
                const py = y1 + (dy / steps) * i;
                const perpX = -dy / dist * (i%2===0 ? 5 : -5);
                const perpY = dx / dist * (i%2===0 ? 5 : -5);
                if(i === steps) targetCtx.lineTo(x2, y2);
                else targetCtx.lineTo(px + perpX, py + perpY);
            }
        } else {
            targetCtx.lineTo(x2, y2);
        }
    } else {
        targetCtx.moveTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = (lineType === 'move') ? 2 : 3;
        if (lineType === 'pass') targetCtx.setLineDash([5, 5]);
        else targetCtx.setLineDash([]);
    }
    
    targetCtx.stroke();
    targetCtx.setLineDash([]);
    
    targetCtx.beginPath();
    targetCtx.moveTo(x2, y2);
    targetCtx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    targetCtx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    targetCtx.lineTo(x2, y2);
    targetCtx.fillStyle = color;
    targetCtx.fill();
}

function drawArrow(x1, y1, x2, y2, lineType) {
    drawArrowToCtx(x1, y1, x2, y2, lineType, ctx);
}

function drawLadderToCtx(x1, y1, x2, y2, targetCtx) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 10) return;
    
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;
    const width = 12; // half-width of ladder (total 24px)
    
    targetCtx.beginPath();
    // Rails
    targetCtx.moveTo(x1 + nx * width, y1 + ny * width);
    targetCtx.lineTo(x2 + nx * width, y2 + ny * width);
    targetCtx.moveTo(x1 - nx * width, y1 - ny * width);
    targetCtx.lineTo(x2 - nx * width, y2 - ny * width);
    
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 2.5;
    targetCtx.stroke();
    
    // Rungs (every 20 pixels)
    const step = 20;
    targetCtx.beginPath();
    for (let t = 0; t <= dist; t += step) {
        const rx = x1 + ux * t;
        const ry = y1 + uy * t;
        targetCtx.moveTo(rx + nx * width, ry + ny * width);
        targetCtx.lineTo(rx - nx * width, ry - ny * width);
    }
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 2;
    targetCtx.stroke();
}

function drawLadder(x1, y1, x2, y2) {
    drawLadderToCtx(x1, y1, x2, y2, ctx);
}

function drawRectPreview(x1, y1, x2, y2) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.setLineDash([]);
}

function applyGridSnap(val, axis = 'x') {
    const cb = document.getElementById('canvas-snap-grid');
    if (cb && cb.checked) {
        const center = (axis === 'x') ? 400 : 250;
        return center + Math.round((val - center) / 20) * 20;
    }
    return val;
}

function handleMouseDown(e) {
    if (isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left) * (canvas.width / rect.width);
    let y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (currentTool === 'select') {
        selectedObject = null;
        isResizing = false;
        resizeHandle = null;
        
        for(let i = objects.length-1; i >= 0; i--) {
            const obj = objects[i];
            if (obj.type === 'rect') {
                const s = 10;
                if (Math.abs(x - obj.x1) <= s && Math.abs(y - obj.y1) <= s) { isResizing = true; resizeHandle = 'nw'; draggedObject = obj; selectedObject = obj; break; }
                if (Math.abs(x - obj.x2) <= s && Math.abs(y - obj.y1) <= s) { isResizing = true; resizeHandle = 'ne'; draggedObject = obj; selectedObject = obj; break; }
                if (Math.abs(x - obj.x1) <= s && Math.abs(y - obj.y2) <= s) { isResizing = true; resizeHandle = 'sw'; draggedObject = obj; selectedObject = obj; break; }
                if (Math.abs(x - obj.x2) <= s && Math.abs(y - obj.y2) <= s) { isResizing = true; resizeHandle = 'se'; draggedObject = obj; selectedObject = obj; break; }
                
                const mx1 = Math.min(obj.x1, obj.x2);
                const mx2 = Math.max(obj.x1, obj.x2);
                const my1 = Math.min(obj.y1, obj.y2);
                const my2 = Math.max(obj.y1, obj.y2);
                if (x >= mx1 && x <= mx2 && y >= my1 && y <= my2) {
                    draggedObject = obj;
                    selectedObject = obj;
                    startX = x; startY = y;
                    break;
                }
            } else if(obj.type !== 'line' && obj.type !== 'ladder') {
                const dx = x - obj.x;
                const dy = y - obj.y;
                let isHit = false;
                if (obj.type === 'text') {
                    ctx.font = 'bold 14px Inter, sans-serif';
                    const tw = ctx.measureText(obj.text || '').width;
                    isHit = Math.abs(dx) <= tw/2 + 5 && Math.abs(dy) <= 15;
                } else {
                    isHit = Math.sqrt(dx*dx + dy*dy) <= obj.radius + 5;
                }
                
                if(isHit) {
                    draggedObject = obj;
                    selectedObject = obj;
                    
                    if (obj.type === 'player') {
                        const elNum = document.getElementById('canvas-player-number');
                        const elSel = document.getElementById('canvas-player-select');
                        if (elNum) elNum.value = obj.number || '';
                        if (elSel && obj.playerId) elSel.value = obj.playerId;
                    }
                    break;
                }
            }
        }
        drawPitch(objects);
    } else if (currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
        isDrawing = true;
        startX = applyGridSnap(x, 'x');
        startY = applyGridSnap(y, 'y');
    } else {
        selectedObject = null;
        x = applyGridSnap(x, 'x');
        y = applyGridSnap(y, 'y');
        
        let color, radius, type, number = '', playerId = '', playerName = '';
        const elPlayerNumber = document.getElementById('canvas-player-number');
        const elPlayerSelect = document.getElementById('canvas-player-select');
        
        const isFormationMode = !!(currentMatchId && currentFormationId);
        if (elPlayerSelect && !elPlayerSelect.classList.contains('hidden')) {
            const opt = elPlayerSelect.options[elPlayerSelect.selectedIndex];
            if (opt && opt.value) {
                playerId = opt.value;
                number = opt.dataset.num;
                playerName = opt.dataset.name;
            }
        } else {
            number = elPlayerNumber ? elPlayerNumber.value : '';
        }

        if(currentTool === 'red') { color = '#f23932'; radius = 14; type = 'player'; }
        if(currentTool === 'blue') { color = '#3d79d5'; radius = 14; type = 'player'; }
        if(currentTool === 'green') { color = '#63a84d'; radius = 14; type = 'player'; }
        if(currentTool === 'orange') { color = '#f09f4d'; radius = 14; type = 'player'; }
        if(currentTool === 'ball') { color = '#ffffff'; radius = 8; type = 'ball'; }
        if(currentTool === 'marker') { color = '#f97316'; radius = 8; type = 'marker'; }
        if(currentTool === 'cone') { color = '#facc15'; radius = 10; type = 'cone'; }
        if(currentTool === 'minigoal') { color = '#ffffff'; radius = 15; type = 'minigoal'; }
        if(currentTool === 'text') { color = '#000000'; radius = 0; type = 'text'; }
        
        if (type) {
            const newObj = { id: objectIdCounter++, type, x, y, radius, color, number };
            if (type === 'text') {
                const modal = document.getElementById('modal-text-input');
                const input = document.getElementById('canvas-text-value');
                if(modal && input) {
                    input.value = '';
                    modal.classList.remove('hidden');
                    input.focus();
                    
                    const form = document.getElementById('form-text-input');
                    form.onsubmit = (ev) => {
                        ev.preventDefault();
                        if(input.value) {
                            newObj.text = input.value;
                            objects.push(newObj);
                            selectedObject = newObj;
                            saveHistory();
                            drawPitch(objects);
                        }
                        modal.classList.add('hidden');
                    };
                    return;
                }
            }
            if (playerId) {
                newObj.playerId = playerId;
                newObj.playerName = playerName;
            }
            objects.push(newObj);
            selectedObject = newObj;
            saveHistory();
            drawPitch(objects);
            
            // Auto increment number box
            if (type === 'player' && elPlayerNumber && !isFormationMode) {
                let n = parseInt(elPlayerNumber.value);
                if (!isNaN(n)) elPlayerNumber.value = n + 1;
            }
        }
    }
}

function handleMouseMove(e) {
    if (isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if(draggedObject) {
        if (isResizing && draggedObject.type === 'rect') {
            if (resizeHandle === 'nw') { draggedObject.x1 = applyGridSnap(x, 'x'); draggedObject.y1 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'ne') { draggedObject.x2 = applyGridSnap(x, 'x'); draggedObject.y1 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'sw') { draggedObject.x1 = applyGridSnap(x, 'x'); draggedObject.y2 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'se') { draggedObject.x2 = applyGridSnap(x, 'x'); draggedObject.y2 = applyGridSnap(y, 'y'); }
        } else if (draggedObject.type === 'rect') {
            const dx = applyGridSnap(x, 'x') - applyGridSnap(startX, 'x');
            const dy = applyGridSnap(y, 'y') - applyGridSnap(startY, 'y');
            draggedObject.x1 += dx; draggedObject.x2 += dx;
            draggedObject.y1 += dy; draggedObject.y2 += dy;
            startX = x; startY = y;
        } else {
            draggedObject.x = applyGridSnap(x, 'x');
            draggedObject.y = applyGridSnap(y, 'y');
        }
        drawPitch(objects);
    } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
        drawPitch(objects);
        if (currentTool === 'ladder') {
            drawLadder(startX, startY, applyGridSnap(x, 'x'), applyGridSnap(y, 'y'));
        } else if (currentTool === 'line-rect') {
            drawRectPreview(startX, startY, applyGridSnap(x, 'x'), applyGridSnap(y, 'y'));
        } else {
            const lType = currentTool.replace('line-', '');
            drawArrow(startX, startY, applyGridSnap(x, 'x'), applyGridSnap(y, 'y'), lType);
        }
    }
}

function handleMouseUp(e) {
    if (isPlaying) return;
    if(draggedObject) {
        saveHistory();
        draggedObject = null;
        isResizing = false;
        resizeHandle = null;
    } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
        const rect = canvas.getBoundingClientRect();
        const x = applyGridSnap((e.clientX - rect.left) * (canvas.width / rect.width), 'x');
        const y = applyGridSnap((e.clientY - rect.top) * (canvas.height / rect.height), 'y');
        if(Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
            if (currentTool === 'ladder') {
                objects.push({ id: objectIdCounter++, type: 'ladder', x1: startX, y1: startY, x2: x, y2: y });
            } else if (currentTool === 'line-rect') {
                objects.push({ id: objectIdCounter++, type: 'rect', x1: startX, y1: startY, x2: x, y2: y });
            } else {
                const lType = currentTool.replace('line-', '');
                objects.push({ id: objectIdCounter++, type: 'line', lineType: lType, x1: startX, y1: startY, x2: x, y2: y });
            }
            saveHistory();
        }
        isDrawing = false;
        drawPitch(objects);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
