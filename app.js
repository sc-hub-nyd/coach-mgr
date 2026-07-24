let state = {
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

let currentMatchNendo = 'all';
let currentPracticeNendo = 'all';
let currentPracticeMonth = 'all';
let currentLibraryCategory = 'all';

let currentMatchPage = 1;
let currentPracticePage = 1;
const ITEMS_PER_PAGE = 10;

// Security & Helper Functions
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function encryptData(text) {
    try {
        if (!text) return text;
        const encoded = encodeURIComponent(text);
        return btoa(encoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (101 + (i % 7)))).join(''));
    } catch (e) {
        return text;
    }
}

function decryptData(ciphertext) {
    try {
        if (!ciphertext) return ciphertext;
        const decoded = atob(ciphertext);
        const unmasked = decoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (101 + (i % 7)))).join('');
        return decodeURIComponent(unmasked);
    } catch (e) {
        return ciphertext; // Fallback to raw if decryption fails (e.g., plain json from older version)
    }
}

function getNendo(dateStr) {
    const d = new Date(dateStr);
    let year = d.getFullYear();
    if (d.getMonth() < 3) year--; // Jan, Feb, Mar
    return year;
}

// LocalStorage Logic
function loadData() {
    let saved = localStorage.getItem('coachMgrData');
    if (saved) {
        if (saved.startsWith('enc:')) {
            saved = decryptData(saved.slice(4));
        }
        let parsed = null;
        try {
            parsed = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse saved data:', e);
        }
        if (parsed) {
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
        }

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
        state.matches = [];
        state.practices = [];
        state.players = [];
        state.menuLibrary = [];
    }
}

function saveData() {
    const jsonStr = JSON.stringify({
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
    });

    // Store encrypted
    localStorage.setItem('coachMgrData', 'enc:' + encryptData(jsonStr));

    // Auto sync to cloud ONLY if in coach mode and URL is configured (prevents background push on parent/view mode)
    if (state.currentUserRole === 'coach' && state.teamInfo && state.teamInfo.gasApiUrl) {
        syncPushGasCloud(true);
    }
}

// GAS Cloud Sync Engine
function syncPushGasCloud(isSilent = false) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        if (!isSilent) alert('Google Apps Script の Web API URL が設定されていません。「設定」画面で入力してください。');
        return Promise.reject('No URL');
    }

    const payload = {
        action: 'push',
        sheetName: state.teamInfo.gasSheetName || '',
        authToken: state.teamInfo.gasAuthToken || '',
        data: {
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
        }
    };

    if (!isSilent) showToast('クラウドへ同期中...');

    return fetch(state.teamInfo.gasApiUrl, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) throw new Error(`HTTPエラー: ${res.status}`);
            return res.json();
        })
        .then(resData => {
            if (resData && resData.status === 'success') {
                if (!isSilent) showToast('クラウドへの送信が完了しました！');
                return resData;
            } else {
                throw new Error(resData.message || '同期エラー');
            }
        })
        .catch(err => {
            console.error('GAS Sync Push Error Details:', err);
            if (!isSilent) alert(`クラウド送信に失敗しました:\n${err.message || err}`);
        });
}

function syncPullGasCloud(isSilent = false) {
    if (!state.teamInfo || !state.teamInfo.gasApiUrl) {
        if (!isSilent) alert('Google Apps Script の Web API URL が設定されていません。「設定」画面で入力してください。');
        return Promise.reject('No URL');
    }

    if (!isSilent) showToast('クラウドからデータを受信中...');

    const sheetParam = state.teamInfo.gasSheetName ? `&sheetName=${encodeURIComponent(state.teamInfo.gasSheetName)}` : '';
    const authParam = state.teamInfo.gasAuthToken ? `&authToken=${encodeURIComponent(state.teamInfo.gasAuthToken)}` : '';
    const fetchUrl = `${state.teamInfo.gasApiUrl}?action=pull${sheetParam}${authParam}&t=${Date.now()}`;

    return fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
    })
        .then(res => {
            if (!res.ok) throw new Error(`HTTPエラー: ${res.status}`);
            return res.json();
        })
        .then(resData => {
            if (resData && resData.status === 'success' && resData.data) {
                let remoteData = resData.data;

                // Handle multiple levels of stringification if present
                for (let i = 0; i < 3; i++) {
                    if (typeof remoteData === 'string') {
                        try { remoteData = JSON.parse(remoteData); } catch (e) { break; }
                    }
                }

                // Validate data integrity
                if (remoteData && (typeof remoteData === 'object')) {
                    const currentGasUrl = state.teamInfo.gasApiUrl;
                    const currentGasSheetName = state.teamInfo.gasSheetName;
                    const currentGasAuthToken = state.teamInfo.gasAuthToken;

                    // Direct state assignment from remote data
                    state.matches = remoteData.matches || [];
                    state.practices = remoteData.practices || [];
                    state.players = remoteData.players || [];
                    state.menuLibrary = remoteData.menuLibrary || [];
                    state.matchTypes = remoteData.matchTypes || state.matchTypes;
                    state.menuCategories = remoteData.menuCategories || state.menuCategories;
                    state.skillMetrics = remoteData.skillMetrics || state.skillMetrics;
                    state.positions = remoteData.positions || state.positions;
                    state.positionsCat2 = remoteData.positionsCat2 || state.positionsCat2;
                    if (remoteData.teamInfo) {
                        state.teamInfo = remoteData.teamInfo;
                    }
                    if (remoteData.customFormations) {
                        state.customFormations = remoteData.customFormations;
                    }

                    if (currentGasUrl) state.teamInfo.gasApiUrl = currentGasUrl;
                    if (currentGasSheetName) state.teamInfo.gasSheetName = currentGasSheetName;
                    if (currentGasAuthToken) state.teamInfo.gasAuthToken = currentGasAuthToken;

                    saveData();

                    document.documentElement.style.setProperty('--primary', state.teamInfo.color);
                    const sidebarTitle = document.querySelector('.sidebar-header h2');
                    if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;

                    if (!isSilent) showToast('クラウドから最新データを復元しました！');
                    navigate(state.currentRoute || 'dashboard');
                    return remoteData;
                }
            }
            throw new Error('有効なクラウドデータが見つかりませんでした');
        })
        .catch(err => {
            console.error('GAS Sync Pull Error Details:', err);
            if (!isSilent) alert(`クラウドからの復元に失敗しました:\n${err.message || err}`);
        });
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
            } catch (e) {
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

        // Check for URL query params (e.g. parent invite link)
        const urlParams = new URLSearchParams(window.location.search);
        const paramApiUrl = urlParams.get('apiUrl');
        const paramAuthToken = urlParams.get('authToken');
        const paramSheetName = urlParams.get('sheetName');

        let isFromInviteLink = false;
        if (paramApiUrl) {
            state.teamInfo.gasApiUrl = paramApiUrl;
            if (paramAuthToken) state.teamInfo.gasAuthToken = paramAuthToken;
            if (paramSheetName) state.teamInfo.gasSheetName = paramSheetName;
            isFromInviteLink = true;

            // Clear URL query parameters from browser bar for security/cleanliness
            try {
                const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
            } catch (e) { }
        }

        // Apply Team Info Settings
        document.documentElement.style.setProperty('--primary', state.teamInfo.color);
        const sidebarTitle = document.querySelector('.sidebar-header h2');
        if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
        setupEventListeners();
        setupModals();

        // Always show dashboard immediately so screen is never stuck loading
        navigate('dashboard');

        // Auto pull latest data from cloud in background if configured
        if (state.teamInfo && state.teamInfo.gasApiUrl) {
            if (isFromInviteLink) {
                showToast('招待リンクよりクラウド設定を適用しました！同期中...');
            }
            syncPullGasCloud(true).catch(err => {
                console.warn('Background sync on init skipped or failed:', err);
            });
        }
    } catch (e) {
        console.error("Initialization error:", e);
        alert("初期化エラーが発生しました: " + e.message);
        try {
            navigate('dashboard');
        } catch (err) { }
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
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    };

    const toggleSidebar = () => {
        if (sidebar) {
            const isOpen = sidebar.classList.toggle('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('open', isOpen);
            }
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            navigate(route);
            closeSidebar();
        });
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            toggleSidebar();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            closeSidebar();
        });
    }

    const teamBrand = document.getElementById('sidebar-team-brand');
    if (teamBrand) {
        teamBrand.addEventListener('click', () => {
            navigate('dashboard');
            closeSidebar();
        });
    }

    // Role Toggle logic
    const btnToggleRole = document.getElementById('btn-toggle-role');
    const modalPasscode = document.getElementById('modal-coach-passcode');
    const formPasscode = document.getElementById('form-coach-passcode');
    const inputPasscode = document.getElementById('input-coach-passcode');
    const errorMsg = document.getElementById('passcode-error-msg');

    if (btnToggleRole) {
        btnToggleRole.addEventListener('click', () => {
            if (state.currentUserRole === 'coach') {
                // Switch to parent mode directly
                state.currentUserRole = 'parent';
                updateRoleUI();
                navigate('dashboard');
                showToast('保護者モード（閲覧専用）に切り替えました');
            } else {
                // Prompt passcode to switch to coach mode
                if (inputPasscode) inputPasscode.value = '';
                if (errorMsg) errorMsg.style.display = 'none';
                if (modalPasscode) modalPasscode.classList.remove('hidden');
                setTimeout(() => {
                    if (inputPasscode) {
                        inputPasscode.focus();
                        inputPasscode.select();
                    }
                }, 50);
            }
        });
    }

    if (formPasscode) {
        formPasscode.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = inputPasscode ? inputPasscode.value.trim() : '';
            const targetPass = (state.teamInfo && state.teamInfo.passcode) ? state.teamInfo.passcode : '7064';

            if (val === targetPass) {
                state.currentUserRole = 'coach';
                if (modalPasscode) modalPasscode.classList.add('hidden');
                updateRoleUI();
                navigate('dashboard');
                showToast('コーチモード（編集可能）に切り替えました');
            } else {
                if (errorMsg) errorMsg.style.display = 'block';
                if (inputPasscode) {
                    inputPasscode.focus();
                    inputPasscode.select();
                }
            }
        });
    }

    updateRoleUI();
}

// ボトムナビゲーションのクリックイベント設定
const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');
bottomNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = e.currentTarget.dataset.route;
        navigate(route);
    });
});

function updateRoleUI() {
    const badge = document.getElementById('user-role-badge');
    const avatar = document.getElementById('user-avatar');
    const btnToggle = document.getElementById('btn-toggle-role');
    const isCoach = state.currentUserRole === 'coach';

    if (badge) {
        if (isCoach) {
            badge.style.background = 'rgba(242, 57, 50, 0.15)';
            badge.style.color = '#ef4444';
            badge.innerHTML = '<i class="fa-solid fa-user-shield"></i> コーチ (編集権限)';
        } else {
            badge.style.background = 'rgba(34, 197, 94, 0.15)';
            badge.style.color = '#15803d';
            badge.innerHTML = '<i class="fa-solid fa-eye"></i> 保護者 (閲覧専用)';
        }
    }

    if (avatar) {
        if (isCoach) {
            avatar.src = 'https://ui-avatars.com/api/?name=Coach&background=ef4444&color=fff';
        } else {
            avatar.src = 'https://ui-avatars.com/api/?name=Parent&background=22c55e&color=fff';
        }
    }

    if (btnToggle) {
        btnToggle.innerHTML = isCoach
            ? '<i class="fa-solid fa-eye"></i> 保護者モードへ'
            : '<i class="fa-solid fa-user-lock"></i> コーチモードへ';
    }

    const btnTopbarSync = document.getElementById('btn-topbar-sync');
    if (btnTopbarSync) {
        const hasUrl = state.teamInfo && state.teamInfo.gasApiUrl;
        btnTopbarSync.style.display = hasUrl ? 'inline-flex' : 'none';
        btnTopbarSync.onclick = () => {
            if (isCoach) {
                syncPushGasCloud(false);
            } else {
                syncPullGasCloud(false);
            }
        };
    }

    // Toggle sidebar library, data management, and settings link visibility for parent role
    const settingsLink = document.querySelector('.nav-links li[data-route="settings"]');
    if (settingsLink) {
        settingsLink.style.display = isCoach ? 'flex' : 'none';
    }

    const libraryLink = document.querySelector('.nav-links li[data-route="library"]');
    if (libraryLink) {
        libraryLink.style.display = isCoach ? 'flex' : 'none';
    }

    const dataLink = document.querySelector('.nav-links li[data-route="data"]');
    if (dataLink) {
        dataLink.style.display = isCoach ? 'flex' : 'none';
    }

    // ★ 追加：ボトムナビの表示切替（左ペインと完全同期）
    const bottomLibraryLink = document.querySelector('.bottom-nav .nav-item[data-route="library"]');
    if (bottomLibraryLink) {
        bottomLibraryLink.style.display = isCoach ? 'flex' : 'none';
    }

    const bottomSettingsLink = document.querySelector('.bottom-nav .nav-item[data-route="settings"]');
    if (bottomSettingsLink) {
        bottomSettingsLink.style.display = isCoach ? 'flex' : 'none';
    }


    if (!isCoach && (state.currentRoute === 'settings' || state.currentRoute === 'library' || state.currentRoute === 'data')) {
        navigate('dashboard');
    }

    // Toggle read-only attribute on IDP textareas
    const goalShort = document.getElementById('player-goal-short');
    const goalLong = document.getElementById('player-goal-long');
    if (goalShort) {
        if (isCoach) goalShort.removeAttribute('readonly');
        else goalShort.setAttribute('readonly', 'true');
    }
    if (goalLong) {
        if (isCoach) goalLong.removeAttribute('readonly');
        else goalLong.setAttribute('readonly', 'true');
    }

    // Add or remove read-only CSS mode on body
    if (isCoach) {
        document.body.classList.remove('role-read-only');
    } else {
        document.body.classList.add('role-read-only');
    }
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
            // ボトムナビの active 切り替え
            const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');
            bottomNavLinks.forEach(link => {
                link.classList.toggle('active', link.dataset.route === route);
            });
        }
    });

    // ★ 追加：ボトムナビの active クラス切り替え
    const bottomNavLinks = document.querySelectorAll('.bottom-nav .nav-item');
    bottomNavLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.route === route);
    });

    // Auto-close sidebar & overlay
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');

    const template = document.getElementById(`tpl-${route}`);
    if (template) {
        viewContainer.innerHTML = '';
        viewContainer.appendChild(template.content.cloneNode(true));

        if (route === 'dashboard') initDashboard();
        if (route === 'matches') {
            currentMatchPage = 1;
            initMatches();
        }
        if (route === 'practices') {
            currentPracticePage = 1;
            initPractices();
        }
        if (route === 'players') initPlayers();
        if (route === 'data') initData();
        if (route === 'library') initLibrary();
        if (route === 'settings') initSettings();
        if (route === 'animation') initAnimation(params);
    }
}

function initData() {
    const btnExportSettings = document.getElementById('btn-export-data');
    const btnExportView = document.getElementById('btn-data-view-export');

    const handleExport = () => {
        const dataStr = JSON.stringify({
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
        }, null, 2);

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `coachMgrBackup_${dateStr}.json`;

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
            _showExportFallbackModal(dataStr);
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            setTimeout(() => _showExportFallbackModal(dataStr), 300);
        }
    };

    if (btnExportSettings) btnExportSettings.onclick = handleExport;
    if (btnExportView) btnExportView.onclick = handleExport;

    const handleImportFile = (file, inputEl) => {
        if (!file) return;
        if (!confirm('現在のデータがすべて上書きされます。インポートを実行してよろしいですか？')) {
            if (inputEl) inputEl.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (!parsed.matches && !parsed.players && !parsed.practices) {
                    alert('有効なデータファイルではありません。エクスポートしたJSONファイルを選択してください。');
                    return;
                }
                localStorage.setItem('coachMgrData', JSON.stringify(parsed));
                loadData();
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
    };

    const inputImportSettings = document.getElementById('input-import-data');
    if (inputImportSettings) {
        inputImportSettings.onchange = (e) => handleImportFile(e.target.files[0], inputImportSettings);
    }

    const inputImportView = document.getElementById('input-data-view-import');
    if (inputImportView) {
        inputImportView.onchange = (e) => handleImportFile(e.target.files[0], inputImportView);
    }

    const btnAllClear = document.getElementById('btn-data-all-clear');
    if (btnAllClear) {
        btnAllClear.onclick = () => {
            if (!confirm('【警告】入力済みのデータをすべて消去して初期化します。\nこの操作は取り消せません。よろしいですか？')) {
                return;
            }
            if (!confirm('本当にすべてのデータを消去しますか？（最終確認）')) {
                return;
            }
            state.matches = [];
            state.practices = [];
            state.players = [];
            state.menuLibrary = [];
            localStorage.removeItem('coachMgrData');
            showToast('すべての入力データをクリアしました。');
            setTimeout(() => location.reload(), 1000);
        };
    }
}

