const fs = require('fs');

const file = '/home/l0mochi/antigravity/coach-mgr/CSS/components.css';
let content = fs.readFileSync(file, 'utf8');

const additionalCss = `
/* Timeline Headers */
.c-timeline-chapter {
    background: var(--color-brand);
    color: var(--color-text-on-brand);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    margin-top: 2rem;
    margin-bottom: 1rem;
    margin-left: -24px; /* Pull left to cover the padding */
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    position: relative;
    z-index: 2;
    box-shadow: var(--shadow-sm);
}
.c-timeline-chapter:first-child {
    margin-top: 0.5rem;
}

.c-timeline-route {
    background: var(--color-brand-surface);
    color: var(--color-text);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    position: relative;
    z-index: 2;
}
.c-timeline-route::before {
    content: '';
    position: absolute;
    left: -23px; /* align with vertical line */
    top: 50%;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    background: var(--color-brand);
    box-shadow: 0 0 0 2px var(--surface);
    border-radius: 2px; /* Slight square for flag */
}
`;

content = content + additionalCss;
fs.writeFileSync(file, content);
