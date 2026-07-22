// UI Utility & Notifications Module

export function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

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

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function setupModals() {
    const closeBtns = document.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => {
        btn.onclick = (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.add('hidden');
        };
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        };
    });
}

export function _showExportFallbackModal(jsonStr) {
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
            textarea.setSelectionRange(0, textarea.value.length);
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