// Modals & Forms
function addGoalRecordRow(scorerId = null, assistId = null, targetContainerId = 'goal-records-list') {
    const container = document.getElementById(targetContainerId);
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
    div.style = 'display:flex; gap:0.4rem; align-items:center; width:100%; font-size:0.8rem;';
    div.innerHTML = `
        <span style="min-width:3rem; text-align:right; font-size:0.78rem; color:var(--text-secondary); flex-shrink:0;">得点:</span>
        <select class="form-control goal-scorer-select" style="flex:1; min-width:0; padding:0.25rem 0.4rem; font-size:0.8rem; height:auto;">
            ${scorerOptions}
        </select>
        <span style="min-width:3.6rem; text-align:right; font-size:0.78rem; color:var(--text-secondary); flex-shrink:0;">アシスト:</span>
        <select class="form-control goal-assist-select" style="flex:1; min-width:0; padding:0.25rem 0.4rem; font-size:0.8rem; height:auto;">
            ${assistOptions}
        </select>
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.45rem; font-size:0.8rem; flex-shrink:0;" title="削除"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
}

function addFormationVideoRow(urlVal = '') {
    const container = document.getElementById('formation-video-list');
    if (!container) return;
    const rowId = 'video-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'formation-video-row';
    div.style = 'display:flex; gap:0.5rem; align-items:center; width:100%;';
    div.innerHTML = `
        <input type="url" class="form-control formation-video-input" value="${urlVal}" placeholder="https://www.youtube.com/watch?v=... または https://youtu.be/..." style="flex:1; font-size:0.85rem; padding:0.3rem 0.6rem;">
        <button type="button" class="btn btn-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:0.25rem 0.5rem; font-size:0.85rem;" title="削除"><i class="fa-solid fa-trash"></i></button>
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

    const btnAddPeriodGoalRecord = document.getElementById('btn-add-period-goal-record');
    if (btnAddPeriodGoalRecord) {
        btnAddPeriodGoalRecord.onclick = () => {
            addGoalRecordRow(null, null, 'period-goal-records-list');
        };
    }

    const btnAddFormationVideo = document.getElementById('btn-add-formation-video');
    if (btnAddFormationVideo) {
        btnAddFormationVideo.onclick = () => {
            addFormationVideoRow();
        };
    }

    const formationScoreUs = document.getElementById('formation-score-us');
    if (formationScoreUs) {
        formationScoreUs.addEventListener('input', (e) => {
            const score = parseInt(e.target.value, 10) || 0;
            const container = document.getElementById('period-goal-records-list');
            if (container) {
                const currentRows = container.querySelectorAll('.goal-record-row').length;
                if (score > currentRows) {
                    const diff = score - currentRows;
                    for (let i = 0; i < diff; i++) {
                        addGoalRecordRow(null, null, 'period-goal-records-list');
                    }
                }
            }
        });
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

        let resultStr = "";
        if (scoreUs !== "" && scoreThem !== "") {
            resultStr = `${scoreUs}-${scoreThem}`;
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
                match.tournament = document.getElementById('match-tournament').value;
                match.result = resultStr;
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
                tournament: document.getElementById('match-tournament').value,
                result: resultStr,
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
        if (libId) {
            const libMenu = state.menuLibrary.find(m => m.id === libId);
            if (libMenu) {
                document.getElementById('menu-focus').value = libMenu.focus || '';
                document.getElementById('menu-organize').value = libMenu.organize || '';
                document.getElementById('menu-keyfactor').value = libMenu.keyfactor || '';
                document.getElementById('menu-options').value = libMenu.options || '';
                document.getElementById('menu-category').value = libMenu.category || 'その他';
                const vInp = document.getElementById('menu-video-url');
                if (vInp) vInp.value = libMenu.videoUrl || '';
                document.getElementById('menu-library-source-id').value = libMenu.id;
            }
        } else {
            // Reset fields
            document.getElementById('menu-focus').value = '';
            document.getElementById('menu-organize').value = '';
            document.getElementById('menu-keyfactor').value = '';
            document.getElementById('menu-options').value = '';
            document.getElementById('menu-category').value = 'ウォーミングアップ';
            const vInp = document.getElementById('menu-video-url');
            if (vInp) vInp.value = '';
            document.getElementById('menu-library-source-id').value = '';
        }
    });

    document.getElementById('form-menu').addEventListener('submit', (e) => {
        e.preventDefault();
        const practiceId = document.getElementById('menu-practice-id').value;
        const sourceId = document.getElementById('menu-library-source-id').value;

        let frames = null;
        let pitchTemplate = 'full';
        if (sourceId) {
            const src = state.menuLibrary.find(m => m.id === parseInt(sourceId));
            if (src) {
                if (src.frames) {
                    frames = JSON.parse(JSON.stringify(src.frames)); // deep copy frames
                }
                if (src.pitchTemplate) {
                    pitchTemplate = src.pitchTemplate;
                }
            }
        }

        const videoUrlInp = document.getElementById('menu-video-url');
        const videoUrlVal = videoUrlInp ? videoUrlInp.value.trim() : '';

        const newMenuObj = {
            id: Date.now(),
            focus: document.getElementById('menu-focus').value,
            organize: document.getElementById('menu-organize').value,
            keyfactor: document.getElementById('menu-keyfactor').value,
            options: document.getElementById('menu-options').value,
            category: document.getElementById('menu-category').value,
            videoUrl: videoUrlVal,
            frames: frames,
            pitchTemplate: pitchTemplate
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
                targetMenu.videoUrl = newMenuObj.videoUrl;
                if (sourceId) {
                    targetMenu.frames = frames;
                    targetMenu.pitchTemplate = pitchTemplate;
                }
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
                if (document.getElementById('menu-edit-id')) document.getElementById('menu-edit-id').value = '';
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
    if (formPlayer) {
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
    if (formMatchFeedback) {
        formMatchFeedback.addEventListener('submit', (e) => {
            e.preventDefault();
            const matchId = parseInt(document.getElementById('feedback-match-id').value);
            const match = state.matches.find(m => m.id === matchId);
            if (match) {
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
                    if (btnDetail) btnDetail.click();
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

            if (match) {
                const name = document.getElementById('formation-name').value;
                const system = document.getElementById('formation-system-select').value;

                // Collect video URLs
                const videoInputs = document.querySelectorAll('#formation-video-list .formation-video-input');
                const videoUrls = Array.from(videoInputs).map(inp => inp.value.trim()).filter(val => val.length > 0);
                const videoUrl = videoUrls.length > 0 ? videoUrls[0] : '';

                const nodes = document.querySelectorAll('#tactical-formation-pitch .pitch-node');
                const lineup = [];
                nodes.forEach(node => {
                    const playerId = node.dataset.playerId ? parseInt(node.dataset.playerId, 10) : null;
                    if (playerId) {
                        lineup.push({
                            playerId,
                            role: node.dataset.role,
                            roleLabel: node.dataset.label,
                            roleIndex: parseInt(node.dataset.index, 10)
                        });
                    }
                });

                // Collect Period Scores
                const scoreUs = parseInt(document.getElementById('formation-score-us').value, 10) || 0;
                const scoreThem = parseInt(document.getElementById('formation-score-them').value, 10) || 0;

                // Collect Period Goal Records
                const goalRecords = [];
                const goalRows = document.querySelectorAll('#period-goal-records-list .goal-record-row');
                goalRows.forEach(row => {
                    const scorerVal = row.querySelector('.goal-scorer-select').value;
                    const assistVal = row.querySelector('.goal-assist-select').value;
                    const scorerId = scorerVal ? parseInt(scorerVal, 10) : null;
                    const assistId = assistVal ? parseInt(assistVal, 10) : null;
                    goalRecords.push({ scorerId, assistId });
                });

                if (formationId) {
                    // Update
                    const formObj = match.formations.find(f => f.id === parseInt(formationId));
                    if (formObj) {
                        formObj.name = name;
                        formObj.system = system;
                        formObj.scoreUs = scoreUs;
                        formObj.scoreThem = scoreThem;
                        formObj.goalRecords = goalRecords;
                        formObj.videoUrl = videoUrl;
                        formObj.videoUrls = videoUrls;
                        formObj.lineup = lineup;
                    }
                } else {
                    // Create new
                    match.formations.push({
                        id: Date.now(),
                        name,
                        system,
                        scoreUs,
                        scoreThem,
                        goalRecords,
                        videoUrl,
                        videoUrls,
                        lineup,
                        boardData: []
                    });
                }

                // Recalculate match total scores and result from all periods
                let totalUs = 0;
                let totalThem = 0;
                const allMatchGoalRecords = [];

                match.formations.forEach(f => {
                    totalUs += (f.scoreUs !== undefined ? f.scoreUs : 0);
                    totalThem += (f.scoreThem !== undefined ? f.scoreThem : 0);
                    if (f.goalRecords && f.goalRecords.length > 0) {
                        allMatchGoalRecords.push(...f.goalRecords);
                    }
                });

                match.goalRecords = allMatchGoalRecords;

                // Rebuild match scorers string
                const scorersList = [];
                allMatchGoalRecords.forEach(r => {
                    let text = '';
                    if (r.scorerId) {
                        const sPlayer = state.players.find(p => p.id === r.scorerId);
                        text += sPlayer ? `${sPlayer.name}` : '不明な選手';
                    } else {
                        text += 'オウンゴール/その他';
                    }
                    if (r.assistId) {
                        const aPlayer = state.players.find(p => p.id === r.assistId);
                        text += aPlayer ? ` (アシスト:${aPlayer.name})` : '';
                    }
                    scorersList.push(text);
                });
                match.scorers = scorersList.join(', ');

                if (match.formations.length > 0) {
                    match.result = `${totalUs} - ${totalThem}`;
                }

                saveData();
                showToast('ピリオド(得点・フォーメーション)情報を保存しました');
                document.getElementById('modal-formation').classList.add('hidden');

                // Re-render detail view
                openMatchDetail(matchId);
            }
        });
    }



    const formPlayerAssessment = document.getElementById('form-player-assessment');
    if (formPlayerAssessment) {
        formPlayerAssessment.addEventListener('submit', (e) => {
            e.preventDefault();
            const playerId = parseInt(document.getElementById('assessment-player-id').value, 10);
            const editId = document.getElementById('assessment-edit-id').value;
            const player = state.players.find(p => p.id === playerId);
            if (player) {
                const skills = [];
                state.skillMetrics.forEach((metric, i) => {
                    const val = document.getElementById(`skill-ass-${i}`);
                    skills.push(val ? parseInt(val.value) : 3);
                });
                const commentText = '【ポジティブ】\n' + document.getElementById('assessment-good').value + '\n\n【ネクストステップ】\n' + document.getElementById('assessment-improve').value;
                const evalDate = document.getElementById('assessment-date').value;

                if (editId) {
                    const hId = parseInt(editId, 10);
                    const hItem = player.history ? player.history.find(h => h.id === hId) : null;
                    if (hItem) {
                        hItem.date = evalDate;
                        hItem.comment = commentText;
                        hItem.skills = skills;
                        showToast('評価を更新しました');
                    }
                } else {
                    if (!player.history) player.history = [];
                    player.history.push({
                        id: Date.now(),
                        date: evalDate,
                        comment: commentText,
                        skills: skills
                    });
                    showToast('評価を記録しました');
                }

                // Sort history by date descending
                player.history.sort((a, b) => new Date(b.date) - new Date(a.date));
                saveData();
                document.getElementById('modal-player-assessment').classList.add('hidden');

                // Refresh player detail view
                openPlayerDetail(playerId);

                // Re-render grid to update radar
                initPlayers();
            }
            e.target.reset();
        });
    }
}

function openModal(id) {
    if (id === 'modal-menu') {
        const catSel = document.getElementById('menu-category');
        if (catSel) {
            const currentVal = catSel.value;
            catSel.innerHTML = state.menuCategories.map(c => `<option value="${c}">${c}</option>`).join('');
            if (state.menuCategories.includes(currentVal)) catSel.value = currentVal;
            else if (state.menuCategories.length > 0) catSel.value = state.menuCategories[0];
        }
    }
    document.getElementById(id).classList.remove('hidden');
}

function openMatchModal(matchId = null) {
    document.getElementById('form-match').reset();
    document.getElementById('match-edit-id').value = '';
    const goalRecordsList = document.getElementById('goal-records-list');
    if (goalRecordsList) goalRecordsList.innerHTML = '';
    const title = document.querySelector('#modal-match h2');
    if (title) title.textContent = '試合を追加';
    const select = document.getElementById('match-type');
    if (select) {
        select.innerHTML = state.matchTypes.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    if (matchId) {
        const m = state.matches.find(match => match.id === matchId);
        if (m) {
            document.getElementById('match-edit-id').value = m.id;
            document.getElementById('match-date').value = m.date;
            document.getElementById('match-opponent').value = m.opponent;
            if (select) select.value = m.type;
            document.getElementById('match-tournament').value = m.tournament || '';

            if (m.result && m.result.includes('-')) {
                const scores = m.result.split('-');
                document.getElementById('match-score-us').value = scores[0];
                document.getElementById('match-score-them').value = scores[1];
            } else {
                document.getElementById('match-score-us').value = '';
                document.getElementById('match-score-them').value = '';
            }

            if (goalRecordsList && m.goalRecords && m.goalRecords.length > 0) {
                m.goalRecords.forEach(r => {
                    addGoalRecordRow(r.scorerId, r.assistId);
                });
            }

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

            if (title) title.textContent = '試合情報を編集';
        }
    }

    // Close match detail modal if open to prevent stack overlay issues
    const matchDetailModal = document.getElementById('modal-match-detail');
    if (matchDetailModal) matchDetailModal.classList.add('hidden');

    openModal('modal-match');
}

function openPracticeModal(practiceId = null) {
    document.getElementById('form-practice').reset();
    document.getElementById('practice-edit-id').value = '';
    const title = document.getElementById('practice-modal-title');
    if (title) title.textContent = '練習日を追加';

    if (practiceId) {
        const p = state.practices.find(prac => prac.id === practiceId);
        if (p) {
            document.getElementById('practice-edit-id').value = p.id;
            document.getElementById('practice-date').value = p.date;
            if (title) title.textContent = '練習日情報を編集';

            let activeIds = p.presentPlayerIds;
            if (!activeIds && p.attendance) {
                activeIds = state.players.map(pl => pl.id);
            } else if (!activeIds) {
                activeIds = [];
            }
            renderPracticeRoster(activeIds);
        }
    } else {
        const allPlayerIds = state.players.map(p => p.id);
        renderPracticeRoster(allPlayerIds);
    }
    openModal('modal-practice');
}

function initDashboard() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Separate completed (past or today only) and upcoming matches
    const completedMatches = state.matches.filter(m => m.result && /(\d+)\s*-\s*(\d+)/.test(m.result) && m.date <= todayStr);
    const upcomingMatches = state.matches.filter(m => !m.result || !/(\d+)\s*-\s*(\d+)/.test(m.result) || m.date > todayStr);

    // 1. Calculate overall stats
    let wins = 0, losses = 0, draws = 0;
    completedMatches.forEach(m => {
        const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            const us = parseInt(match[1], 10);
            const them = parseInt(match[2], 10);
            if (us > them) wins++;
            else if (us < them) losses++;
            else draws++;
        }
    });

    const dbRecord = document.getElementById('dash-db-record');
    const dbRecordBar = document.getElementById('dash-db-record-bar');
    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;

    if (dbRecord) dbRecord.innerHTML = `${wins}勝 ${losses}敗 ${draws}分 <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary); margin-left:0.25rem;">(勝率:${winRate}%)</span>`;
    if (dbRecordBar) dbRecordBar.style.width = `${winRate}%`;

    // Calculate stats by match type
    const statsByType = {};
    completedMatches.forEach(m => {
        const type = m.type || 'その他';
        if (!statsByType[type]) {
            statsByType[type] = { wins: 0, losses: 0, draws: 0, total: 0 };
        }
        const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            const us = parseInt(match[1], 10);
            const them = parseInt(match[2], 10);
            if (us > them) statsByType[type].wins++;
            else if (us < them) statsByType[type].losses++;
            else statsByType[type].draws++;
            statsByType[type].total++;
        }
    });

    const dbMatchTypes = document.getElementById('dash-db-match-types');
    if (dbMatchTypes) {
        let html = '';
        const sortedTypes = Object.keys(statsByType).sort((a, b) => {
            const idxA = state.matchTypes.indexOf(a);
            const idxB = state.matchTypes.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        sortedTypes.forEach(type => {
            const stats = statsByType[type];
            if (stats.total > 0) {
                const rate = Math.round((stats.wins / stats.total) * 100);
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.1rem 0; font-weight: 500;">
                        <span>${type}</span>
                        <span>${stats.wins}勝 ${stats.losses}敗 ${stats.draws}分 <span style="color:var(--text-secondary); margin-left:0.25rem; font-weight:normal;">(${rate}%)</span></span>
                    </div>
                `;
            }
        });
        dbMatchTypes.innerHTML = html || '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">試合記録なし</div>';
    }

    // Click handlers for stats cards to jump to corresponding views
    const cardMatches = document.getElementById('dash-card-matches');
    if (cardMatches) cardMatches.onclick = () => navigate('matches');

    // Button navigations
    const btnGoMatches = document.getElementById('dash-btn-go-matches');
    if (btnGoMatches) btnGoMatches.onclick = () => navigate('matches');

    const btnGoPlayers = document.getElementById('dash-btn-go-players');
    if (btnGoPlayers) btnGoPlayers.onclick = () => openLeaderRankingModal();

    // 2. Render Recent completed matches horizontally (latest 3)
    const matchesContent = document.getElementById('dash-matches-content');
    if (matchesContent) {
        if (completedMatches.length > 0) {
            const sortedMatches = [...completedMatches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            matchesContent.innerHTML = sortedMatches.map(m => {
                const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
                let us = 0, them = 0;
                if (match) {
                    us = parseInt(match[1], 10);
                    them = parseInt(match[2], 10);
                }
                let resultLabel = '引分';
                let badgeClass = 'draw';
                let bgStyle = 'rgba(100,116,139,0.15)';
                let colorStyle = '#475569';
                if (us > them) {
                    resultLabel = '勝ち';
                    badgeClass = 'win';
                    bgStyle = 'var(--primary)';
                    colorStyle = '#ffffff';
                } else if (us < them) {
                    resultLabel = '負け';
                    badgeClass = 'loss';
                    bgStyle = 'rgba(100,116,139,0.15)';
                    colorStyle = '#475569';
                }

                const displayScore = match ? `${us} - ${them}` : m.result;

                return `
                    <div class="glass" style="display:flex; flex-direction:column; justify-content:space-between; padding:0.8rem 1rem; border-radius:12px; cursor:pointer; min-height:115px; transition:var(--transition);" onclick="openMatchDetail(${m.id})">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.3rem;">
                            <span class="schedule-badge ${badgeClass}" style="background:${bgStyle}; color:${colorStyle}; font-weight:bold;">${resultLabel}</span>
                            <span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${m.date}</span>
                        </div>
                        <div style="font-size:0.9rem; font-weight:bold; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:0.25rem;">vs ${m.opponent}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem;">${m.type}</div>
                        <div style="font-size:1.25rem; font-weight:bold; color:var(--primary); text-align:right; line-height:1.1;">${displayScore}</div>
                    </div>
                `;
            }).join('');
        } else {
            matchesContent.innerHTML = `
                <div class="text-secondary" style="text-align:center; padding:1.5rem; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--surface-border); grid-column: 1 / -1; width: 100%;">
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



    // 3. Chronological Schedule List (Bottom Card)
    const allEvents = [];

    // Merge practices
    state.practices.forEach(p => {
        allEvents.push({
            type: 'practice',
            date: p.date,
            id: p.id,
            title: '練習日',
            desc: p.menus && p.menus.length > 0 ? p.menus.map(m => m.focus).join(', ') : 'メニュー未登録',
            attendance: p.presentPlayerIds ? `${p.presentPlayerIds.length}/${state.players.length}` : p.attendance,
            raw: p
        });
    });

    // Merge matches
    state.matches.forEach(m => {
        const hasResult = m.result && /(\d+)\s*-\s*(\d+)/.test(m.result);
        allEvents.push({
            type: 'match',
            date: m.date,
            id: m.id,
            title: `vs ${m.opponent}`,
            desc: `${m.type}${m.tournament ? ` (${m.tournament})` : ''}`,
            hasResult: hasResult,
            result: m.result,
            raw: m
        });
    });

    // Filter by date relative to today
    const upcomingEvents = allEvents.filter(e => e.date >= todayStr);
    const pastEvents = allEvents.filter(e => e.date < todayStr);

    // Sort
    upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date)); // Closest first
    pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first

    // Render Upcoming Schedules
    const upcomingContent = document.getElementById('dash-upcoming-schedule-content');
    if (upcomingContent) {
        if (upcomingEvents.length > 0) {
            upcomingContent.innerHTML = upcomingEvents.map(e => {
                if (e.type === 'practice') {
                    return `
                        <div class="schedule-item">
                            <div class="schedule-item-info">
                                <div class="schedule-item-icon-box practice">
                                    <i class="fa-solid fa-calendar-check"></i>
                                </div>
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta">
                                        <span class="schedule-badge practice">練習</span>
                                        <span>${e.date}</span>
                                    </div>
                                    <div class="schedule-item-title">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <button class="btn btn-secondary btn-sm btn-dash-edit-prac" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-pen"></i> 編集</button>
                                <button class="btn btn-secondary btn-sm" onclick="navigate('practices')" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-chevron-right"></i> 詳細</button>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="schedule-item">
                            <div class="schedule-item-info">
                                <div class="schedule-item-icon-box match">
                                    <i class="fa-solid fa-trophy"></i>
                                </div>
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta">
                                        <span class="schedule-badge match">試合予定</span>
                                        <span>${e.date}</span>
                                    </div>
                                    <div class="schedule-item-title">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <button class="btn btn-primary btn-sm btn-dash-score-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-square-poll-horizontal"></i> 結果入力</button>
                                <button class="btn btn-secondary btn-sm btn-dash-edit-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-pen"></i> 編集</button>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        } else {
            upcomingContent.innerHTML = `
                <div style="text-align:center; padding:2rem 1rem; color:var(--text-secondary); font-size:0.85rem; font-style:italic;">
                    今後の予定はありません。
                </div>
            `;
        }
    }

    // Render Past History (latest 3 events)
    const pastContent = document.getElementById('dash-past-schedule-content');
    if (pastContent) {
        const recentPast = pastEvents.slice(0, 3);
        if (recentPast.length > 0) {
            pastContent.innerHTML = recentPast.map(e => {
                if (e.type === 'practice') {
                    return `
                        <div class="schedule-item" style="opacity:0.95;">
                            <div class="schedule-item-info">
                                <div class="schedule-item-icon-box practice" style="opacity:0.8;">
                                    <i class="fa-solid fa-calendar-check"></i>
                                </div>
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta">
                                        <span class="schedule-badge practice" style="opacity:0.8;">練習日履歴</span>
                                        <span>${e.date}</span>
                                    </div>
                                    <div class="schedule-item-title" style="color:var(--text-secondary);">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <span style="font-size:0.75rem; color:var(--text-secondary); margin-right:0.3rem;"><i class="fa-solid fa-users"></i> ${e.attendance}</span>
                                <button class="btn btn-secondary btn-sm" onclick="navigate('practices')" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-chevron-right"></i> 詳細</button>
                            </div>
                        </div>
                    `;
                } else {
                    const resultText = e.hasResult ? `<span style="font-weight:bold; color:var(--primary); font-size:0.85rem;">${e.result}</span>` : `<span style="color:#f59e0b; font-size:0.75rem; font-weight:bold;">結果未入力</span>`;
                    const actionBtn = e.hasResult
                        ? `<button class="btn btn-secondary btn-sm" onclick="openMatchDetail(${e.id})" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-circle-info"></i> 詳細</button>`
                        : `<button class="btn btn-primary btn-sm btn-dash-score-match" data-id="${e.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-square-poll-horizontal"></i> 結果入力</button>`;

                    return `
                        <div class="schedule-item" style="opacity:0.95;">
                            <div class="schedule-item-info">
                                <div class="schedule-item-icon-box match" style="opacity:0.8;">
                                    <i class="fa-solid fa-trophy"></i>
                                </div>
                                <div class="schedule-item-details">
                                    <div class="schedule-item-meta">
                                        <span class="schedule-badge match" style="opacity:0.8;">試合履歴</span>
                                        <span>${e.date}</span>
                                    </div>
                                    <div class="schedule-item-title" style="color:var(--text-secondary);">${e.title}</div>
                                    <div class="schedule-item-desc">${e.desc}</div>
                                </div>
                            </div>
                            <div class="schedule-item-actions">
                                <div style="margin-right:0.4rem; text-align:right;">${resultText}</div>
                                ${actionBtn}
                           </div>
                        </div>
                    `;
                }
            }).join('');
        } else {
            pastContent.innerHTML = `
                <div style="text-align:center; padding:2rem 1rem; color:var(--text-secondary); font-size:0.85rem; font-style:italic;">
                    過去の履歴はありません。
                </div>
            `;
        }
    }

    // Bind schedule buttons
    const btnDashAddPrac = document.getElementById('dash-btn-add-practice');
    if (btnDashAddPrac) btnDashAddPrac.onclick = () => openPracticeModal();

    const btnDashAddMatch = document.getElementById('dash-btn-add-match');
    if (btnDashAddMatch) btnDashAddMatch.onclick = () => openMatchModal();

    // Bind item specific actions
    document.querySelectorAll('.btn-dash-edit-prac').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openPracticeModal(parseInt(btn.dataset.id));
        };
    });
    document.querySelectorAll('.btn-dash-edit-match').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openMatchModal(parseInt(btn.dataset.id));
        };
    });
    document.querySelectorAll('.btn-dash-score-match').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openMatchModal(parseInt(btn.dataset.id));
        };
    });

    // 4. Render Top Scorers and Assists lists (Top 3)
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
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)))
        .slice(0, 3);

    const topAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)))
        .slice(0, 3);

    const renderDashLeaderItem = (item, idx) => `
        <div style="display:flex; align-items:baseline; margin-bottom:0.25rem; cursor:pointer;" onclick="openPlayerDetail(${item.p.id})">
            <span style="width:1.1rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.25rem; flex-shrink:0; font-size:0.7rem;">${idx + 1}.</span>
            <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${item.p.number} ${item.p.name}</strong> (${item.count})</span>
        </div>
    `;

    const elTopScorers = document.getElementById('dash-top-scorers');
    if (elTopScorers) {
        elTopScorers.innerHTML = topScorers.length > 0
            ? topScorers.map((item, idx) => renderDashLeaderItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.72rem; padding:0.25rem 0;">得点記録なし</div>';
    }

    const elTopAssists = document.getElementById('dash-top-assists');
    if (elTopAssists) {
        elTopAssists.innerHTML = topAssists.length > 0
            ? topAssists.map((item, idx) => renderDashLeaderItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.72rem; padding:0.25rem 0;">アシスト記録なし</div>';
    }

    const btnGoRanking = document.getElementById('dash-btn-go-players');
    if (btnGoRanking) {
        btnGoRanking.onclick = () => openLeaderRankingModal();
    }
}

function openLeaderRankingModal() {
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

    const allScorers = Object.entries(scorerCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)));

    const allAssists = Object.entries(assistCounts)
        .map(([id, count]) => ({ p: state.players.find(pl => pl.id === parseInt(id)), count }))
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || ((parseInt(a.p.number) || 0) - (parseInt(b.p.number) || 0)));

    const renderRankingItem = (item, idx) => {
        return `
            <div style="display:flex; align-items:baseline; margin-bottom:0.3rem; cursor:pointer;" onclick="document.getElementById('modal-leader-ranking').classList.add('hidden'); openPlayerDetail(${item.p.id})">
                <span style="width:1.6rem; font-weight:bold; color:var(--text-secondary); text-align:right; margin-right:0.4rem; flex-shrink:0;">${idx + 1}.</span>
                <span style="flex:1;"><strong>${item.p.number} ${item.p.name}</strong> (${item.count})</span>
            </div>
        `;
    };

    const elRankingScorers = document.getElementById('ranking-scorers-list');
    if (elRankingScorers) {
        elRankingScorers.innerHTML = allScorers.length > 0
            ? allScorers.map((item, idx) => renderRankingItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">得点記録がありません。</div>';
    }

    const elRankingAssists = document.getElementById('ranking-assists-list');
    if (elRankingAssists) {
        elRankingAssists.innerHTML = allAssists.length > 0
            ? allAssists.map((item, idx) => renderRankingItem(item, idx)).join('')
            : '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem 0;">アシスト記録がありません。</div>';
    }

    openModal('modal-leader-ranking');
}

