const fs = require('fs');

const file = '/home/l0mochi/antigravity/coach-mgr/players.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
content = content.replace(
    "import { escapeHtml, showToast, showCustomConfirm } from './utils.js';",
    "import { escapeHtml, showToast, showCustomConfirm, getNendo } from './utils.js';"
);

// 2. Add getRelativeGrade helper
const helperCode = `
function getRelativeGrade(currentGrade, recordNendo, currentNendo) {
    const diff = parseInt(recordNendo, 10) - parseInt(currentNendo, 10);
    if (diff === 0 || !currentGrade) return currentGrade || \`\${recordNendo}年度\`;
    const match = currentGrade.match(/(\\d+)/);
    if (match) {
        const num = parseInt(match[1], 10);
        const newNum = num + diff;
        if (newNum > 0) return currentGrade.replace(match[1], newNum);
    }
    return \`\${recordNendo}年度\`;
}
`;

content = content.replace(
    "function renderDevelopmentNotebook(player) {",
    helperCode + "\nfunction renderDevelopmentNotebook(player) {"
);

// 3. Update renderTimeline
const oldRenderTimeline = `    // タイムライン描画関数（インラインフィルター対応）
    const renderTimeline = () => {
        if (!timeline) return;
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeChip = filterChips ? filterChips.querySelector('.active') : null;
        const filterType = activeChip ? activeChip.dataset.type : 'all';

        const filtered = summary.timeline.filter(item => {
            if (filterType !== 'all' && item.kind !== filterType) return false;
            if (query) {
                const text = \`\${item.title || ''} \${item.detail || ''}\`.toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        });

        timeline.innerHTML = filtered.length ? filtered.map(item => \`
            <article class="c-data-list__item is-\${escapeHtml(item.kind)}">
                <span class="c-data-list__identity"><i class="\${icons[item.kind] || 'ti ti-circle'}" aria-hidden="true"></i></span>
                <div class="c-data-list__content"><span class="c-data-list__meta">\${escapeHtml(item.date || '')} ・ \${labels[item.kind] || '記録'}</span><strong>\${escapeHtml(item.title || '')}</strong><p class="c-data-list__body">\${escapeHtml(item.detail || '')}</p></div>
                \${canEdit && item.kind === 'note' ? \`<div class="c-data-list__actions"><button type="button" class="c-button btn c-button--secondary btn-secondary btn-remove-development-note" data-development-note-id="\${escapeHtml(item.id)}" aria-label="育成ノートを削除"><i class="ti ti-trash"></i></button></div>\` : ''}
            </article>\`).join('') : '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-search c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">該当する記録がありません。</p></div></div>';
        
        timeline.querySelectorAll('.btn-remove-development-note').forEach(button => {
            button.onclick = async () => {
                if (!canEdit) {
                    showToast('保護者モードでは育成ノートを削除できません');
                    return;
                }
                const proceed = await showCustomConfirm('この育成ノートを削除しますか？', '育成ノートの削除', { okText: '削除する', type: 'danger' });
                if (!proceed) return;
                removeDevelopmentNote(player, button.dataset.developmentNoteId);
                await saveData();
                renderDevelopmentNotebook(player);
                showToast('育成ノートを削除しました');
            };
        });
    };`;

