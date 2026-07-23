// Application Main Entry Point (ES Module)

import { loadData, state } from './state.js?v=25';
import { setupModals } from './ui.js';
import { registerViewInitializers, setupEventListeners, navigate } from './router.js';

import { initDashboard } from './views/dashboard.js';
import { initMatches } from './views/matches.js';
import { initPractices } from './views/practices.js';
import { initPlayers } from './views/players.js';
import { initLibrary } from './views/library.js';
import { initSettings } from './views/settings.js';
import { initData } from './views/data.js';
import { initAnimation, stopAnimation } from './canvas.js';

function init() {
    try {
        loadData();

        // Register view initializers into router
        registerViewInitializers({
            initDashboard,
            initMatches,
            initPractices,
            initPlayers,
            initLibrary,
            initSettings,
            initData,
            initAnimation,
            stopAnimation
        });

        // Apply Team Theme Colors
        document.documentElement.style.setProperty('--primary', state.teamInfo.color);
        const sidebarTitle = document.querySelector('.sidebar-header h2');
        if (sidebarTitle) sidebarTitle.innerHTML = `<i class="fa-solid fa-futbol"></i> ${state.teamInfo.name}`;

        setupEventListeners();
        setupModals();

        // Initial navigation
        navigate('dashboard');
    } catch (e) {
        console.error("Initialization error:", e);
        alert("初期化エラーが発生しました: " + e.message);
        try {
            navigate('dashboard');
        } catch (err) {}
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