// View Initializers
function initMatches() {
    // Nendo Filter Setup
    const matchNendos = [...new Set(state.matches.map(m => getNendo(m.date)))].sort((a, b) => b - a);
    const filterSelect = document.getElementById('filter-nendo-match');
    if (filterSelect) {
        let options = '<option value="all">すべての年度</option>';
        matchNendos.forEach(y => {
            options += `<option value="${y}" ${currentMatchNendo === String(y) ? 'selected' : ''}>${y}年度</option>`;
        });
        filterSelect.innerHTML = options;

        filterSelect.onchange = (e) => {
            currentMatchNendo = e.target.value;
            currentMatchPage = 1;
            initMatches();
        };
    }

    const filteredMatches = currentMatchNendo === 'all'
        ? state.matches
        : state.matches.filter(m => String(getNendo(m.date)) === currentMatchNendo);

    // Stats Update
    let wins = 0, losses = 0, draws = 0, goals = 0;
    const completedMatches = filteredMatches.filter(m => m.result && /(\d+)\s*-\s*(\d+)/.test(m.result));

    completedMatches.forEach(m => {
        const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            const us = parseInt(match[1], 10);
            const them = parseInt(match[2], 10);
            goals += us;
            if (us > them) wins++;
            else if (us < them) losses++;
            else draws++;
        }
    });
    const elRecord = document.getElementById('dash-record');
    const elGoals = document.getElementById('dash-goals');
    const winRate = (wins + losses + draws) > 0 ? Math.round((wins / (wins + losses + draws)) * 100) : 0;
    if (elRecord) elRecord.innerHTML = `${wins}勝 ${losses}敗 ${draws}分 <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary); margin-left:0.25rem;">(勝率:${winRate}%)</span>`;
    if (elGoals) elGoals.textContent = goals;
    const bar = document.getElementById('dash-record-bar');
    if (bar) bar.style.width = `${winRate}%`;

    // Calculate stats by match type
    const statsByType = {};
    completedMatches.forEach(m => {
        const type = m.type || 'その他';
        if (!statsByType[type]) {
            statsByType[type] = { wins: 0, losses: 0, draws: 0, total: 0 };
        }
        const match = m.result.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
            const us = parseInt(match[1], 10);
            const them = parseInt(match[2], 10);
            if (us > them) statsByType[type].wins++;
            else if (us < them) statsByType[type].losses++;
            else statsByType[type].draws++;
            statsByType[type].total++;
        }
    });

    const elMatchTypes = document.getElementById('dash-match-types');
    if (elMatchTypes) {
        let html = '';
        const sortedTypes = Object.keys(statsByType).sort((a, b) => {
            const idxA = state.matchTypes.indexOf(a);
            const idxB = state.matchTypes.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        sortedTypes.forEach(type => {
            const stats = statsByType[type];
            if (stats.total > 0) {
                const rate = Math.round((stats.wins / stats.total) * 100);
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.1rem 0; font-weight: 500;">
                        <span>${type}</span>
                        <span>${stats.wins}勝 ${stats.losses}敗 ${stats.draws}分 <span style="color:var(--text-secondary); margin-left:0.25rem; font-weight:normal;">(${rate}%)</span></span>
                    </div>
                `;
            }
        });
        elMatchTypes.innerHTML = html || '<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">試合記録なし</div>';
    }

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
        .sort((a, b) => b.count - a.count || (parseInt(a.p.number) - parseInt(b.p.number)))
        .slice(0, 3);

    const topAssists = Object.entries(assistCounts)
        .map(([id, count]) => {
            const p = state.players.find(pl => pl.id === parseInt(id, 10));
            return { p, count };
        })
        .filter(x => x.p)
        .sort((a, b) => b.count - a.count || (parseInt(a.p.number) - parseInt(b.p.number)))
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

    const displayedMatches = filteredMatches.slice(0, currentMatchPage * ITEMS_PER_PAGE);

    // List Update (Grouped by month grid, similar to practices)
    const matchList = document.getElementById('match-list');
    if (matchList) {
        const grouped = {};
        displayedMatches.forEach(m => {
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
                const matchScore = m.result ? m.result.match(/(\d+)\s*-\s*(\d+)/) : null;
                const isCompleted = !!matchScore;
                const resultText = isCompleted ? `${matchScore[1]} - ${matchScore[2]}` : '<span style="font-weight:normal; color:var(--text-secondary); font-size:0.9rem;">試合予定</span>';
                html += `
                    <div class="card match-card">
                        <div class="match-card-header">
                            <div>
                                <div class="match-card-date"><i class="fa-regular fa-calendar"></i> ${m.date} | ${m.type}${m.tournament ? ` (${m.tournament})` : ''}</div>
                                <div class="match-card-opponent">vs ${m.opponent}</div>
                            </div>
                            <div class="match-card-result">${resultText}</div>
                        </div>
                        ${isCompleted ? `
                        <div class="match-card-scorers" style="text-align:left;" title="${(() => {
                            if (m.goalRecords && m.goalRecords.length > 0) {
                                return m.goalRecords.map(r => {
                                    if (r.scorerId) {
                                        const p = state.players.find(pl => pl.id === r.scorerId);
                                        return p ? `${p.name}` : '不明な選手';
                                    }
                                    return 'オウンゴール/その他';
                                }).join(', ');
                            }
                            return (m.scorers || '記録なし').replace(/\s*\([^)]*アシスト[^)]*\)/g, '');
                        })()}">
                            <i class="fa-solid fa-futbol" style="font-size:0.8rem;"></i> ${(() => {
                            if (m.goalRecords && m.goalRecords.length > 0) {
                                return m.goalRecords.map(r => {
                                    if (r.scorerId) {
                                        const p = state.players.find(pl => pl.id === r.scorerId);
                                        return p ? `${p.name}` : '不明な選手';
                                    }
                                    return 'オウンゴール/その他';
                                }).join(', ');
                            }
                            return (m.scorers || '記録なし').replace(/\s*\([^)]*アシスト[^)]*\)/g, '');
                        })()}
                        </div>
                        ` : ''}
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

        if (filteredMatches.length > displayedMatches.length) {
            const remaining = filteredMatches.length - displayedMatches.length;
            html += `
                <div style="text-align:center; margin: 1.5rem 0 1rem 0;">
                    <button class="btn btn-secondary" id="btn-load-more-matches" style="padding: 0.6rem 2rem; font-size: 0.9rem; border-radius: 9999px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredMatches.length} 件)
                    </button>
                </div>
            `;
        }

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

        const btnLoadMoreMatches = document.getElementById('btn-load-more-matches');
        if (btnLoadMoreMatches) {
            btnLoadMoreMatches.onclick = () => {
                currentMatchPage++;
                initMatches();
            };
        }

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
    const btnAddMatch = document.getElementById('btn-add-match');
    if (btnAddMatch) {
        btnAddMatch.onclick = () => {
            openMatchModal();
        };
    }

    document.querySelectorAll('.btn-detail-match').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            openMatchDetail(id);
        });
    });

    document.querySelectorAll('.btn-delete-match').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm('この試合記録を削除しますか？')) {
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
    if (m) {
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
        let scorersHtml = '<div style="text-align:left;">記録なし</div>';
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
                return `<div style="display:flex; align-items:baseline; margin-bottom:0.25rem;">
                    <span style="width:1.5rem; text-align:left; font-weight:500; color:var(--text-secondary); flex-shrink:0;">${idx + 1}.</span>
                    <div style="text-align:left; flex:1;">${scorerText}${assistText}</div>
                </div>`;
            }).join('');
        } else if (m.scorers) {
            scorersHtml = `<div style="text-align:left;">${m.scorers}</div>`;
        }

        const content = document.getElementById('match-detail-content');
        content.innerHTML = `
            <div style="font-size:1.2rem; font-weight:bold; text-align:left;">${m.date} | ${m.type}${m.tournament ? ` (${m.tournament})` : ''}</div>
            <div style="font-size:1.5rem; color:var(--primary); margin-bottom:1rem; text-align:left;">vs ${m.opponent} ${m.result ? `(${m.result})` : '(試合予定)'}</div>
            <div class="detail-box" style="text-align:left;">
                <h4 style="text-align:left;"><i class="fa-solid fa-futbol"></i> 得点者・アシスト</h4>
                <div style="font-size:0.95rem; line-height:1.4; text-align:left; display:flex; flex-direction:column; align-items:flex-start;">${scorersHtml}</div>
            </div>
            <div class="detail-box" style="text-align:left;">
                <h4 style="text-align:left;"><i class="fa-solid fa-comment-dots"></i> チーム振り返りメモ</h4>
                <p style="white-space:pre-wrap; text-align:left;">${m.comments || '記録なし'}</p>
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
                if (f.lineup) {
                    f.lineup.forEach(l => {
                        const p = state.players.find(pl => pl.id === l.playerId);
                        if (p && roles[l.role]) roles[l.role].push(p.name);
                    });
                }

                const vUrls = f.videoUrls && f.videoUrls.length > 0 ? f.videoUrls : (f.videoUrl ? [f.videoUrl] : []);
                const videoBtn = vUrls.length > 0 ? vUrls.map((vUrl, idx) => `
                    <a href="${vUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="btn btn-secondary" style="padding:0.15rem 0.4rem; font-size:0.75rem; color:#ef4444; text-decoration:none; display:inline-flex; align-items:center; gap:0.25rem;">
                        <i class="fa-brands fa-youtube"></i> 動画${vUrls.length > 1 ? ` ${idx + 1}` : ''}
                    </a>
                `).join('') : '';

                const hasBoardData = f.boardData && f.boardData.length > 0;
                const scoreBadge = (f.scoreUs !== undefined && f.scoreThem !== undefined)
                    ? `<span class="badge" style="background:var(--primary); color:#ffffff; font-weight:bold;">${f.scoreUs} - ${f.scoreThem}</span>`
                    : '';
                return `
                    <div class="card" style="margin-bottom:1rem; padding:1rem; cursor:pointer;" onclick="editFormation(${m.id}, ${f.id})">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <strong style="color:var(--primary); font-size:1.1rem;">${f.name}</strong>
                            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                ${scoreBadge}
                                ${videoBtn}
                                <span class="badge">${f.system || '-'}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex-shrink:0; width:200px; height:125px; background:#1e293b; border-radius:4px; overflow:hidden; position:relative;">
                                <canvas id="mini-pitch-${f.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                            </div>
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
                    const mCanv = document.getElementById(`mini-pitch-${f.id}`);
                    if (!mCanv) return;
                    const mCtx = mCanv.getContext('2d');

                    if (f.boardData && f.boardData.length > 0) {
                        drawPitchToCtx(f.boardData, mCanv, mCtx, f.pitchTemplate || 'full');
                    } else {
                        // Generate line-up board objects dynamically matching formation modal pitch coordinates
                        const customForm = state.customFormations.find(cf => cf.name === f.system);
                        const coords = customForm ? customForm.coords : (formationCoords[f.system] || (state.customFormations.length > 0 ? state.customFormations[0].coords : []));

                        const lineupObjects = [];
                        coords.forEach((coord, idx) => {
                            const topPercent = parseFloat(coord.top) / 100;
                            const leftPercent = parseFloat(coord.left) / 100;

                            // Map vertical formation coordinates (GK at bottom 88%, FW at top 15%)
                            // to horizontal landscape canvas (GK at left, FW at right, attacking rightwards)
                            // topPercent -> Horizontal X axis (0.88 -> ~90px left GK, 0.15 -> ~670px right FW)
                            // leftPercent -> Vertical Y axis
                            const x = 20 + 760 * (1 - topPercent);
                            const y = 20 + 460 * leftPercent;

                            const assigned = f.lineup ? f.lineup.find(l => l.roleLabel === coord.label || (f.lineup.length === coords.length && l.roleIndex === idx)) : null;
                            const p = assigned ? state.players.find(pl => pl.id === assigned.playerId) : null;

                            // Player node circle (pointing right 90 deg towards opponent)
                            lineupObjects.push({
                                id: idx + 1,
                                type: 'player',
                                x: x,
                                y: y,
                                radius: 15,
                                number: p ? p.number : coord.label,
                                color: coord.role === 'GK' ? 'green' : 'blue',
                                angle: 90
                            });

                            // Player name text badge under the node
                            if (p) {
                                lineupObjects.push({
                                    id: 100 + idx,
                                    type: 'text',
                                    x: x,
                                    y: y + 26,
                                    text: `${p.number} ${p.name}`,
                                    color: '#1e293b'
                                });
                            }
                        });

                        drawPitchToCtx(lineupObjects, mCanv, mCtx, 'full');
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
            document.getElementById('formation-score-us').value = 0;
            document.getElementById('formation-score-them').value = 0;

            const pGoalList = document.getElementById('period-goal-records-list');
            if (pGoalList) pGoalList.innerHTML = '';

            const vList = document.getElementById('formation-video-list');
            if (vList) {
                vList.innerHTML = '';
                addFormationVideoRow(); // Default single empty input row
            }

            const sysSelect = document.getElementById('formation-system-select');
            sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');

            const defaultSys = state.customFormations.length > 0 ? state.customFormations[0].name : '3-3-1';
            sysSelect.value = defaultSys;
            sysSelect.onchange = (e) => {
                renderFormationPitch(e.target.value, []);
            };

            renderFormationPitch(defaultSys, []);

            const modalTitle = document.getElementById('formation-modal-title');
            if (modalTitle) modalTitle.textContent = 'ピリオド編集';

            const formElem = document.getElementById('form-formation');
            if (formElem) {
                const inputs = formElem.querySelectorAll('input, select, textarea, button');
                inputs.forEach(el => {
                    el.disabled = false;
                    el.style.display = '';
                });

                const pitch = document.getElementById('tactical-formation-pitch');
                if (pitch) {
                    pitch.style.pointerEvents = 'auto';
                }
            }

            openModal('modal-formation');
        };

        const btnEditMatch = document.getElementById('btn-edit-match');
        if (btnEditMatch) {
            btnEditMatch.onclick = () => {
                openMatchModal(m.id);
            };
        }

        // Define window.editFormation for editing existing formation periods
        window.editFormation = (matchId, formationId) => {
            const match = state.matches.find(mObj => mObj.id === matchId);
            if (!match) return;
            const fObj = match.formations.find(f => f.id === formationId);
            if (!fObj) return;

            document.getElementById('form-formation').reset();
            document.getElementById('formation-match-id').value = matchId;
            document.getElementById('formation-id').value = formationId;
            document.getElementById('formation-name').value = fObj.name || '';
            document.getElementById('formation-score-us').value = fObj.scoreUs !== undefined ? fObj.scoreUs : 0;
            document.getElementById('formation-score-them').value = fObj.scoreThem !== undefined ? fObj.scoreThem : 0;

            const pGoalList = document.getElementById('period-goal-records-list');
            if (pGoalList) {
                pGoalList.innerHTML = '';
                if (fObj.goalRecords && fObj.goalRecords.length > 0) {
                    fObj.goalRecords.forEach(r => addGoalRecordRow(r.scorerId, r.assistId, 'period-goal-records-list'));
                }
            }

            const vList = document.getElementById('formation-video-list');
            if (vList) {
                vList.innerHTML = '';
                const urls = fObj.videoUrls && fObj.videoUrls.length > 0 ? fObj.videoUrls : (fObj.videoUrl ? [fObj.videoUrl] : ['']);
                urls.forEach(url => addFormationVideoRow(url));
            }

            const sysSelect = document.getElementById('formation-system-select');
            sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');

            const selectedSys = fObj.system || (state.customFormations.length > 0 ? state.customFormations[0].name : '3-3-1');
            sysSelect.value = selectedSys;
            sysSelect.onchange = (e) => {
                renderFormationPitch(e.target.value, fObj.lineup || []);
            };

            renderFormationPitch(selectedSys, fObj.lineup || []);

            // Handle parent (read-only) mode UI adjustment
            const modalTitle = document.getElementById('formation-modal-title');
            const isReadOnly = state.currentUserRole !== 'coach';

            if (modalTitle) {
                modalTitle.textContent = isReadOnly ? 'ピリオド詳細' : 'ピリオド編集';
            }

            const formElem = document.getElementById('form-formation');
            if (formElem) {
                const inputs = formElem.querySelectorAll('input, select, textarea, button');
                inputs.forEach(el => {
                    if (el.classList.contains('btn-close-modal')) {
                        el.disabled = false;
                        el.style.display = '';
                    } else if (isReadOnly) {
                        if (el.tagName === 'BUTTON') {
                            el.style.display = 'none';
                        } else {
                            el.disabled = true;
                        }
                    } else {
                        if (el.tagName === 'BUTTON') {
                            el.style.display = '';
                        } else {
                            el.disabled = false;
                        }
                    }
                });

                const pitch = document.getElementById('tactical-formation-pitch');
                if (pitch) {
                    pitch.style.pointerEvents = isReadOnly ? 'none' : 'auto';
                }
            }

            openModal('modal-formation');
        };

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
    const practiceNendos = [...new Set(state.practices.map(p => getNendo(p.date)))].sort((a, b) => b - a);
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
            currentPracticePage = 1;
            initPractices();
        };
    }

    const filterMonthSelect = document.getElementById('filter-month-practice');
    if (filterMonthSelect) {
        const availablePractices = currentPracticeNendo === 'all'
            ? state.practices
            : state.practices.filter(p => String(getNendo(p.date)) === currentPracticeNendo);

        const practiceMonths = [...new Set(availablePractices.map(p => parseInt(p.date.substring(5, 7), 10)))].sort((a, b) => b - a);
        let options = '<option value="all">すべての月</option>';
        practiceMonths.forEach(m => {
            const mStr = m.toString().padStart(2, '0');
            options += `<option value="${mStr}" ${currentPracticeMonth === mStr ? 'selected' : ''}>${m}月</option>`;
        });
        filterMonthSelect.innerHTML = options;

        filterMonthSelect.onchange = (e) => {
            currentPracticeMonth = e.target.value;
            currentPracticePage = 1;
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

    const displayedPractices = filteredPractices.slice(0, currentPracticePage * ITEMS_PER_PAGE);

    // List Update
    const practiceList = document.getElementById('practice-list');

    const grouped = {};
    displayedPractices.forEach(p => {
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
                                    ${(menu.organize || menu.keyfactor || menu.options || menu.videoUrl || menu.frames) ? `
                                    <div class="practice-menu-item-details" style="padding:0 0.8rem 0.8rem 0.8rem; border-top:1px solid rgba(0,0,0,0.05); font-size:0.85rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.5rem; margin-top:0.4rem;">
                                        <div class="practice-canvas-wrapper" style="width:100%; height:140px; background:#1e293b; border-radius:8px; overflow:hidden; position:relative; margin-top:0.25rem;" onclick="event.stopPropagation();">
                                            <canvas id="practice-mini-pitch-${p.id}-${menu.id}" width="800" height="500" style="width:100%; height:100%; object-fit:contain; pointer-events:none;"></canvas>
                                            ${menu.frames && menu.frames.length > 1 ? `
                                                <div style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:0.15rem 0.35rem; border-radius:4px; font-weight:bold; pointer-events:none; display:flex; align-items:center; gap:0.2rem;">
                                                    <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%; animation: pulse 1.5s infinite;"></span>ANIM
                                                </div>
                                            ` : ''}
                                        </div>
                                        ${menu.organize ? `<div><strong><i class="fa-solid fa-users"></i> オーガナイズ</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${menu.organize}</div></div>` : ''}
                                        ${menu.keyfactor ? `<div><strong><i class="fa-solid fa-key"></i> キーファクター</strong><div style="white-space:pre-wrap; margin-top:0.15rem;">${menu.keyfactor}</div></div>` : ''}
                                        ${menu.videoUrl ? `<div><strong><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 参考動画</strong><div style="margin-top:0.15rem;"><a href="${menu.videoUrl}" target="_blank" rel="noopener noreferrer" style="color:#ef4444; text-decoration:underline; font-weight:bold; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
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

    if (filteredPractices.length > displayedPractices.length) {
        const remaining = filteredPractices.length - displayedPractices.length;
        html += `
            <div style="text-align:center; margin: 1.5rem 0 1rem 0;">
                <button class="btn btn-secondary" id="btn-load-more-practices" style="padding: 0.6rem 2rem; font-size: 0.9rem; border-radius: 9999px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
                    <i class="fa-solid fa-angle-down"></i> さらに読み込む (残 ${remaining} 件 / 全 ${filteredPractices.length} 件)
                </button>
            </div>
        `;
    }

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
    }

    practiceList.innerHTML = html;

    const btnLoadMorePractices = document.getElementById('btn-load-more-practices');
    if (btnLoadMorePractices) {
        btnLoadMorePractices.onclick = () => {
            currentPracticePage++;
            initPractices();
        };
    }

    setTimeout(() => {
        const btnEmptyAdd = document.getElementById('btn-empty-add-practice');
        if (btnEmptyAdd) {
            btnEmptyAdd.onclick = () => {
                const btnAdd = document.getElementById('btn-add-practice');
                if (btnAdd) btnAdd.click();
            };
        }
    }, 50);

    // Clear old animation loops for practice mini pitches
    if (window.practiceMiniPitchIntervals) {
        window.practiceMiniPitchIntervals.forEach(clearInterval);
    }
    window.practiceMiniPitchIntervals = [];

    // Draw practice mini pitches for displayed items
    setTimeout(() => {
        displayedPractices.forEach(p => {
            if (p.menus && p.menus.length > 0) {
                p.menus.forEach(menu => {
                    const mCanv = document.getElementById(`practice-mini-pitch-${p.id}-${menu.id}`);
                    if (mCanv) {
                        const mCtx = mCanv.getContext('2d');
                        if (menu.frames && menu.frames.length > 0) {
                            if (menu.frames.length > 1) {
                                let frameIdx = 0;
                                drawPitchToCtx(menu.frames[frameIdx], mCanv, mCtx, menu.pitchTemplate || 'full');

                                const intervalId = setInterval(() => {
                                    frameIdx = (frameIdx + 1) % menu.frames.length;
                                    drawPitchToCtx(menu.frames[frameIdx], mCanv, mCtx, menu.pitchTemplate || 'full');
                                }, 1200);
                                window.practiceMiniPitchIntervals.push(intervalId);
                            } else {
                                drawPitchToCtx(menu.frames[0], mCanv, mCtx, menu.pitchTemplate || 'full');
                            }
                        } else {
                            drawPitchToCtx([], mCanv, mCtx, menu.pitchTemplate || 'full');
                        }
                    }
                });
            }
        });
    }, 50);

    const btnAddPractice = document.getElementById('btn-add-practice');
    if (btnAddPractice) {
        btnAddPractice.onclick = () => { openPracticeModal(); };
    }

    document.querySelectorAll('.btn-edit-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            openPracticeModal(id);
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
            if (title) title.textContent = '練習メニューを追加';

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
            if (confirm('この日の練習記録をすべて削除しますか？')) {
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
            if (confirm('この練習メニューを削除しますか？')) {
                const pid = parseInt(e.currentTarget.dataset.pid);
                const mid = parseInt(e.currentTarget.dataset.mid);
                const practice = state.practices.find(p => p.id === pid);
                if (practice) {
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
            if (practice) {
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
                    const vInp = document.getElementById('menu-video-url');
                    if (vInp) vInp.value = menu.videoUrl || '';

                    document.getElementById('menu-library-select').parentElement.style.display = 'none'; // hide library select

                    const title = document.querySelector('#modal-menu h2');
                    if (title) title.textContent = '練習メニューを編集';

                    openModal('modal-menu');
                }
            }
        });
    });
}

const formationCoords = {
    '4-3-3': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LB', top: '70%', left: '15%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '38%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '62%' },
        { role: 'DF', label: 'RB', top: '70%', left: '85%' },
        { role: 'MF', label: 'DM', top: '52%', left: '50%' },
        { role: 'MF', label: 'LCM', top: '42%', left: '30%' },
        { role: 'MF', label: 'RCM', top: '42%', left: '70%' },
        { role: 'FW', label: 'LW', top: '22%', left: '18%' },
        { role: 'FW', label: 'ST', top: '15%', left: '50%' },
        { role: 'FW', label: 'RW', top: '22%', left: '82%' }
    ],
    '4-4-2': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LB', top: '70%', left: '15%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '38%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '62%' },
        { role: 'DF', label: 'RB', top: '70%', left: '85%' },
        { role: 'MF', label: 'LM', top: '45%', left: '15%' },
        { role: 'MF', label: 'LCM', top: '48%', left: '38%' },
        { role: 'MF', label: 'RCM', top: '48%', left: '62%' },
        { role: 'MF', label: 'RM', top: '45%', left: '85%' },
        { role: 'FW', label: 'LST', top: '20%', left: '35%' },
        { role: 'FW', label: 'RST', top: '20%', left: '65%' }
    ],
    '3-5-2': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '25%' },
        { role: 'DF', label: 'CCB', top: '76%', left: '50%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '75%' },
        { role: 'MF', label: 'LDM', top: '55%', left: '35%' },
        { role: 'MF', label: 'RDM', top: '55%', left: '65%' },
        { role: 'MF', label: 'LWB', top: '48%', left: '12%' },
        { role: 'MF', label: 'RWB', top: '48%', left: '88%' },
        { role: 'MF', label: 'AM', top: '35%', left: '50%' },
        { role: 'FW', label: 'LST', top: '18%', left: '35%' },
        { role: 'FW', label: 'RST', top: '18%', left: '65%' }
    ],
    '3-4-3': [
        { role: 'GK', label: 'GK', top: '88%', left: '50%' },
        { role: 'DF', label: 'LCB', top: '74%', left: '25%' },
        { role: 'DF', label: 'CCB', top: '76%', left: '50%' },
        { role: 'DF', label: 'RCB', top: '74%', left: '75%' },
        { role: 'MF', label: 'LM', top: '50%', left: '15%' },
        { role: 'MF', label: 'LCM', top: '52%', left: '38%' },
        { role: 'MF', label: 'RCM', top: '52%', left: '62%' },
        { role: 'MF', label: 'RM', top: '50%', left: '85%' },
        { role: 'FW', label: 'LW', top: '22%', left: '18%' },
        { role: 'FW', label: 'ST', top: '15%', left: '50%' },
        { role: 'FW', label: 'RW', top: '22%', left: '82%' }
    ]
};