const newRenderTimeline = `    // タイムライン描画関数（インラインフィルター対応・階層化）
    const renderTimeline = () => {
        if (!timeline) return;
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeChip = filterChips ? filterChips.querySelector('.active') : null;
        const filterType = activeChip ? activeChip.dataset.type : 'all';

        const filtered = summary.timeline.filter(item => {
            if (filterType !== 'all' && item.kind !== filterType) return false;
            if (query) {
                const text = \`\${item.title || ''} \${item.detail || ''}\`.toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            timeline.innerHTML = '<div class="c-empty-state c-empty-state--compact"><div class="c-empty-state__body"><i class="ti ti-search c-empty-state__icon" aria-hidden="true"></i><p class="c-empty-state__text">該当する記録がありません。</p></div></div>';
            return;
        }

        const todayNendo = getNendo(new Date().toISOString().slice(0, 10));
        const grouped = {};
        
        filtered.forEach(item => {
            const itemNendo = getNendo(item.date);
            const mm = parseInt(item.date.split('-')[1], 10);
            
            if (!grouped[itemNendo]) grouped[itemNendo] = { items: [], months: {} };
            grouped[itemNendo].items.push(item);
            
            // Month key is just the month number to sort properly within the Nendo
            if (!grouped[itemNendo].months[mm]) grouped[itemNendo].months[mm] = { items: [], focus: null };
            grouped[itemNendo].months[mm].items.push(item);
        });

        Object.keys(grouped).forEach(nendo => {
            Object.keys(grouped[nendo].months).forEach(mm => {
                const mGroup = grouped[nendo].months[mm];
                const notes = mGroup.items.filter(i => i.kind === 'note' && i.note && i.note.focus);
                if (notes.length > 0) mGroup.focus = notes[0].note.focus;
            });
        });

        let html = '';
        const sortedNendos = Object.keys(grouped).sort((a, b) => b - a);
        sortedNendos.forEach(nendo => {
            const gradeStr = getRelativeGrade(player.grade, nendo, todayNendo);
            const nendoCount = grouped[nendo].items.length;
            
            html += \`
                <div class="c-timeline-chapter">
                    <span class="c-timeline-chapter__title">▼ \${escapeHtml(gradeStr)} \${nendo}年度</span>
                    <span class="c-timeline-chapter__count">\${nendoCount}件</span>
                </div>
            \`;

            // Month sort desc (e.g. 12, 11, ... 1) inside a nendo, wait nendo starts from 4 to 3.
            // If month is 1,2,3 it belongs to next year's early months, so for desc sorting in Nendo:
            // 3, 2, 1, 12, 11, ... 4
            const sortedMonths = Object.keys(grouped[nendo].months).sort((a, b) => {
                const ma = parseInt(a, 10) <= 3 ? parseInt(a, 10) + 12 : parseInt(a, 10);
                const mb = parseInt(b, 10) <= 3 ? parseInt(b, 10) + 12 : parseInt(b, 10);
                return mb - ma;
            });

            sortedMonths.forEach(mm => {
                const mGroup = grouped[nendo].months[mm];
                const titleText = mGroup.focus ? \`\${mm}月 \${mGroup.focus}\` : \`\${mm}月\`;
                
                html += \`
                    <div class="c-timeline-route">
                        <span class="c-timeline-route__title">▼ \${escapeHtml(titleText)}</span>
                        <span class="c-timeline-route__count">\${mGroup.items.length}件</span>
                    </div>
                \`;
                
                mGroup.items.forEach(item => {
                    html += \`
                    <article class="c-data-list__item is-\${escapeHtml(item.kind)}">
                        <span class="c-data-list__identity"><i class="\${icons[item.kind] || 'ti ti-circle'}" aria-hidden="true"></i></span>
                        <div class="c-data-list__content"><span class="c-data-list__meta">\${escapeHtml(item.date || '')} ・ \${labels[item.kind] || '記録'}</span><strong>\${escapeHtml(item.title || '')}</strong><p class="c-data-list__body">\${escapeHtml(item.detail || '')}</p></div>
                        \${canEdit && item.kind === 'note' ? \`<div class="c-data-list__actions"><button type="button" class="c-button btn c-button--secondary btn-secondary btn-remove-development-note" data-development-note-id="\${escapeHtml(item.id)}" aria-label="育成ノートを削除"><i class="ti ti-trash"></i></button></div>\` : ''}
                    </article>\`;
                });
            });
        });

        timeline.innerHTML = html;
        
        timeline.querySelectorAll('.btn-remove-development-note').forEach(button => {
            button.onclick = async () => {
                if (!canEdit) {
                    showToast('保護者モードでは育成ノートを削除できません');
                    return;
                }
                const proceed = await showCustomConfirm('この育成ノートを削除しますか？', '育成ノートの削除', { okText: '削除する', type: 'danger' });
                if (!proceed) return;
                removeDevelopmentNote(player, button.dataset.developmentNoteId);
                await saveData();
                renderDevelopmentNotebook(player);
                showToast('育成ノートを削除しました');
            };
        });
    };`;

content = content.replace(oldRenderTimeline, newRenderTimeline);

fs.writeFileSync(file, content);
