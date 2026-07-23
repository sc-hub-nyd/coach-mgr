// Routing, Navigation & Role Management Module

import { state } from './state.js?v=25';
import { showToast } from './ui.js';

let viewInitializers = {};

export function registerViewInitializers(initializers) {
    viewInitializers = { ...viewInitializers, ...initializers };
}

export function updateRoleUI() {
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

    const settingsLink = document.querySelector('.nav-links li[data-route="settings"]');
    if (settingsLink) {
        settingsLink.style.display = isCoach ? 'flex' : 'none';
    }

    const libraryLink = document.querySelector('.nav-links li[data-route="library"]');
    if (libraryLink) {
        libraryLink.style.display = isCoach ? 'flex' : 'none';
    }

    if (!isCoach && (state.currentRoute === 'settings' || state.currentRoute === 'library')) {
        navigate('dashboard');
    }

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

    if (isCoach) {
        document.body.classList.remove('role-read-only');
    } else {
        document.body.classList.add('role-read-only');
    }
}

export function navigate(route, params = null) {
    if (typeof viewInitializers.stopAnimation === 'function') {
        viewInitializers.stopAnimation();
    }
    
    state.currentRoute = route;
    
    const navLinks = document.querySelectorAll('.nav-links li');
    const topbarTitle = document.getElementById('topbar-title');
    
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.route === route);
        if (link.dataset.route === route && topbarTitle) {
            topbarTitle.textContent = link.textContent.trim();
        }
    });

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
    }

    const viewContainer = document.getElementById('view-container');
    const template = document.getElementById(`tpl-${route}`);
    
    if (template && viewContainer) {
        viewContainer.innerHTML = '';
        viewContainer.appendChild(template.content.cloneNode(true));
        
        if (route === 'dashboard' && viewInitializers.initDashboard) viewInitializers.initDashboard();
        if (route === 'matches' && viewInitializers.initMatches) viewInitializers.initMatches();
        if (route === 'practices' && viewInitializers.initPractices) viewInitializers.initPractices();
        if (route === 'players' && viewInitializers.initPlayers) viewInitializers.initPlayers();
        if (route === 'data' && viewInitializers.initData) viewInitializers.initData();
        if (route === 'library' && viewInitializers.initLibrary) viewInitializers.initLibrary();
        if (route === 'settings' && viewInitializers.initSettings) viewInitializers.initSettings();
        if (route === 'animation' && viewInitializers.initAnimation) viewInitializers.initAnimation(params);
    }
}

export function setupEventListeners() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const route = e.currentTarget.dataset.route;
            navigate(route);
            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('open');
            }
        });
    });

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    const teamBrand = document.getElementById('sidebar-team-brand');
    if (teamBrand) {
        teamBrand.addEventListener('click', () => {
            navigate('dashboard');
            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('open');
            }
        });
    }

    const btnToggleRole = document.getElementById('btn-toggle-role');
    const modalPasscode = document.getElementById('modal-coach-passcode');
    const formPasscode = document.getElementById('form-coach-passcode');
    const inputPasscode = document.getElementById('input-coach-passcode');
    const errorMsg = document.getElementById('passcode-error-msg');

    if (btnToggleRole) {
        btnToggleRole.addEventListener('click', () => {
            if (state.currentUserRole === 'coach') {
                state.currentUserRole = 'parent';
                updateRoleUI();
                navigate('dashboard');
                showToast('保護者モード（閲覧専用）に切り替えました');
            } else {
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