function renderFormationPitch(systemName, existingLineup = []) {
    const pitch = document.getElementById('tactical-formation-pitch');
    if (!pitch) return;

    // Clear old nodes
    const oldNodes = pitch.querySelectorAll('.pitch-node');
    oldNodes.forEach(node => node.remove());

    const customForm = state.customFormations.find(cf => cf.name === systemName);
    const coords = customForm ? customForm.coords : (formationCoords[systemName] || (state.customFormations.length > 0 ? state.customFormations[0].coords : []));

    coords.forEach((coord, index) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'pitch-node';
        nodeEl.style.top = coord.top;
        nodeEl.style.left = coord.left;
        nodeEl.dataset.index = index;
        nodeEl.dataset.role = coord.role;
        nodeEl.dataset.label = coord.label;

        // Find if a player is assigned to this index/label
        const assigned = existingLineup.find(l => l.roleLabel === coord.label || (existingLineup.length === coords.length && l.roleIndex === index));
        let playerText = '';
        let numberText = coord.label;

        if (assigned) {
            const p = state.players.find(pl => pl.id === assigned.playerId);
            if (p) {
                playerText = `<div class="pitch-node-name">${p.number} ${p.name}</div>`;
                numberText = p.number;
                nodeEl.dataset.playerId = p.id;
            }
        }

        nodeEl.innerHTML = `
            <span class="pitch-node-role">${coord.label}</span>
            <span class="pitch-node-number">${numberText}</span>
            ${playerText}
        `;

        nodeEl.onclick = (e) => {
            e.stopPropagation();
            openFormationPlayerPicker(nodeEl);
        };

        pitch.appendChild(nodeEl);
    });

    // Close picker if click on pitch
    pitch.onclick = () => {
        const picker = document.getElementById('formation-player-picker');
        if (picker) picker.style.display = 'none';
    };
}

function openFormationPlayerPicker(nodeEl) {
    const picker = document.getElementById('formation-player-picker');
    const select = document.getElementById('formation-picker-select');
    if (!picker || !select) return;

    const sorted = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
    select.innerHTML = '<option value="">-- 未選択 --</option>' + sorted.map(p => `
        <option value="${p.id}">${p.number} ${p.name} (${(Array.isArray(p.position) ? p.position : [p.position]).join('/')})</option>
    `).join('');

    select.value = nodeEl.dataset.playerId || '';

    picker.style.display = 'block';
    picker.style.top = `calc(${nodeEl.style.top} + 25px)`;
    picker.style.left = `calc(${nodeEl.style.left} - 70px)`;

    document.getElementById('btn-formation-picker-ok').onclick = () => {
        const val = select.value;
        if (val) {
            const playerId = parseInt(val, 10);
            const p = state.players.find(pl => pl.id === playerId);
            if (p) {
                nodeEl.dataset.playerId = p.id;
                nodeEl.innerHTML = `
                    <span class="pitch-node-role">${nodeEl.dataset.label}</span>
                    <span class="pitch-node-number">${p.number}</span>
                    <div class="pitch-node-name">${p.number} ${p.name}</div>
                `;
            }
        } else {
            nodeEl.removeAttribute('data-player-id');
            nodeEl.innerHTML = `
                <span class="pitch-node-role">${nodeEl.dataset.label}</span>
                <span class="pitch-node-number">${nodeEl.dataset.label}</span>
            `;
        }
        picker.style.display = 'none';
    };

    document.getElementById('btn-formation-picker-clear').onclick = () => {
        nodeEl.removeAttribute('data-player-id');
        nodeEl.innerHTML = `
            <span class="pitch-node-role">${nodeEl.dataset.label}</span>
            <span class="pitch-node-number">${nodeEl.dataset.label}</span>
        `;
        picker.style.display = 'none';
    };
}

function editFormation(matchId, formId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    const formObj = match.formations.find(f => f.id === formId);
    if (!formObj) return;

    document.getElementById('formation-match-id').value = match.id;
    document.getElementById('formation-id').value = formObj.id;
    document.getElementById('formation-name').value = formObj.name;

    const sysSelect = document.getElementById('formation-system-select');
    sysSelect.innerHTML = state.customFormations.map(cf => `<option value="${cf.name}">${cf.name} (${cf.coords.length}人制)</option>`).join('');

    const systemName = formObj.system || (state.customFormations.length > 0 ? state.customFormations[0].name : '3-3-1');
    sysSelect.value = systemName;

    sysSelect.onchange = (e) => {
        renderFormationPitch(e.target.value, []);
    };

    renderFormationPitch(systemName, formObj.lineup || []);

    openModal('modal-formation');
}

function initPlayers() {
    const summaryCardsContainer = document.getElementById('player-summary-cards');
    if (summaryCardsContainer) {
        const totalPlayers = state.players.length;
        const isParent = state.currentUserRole === 'parent';

        // Calculate Position Breakdown
        const posCounts = { FW: 0, MF: 0, DF: 0, GK: 0 };
        state.players.forEach(p => {
            const positions = Array.isArray(p.position) ? p.position : [p.position];
            positions.forEach(pos => {
                if (pos) {
                    const u = pos.toUpperCase();
                    if (u.includes('FW')) posCounts.FW++;
                    else if (u.includes('MF')) posCounts.MF++;
                    else if (u.includes('DF')) posCounts.DF++;
                    else if (u.includes('GK')) posCounts.GK++;
                }
            });
        });

        // Calculate Latest Assessment / Growth Data
        let totalSkillAvg = 0;
        let evaluatedCount = 0;
        let latestAssessmentDate = null;
        let goalSetCount = 0;

        state.players.forEach(p => {
            if (p.goals && (p.goals.shortTerm || p.goals.longTerm)) {
                goalSetCount++;
            }
            if (p.history && p.history.length > 0) {
                evaluatedCount++;
                const skills = p.history[0].skills || [0, 0, 0, 0, 0, 0];
                const sum = skills.reduce((a, b) => a + (b || 0), 0);
                const avg = skills.length > 0 ? sum / skills.length : 0;
                totalSkillAvg += avg;

                const dStr = p.history[0].date;
                if (dStr) {
                    if (!latestAssessmentDate || new Date(dStr) > new Date(latestAssessmentDate)) {
                        latestAssessmentDate = dStr;
                    }
                }
            }
        });

        const teamAvgSkill = evaluatedCount > 0 ? (totalSkillAvg / evaluatedCount).toFixed(1) : '-';

        // Unified 3 summary cards for both Parent and Coach roles
        summaryCardsContainer.innerHTML = `
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(242,57,50,0.1); color:var(--primary);"><i class="fa-solid fa-users"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">チームの仲間</h3>
                    <p style="font-size:1.15rem;">${totalPlayers}名</p>
                </div>
            </div>
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(59,130,246,0.1); color:#2563eb;"><i class="fa-solid fa-layer-group"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">ポジション内訳</h3>
                    <div style="font-size:0.72rem; font-weight:bold; color:var(--text-primary); margin-top:0.2rem; display:flex; gap:0.35rem; flex-wrap:wrap;">
                        <span style="color:#ef4444;">FW:${posCounts.FW}</span>
                        <span style="color:#3b82f6;">MF:${posCounts.MF}</span>
                        <span style="color:#22c55e;">DF:${posCounts.DF}</span>
                        <span style="color:#eab308;">GK:${posCounts.GK}</span>
                    </div>
                </div>
            </div>
            <div class="card stat-card" style="padding:0.75rem 1rem;">
                <div class="stat-icon" style="background:rgba(34,197,94,0.1); color:#16a34a;"><i class="fa-solid fa-chart-line"></i></div>
                <div class="stat-info">
                    <h3 style="font-size:0.75rem;">チーム平均スキル</h3>
                    <p style="font-size:1.15rem;">Lv ${teamAvgSkill} <span style="font-size:0.7rem; font-weight:normal; color:var(--text-secondary);">/ 5.0</span></p>
                </div>
            </div>
        `;
    }

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
        const sortedPlayers = [...state.players].sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
        playerGrid.innerHTML = sortedPlayers.map(p => {
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
                    <div class="radar-container" style="width:200px; height:200px; margin:0 auto; position:relative;">
                        <canvas id="radar-${p.id}" width="400" height="400" style="width:200px; height:200px;"></canvas>
                    </div>
                </div>
            `;
        }).join('');

        // Draw Radar Charts
        sortedPlayers.forEach(p => {
            const currentSkills = p.history && p.history.length > 0 ? p.history[0].skills : [0, 0, 0, 0, 0, 0];
            drawRadarChart(`radar-${p.id}`, currentSkills);
        });
    }

    const btnAdd = document.getElementById('btn-add-player');
    if (btnAdd) {
        // Refresh dynamically populated lists for the modal
        const posContainer = document.getElementById('player-position-container');
        if (posContainer) {
            posContainer.innerHTML = state.positions.map(p => `
                <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }

        const posCat2Container = document.getElementById('player-position-cat2-container');
        if (posCat2Container) {
            posCat2Container.innerHTML = (state.positionsCat2 || []).map(p => `
                <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                    <input type="checkbox" class="player-pos-checkbox" value="${p}"> ${p}
                </label>
            `).join('');
        }

        const initSkills = document.getElementById('player-initial-skills-container');
        if (initSkills) {
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

    const btnImportCSV = document.getElementById('btn-import-players-csv');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            openPlayerCSVImportModal();
        });
    }
}

// --- CSV Bulk Import for Players ---
function parsePlayerCSV(csvText) {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const results = [];

    // Header detection keywords
    const headerKeywords = ['背番号', '番号', '氏名', '名前', '選手名', '学年', 'ポジション', 'num', 'number', 'name', 'pos', 'position'];
    let startIndex = 0;

    // Check if first line is a header
    const firstLineLower = lines[0].toLowerCase();
    if (headerKeywords.some(k => firstLineLower.includes(k))) {
        startIndex = 1; // Skip header line
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        // Split by comma or tab or multi-space
        let parts = line.split(/,|\t/).map(p => p.trim());
        if (parts.length === 1 && line.includes(' ')) {
            parts = line.split(/\s+/).map(p => p.trim());
        }

        if (parts.length === 0 || !parts[0]) continue;

        let number = '';
        let name = '';
        let grade = '';
        let position = 'MF';

        if (parts.length >= 4) {
            number = parts[0];
            name = parts[1];
            grade = parts[2];
            position = parts[3];
        } else if (parts.length === 3) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
                if (['FW', 'MF', 'DF', 'GK', 'CB', 'SB', 'CH', 'SH', 'ST', 'WG', 'OH', 'DH'].some(p => parts[2].toUpperCase().includes(p))) {
                    position = parts[2];
                } else {
                    grade = parts[2];
                }
            } else {
                name = parts[0];
                grade = parts[1];
                position = parts[2];
            }
        } else if (parts.length === 2) {
            if (!isNaN(parseInt(parts[0], 10))) {
                number = parts[0];
                name = parts[1];
            } else {
                name = parts[0];
                position = parts[1];
            }
        } else if (parts.length === 1) {
            name = parts[0];
        }

        if (name) {
            results.push({
                number: number ? (parseInt(number, 10) || number) : '',
                name,
                grade: grade || '',
                position: position.toUpperCase() || 'MF'
            });
        }
    }

    return results;
}

