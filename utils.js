// utils.js
import { state } from './state.js';

export function escapeHtml(str) {
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

export function encryptData(text) {
    try {
        if (!text) return text;
        const encoded = encodeURIComponent(text);
        return btoa(encoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (101 + (i % 7)))).join(''));
    } catch (e) {
        return text;
    }
}

export function decryptData(ciphertext) {
    try {
        if (!ciphertext) return ciphertext;
        const decoded = atob(ciphertext);
        const unmasked = decoded.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (101 + (i % 7)))).join('');
        return decodeURIComponent(unmasked);
    } catch (e) {
        return ciphertext;
    }
}

export function getNendo(dateStr) {
    const d = new Date(dateStr);
    let year = d.getFullYear();
    if (d.getMonth() < 3) year--;
    return year;
}

export function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
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

export function setupScoreCounters() {
    ['match-score-us', 'match-score-them', 'formation-score-us', 'formation-score-them'].forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.type === 'hidden' || input.parentNode.classList.contains('score-counter-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'score-counter-wrapper';
        wrapper.style = 'display: flex; align-items: center; gap: 0.3rem; width: 100%;';

        input.parentNode.replaceChild(wrapper, input);
        input.style.textAlign = 'center';
        input.style.fontWeight = 'bold';

        const btnMinus = document.createElement('button');
        btnMinus.type = 'button';
        btnMinus.className = 'btn btn-secondary btn-score-minus';
        btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';
        btnMinus.style = 'padding: 0.4rem 0.6rem; font-size: 0.8rem;';

        const btnPlus = document.createElement('button');
        btnPlus.type = 'button';
        btnPlus.className = 'btn btn-secondary btn-score-plus';
        btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';
        btnPlus.style = 'padding: 0.4rem 0.6rem; font-size: 0.8rem;';

        btnMinus.onclick = () => {
            let val = parseInt(input.value, 10) || 0;
            if (val > 0) {
                input.value = val - 1;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        btnPlus.onclick = () => {
            let val = parseInt(input.value, 10) || 0;
            input.value = val + 1;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        wrapper.appendChild(btnMinus);
        wrapper.appendChild(input);
        wrapper.appendChild(btnPlus);
        input.style.flex = '1';
    });
}