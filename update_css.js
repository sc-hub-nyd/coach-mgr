const fs = require('fs');

const file = '/home/l0mochi/antigravity/coach-mgr/CSS/components.css';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove padding and ::before from .c-data-list--notebook
content = content.replace(
    /\.c-data-list--notebook {\n    position: relative;\n    padding-left: 24px;\n    margin-top: 1rem;\n}/,
    '.c-data-list--notebook {\n    position: relative;\n    margin-top: 1rem;\n}'
);

content = content.replace(
    /\.c-data-list--notebook::before {[\s\S]*?z-index: 0;\n}/,
    ''
);

// 2. Adjust .c-timeline-chapter margin-left
content = content.replace(
    /margin-left: -24px; \/\* Pull left to cover the padding \*\//,
    'margin-left: 0;'
);

// 3. Add .c-timeline-section
const sectionCss = `
.c-timeline-section {
    position: relative;
    padding-left: 24px;
    padding-bottom: 0.5rem;
}
.c-timeline-section::before {
    content: '';
    position: absolute;
    top: 2rem;
    bottom: 0;
    left: 6px;
    width: 2px;
    background: var(--surface-border);
    z-index: 0;
}
`;

content = content + sectionCss;

fs.writeFileSync(file, content);