function openPlayerCSVImportModal() {
    const modal = document.getElementById('modal-import-players-csv');
    const inputFileInput = document.getElementById('input-csv-file');
    const textareaData = document.getElementById('textarea-csv-data');
    const previewContainer = document.getElementById('csv-preview-container');
    const errorMsg = document.getElementById('csv-error-msg');
    const form = document.getElementById('form-import-players-csv');

    if (!modal) return;

    if (inputFileInput) inputFileInput.value = '';
    if (textareaData) textareaData.value = '';
    if (previewContainer) { previewContainer.style.display = 'none'; previewContainer.innerHTML = ''; }
    if (errorMsg) errorMsg.style.display = 'none';

    const updatePreview = () => {
        const text = textareaData ? textareaData.value : '';
        const parsed = parsePlayerCSV(text);

        if (parsed.length > 0) {
            previewContainer.style.display = 'block';
            previewContainer.innerHTML = `
                <div style="font-size:0.75rem; font-weight:bold; margin-bottom:0.4rem; color:var(--primary);">
                    <i class="fa-solid fa-eye"></i> プレビュー (${parsed.length}件の選手を検出)
                </div>
                <table class="csv-preview-table">
                    <thead>
                        <tr>
                            <th>背番号</th>
                            <th>氏名</th>
                            <th>学年</th>
                            <th>ポジション</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${parsed.map(p => `
                            <tr>
                                <td>${p.number || '-'}</td>
                                <td><strong>${p.name}</strong></td>
                                <td>${p.grade || '-'}</td>
                                <td><span class="badge badge-sub">${p.position}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            if (errorMsg) errorMsg.style.display = 'none';
        } else {
            previewContainer.style.display = 'none';
            previewContainer.innerHTML = '';
        }
    };

    if (inputFileInput) {
        inputFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (textareaData) {
                        textareaData.value = event.target.result;
                        updatePreview();
                    }
                };
                reader.readAsText(file, 'UTF-8');
            }
        };
    }

    if (textareaData) {
        textareaData.oninput = updatePreview;
    }

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const text = textareaData ? textareaData.value : '';
            const parsed = parsePlayerCSV(text);

            if (parsed.length === 0) {
                if (errorMsg) {
                    errorMsg.textContent = '登録可能な選手データが検出されませんでした。フォーマットを確認してください。';
                    errorMsg.style.display = 'block';
                }
                return;
            }

            let addedCount = 0;
            parsed.forEach((p, idx) => {
                const newPlayer = {
                    id: Date.now() + Math.floor(Math.random() * 1000) + idx,
                    number: p.number ? p.number : (state.players.length + 1 + idx),
                    name: p.name,
                    grade: p.grade || '',
                    position: p.position || 'MF',
                    history: [{ id: Date.now(), date: new Date().toISOString().split('T')[0], comment: 'CSV一括登録', skills: {} }]
                };
                state.players.push(newPlayer);
                addedCount++;
            });

            saveData();
            modal.classList.add('hidden');
            showToast(`${addedCount}名の選手を一括登録しました！`);
            initPlayers();
        };
    }

    modal.classList.remove('hidden');
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

    // Show count in topbar title
    const topbarTitleEl = document.getElementById('topbar-title');
    if (topbarTitleEl && topbarTitleEl.textContent.includes('メニュー管理')) {
        topbarTitleEl.innerHTML = `メニュー管理 <span style="font-size:0.75rem; font-weight:500; background:var(--primary); color:#fff; border-radius:9999px; padding:0.1rem 0.55rem; margin-left:0.4rem; vertical-align:middle;">${state.menuLibrary.length}件</span>`;
    }

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
                                ${m.videoUrl ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 参考動画</strong><div style="margin-top:0.1rem;"><a href="${m.videoUrl}" target="_blank" rel="noopener noreferrer" style="color:#ef4444; text-decoration:underline; font-weight:bold; word-break:break-all;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> 参考動画を見る (YouTube)</a></div></div>` : ''}
                                ${m.options ? `<div><strong style="color:var(--text-secondary); font-size:0.8rem;"><i class="fa-solid fa-plus"></i> オプション</strong><div style="white-space:pre-wrap; margin-top:0.1rem; line-height:1.3;">${m.options}</div></div>` : ''}
                                ${(!m.organize && !m.keyfactor && !m.options && !m.videoUrl) ? '<div style="font-size:0.8rem; color:var(--text-secondary);">詳細説明はありません。</div>' : ''}
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
            if (title) title.textContent = '練習メニューを追加';
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
                const vInp = document.getElementById('menu-video-url');
                if (vInp) vInp.value = menu.videoUrl || '';

                document.getElementById('menu-library-select').parentElement.style.display = 'none'; // hide library select

                const title = document.querySelector('#modal-menu h2');
                if (title) title.textContent = '練習メニューを編集';

                openModal('modal-menu');
            }
        });
    });

    document.querySelectorAll('.btn-delete-library').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm('このライブラリを削除しますか？')) {
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
                    let pitchTemplate = 'full';
                    if (libMenu.frames) {
                        frames = JSON.parse(JSON.stringify(libMenu.frames)); // Deep copy
                    }
                    if (libMenu.pitchTemplate) {
                        pitchTemplate = libMenu.pitchTemplate;
                    }

                    const newMenuObj = {
                        id: Date.now(),
                        focus: libMenu.focus,
                        organize: libMenu.organize,
                        keyfactor: libMenu.keyfactor,
                        options: libMenu.options,
                        category: libMenu.category || 'その他',
                        videoUrl: libMenu.videoUrl || '',
                        frames: frames,
                        pitchTemplate: pitchTemplate
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
    const teamPasscodeInput = document.getElementById('team-info-passcode');
    if (teamNameInput && teamColorInput) {
        teamNameInput.value = state.teamInfo.name;
        teamColorInput.value = state.teamInfo.color;
        if (teamPasscodeInput) teamPasscodeInput.value = state.teamInfo.passcode || '7064';

        const formTeamInfo = document.getElementById('form-team-info');
        const newFormTeamInfo = formTeamInfo.cloneNode(true);
        formTeamInfo.parentNode.replaceChild(newFormTeamInfo, formTeamInfo);
        newFormTeamInfo.addEventListener('submit', (e) => {
            e.preventDefault();
            state.teamInfo.name = document.getElementById('team-info-name').value;
            state.teamInfo.color = document.getElementById('team-info-color').value;
            const newPasscode = document.getElementById('team-info-passcode') ? document.getElementById('team-info-passcode').value.trim() : '';
            if (newPasscode) {
                state.teamInfo.passcode = newPasscode;
            }
            saveData();
            showToast('チーム基本情報を保存しました');
            // Update UI variables
            document.documentElement.style.setProperty('--primary', state.teamInfo.color);
            const sidebarTitle = document.querySelector('.sidebar-header h2');
            if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;
        });
    }

    // GAS Sync Settings & Events
    const gasApiInput = document.getElementById('gas-api-url');
    const gasSheetInput = document.getElementById('gas-sheet-name');
    const gasAuthInput = document.getElementById('gas-auth-token');
    if (gasApiInput) {
        gasApiInput.value = state.teamInfo.gasApiUrl || '';
    }
    if (gasSheetInput) {
        gasSheetInput.value = state.teamInfo.gasSheetName || '';
    }
    if (gasAuthInput) {
        gasAuthInput.value = state.teamInfo.gasAuthToken || '';
    }

    const formGasSync = document.getElementById('form-gas-sync');
    if (formGasSync) {
        formGasSync.onsubmit = (e) => {
            e.preventDefault();
            const urlVal = gasApiInput ? gasApiInput.value.trim() : '';
            const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : '';
            const authVal = gasAuthInput ? gasAuthInput.value.trim() : '';
            state.teamInfo.gasApiUrl = urlVal;
            state.teamInfo.gasSheetName = sheetVal;
            state.teamInfo.gasAuthToken = authVal;
            saveData();
            updateRoleUI();
            showToast('クラウド同期設定を保存しました');
        };
    }

    const btnPush = document.getElementById('btn-manual-sync-push');
    if (btnPush) {
        btnPush.onclick = () => {
            const urlVal = gasApiInput ? gasApiInput.value.trim() : '';
            const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : '';
            const authVal = gasAuthInput ? gasAuthInput.value.trim() : '';
            if (urlVal) state.teamInfo.gasApiUrl = urlVal;
            state.teamInfo.gasSheetName = sheetVal;
            state.teamInfo.gasAuthToken = authVal;
            syncPushGasCloud(false);
        };
    }

    const btnPull = document.getElementById('btn-manual-sync-pull');
    if (btnPull) {
        btnPull.onclick = () => {
            const urlVal = gasApiInput ? gasApiInput.value.trim() : '';
            const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : '';
            const authVal = gasAuthInput ? gasAuthInput.value.trim() : '';
            if (urlVal) state.teamInfo.gasApiUrl = urlVal;
            state.teamInfo.gasSheetName = sheetVal;
            if (confirm('クラウドからデータを復元しますか？ローカルのデータは上書きされます。')) {
                syncPullGasCloud(false);
            }
        };
    }

    const btnCopyInviteLink = document.getElementById('btn-copy-invite-link');
    if (btnCopyInviteLink) {
        btnCopyInviteLink.onclick = () => {
            const urlVal = gasApiInput ? gasApiInput.value.trim() : (state.teamInfo.gasApiUrl || '');
            const sheetVal = gasSheetInput ? gasSheetInput.value.trim() : (state.teamInfo.gasSheetName || '');
            const authVal = gasAuthInput ? gasAuthInput.value.trim() : (state.teamInfo.gasAuthToken || '');

            if (!urlVal) {
                alert('Web API URL が設定されていません。入力して保存した後に実行してください。');
                return;
            }

            const baseUrl = window.location.origin + window.location.pathname;
            const params = new URLSearchParams();
            params.set('apiUrl', urlVal);
            if (sheetVal) params.set('sheetName', sheetVal);
            if (authVal) params.set('authToken', authVal);

            const inviteUrl = `${baseUrl}?${params.toString()}`;

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inviteUrl).then(() => {
                        showToast('保護者用設定リンクをクリップボードにコピーしました！LINE等で送付してください。');
                    });
                } else {
                    prompt('以下の招待用URLをコピーして保護者に共有してください:', inviteUrl);
                }
            } catch (e) {
                prompt('以下の招待用URLをコピーして保護者に共有してください:', inviteUrl);
            }
        };
    }

    // Generic list renderer
    function renderList(listId, stateArray, itemLabelFunc = (x) => x) {
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = stateArray.map((item, index) => {
            const isCustomForm = listId === 'custom-formation-list';
            const editBtnClass = isCustomForm ? 'btn-edit-custom-formation' : 'btn-edit-master-item';
            const editBtn = `<button type="button" class="btn btn-secondary ${editBtnClass}" data-list="${listId}" data-index="${index}" style="padding:0.2rem 0.5rem; margin-right:0.3rem;"><i class="fa-solid fa-pen"></i> 編集</button>`;
            return `
                <li style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${itemLabelFunc(item)}</span>
                    <div>
                        ${editBtn}
                        <button type="button" class="btn btn-danger btn-delete-item" data-list="${listId}" data-index="${index}" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </li>
            `;
        }).join('');
    }

    renderList('match-type-list', state.matchTypes);
    renderList('menu-category-list', state.menuCategories);
    renderList('skill-metric-list', state.skillMetrics);
    renderList('position-list', state.positions);
    renderList('position-cat2-list', state.positionsCat2);
    renderList('custom-formation-list', state.customFormations, (item) => `${item.name} (${item.coords.length}人制)`);

    // Master item edit handler
    document.querySelectorAll('.btn-edit-master-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const listId = e.currentTarget.dataset.list;
            const idx = parseInt(e.currentTarget.dataset.index);
            let currentVal = '';
            let targetArray = null;

            if (listId === 'match-type-list') {
                targetArray = state.matchTypes;
            } else if (listId === 'menu-category-list') {
                targetArray = state.menuCategories;
            } else if (listId === 'skill-metric-list') {
                targetArray = state.skillMetrics;
            } else if (listId === 'position-list') {
                targetArray = state.positions;
            } else if (listId === 'position-cat2-list') {
                targetArray = state.positionsCat2;
            }

            if (!targetArray) return;
            currentVal = targetArray[idx];

            const newVal = prompt('名称を編集してください:', currentVal);
            if (newVal !== null && newVal.trim() !== '' && newVal.trim() !== currentVal) {
                const trimmed = newVal.trim();
                const oldVal = targetArray[idx];
                targetArray[idx] = trimmed;

                // Update referenced objects where necessary
                if (listId === 'match-type-list') {
                    state.matches.forEach(m => { if (m.type === oldVal) m.type = trimmed; });
                } else if (listId === 'menu-category-list') {
                    state.practices.forEach(p => {
                        if (p.menus) p.menus.forEach(m => { if (m.category === oldVal) m.category = trimmed; });
                    });
                    state.menuLibrary.forEach(m => { if (m.category === oldVal) m.category = trimmed; });
                } else if (listId === 'position-list' || listId === 'position-cat2-list') {
                    state.players.forEach(p => {
                        if (Array.isArray(p.position)) {
                            p.position = p.position.map(pos => pos === oldVal ? trimmed : pos);
                        } else if (p.position === oldVal) {
                            p.position = trimmed;
                        }
                    });
                }

                saveData();
                initSettings();
            }
        });
    });

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
            } else if (listId === 'position-cat2-list') {
                label = state.positionsCat2[idx];
                inUse = state.players.some(p => {
                    const posList = Array.isArray(p.position) ? p.position : [p.position];
                    return posList.includes(label);
                });
            } else if (listId === 'custom-formation-list') {
                label = state.customFormations[idx].name;
                inUse = state.matches.some(m => m.formations && m.formations.some(f => f.system === label));
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

            if (listId === 'match-type-list') state.matchTypes.splice(idx, 1);
            if (listId === 'menu-category-list') state.menuCategories.splice(idx, 1);
            if (listId === 'skill-metric-list') state.skillMetrics.splice(idx, 1);
            if (listId === 'position-list') state.positions.splice(idx, 1);
            if (listId === 'position-cat2-list') state.positionsCat2.splice(idx, 1);
            if (listId === 'custom-formation-list') state.customFormations.splice(idx, 1);
            saveData();
            initSettings();
        });
    });

    // Custom Formation visual builder & editor
    const openCustomFormationModal = (editIndex = null) => {
        document.getElementById('form-custom-formation').reset();

        const titleEl = document.querySelector('#modal-custom-formation h2');
        if (titleEl) {
            titleEl.innerHTML = editIndex !== null
                ? `<i class="fa-solid fa-street-view"></i> カスタムフォーメーション編集`
                : `<i class="fa-solid fa-street-view"></i> カスタムフォーメーション作成`;
        }

        const pitchCanvas = document.getElementById('custom-formation-pitch-canvas');
        pitchCanvas.querySelectorAll('.pitch-node').forEach(n => n.remove());

        const editorList = document.getElementById('custom-formation-nodes-editor-list');
        editorList.innerHTML = `<p class="text-secondary" style="font-size:0.85rem; font-style:italic;">ピッチをクリックしてポジションを追加してください。</p>`;

        const selectCount = document.getElementById('custom-formation-player-count');
        const maxCountLabel = document.getElementById('custom-formation-max-count');

        let placedNodes = [];

        const drawAndBindNode = (node) => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'pitch-node';
            nodeEl.id = `custom-pitch-node-${node.index}`;
            nodeEl.style.top = node.top;
            nodeEl.style.left = node.left;
            nodeEl.style.cursor = 'grab';
            nodeEl.innerHTML = `
                <span class="pitch-node-role" id="custom-pitch-node-label-span-${node.index}">${node.label}</span>
                <span class="pitch-node-number" id="custom-pitch-node-role-span-${node.index}" style="font-size:0.6rem;">${node.role}</span>
            `;
            pitchCanvas.appendChild(nodeEl);

            if (placedNodes.length === 1) {
                editorList.innerHTML = '';
            }

            const cat1Roles = (state.positions && state.positions.length > 0) ? state.positions : ['GK', 'DF', 'MF', 'FW'];
            const cat2Roles = (state.positionsCat2 && state.positionsCat2.length > 0) ? state.positionsCat2 : ['CB', 'SB', 'CH', 'SH', 'ST', 'WG'];

            const cat1Options = cat1Roles.map(r => `<option value="${r}" ${node.role === r ? 'selected' : ''}>${r}</option>`).join('');
            const cat2Options = `<option value="">(選択なし)</option>` + cat2Roles.map(r => `<option value="${r}" ${node.label === r ? 'selected' : ''}>${r}</option>`).join('');

            const row = document.createElement('div');
            row.className = 'custom-formation-node-row';
            row.id = `custom-node-editor-row-${node.index}`;
            row.style = 'display:flex; gap:0.4rem; align-items:center; margin-bottom:0.4rem;';
            row.innerHTML = `
                <strong style="font-size:0.8rem; min-width:20px;">#${node.index + 1}</strong>
                <select class="form-control custom-node-role-select" title="カテゴリ1" style="font-size:0.8rem; padding:0.2rem 0.4rem; height:auto; flex:1;">
                    ${cat1Options}
                </select>
                <select class="form-control custom-node-cat2-select" title="カテゴリ2" style="font-size:0.8rem; padding:0.2rem 0.4rem; height:auto; flex:1;">
                    ${cat2Options}
                </select>
            `;

            const roleSelect = row.querySelector('.custom-node-role-select');
            const cat2Select = row.querySelector('.custom-node-cat2-select');

            const updateNodeLabels = () => {
                const c1 = roleSelect.value;
                const c2 = cat2Select.value;
                node.role = c1;
                node.label = c2 ? c2 : c1;

                const spanLabel = document.getElementById(`custom-pitch-node-label-span-${node.index}`);
                const spanRole = document.getElementById(`custom-pitch-node-role-span-${node.index}`);
                if (spanLabel) spanLabel.textContent = node.label;
                if (spanRole) spanRole.textContent = node.role;
            };

            roleSelect.onchange = updateNodeLabels;
            cat2Select.onchange = updateNodeLabels;

            editorList.appendChild(row);

            let isDragging = false;

            const handleStart = (e) => {
                isDragging = true;
                nodeEl.style.cursor = 'grabbing';
                e.stopPropagation();
                e.preventDefault();
            };

            const handleMove = (e) => {
                if (!isDragging) return;
                const rect = pitchCanvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const x = clientX - rect.left;
                const y = clientY - rect.top;

                let leftPercent = Math.round((x / rect.width) * 100);
                let topPercent = Math.round((y / rect.height) * 100);
                leftPercent = Math.max(0, Math.min(100, leftPercent));
                topPercent = Math.max(0, Math.min(100, topPercent));

                nodeEl.style.left = `${leftPercent}%`;
                nodeEl.style.top = `${topPercent}%`;
                node.left = `${leftPercent}%`;
                node.top = `${topPercent}%`;
            };

            const handleEnd = () => {
                if (isDragging) {
                    isDragging = false;
                    nodeEl.style.cursor = 'grab';
                }
            };

            nodeEl.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);

            nodeEl.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
        };

        if (editIndex !== null) {
            const formObj = state.customFormations[editIndex];
            document.getElementById('custom-formation-name').value = formObj.name;
            selectCount.value = formObj.coords.length;
            maxCountLabel.textContent = formObj.coords.length;

            formObj.coords.forEach((coord, i) => {
                const node = {
                    index: i,
                    top: coord.top,
                    left: coord.left,
                    label: coord.label,
                    role: coord.role
                };
                placedNodes.push(node);
                drawAndBindNode(node);
            });
        } else {
            maxCountLabel.textContent = selectCount.value;
        }

        const clearBoard = () => {
            placedNodes = [];
            pitchCanvas.querySelectorAll('.pitch-node').forEach(n => n.remove());
            editorList.innerHTML = `<p class="text-secondary" style="font-size:0.85rem; font-style:italic;">ピッチをクリックしてポジションを追加してください。</p>`;
        };

        selectCount.onchange = () => {
            maxCountLabel.textContent = selectCount.value;
            clearBoard();
        };

        document.getElementById('btn-custom-formation-clear-all').onclick = clearBoard;

        pitchCanvas.onclick = (e) => {
            if (e.target.closest('.pitch-node')) {
                return;
            }

            const maxCount = parseInt(selectCount.value, 10);
            if (placedNodes.length >= maxCount) {
                alert(`ポジションは最大 ${maxCount} 箇所まで設定可能です。`);
                return;
            }

            const rect = pitchCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const leftPercent = Math.round((x / rect.width) * 100);
            const topPercent = Math.round((y / rect.height) * 100);

            const nodeIndex = placedNodes.length;
            const defaultLabel = nodeIndex === 0 ? 'GK' : `P${nodeIndex}`;
            const defaultRole = nodeIndex === 0 ? 'GK' : 'DF';

            const newNode = {
                index: nodeIndex,
                top: `${topPercent}%`,
                left: `${leftPercent}%`,
                label: defaultLabel,
                role: defaultRole
            };

            placedNodes.push(newNode);
            drawAndBindNode(newNode);
        };

        const formCustomForm = document.getElementById('form-custom-formation');
        formCustomForm.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('custom-formation-name').value.trim();
            const maxCount = parseInt(selectCount.value, 10);

            if (placedNodes.length !== maxCount) {
                alert(`指定された人数（${maxCount}人）分のポジションを設定してください。（現在: ${placedNodes.length}箇所）`);
                return;
            }

            const finalCoords = placedNodes.map(node => {
                const rowEl = document.getElementById(`custom-node-editor-row-${node.index}`);
                const role = rowEl.querySelector('.custom-node-role-select').value;
                const cat2Val = rowEl.querySelector('.custom-node-cat2-select').value;
                const label = cat2Val ? cat2Val : role;
                return {
                    role,
                    label,
                    top: node.top,
                    left: node.left
                };
            });

            if (editIndex !== null) {
                state.customFormations[editIndex] = { name, coords: finalCoords };
                showToast(`フォーメーション「${name}」を更新しました`);
            } else {
                state.customFormations.push({ name, coords: finalCoords });
                showToast(`フォーメーション「${name}」を登録しました`);
            }

            saveData();
            document.getElementById('modal-custom-formation').classList.add('hidden');
            initSettings();
        };

        openModal('modal-custom-formation');
    };

    const btnAddCustomForm = document.getElementById('btn-add-custom-formation');
    if (btnAddCustomForm) {
        btnAddCustomForm.onclick = () => openCustomFormationModal();
    }

    document.querySelectorAll('.btn-edit-custom-formation').forEach(btn => {
        btn.onclick = (e) => {
            const index = parseInt(e.currentTarget.dataset.index, 10);
            openCustomFormationModal(index);
        };
    });

    // Generic add handler
    function setupAddForm(formId, inputId, stateArray) {
        const form = document.getElementById(formId);
        if (!form) return;
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newVal = document.getElementById(inputId).value.trim();
            if (newVal && !stateArray.includes(newVal)) {
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
    setupAddForm('form-add-position-cat2', 'new-position-cat2', state.positionsCat2);

    // Initialize data export and import handlers
    initData();
}

let currentPlayerDetailId = null;

function openPlayerDetail(id) {
    const p = state.players.find(pl => pl.id === id);
    if (!p) return;

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
    if (p.history) {
        p.history.forEach(h => {
            timeline.push({ type: 'assessment', date: h.date, comment: h.comment, data: h });
        });
    }

    // Find match feedbacks for this player
    state.matches.forEach(m => {
        if (m.playerFeedback) {
            m.playerFeedback.forEach(fb => {
                if (fb.playerId === p.id) {
                    timeline.push({ type: 'match', date: m.date, matchDetails: `${m.type}${m.tournament ? ` (${m.tournament})` : ''} vs ${m.opponent}`, comment: fb.comment, matchId: m.id });
                }
            });
        }
    });

    // Sort timeline descending by date
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    const historyList = document.getElementById('pd-history-list');
    historyList.innerHTML = timeline.length > 0 ? timeline.map(item => {
        if (item.type === 'assessment') {
            const hId = item.data ? item.data.id : null;
            const editBtn = hId ? `<button type="button" class="btn btn-secondary btn-edit-assessment" data-history-id="${hId}" style="padding:0.15rem 0.4rem; font-size:0.7rem; margin-left:auto;"><i class="fa-solid fa-pen"></i> 編集</button>` : '';
            const delBtn = hId ? `<button type="button" class="btn btn-danger btn-delete-assessment" data-history-id="${hId}" style="padding:0.15rem 0.4rem; font-size:0.7rem; margin-left:0.25rem;"><i class="fa-solid fa-trash"></i> 削除</button>` : '';
            return `
                <div class="timeline-item">
                    <div class="timeline-item-date" style="display:flex; align-items:center;">
                        <span>${item.date} <span class="timeline-item-badge">スキル評価</span></span>
                        ${editBtn}
                        ${delBtn}
                    </div>
                    <div class="timeline-item-comment" style="white-space:pre-wrap;">${item.comment}</div>
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

    // Edit past assessment click handler
    document.querySelectorAll('.btn-edit-assessment').forEach(btn => {
        btn.onclick = (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            const hItem = p.history ? p.history.find(h => h.id === hId) : null;
            if (!hItem) return;

            document.getElementById('assessment-player-id').value = p.id;
            document.getElementById('assessment-edit-id').value = hId;
            const titleEl = document.getElementById('assessment-modal-title');
            if (titleEl) titleEl.textContent = 'スキル評価を編集';

            document.getElementById('assessment-date').value = hItem.date || new Date().toISOString().split('T')[0];

            let goodText = '';
            let improveText = '';
            if (hItem.comment) {
                const parts = hItem.comment.split('\n\n【ネクストステップ】\n');
                if (parts.length === 2) {
                    goodText = parts[0].replace('【ポジティブ】\n', '');
                    improveText = parts[1];
                } else {
                    goodText = hItem.comment;
                }
            }
            document.getElementById('assessment-good').value = goodText;
            document.getElementById('assessment-improve').value = improveText;

            const assSkills = document.getElementById('assessment-skills-container');
            if (assSkills) {
                assSkills.innerHTML = state.skillMetrics.map((m, i) => `
                    <div class="form-group"><label>${m}</label><input type="number" id="skill-ass-${i}" class="form-control" min="1" max="5" value="${(hItem.skills && hItem.skills[i]) || 3}" required></div>
                `).join('');
            }

            openModal('modal-player-assessment');
        };
    });

    // Delete past assessment click handler
    document.querySelectorAll('.btn-delete-assessment').forEach(btn => {
        btn.onclick = (e) => {
            const hId = parseInt(e.currentTarget.dataset.historyId, 10);
            if (confirm('この過去の評価記録を削除しますか？')) {
                p.history = p.history.filter(h => h.id !== hId);
                saveData();
                showToast('評価を削除しました');
                openPlayerDetail(p.id);
                initPlayers();
            }
        };
    });

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
    const currentSkills = p.history && p.history.length > 0 ? (p.history[0].data ? p.history[0].data.skills : p.history[0].skills) : [0, 0, 0, 0, 0, 0];
    const prevSkills = p.history && p.history.length > 1 ? (p.history[1].data ? p.history[1].data.skills : p.history[1].skills) : null;

    // Toggle legend based on prevSkills
    const legend = document.getElementById('pd-radar-legend');
    if (legend) {
        legend.style.display = prevSkills ? 'flex' : 'none';
    }

    setTimeout(() => {
        drawRadarChart('pd-radar', currentSkills, prevSkills);
    }, 50);

    // Add assessment btn
    document.getElementById('btn-add-assessment').onclick = () => {
        document.getElementById('assessment-player-id').value = p.id;
        document.getElementById('assessment-edit-id').value = '';
        const titleEl = document.getElementById('assessment-modal-title');
        if (titleEl) titleEl.textContent = '新しいスキル評価を記録';
        document.getElementById('assessment-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('assessment-good').value = '';
        document.getElementById('assessment-improve').value = '';

        const assSkills = document.getElementById('assessment-skills-container');
        if (assSkills) {
            assSkills.innerHTML = state.skillMetrics.map((m, i) => `
                <div class="form-group"><label>${m}</label><input type="number" id="skill-ass-${i}" class="form-control" min="1" max="5" value="3" required></div>
            `).join('');

            if (currentSkills) {
                state.skillMetrics.forEach((m, i) => {
                    const el = document.getElementById(`skill-ass-${i}`);
                    if (el) el.value = currentSkills[i] || 3;
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

        // Populate and check checkbox lists for Category 1 & Category 2
        const posContainer = document.getElementById('player-position-container');
        if (posContainer) {
            posContainer.innerHTML = state.positions.map(pos => {
                const checked = (Array.isArray(p.position) ? p.position : [p.position]).includes(pos) ? 'checked' : '';
                return `
                    <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer;">
                        <input type="checkbox" class="player-pos-checkbox" value="${pos}" ${checked}> ${pos}
                    </label>
                `;
            }).join('');
        }

        const posCat2Container = document.getElementById('player-position-cat2-container');
        if (posCat2Container) {
            posCat2Container.innerHTML = (state.positionsCat2 || []).map(pos => {
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
        if (confirm('この選手を削除しますか？')) {
            state.players = state.players.filter(pl => pl.id !== p.id);
            saveData();
            showToast('削除しました');
            document.getElementById('modal-player-detail').classList.add('hidden');
            initPlayers();
        }
    };

    // --- Proposal 4: Player Goals (IDP) and 1on1 Timeline ---
    // IDP Goals Population
    document.getElementById('goals-player-id').value = p.id;
    document.getElementById('player-goal-short').value = (p.goals && p.goals.shortTerm) ? p.goals.shortTerm : '';
    document.getElementById('player-goal-long').value = (p.goals && p.goals.longTerm) ? p.goals.longTerm : '';

    // 1on1 Notes Population
    document.getElementById('1on1-player-id').value = p.id;
    document.getElementById('player-1on1-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('player-1on1-note').value = '';
    render1on1List(p);

    // Setup tab switching
    const tabs = document.querySelectorAll('#modal-player-detail .player-detail-tab');
    const panes = document.querySelectorAll('#modal-player-detail .player-detail-tab-pane');

    // Reset to first tab
    tabs.forEach(tab => {
        if (tab.dataset.tab === 'pd-tab-history') tab.classList.add('active');
        else tab.classList.remove('active');
    });
    panes.forEach(pane => {
        if (pane.id === 'pd-tab-history') pane.classList.add('active');
        else pane.classList.remove('active');
    });

    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(pane => pane.classList.remove('active'));

            tab.classList.add('active');
            const targetPane = document.getElementById(tab.dataset.tab);
            if (targetPane) targetPane.classList.add('active');
        };
    });

    // Form Submissions
    const formGoals = document.getElementById('form-player-goals');
    if (formGoals) {
        formGoals.onsubmit = (e) => {
            e.preventDefault();
            const plId = parseInt(document.getElementById('goals-player-id').value, 10);
            const player = state.players.find(pl => pl.id === plId);
            if (player) {
                player.goals = {
                    shortTerm: document.getElementById('player-goal-short').value.trim(),
                    longTerm: document.getElementById('player-goal-long').value.trim()
                };
                saveData();
                showToast('個人目標を保存しました');
            }
        };
    }

    const form1on1 = document.getElementById('form-player-1on1');
    if (form1on1) {
        form1on1.onsubmit = (e) => {
            e.preventDefault();
            const plId = parseInt(document.getElementById('1on1-player-id').value, 10);
            const player = state.players.find(pl => pl.id === plId);
            if (player) {
                if (!player.notes1on1) player.notes1on1 = [];
                player.notes1on1.push({
                    id: Date.now(),
                    date: document.getElementById('player-1on1-date').value,
                    content: document.getElementById('player-1on1-note').value.trim()
                });
                saveData();
                showToast('面談記録を追加しました');
                document.getElementById('player-1on1-note').value = '';
                render1on1List(player);
            }
        };
    }
}

function render1on1List(p) {
    const listEl = document.getElementById('pd-1on1-list');
    if (!listEl) return;

    if (p.notes1on1 && p.notes1on1.length > 0) {
        const sorted = [...p.notes1on1].sort((a, b) => new Date(b.date) - new Date(a.date));
        listEl.innerHTML = sorted.map(note => `
            <div class="feedback-box" style="position:relative; padding:0.6rem 0.8rem; background:rgba(0,0,0,0.01); border:1px solid var(--surface-border); border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <strong style="font-size:0.8rem; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${note.date}</strong>
                    <button class="btn btn-danger btn-delete-1on1" data-player-id="${p.id}" data-note-id="${note.id}" style="padding:0.15rem 0.35rem; font-size:0.65rem; height:20px; min-width:auto; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <p style="font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap; margin:0; line-height:1.4;">${note.content}</p>
            </div>
        `).join('');

        listEl.querySelectorAll('.btn-delete-1on1').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('この面談記録を削除しますか？')) {
                    const plId = parseInt(e.currentTarget.dataset.playerId, 10);
                    const noteId = parseInt(e.currentTarget.dataset.noteId, 10);
                    const player = state.players.find(pl => pl.id === plId);
                    if (player && player.notes1on1) {
                        player.notes1on1 = player.notes1on1.filter(n => n.id !== noteId);
                        saveData();
                        showToast('面談記録を削除しました');
                        render1on1List(player);
                    }
                }
            };
        });
    } else {
        listEl.innerHTML = '<p class="text-secondary" style="font-size:0.85rem; font-style:italic; text-align:center; padding:1rem 0; margin:0;">面談記録はありません。</p>';
    }
}

function drawRadarChart(canvasId, skills, prevSkills = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scaleFactor = w / 200; // Resolution multiplier
    const radius = w / 2 - (56 * scaleFactor / 2);

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
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 1 * scaleFactor;
        ctx.stroke();

        // Draw axis lines
        if (i === maxVal) {
            for (let j = 0; j < numSides; j++) {
                const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
                ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
                ctx.lineWidth = 1 * scaleFactor;
                ctx.stroke();

                // Labels - High Contrast & Scaled Crisp Font with padding safety
                const labelDist = radius + (14 * scaleFactor);
                const lx = cx + labelDist * Math.cos(angle);
                const ly = cy + labelDist * Math.sin(angle);
                ctx.fillStyle = '#334155'; // Darker Slate for high contrast & crispness
                ctx.font = `bold ${Math.round(10.5 * scaleFactor)}px 'Inter', 'Hiragino Kaku Gothic ProN', sans-serif`;
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
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)'; // Slate-400 transparent
        ctx.fill();
        ctx.strokeStyle = '#64748b'; // Slate-500
        ctx.lineWidth = 2 * scaleFactor;
        ctx.setLineDash([4 * scaleFactor, 4 * scaleFactor]);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let j = 0; j < numSides; j++) {
            const val = prevSkills[j] || 0;
            const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
            const r = (radius / maxVal) * val;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, 3 * scaleFactor, 0, Math.PI * 2);
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
    ctx.fillStyle = 'rgba(242, 57, 50, 0.35)'; // Primary color transparent
    ctx.fill();
    ctx.strokeStyle = '#f23932'; // Primary color
    ctx.lineWidth = 2.5 * scaleFactor;
    ctx.stroke();

    // Draw Data Points
    for (let j = 0; j < numSides; j++) {
        const val = skills[j] || 0;
        const angle = (Math.PI * 2 * j) / numSides - Math.PI / 2;
        const r = (radius / maxVal) * val;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 4 * scaleFactor, 0, Math.PI * 2);
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
let redoStack = [];
let isResizing = false;
let resizeHandle = null;

function saveHistory() {
    if (isPlaying) return;
    historyStack.push(JSON.parse(JSON.stringify(objects)));
    if (historyStack.length > 30) historyStack.shift();
    redoStack = []; // Clear redo history on new action
    updateUndoRedoButtons();
}

function undoHistory() {
    if (isPlaying) return;
    if (historyStack.length > 1) {
        const current = historyStack.pop();
        redoStack.push(current);
        objects = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));
        selectedObject = null;
        drawPitch(objects);
    } else if (historyStack.length === 1) {
        const current = historyStack.pop();
        redoStack.push(current);
        objects = [];
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
}

function redoHistory() {
    if (isPlaying) return;
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        historyStack.push(nextState);
        objects = JSON.parse(JSON.stringify(nextState));
        selectedObject = null;
        drawPitch(objects);
    }
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('tool-undo');
    const btnRedo = document.getElementById('tool-redo');
    if (btnUndo) {
        btnUndo.disabled = historyStack.length === 0;
        btnUndo.style.opacity = historyStack.length > 0 ? '1' : '0.5';
    }
    if (btnRedo) {
        btnRedo.disabled = redoStack.length === 0;
        btnRedo.style.opacity = redoStack.length > 0 ? '1' : '0.5';
    }
}

function updateCanvasToolbar() {
    const btnDelete = document.getElementById('tool-delete');
    const btnRotate = document.getElementById('tool-rotate');

    if (btnDelete) {
        btnDelete.disabled = !selectedObject;
        btnDelete.style.opacity = selectedObject ? '1' : '0.5';
    }
    if (btnRotate) {
        const canRotate = !!(selectedObject && (selectedObject.type === 'minigoal' || selectedObject.type === 'player'));
        btnRotate.disabled = !canRotate;
        btnRotate.style.opacity = canRotate ? '1' : '0.5';
    }
    updateUndoRedoButtons();
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
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
            redoHistory();
        } else {
            undoHistory();
        }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redoHistory();
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
let currentLibraryId = null;

function initAnimation(params) {
    canvas = document.getElementById('pitch-canvas');
    if (!canvas) return;

    currentPracticeId = params && params.practiceId ? params.practiceId : null;
    currentMenuId = params && params.menuId ? params.menuId : null;
    currentMatchId = params && params.matchId ? params.matchId : null;
    currentFormationId = params && params.formId ? params.formId : null;
    currentLibraryId = params && params.libraryId ? params.libraryId : null;

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
                if (title) title.textContent = '練習メニューを編集';

                openModal('modal-menu');
            });
        }
    }

    // Fixed internal resolution
    canvas.width = 800;
    canvas.height = 500;

    ctx = canvas.getContext('2d');
    frames = initialFrames || [];
    if (frames.length === 0) {
        frames = [{ objects: [], title: '' }];
    }
    currentFrameIndex = 0;
    const activeFrame = frames[currentFrameIndex];
    objects = JSON.parse(JSON.stringify(Array.isArray(activeFrame) ? activeFrame : (activeFrame.objects || [])));
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

    const tools = ['select', 'player', 'ball', 'marker', 'cone', 'ladder', 'minigoal', 'line-rect', 'line-circle', 'text', 'line-move', 'line-pass', 'line-dribble'];
    tools.forEach(tool => {
        const el = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (!el) return;

        // Hide non-player tools in formation mode
        const isPlayerTool = ['select', 'player'].includes(tool);
        if (isFormationMode && !isPlayerTool) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }

        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);

        newEl.addEventListener('click', (e) => {
            currentTool = tool;
            updateToolDockActive();
        });
    });
    currentTool = 'select';
    updateToolDockActive();

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

    const btnRedo = document.getElementById('tool-redo');
    if (btnRedo) {
        const newBtnRedo = btnRedo.cloneNode(true);
        btnRedo.parentNode.replaceChild(newBtnRedo, btnRedo);
        newBtnRedo.addEventListener('click', redoHistory);
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
            if (selectedObject) {
                if (typeof selectedObject.x1 !== 'undefined' && typeof selectedObject.x2 !== 'undefined') {
                    const rad = Math.PI / 4; // 45 degrees
                    const cx = (selectedObject.x1 + selectedObject.x2) / 2;
                    const cy = (selectedObject.y1 + selectedObject.y2) / 2;
                    const rotatePt = (px, py) => {
                        const dx = px - cx;
                        const dy = py - cy;
                        return {
                            x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
                            y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
                        };
                    };
                    const p1 = rotatePt(selectedObject.x1, selectedObject.y1);
                    const p2 = rotatePt(selectedObject.x2, selectedObject.y2);
                    selectedObject.x1 = p1.x; selectedObject.y1 = p1.y;
                    selectedObject.x2 = p2.x; selectedObject.y2 = p2.y;
                } else {
                    selectedObject.angle = ((selectedObject.angle || 0) + 45) % 360;
                }
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

    const btnInsert = document.getElementById('anim-insert-frame');
    if (btnInsert) {
        const newBtnInsert = btnInsert.cloneNode(true);
        btnInsert.parentNode.replaceChild(newBtnInsert, btnInsert);
        newBtnInsert.addEventListener('click', insertFrame);
    }

    const selectFrameEl = document.getElementById('anim-frame-select');
    if (selectFrameEl) {
        selectFrameEl.onchange = (e) => {
            const idx = parseInt(e.target.value, 10);
            if (idx >= 0) selectFrame(idx);
        };
    }

    const btnPrevFrame = document.getElementById('anim-prev-frame');
    if (btnPrevFrame) {
        btnPrevFrame.onclick = () => {
            if (currentFrameIndex > 0) selectFrame(currentFrameIndex - 1);
        };
    }

    const btnNextFrame = document.getElementById('anim-next-frame');
    if (btnNextFrame) {
        btnNextFrame.onclick = () => {
            if (currentFrameIndex >= 0 && currentFrameIndex < frames.length - 1) {
                selectFrame(currentFrameIndex + 1);
            }
        };
    }

    const btnEditFrameTitle = document.getElementById('anim-edit-frame-title');
    if (btnEditFrameTitle) {
        btnEditFrameTitle.onclick = () => {
            editFrameTitle();
        };
    }

    const btnDeleteFrame = document.getElementById('anim-delete-frame');
    if (btnDeleteFrame) {
        btnDeleteFrame.onclick = () => {
            if (currentFrameIndex >= 0 && currentFrameIndex < frames.length) {
                deleteFrame(currentFrameIndex);
            }
        };
    }

    const btnPlay = document.getElementById('anim-play');
    const newBtnPlay = btnPlay.cloneNode(true);
    btnPlay.parentNode.replaceChild(newBtnPlay, btnPlay);
    newBtnPlay.addEventListener('click', playAnimation);

    const btnStop = document.getElementById('anim-stop');
    const newBtnStop = btnStop.cloneNode(true);
    btnStop.parentNode.replaceChild(newBtnStop, btnStop);
    newBtnStop.addEventListener('click', stopAnimation);

    // Video Export Button Handler (LINE sharing)
    const btnExportVideo = document.getElementById('anim-export-video');
    if (btnExportVideo) {
        const newBtnExport = btnExportVideo.cloneNode(true);
        btnExportVideo.parentNode.replaceChild(newBtnExport, btnExportVideo);
        newBtnExport.addEventListener('click', exportAnimationVideo);
    }

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
        if (isFormationMode) {
            navigate('matches');
            setTimeout(() => {
                const btnDetail = document.querySelector(`.btn-detail-match[data-id="${currentMatchId}"]`);
                if (btnDetail) btnDetail.click();
                setTimeout(() => {
                    const tabFormation = document.getElementById('tab-match-formation');
                    if (tabFormation) tabFormation.click();
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
        if (countEl) countEl.style.display = 'none';

        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> 保存';
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
                        if (btnDetail) btnDetail.click();
                        setTimeout(() => {
                            const tabFormation = document.getElementById('tab-match-formation');
                            if (tabFormation) tabFormation.click();
                        }, 50);
                    }, 50);
                }
            }
        });
    } else if (currentPracticeId && currentMenuId) {
        newBtnAdd.style.display = 'inline-block';
        newBtnPlay.style.display = 'inline-block';
        newBtnStop.style.display = 'inline-block';
        if (countEl) countEl.style.display = 'inline-block';

        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> 保存';
        newBtnSave.addEventListener('click', () => {
            const practice = state.practices.find(p => p.id === currentPracticeId);
            if (practice) {
                const menu = practice.menus.find(m => m.id === currentMenuId);
                if (menu) {
                    if (frames.length === 0) {
                        frames.push(JSON.parse(JSON.stringify(objects)));
                    } else {
                        frames[frames.length - 1] = JSON.parse(JSON.stringify(objects));
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
        if (countEl) countEl.style.display = 'inline-block';

        newBtnSave.style.display = 'inline-flex';
        newBtnSave.innerHTML = '<i class="fa-solid fa-save"></i> 保存';
        newBtnSave.addEventListener('click', () => {
            const libMenu = state.menuLibrary.find(m => m.id === currentLibraryId);
            if (libMenu) {
                if (frames.length === 0) {
                    frames.push(JSON.parse(JSON.stringify(objects)));
                } else {
                    frames[frames.length - 1] = JSON.parse(JSON.stringify(objects));
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
    // Strict Theme Focus Title Display (from menu creation input)
    const titleEl = document.getElementById('anim-menu-focus');
    if (titleEl) {
        if (targetMenu && (targetMenu.focus || targetMenu.name)) {
            titleEl.textContent = targetMenu.focus || targetMenu.name;
        } else if (isFormationMode) {
            titleEl.textContent = 'フォーメーション作図';
        } else {
            titleEl.textContent = 'テーマ・フォーカス未設定';
        }
    }

    // Right Side Panel Data Population & Toggle Handler
    const sidePanel = document.getElementById('anim-detail-side-panel');
    const sideToggleBtn = document.getElementById('anim-side-panel-toggle-btn');
    if (sidePanel && sideToggleBtn) {
        const sideFocus = document.getElementById('side-info-focus');
        const sideOrg = document.getElementById('side-info-organize');
        const sideKf = document.getElementById('side-info-keyfactor');
        const sideOpt = document.getElementById('side-info-options');

        if (targetMenu) {
            if (sideFocus) sideFocus.textContent = targetMenu.focus || targetMenu.name || '未設定';
            if (sideOrg) sideOrg.textContent = targetMenu.organize || 'なし';
            if (sideKf) sideKf.textContent = targetMenu.keyfactor || 'なし';
            if (sideOpt) sideOpt.textContent = targetMenu.options || 'なし';
        } else {
            if (sideFocus) sideFocus.textContent = '未設定';
            if (sideOrg) sideOrg.textContent = 'なし';
            if (sideKf) sideKf.textContent = 'なし';
            if (sideOpt) sideOpt.textContent = 'なし';
        }

        // --- 右パネル初期化処理 ---
        if (window.innerWidth <= 768) {
            sidePanel.classList.remove('open');
            const icon = sideToggleBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-chevron-left';
        } else {
            sidePanel.classList.add('open');
            const icon = sideToggleBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-chevron-right';
        }

        // ボタンタップ時の処理
        sideToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = sidePanel.classList.toggle('open');

            const icon = sideToggleBtn.querySelector('i');
            if (icon) {
                if (isOpen) {
                    icon.className = 'fa-solid fa-chevron-right';
                } else {
                    icon.className = 'fa-solid fa-chevron-left';
                }
            }
        };
    }

    // Settings Dropdown Popover Handler
    const settingsBtn = document.getElementById('anim-settings-btn');
    const settingsPopover = document.getElementById('anim-settings-popover');
    if (settingsBtn && settingsPopover) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            settingsPopover.classList.toggle('hidden');
        };
        document.addEventListener('click', (e) => {
            if (settingsPopover && !settingsPopover.contains(e.target) && e.target !== settingsBtn) {
                settingsPopover.classList.add('hidden');
            }
        });
    }

    // Timeline Collapse Toggle Handler
    const timelineToggleBtn = document.getElementById('anim-timeline-toggle');
    const timelineBar = document.getElementById('anim-timeline-bar');
    if (timelineToggleBtn && timelineBar) {
        timelineToggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = timelineBar.classList.toggle('collapsed');
            timelineToggleBtn.textContent = isCollapsed ? '▲ 開く' : '▼ 隠す';
        };
    }

    drawPitch(objects);

    selectedObject = null; // Globals for canvas

    if (elPlayerNumber) {
        const newEl = elPlayerNumber.cloneNode(true);
        elPlayerNumber.parentNode.replaceChild(newEl, elPlayerNumber);
        newEl.addEventListener('input', (e) => {
            if (selectedObject && selectedObject.type === 'player') {
                selectedObject.number = e.target.value;
                drawPitch(objects);
            }
        });
    }

    const popoverColorDots = document.querySelectorAll('.color-dot');
    popoverColorDots.forEach(dot => {
        dot.onclick = (e) => {
            e.stopPropagation();
            const colorName = dot.dataset.color;
            const colorSelect = document.getElementById('canvas-player-color');
            if (colorSelect) colorSelect.value = colorName;

            let hexColor = '#f23932';
            if (colorName === 'blue') hexColor = '#3d79d5';
            else if (colorName === 'green') hexColor = '#63a84d';
            else if (colorName === 'orange') hexColor = '#f09f4d';

            if (selectedObject) {
                if (selectedObject.type === 'marker') {
                    if (colorName === 'orange') hexColor = '#f97316';
                    else if (colorName === 'blue') hexColor = '#3b82f6';
                    else if (colorName === 'red') hexColor = '#ef4444';
                    else if (colorName === 'green') hexColor = '#22c55e';
                    selectedObject.color = hexColor;
                    saveHistory();
                    drawPitch(objects);
                } else if (selectedObject.type === 'player') {
                    selectedObject.color = hexColor;
                    saveHistory();
                    drawPitch(objects);
                }
            }
        };
    });

    if (elPlayerSelect) {
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

    const elGoalSize = document.getElementById('canvas-goal-size');
    if (elGoalSize) {
        const newEl = elGoalSize.cloneNode(true);
        elGoalSize.parentNode.replaceChild(newEl, elGoalSize);
        newEl.addEventListener('change', (e) => {
            const val = e.target.value;
            let scale = 1.0;
            if (val === 'small') scale = 0.7;
            else if (val === 'large') scale = 1.6;
            else if (val === 'full') scale = 2.4;

            if (selectedObject && selectedObject.type === 'minigoal') {
                selectedObject.sizeCategory = val;
                selectedObject.goalScale = scale;
                saveHistory();
                drawPitch(objects);
            }
        });
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('dblclick', handleCanvasDblClick);

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

let currentFrameIndex = -1;

function updateFrameCount() {
    const el = document.getElementById('frame-count');
    if (el) el.textContent = frames.length;

    const selectEl = document.getElementById('anim-frame-select');
    const btnPrev = document.getElementById('anim-prev-frame');
    const btnNext = document.getElementById('anim-next-frame');
    const btnDelete = document.getElementById('anim-delete-frame');

    if (!selectEl) return;

    if (frames.length === 0) {
        selectEl.innerHTML = '<option value="-1">1: </option>';
        selectEl.disabled = true;
        if (btnPrev) { btnPrev.disabled = true; btnPrev.style.opacity = '0.5'; }
        if (btnNext) { btnNext.disabled = true; btnNext.style.opacity = '0.5'; }
        if (btnDelete) { btnDelete.disabled = true; btnDelete.style.opacity = '0.5'; }
        return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = frames.map((f, idx) => {
        const titlePart = (f && typeof f === 'object' && f.title) ? f.title : '';
        return `<option value="${idx}" ${idx === currentFrameIndex ? 'selected' : ''}>${idx + 1}: ${titlePart}</option>`;
    }).join('');

    if (btnPrev) {
        btnPrev.disabled = currentFrameIndex <= 0;
        btnPrev.style.opacity = currentFrameIndex > 0 ? '1' : '0.5';
    }
    if (btnNext) {
        btnNext.disabled = currentFrameIndex < 0 || currentFrameIndex >= frames.length - 1;
        btnNext.style.opacity = (currentFrameIndex >= 0 && currentFrameIndex < frames.length - 1) ? '1' : '0.5';
    }
    if (btnDelete) {
        btnDelete.disabled = currentFrameIndex < 0 || currentFrameIndex >= frames.length;
        btnDelete.style.opacity = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? '1' : '0.5';
    }
}

function selectFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        currentFrameIndex = index;
        const frameData = frames[index];
        objects = JSON.parse(JSON.stringify(Array.isArray(frameData) ? frameData : (frameData.objects || [])));
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        showToast(`シーン ${index + 1} を表示中`);
    }
}

function deleteFrame(index) {
    if (isPlaying) return;
    if (index >= 0 && index < frames.length) {
        frames.splice(index, 1);
        if (frames.length > 0) {
            currentFrameIndex = Math.min(index, frames.length - 1);
            const frameData = frames[currentFrameIndex];
            objects = JSON.parse(JSON.stringify(Array.isArray(frameData) ? frameData : (frameData.objects || [])));
        } else {
            currentFrameIndex = -1;
            objects = [];
        }
        selectedObject = null;
        updateFrameCount();
        drawPitch(objects);
        showToast(`シーン ${index + 1} を削除しました`);
    }
}

function addFrame() {
    const insertIdx = (currentFrameIndex >= 0 && currentFrameIndex < frames.length) ? currentFrameIndex + 1 : frames.length;
    frames.splice(insertIdx, 0, { objects: JSON.parse(JSON.stringify(objects)), title: '' });
    currentFrameIndex = insertIdx;
    updateFrameCount();
    drawPitch(objects);
    showToast(`シーン ${insertIdx + 1} を追加しました`);
}

function editFrameTitle() {
    if (frames.length === 0) {
        frames = [{ objects: JSON.parse(JSON.stringify(objects)), title: '' }];
        currentFrameIndex = 0;
    }
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        currentFrameIndex = Math.max(0, frames.length - 1);
    }
    let f = frames[currentFrameIndex];
    let currentTitle = (f && typeof f === 'object' && !Array.isArray(f) && f.title) ? f.title : '';

    const inputTitle = prompt(`シーン ${currentFrameIndex + 1} の見出しを入力してください\n（例: 初期配置、プレス回避、シュート体勢 など）:`, currentTitle);
    if (inputTitle !== null) {
        const trimmed = inputTitle.trim();
        if (Array.isArray(f)) {
            frames[currentFrameIndex] = { objects: f, title: trimmed };
        } else if (typeof f === 'object' && f !== null) {
            f.title = trimmed;
        } else {
            frames[currentFrameIndex] = { objects: [], title: trimmed };
        }
        updateFrameCount();
        showToast(`シーン ${currentFrameIndex + 1} の見出しを「${trimmed || '(なし)'}」に更新しました`);
    }
}

function stopAnimation() {
    isPlaying = false;
    if (animReqId) cancelAnimationFrame(animReqId);
    if (frames.length > 0) {
        const lastFrame = frames[frames.length - 1];
        objects = JSON.parse(JSON.stringify(Array.isArray(lastFrame) ? lastFrame : (lastFrame.objects || [])));
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

        const rawCurrent = frames[currentFrameIdx];
        const rawNext = frames[currentFrameIdx + 1];

        const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
        const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);

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

function exportAnimationVideo() {
    const pitchCanvas = document.getElementById('pitch-canvas');
    if (!pitchCanvas) {
        alert('キャンバスが見つかりません');
        return;
    }

    let menuTitle = '戦術作図';
    const focusEl = document.getElementById('side-info-focus');
    if (focusEl && focusEl.textContent && focusEl.textContent.trim() !== '未設定') {
        menuTitle = focusEl.textContent.trim();
    }
    const safeTitle = menuTitle.replace(/[/\\?%*:|"<>]/g, '_');

    // Helper: Trigger direct browser file download
    const downloadFile = (dataUrl, fileName) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
        }, 400);
    };

    stopAnimation(); // Stop any existing animation playback

    showToast('📹 .webm 動画ファイルを作成中...（完了まで数秒お待ちください）');

    try {
        const stream = pitchCanvas.captureStream(30);
        let options = {};
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) {
                options = { mimeType: t };
                break;
            }
        }

        const recordedChunks = [];
        let mediaRecorder;
        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (recordedChunks.length === 0) {
                alert('動画の書き出しに失敗しました。もう一度お試しください。');
                return;
            }

            const mime = mediaRecorder.mimeType || 'video/webm';
            const blob = new Blob(recordedChunks, { type: mime });
            const ext = mime.includes('mp4') ? 'mp4' : 'webm';
            const url = URL.createObjectURL(blob);

            downloadFile(url, `【作図動画】${safeTitle}.${ext}`);
            showToast('✅ 動画のダウンロードが完了しました！LINE等で送信できます。');
            drawPitch(objects);
        };

        // Start recording with 100ms timeslice chunks
        mediaRecorder.start(100);

        const hasMultiFrames = frames && frames.length > 1;
        const durationPerFrame = 1400; // ms per scene transition

        let startTime = null;
        let isRecording = true;

        function recordLoop(timestamp) {
            if (!isRecording) return;
            if (!startTime) startTime = timestamp;

            const elapsed = timestamp - startTime;

            if (hasMultiFrames) {
                let currentFrameIdx = Math.floor(elapsed / durationPerFrame);
                let progress = (elapsed % durationPerFrame) / durationPerFrame;

                if (currentFrameIdx >= frames.length - 1) {
                    // Completed full sequence
                    isRecording = false;
                    try {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.requestData();
                            setTimeout(() => mediaRecorder.stop(), 150);
                        }
                    } catch (err) {
                        mediaRecorder.stop();
                    }
                    return;
                }

                const rawCurrent = frames[currentFrameIdx];
                const rawNext = frames[currentFrameIdx + 1];
                const currentFrame = Array.isArray(rawCurrent) ? rawCurrent : ((rawCurrent && rawCurrent.objects) || []);
                const nextFrame = Array.isArray(rawNext) ? rawNext : ((rawNext && rawNext.objects) || []);
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
            } else {
                // Single scene recording (2.0s duration)
                drawPitch(objects);
                if (elapsed >= 2000) {
                    isRecording = false;
                    try {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.requestData();
                            setTimeout(() => mediaRecorder.stop(), 150);
                        }
                    } catch (err) {
                        mediaRecorder.stop();
                    }
                    return;
                }
            }

            requestAnimationFrame(recordLoop);
        }

        requestAnimationFrame(recordLoop);

    } catch (err) {
        console.error('MediaRecorder error:', err);
        // Instant Fallback to PNG download
        const dataUrl = pitchCanvas.toDataURL('image/png');
        downloadFile(dataUrl, `【作図画像】${safeTitle}.png`);
        showToast('📸 作図画像をダウンロードしました');
    }
}

function drawPitch(renderObjects) {
    const templateEl = document.getElementById('canvas-pitch-template');
    const template = templateEl ? templateEl.value : 'full';
    drawPitchToCtx(renderObjects, canvas, ctx, template);
    updateCanvasToolbar();
}

function updateCanvasToolbar() {
    updateContextPopover();
    updateToolDockActive();
}

function updateToolDockActive() {
    const dockBtns = document.querySelectorAll('.anim-tool-dock .tool-btn, .canvas-toolbar .tool-btn');
    dockBtns.forEach(btn => {
        if (btn.dataset.tool === currentTool) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateContextPopover() {
    const popover = document.getElementById('anim-context-popover');
    if (!popover || !canvas) return;

    if (!selectedObject || isPlaying || draggedObject) {
        popover.classList.add('hidden');
        return;
    }

    let objX, objY;
    if (typeof selectedObject.x !== 'undefined' && typeof selectedObject.y !== 'undefined') {
        objX = selectedObject.x;
        objY = selectedObject.y;
    } else if (typeof selectedObject.x1 !== 'undefined') {
        objX = (selectedObject.x1 + selectedObject.x2) / 2;
        objY = Math.min(selectedObject.y1, selectedObject.y2);
    }

    if (typeof objX === 'undefined' || typeof objY === 'undefined') {
        popover.classList.add('hidden');
        return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = canvas.parentNode ? canvas.parentNode.getBoundingClientRect() : canvasRect;

    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;

    const screenX = (objX * scaleX) + (canvasRect.left - wrapperRect.left);
    const screenY = (objY * scaleY) + (canvasRect.top - wrapperRect.top);

    popover.style.left = `${screenX}px`;
    popover.style.top = `${screenY}px`;

    // Smart flip: If object is near top of pitch, render popover BELOW the object so it never gets cut off!
    if (screenY < 75 || objY < 80) {
        popover.classList.add('popover-below');
    } else {
        popover.classList.remove('popover-below');
    }

    popover.classList.remove('hidden');

    const playerControls = document.getElementById('popover-player-controls');
    if (playerControls) {
        if (selectedObject.type === 'player' || selectedObject.type === 'marker') {
            playerControls.style.display = 'flex';

            const numInput = document.getElementById('canvas-player-number');
            const numLabels = playerControls.querySelectorAll('.popover-label');
            if (numInput) numInput.style.display = (selectedObject.type === 'player') ? 'inline-block' : 'none';
            if (numLabels && numLabels[0]) numLabels[0].style.display = (selectedObject.type === 'player') ? 'inline-block' : 'none';

            if (selectedObject.type === 'player' && numInput) {
                numInput.value = selectedObject.number || '';
            }

            const colorDots = popover.querySelectorAll('.color-dot');
            const currentColor = selectedObject.color || (selectedObject.type === 'marker' ? '#f97316' : 'red');
            colorDots.forEach(dot => {
                const c = dot.dataset.color;
                if ((c === 'red' && (currentColor === '#f23932' || currentColor === 'red' || currentColor === '#ef4444')) ||
                    (c === 'blue' && (currentColor === '#3d79d5' || currentColor === 'blue' || currentColor === '#3b82f6')) ||
                    (c === 'green' && (currentColor === '#63a84d' || currentColor === 'green')) ||
                    (c === 'orange' && (currentColor === '#f09f4d' || currentColor === 'orange' || currentColor === '#f97316')) ||
                    currentColor === c) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        } else {
            playerControls.style.display = 'none';
        }
    }

    popover.classList.remove('hidden');
}

function drawPitchToCtx(renderObjectsInput, targetCanvas, targetCtx, template = 'full') {
    const renderObjects = Array.isArray(renderObjectsInput) ? renderObjectsInput : ((renderObjectsInput && renderObjectsInput.objects) || []);
    // Dynamic High-DPI / DPR Resolution Scaling to eliminate blurriness
    if (targetCanvas.id === 'pitch-canvas') {
        const rect = targetCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const dpr = Math.max(window.devicePixelRatio || 1, 2); // Ultra HD DPR scaling
            const targetW = Math.round(rect.width * dpr);
            const targetH = Math.round(rect.height * dpr);
            if (targetCanvas.width !== targetW || targetCanvas.height !== targetH) {
                targetCanvas.width = targetW;
                targetCanvas.height = targetH;
            }
        }
    }

    const w = targetCanvas.width;
    const h = targetCanvas.height;

    targetCtx.clearRect(0, 0, w, h);

    targetCtx.save();

    // Scale context from base 800x500 coordinate space to high-res canvas resolution!
    const scaleX = w / 800;
    const scaleY = h / 500;
    targetCtx.scale(scaleX, scaleY);

    // Background - modern grey-white
    targetCtx.fillStyle = '#f1f5f9';
    targetCtx.fillRect(0, 0, 800, 500);

    // Proportions and Dimensions (Base 800x500 space, side margins fit goals completely)
    const pitchX = 24;
    const pitchY = 16;
    const pitchW = 800 - 48;
    const pitchH = 500 - 32;

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
        if (obj.type === 'line') {
            drawArrowToCtx(obj.x1, obj.y1, obj.x2, obj.y2, obj.lineType || 'pass', targetCtx);
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
            }
        } else if (obj.type === 'ladder') {
            drawLadderToCtx(obj.x1, obj.y1, obj.x2, obj.y2, targetCtx);
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                targetCtx.beginPath(); targetCtx.arc(obj.x1, obj.y1, 5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.arc(obj.x2, obj.y2, 5, 0, Math.PI * 2); targetCtx.fill();
            }
        } else if (obj.type === 'rect') {
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]);
            targetCtx.strokeRect(Math.min(obj.x1, obj.x2), Math.min(obj.y1, obj.y2), Math.abs(obj.x2 - obj.x1), Math.abs(obj.y2 - obj.y1));
            targetCtx.setLineDash([]);

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                const s = 8;
                targetCtx.fillRect(obj.x1 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x1 - s / 2, obj.y2 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y2 - s / 2, s, s);
            }
        } else if (obj.type === 'circle') {
            const rx = Math.abs(obj.x2 - obj.x1) / 2;
            const ry = Math.abs(obj.y2 - obj.y1) / 2;
            const cx = Math.min(obj.x1, obj.x2) + rx;
            const cy = Math.min(obj.y1, obj.y2) + ry;

            targetCtx.beginPath();
            targetCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(148, 163, 184, 0.25)'; // 透明度の高いグレー塗りつぶし
            targetCtx.fill();
            targetCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]); // 点線
            targetCtx.stroke();
            targetCtx.setLineDash([]);

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.fillStyle = 'var(--primary)';
                const s = 8;
                targetCtx.fillRect(obj.x1 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y1 - s / 2, s, s);
                targetCtx.fillRect(obj.x1 - s / 2, obj.y2 - s / 2, s, s);
                targetCtx.fillRect(obj.x2 - s / 2, obj.y2 - s / 2, s, s);
            }
        } else if (obj.type === 'marker') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            targetCtx.beginPath();
            targetCtx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = obj.color || '#f97316';
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();
            targetCtx.restore();

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
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            // Cone base
            targetCtx.beginPath();
            targetCtx.ellipse(0, obj.radius * 0.8, obj.radius * 0.8, 3, 0, 0, Math.PI * 2);
            targetCtx.fillStyle = '#eab308';
            targetCtx.fill();
            targetCtx.strokeStyle = '#000000';
            targetCtx.lineWidth = 1;
            targetCtx.stroke();

            // Cone body
            targetCtx.beginPath();
            targetCtx.moveTo(0, -obj.radius * 1.2);
            targetCtx.lineTo(obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.lineTo(-obj.radius * 0.7, obj.radius * 0.8);
            targetCtx.closePath();
            targetCtx.fillStyle = obj.color || '#facc15';
            targetCtx.fill();
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
        } else if (obj.type === 'minigoal') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            let scale = obj.goalScale || 1.0;
            if (!obj.goalScale) {
                if (obj.sizeCategory === 'small') scale = 0.7;
                else if (obj.sizeCategory === 'large') scale = 1.6;
                else if (obj.sizeCategory === 'full') scale = 2.4;
            }

            const gw = 30 * scale;
            const gh = 15 * scale;
            const hw = gw / 2;

            // Draw top-down goal
            targetCtx.strokeStyle = '#334155';
            targetCtx.lineWidth = Math.max(2, 2.5 * scale);
            targetCtx.strokeRect(-hw, -gh * 0.66, gw, gh);

            targetCtx.beginPath();
            targetCtx.lineWidth = 1;
            targetCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
            const gridStepX = 6 * scale;
            for (let nx = -hw + gridStepX; nx < hw; nx += gridStepX) {
                targetCtx.moveTo(nx, -gh * 0.66);
                targetCtx.lineTo(nx, gh * 0.33);
            }
            const gridStepY = 4 * scale;
            for (let ny = -gh * 0.5; ny < gh * 0.33; ny += gridStepY) {
                targetCtx.moveTo(-hw, ny);
                targetCtx.lineTo(hw, ny);
            }
            targetCtx.stroke();
            targetCtx.restore();

            // Draw highlight & resize handle handles if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                const selR = (obj.radius || 15) * scale + 6;
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, selR, 0, Math.PI * 2);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 2;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);

                // Draw resize handles (4 corners / cardinal handles)
                targetCtx.fillStyle = 'var(--primary)';
                const handleSize = 8;
                [
                    { hx: obj.x - selR, hy: obj.y },
                    { hx: obj.x + selR, hy: obj.y },
                    { hx: obj.x, hy: obj.y - selR },
                    { hx: obj.x, hy: obj.y + selR }
                ].forEach(pt => {
                    targetCtx.fillRect(pt.hx - handleSize / 2, pt.hy - handleSize / 2, handleSize, handleSize);
                });
            }
        } else if (obj.type === 'text') {
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);
            if (obj.angle) targetCtx.rotate((obj.angle * Math.PI) / 180);

            targetCtx.fillStyle = obj.color || '#000000';
            targetCtx.font = 'bold 14px Inter, sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(obj.text || '', 0, 0);
            targetCtx.restore();

            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                const tw = targetCtx.measureText(obj.text || '').width;
                targetCtx.rect(obj.x - tw / 2 - 4, obj.y - 12, tw + 8, 24);
                targetCtx.strokeStyle = 'var(--primary)';
                targetCtx.lineWidth = 1.5;
                targetCtx.setLineDash([2, 2]);
                targetCtx.stroke();
                targetCtx.setLineDash([]);
            }
        } else if (obj.type === 'player') {
            const r = obj.radius || 16;
            const angle = obj.angle || 0;
            targetCtx.save();
            targetCtx.translate(obj.x, obj.y);

            // Color scheme
            let mainColor = '#1d0b5e';
            if (obj.color === 'red') {
                mainColor = '#800a1d';
            } else if (obj.color === 'blue') {
                mainColor = '#1d0b5e';
            } else if (obj.color === 'green') {
                mainColor = '#064e3b';
            } else if (obj.color === 'orange') {
                mainColor = '#7c2d12';
            } else if (obj.color) {
                mainColor = obj.color;
            }

            // Rotate coordinate system for player pointer direction
            targetCtx.rotate((angle * Math.PI) / 180);

            // 1. Top Pointer Triangle (Triangle pointing upward relative to rotated angle)
            targetCtx.beginPath();
            targetCtx.moveTo(-r * 0.45, -r * 1.05);
            targetCtx.lineTo(0, -r * 1.55);
            targetCtx.lineTo(r * 0.45, -r * 1.05);
            targetCtx.closePath();
            targetCtx.fillStyle = mainColor;
            targetCtx.fill();

            // 2. Main Spherical/Circular Body with radial highlight
            const grad = targetCtx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#311096');
            grad.addColorStop(0.7, mainColor);
            grad.addColorStop(1, '#0f0538');

            targetCtx.beginPath();
            targetCtx.arc(0, 0, r, 0, Math.PI * 2);
            targetCtx.fillStyle = (obj.color === 'blue' || !obj.color) ? grad : mainColor;
            targetCtx.fill();

            // Subtle inner light border rim
            targetCtx.beginPath();
            targetCtx.arc(0, 0, r - 0.75, 0, Math.PI * 2);
            targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            // Un-rotate for text so text remains upright and readable
            targetCtx.rotate((-angle * Math.PI) / 180);

            // 3. White Center Label (Position or Jersey Number)
            let label = obj.number !== undefined && obj.number !== null ? String(obj.number) : '';
            targetCtx.fillStyle = '#ffffff';
            targetCtx.font = 'bold 12px "Inter", "Meiryo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(label, 0, 0.5);

            targetCtx.restore();

            // Draw highlight if selected
            if (typeof selectedObject !== 'undefined' && selectedObject === obj) {
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, r + 6, 0, Math.PI * 2);
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
    targetCtx.restore();
}

function drawArrowToCtx(x1, y1, x2, y2, lineType, targetCtx) {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const color = '#334155';

    targetCtx.beginPath();

    if (lineType === 'dribble') {
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([]);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.floor(dist / 10);
        targetCtx.moveTo(x1, y1);
        if (steps > 0) {
            for (let i = 1; i <= steps; i++) {
                const px = x1 + (dx / steps) * i;
                const py = y1 + (dy / steps) * i;
                const perpX = -dy / dist * (i % 2 === 0 ? 5 : -5);
                const perpY = dx / dist * (i % 2 === 0 ? 5 : -5);
                if (i === steps) targetCtx.lineTo(x2, y2);
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
    const dist = Math.sqrt(dx * dx + dy * dy);
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

function drawCirclePreview(x1, y1, x2, y2) {
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const cx = Math.min(x1, x2) + rx;
    const cy = Math.min(y1, y2) + ry;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
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

function handleCanvasDblClick(e) {
    if (isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (500 / rect.height);

    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.type === 'text') {
            const dx = x - obj.x;
            const dy = y - obj.y;
            ctx.font = 'bold 14px Inter, sans-serif';
            const tw = ctx.measureText(obj.text || '').width;
            if (Math.abs(dx) <= tw / 2 + 10 && Math.abs(dy) <= 15) {
                const modal = document.getElementById('modal-text-input');
                const input = document.getElementById('canvas-text-value');
                if (modal && input) {
                    input.value = obj.text || '';
                    modal.classList.remove('hidden');
                    input.focus();

                    const form = document.getElementById('form-text-input');
                    form.onsubmit = (ev) => {
                        ev.preventDefault();
                        if (input.value) {
                            obj.text = input.value;
                            saveHistory();
                            drawPitch(objects);
                        }
                        modal.classList.add('hidden');
                    };
                }
                break;
            }
        }
    }
}

function handleMouseDown(e) {
    if (isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left) * (800 / rect.width);
    let y = (e.clientY - rect.top) * (500 / rect.height);

    if (currentTool === 'select') {
        const prevSelected = selectedObject;
        selectedObject = null;
        isResizing = false;
        resizeHandle = null;

        // 1. Check resize handle hits for previously selected object first
        if (prevSelected) {
            if (prevSelected.type === 'minigoal') {
                const scale = prevSelected.goalScale || 1.0;
                const selR = (prevSelected.radius || 15) * scale + 6;
                const s = 18; // Wide hit area for handle drag
                if (Math.abs(x - (prevSelected.x - selR)) <= s && Math.abs(y - prevSelected.y) <= s) { isResizing = true; resizeHandle = 'goal-w'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - (prevSelected.x + selR)) <= s && Math.abs(y - prevSelected.y) <= s) { isResizing = true; resizeHandle = 'goal-e'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - prevSelected.x) <= s && Math.abs(y - (prevSelected.y - selR)) <= s) { isResizing = true; resizeHandle = 'goal-n'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - prevSelected.x) <= s && Math.abs(y - (prevSelected.y + selR)) <= s) { isResizing = true; resizeHandle = 'goal-s'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
            } else if (prevSelected.type === 'rect' || prevSelected.type === 'circle') {
                const s = 18;
                if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'nw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y1) <= s) { isResizing = true; resizeHandle = 'ne'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - prevSelected.x1) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'sw'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
                if (Math.abs(x - prevSelected.x2) <= s && Math.abs(y - prevSelected.y2) <= s) { isResizing = true; resizeHandle = 'se'; draggedObject = prevSelected; selectedObject = prevSelected; drawPitch(objects); return; }
            }
        }

        // 2. Otherwise select or drag objects
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];

            if (obj.type === 'line' || obj.type === 'ladder') {
                // Distance from point (x, y) to line segment (x1, y1)-(x2, y2)
                const A = x - obj.x1;
                const B = y - obj.y1;
                const C = obj.x2 - obj.x1;
                const D = obj.y2 - obj.y1;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;
                if (lenSq !== 0) param = dot / lenSq;
                let xx, yy;
                if (param < 0) { xx = obj.x1; yy = obj.y1; }
                else if (param > 1) { xx = obj.x2; yy = obj.y2; }
                else { xx = obj.x1 + param * C; yy = obj.y1 + param * D; }
                const dx = x - xx;
                const dy = y - yy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= 12) {
                    draggedObject = obj;
                    selectedObject = obj;
                    startX = x; startY = y;
                    break;
                }
            } else if (obj.type === 'rect' || obj.type === 'circle') {
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
            } else {
                const dx = x - obj.x;
                const dy = y - obj.y;
                let isHit = false;
                if (obj.type === 'text') {
                    ctx.font = 'bold 14px Inter, sans-serif';
                    const tw = ctx.measureText(obj.text || '').width;
                    isHit = Math.abs(dx) <= tw / 2 + 5 && Math.abs(dy) <= 15;
                } else if (obj.type === 'minigoal') {
                    const scale = obj.goalScale || 1.0;
                    const gw = 30 * scale;
                    const gh = 15 * scale;
                    isHit = Math.abs(dx) <= (gw / 2 + 10) && Math.abs(dy) <= (gh / 2 + 10);
                } else {
                    isHit = Math.sqrt(dx * dx + dy * dy) <= (obj.radius + 5);
                }

                if (isHit) {
                    draggedObject = obj;
                    selectedObject = obj;
                    startX = x; startY = y;

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

        if (currentTool === 'player') {
            const colorSelect = document.getElementById('canvas-player-color');
            const colorVal = colorSelect ? colorSelect.value : 'red';
            if (colorVal === 'red') color = '#f23932';
            else if (colorVal === 'blue') color = '#3d79d5';
            else if (colorVal === 'green') color = '#63a84d';
            else if (colorVal === 'orange') color = '#f09f4d';
            radius = 14;
            type = 'player';
        }
        let goalScale = 1.0;
        let sizeCategory = 'medium';
        const elGoalSize = document.getElementById('canvas-goal-size');
        if (elGoalSize) {
            sizeCategory = elGoalSize.value;
            if (sizeCategory === 'small') goalScale = 0.7;
            else if (sizeCategory === 'large') goalScale = 1.6;
            else if (sizeCategory === 'full') goalScale = 2.4;
        }

        if (currentTool === 'ball') { color = '#ffffff'; radius = 8; type = 'ball'; }
        if (currentTool === 'marker') { color = '#f97316'; radius = 8; type = 'marker'; }
        if (currentTool === 'marker-blue') { color = '#3b82f6'; radius = 8; type = 'marker'; }
        if (currentTool === 'marker-red') { color = '#ef4444'; radius = 8; type = 'marker'; }
        if (currentTool === 'cone') { color = '#facc15'; radius = 10; type = 'cone'; }
        if (currentTool === 'minigoal') { color = '#ffffff'; radius = 15; type = 'minigoal'; }
        if (currentTool === 'text') { color = '#000000'; radius = 0; type = 'text'; }

        if (type) {
            const newObj = { id: objectIdCounter++, type, x, y, radius, color, number };
            if (type === 'minigoal') {
                newObj.sizeCategory = sizeCategory;
                newObj.goalScale = goalScale;
            }
            if (type === 'text') {
                const modal = document.getElementById('modal-text-input');
                const input = document.getElementById('canvas-text-value');
                if (modal && input) {
                    input.value = '';
                    modal.classList.remove('hidden');
                    input.focus();

                    const form = document.getElementById('form-text-input');
                    form.onsubmit = (ev) => {
                        ev.preventDefault();
                        if (input.value) {
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
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (500 / rect.height);

    if (draggedObject) {
        if (isResizing && draggedObject.type === 'minigoal') {
            const dist = Math.sqrt(Math.pow(x - draggedObject.x, 2) + Math.pow(y - draggedObject.y, 2));
            const newScale = Math.max(0.4, Math.min(3.5, dist / 21));
            draggedObject.goalScale = parseFloat(newScale.toFixed(2));
        } else if (isResizing && (draggedObject.type === 'rect' || draggedObject.type === 'circle')) {
            if (resizeHandle === 'nw') { draggedObject.x1 = applyGridSnap(x, 'x'); draggedObject.y1 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'ne') { draggedObject.x2 = applyGridSnap(x, 'x'); draggedObject.y1 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'sw') { draggedObject.x1 = applyGridSnap(x, 'x'); draggedObject.y2 = applyGridSnap(y, 'y'); }
            if (resizeHandle === 'se') { draggedObject.x2 = applyGridSnap(x, 'x'); draggedObject.y2 = applyGridSnap(y, 'y'); }
        } else if (draggedObject.type === 'rect' || draggedObject.type === 'circle') {
            const dx = applyGridSnap(x, 'x') - applyGridSnap(startX, 'x');
            const dy = applyGridSnap(y, 'y') - applyGridSnap(startY, 'y');
            draggedObject.x1 += dx; draggedObject.x2 += dx;
            draggedObject.y1 += dy; draggedObject.y2 += dy;
            startX = x; startY = y;
        } else if (draggedObject.type === 'line' || draggedObject.type === 'ladder') {
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
        } else if (currentTool === 'line-circle') {
            drawCirclePreview(startX, startY, applyGridSnap(x, 'x'), applyGridSnap(y, 'y'));
        } else {
            const lType = currentTool.replace('line-', '');
            drawArrow(startX, startY, applyGridSnap(x, 'x'), applyGridSnap(y, 'y'), lType);
        }
    }
}

function handleMouseUp(e) {
    if (isPlaying) return;
    if (draggedObject) {
        saveHistory();
        draggedObject = null;
        isResizing = false;
        resizeHandle = null;
        drawPitch(objects);
    } else if (isDrawing && currentTool && (currentTool.startsWith('line-') || currentTool === 'ladder')) {
        const rect = canvas.getBoundingClientRect();
        const x = applyGridSnap((e.clientX - rect.left) * (canvas.width / rect.width), 'x');
        const y = applyGridSnap((e.clientY - rect.top) * (canvas.height / rect.height), 'y');
        if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
            if (currentTool === 'ladder') {
                objects.push({ id: objectIdCounter++, type: 'ladder', x1: startX, y1: startY, x2: x, y2: y });
            } else if (currentTool === 'line-rect') {
                objects.push({ id: objectIdCounter++, type: 'rect', x1: startX, y1: startY, x2: x, y2: y });
            } else if (currentTool === 'line-circle') {
                objects.push({ id: objectIdCounter++, type: 'circle', x1: startX, y1: startY, x2: x, y2: y });
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
