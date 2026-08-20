import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = fs.readdirSync(root)
  .filter((file) => file === 'index.html' || (file.endsWith('.js') && file !== 'sw.js'))
  .sort();

// Font Awesome to Tabler 3.46.0. Choose intent over literal shape where a one-to-one glyph does not exist.
const ICON_MAP = {
  'fa-plus': 'plus', 'fa-xmark': 'x', 'fa-futbol': 'ball-football', 'fa-bullseye': 'target',
  'fa-trash': 'trash', 'fa-trash-can': 'trash', 'fa-pen': 'pencil', 'fa-chevron-right': 'chevron-right',
  'fa-chevron-down': 'chevron-down', 'fa-chevron-left': 'chevron-left', 'fa-users': 'users',
  'fa-trophy': 'trophy', 'fa-person-running': 'run', 'fa-cloud-arrow-down': 'cloud-download',
  'fa-cloud-arrow-up': 'cloud-upload', 'fa-cloud-check': 'cloud-check', 'fa-check': 'check',
  'fa-triangle-exclamation': 'alert-triangle', 'fa-shield-halved': 'shield', 'fa-shield-heart': 'shield-heart',
  'fa-rotate': 'refresh', 'fa-arrows-rotate': 'refresh', 'fa-arrow-rotate-left': 'arrow-back-up',
  'fa-clock-rotate-left': 'history', 'fa-circle-info': 'info-circle', 'fa-circle-question': 'help-circle',
  'fa-circle-xmark': 'circle-x', 'fa-circle-check': 'circle-check', 'fa-check-circle': 'circle-check',
  'fa-circle-notch': 'loader', 'fa-calendar': 'calendar', 'fa-calendar-plus': 'calendar-plus',
  'fa-calendar-days': 'calendar-event', 'fa-calendar-day': 'calendar-event', 'fa-calendar-check': 'calendar-check',
  'fa-calendar-xmark': 'calendar-x', 'fa-calendar-minus': 'calendar-minus', 'fa-user-check': 'user-check',
  'fa-user-plus': 'user-plus', 'fa-user-shield': 'user-shield', 'fa-user-xmark': 'user-x',
  'fa-user-lock': 'user-shield', 'fa-user-group': 'users-group', 'fa-users-gear': 'users-group',
  'fa-user-gear': 'user-cog', 'fa-user-clock': 'user', 'fa-user': 'user', 'fa-shoe-prints': 'shoe',
  'fa-eye': 'eye', 'fa-street-view': 'walk', 'fa-sliders': 'adjustments', 'fa-magnifying-glass': 'search',
  'fa-clipboard-list': 'clipboard-list', 'fa-clipboard-user': 'clipboard', 'fa-clipboard-check': 'clipboard-check',
  'fa-clipboard': 'clipboard', 'fa-play': 'player-play', 'fa-pause': 'player-pause', 'fa-stop': 'player-stop',
  'fa-key': 'key',   'fa-youtube': 'brand-youtube', 'fa-save': 'device-floppy',
  'fa-floppy-disk': 'device-floppy', 'fa-hard-drive': 'server', 'fa-circle': 'circle',
  'fa-arrow-right': 'arrow-right', 'fa-arrow-left': 'arrow-left', 'fa-arrow-down': 'arrow-down',
  'fa-arrow-down-wide-short': 'sort-descending', 'fa-arrow-up-wide-short': 'sort-ascending',
  'fa-arrow-up-right-from-square': 'external-link', 'fa-arrow-right-arrow-left': 'arrows-exchange',
  'fa-right-left': 'arrows-exchange', 'fa-stopwatch': 'stopwatch', 'fa-share-nodes': 'share-3',
  'fa-moon': 'moon', 'fa-sun': 'sun', 'fa-fire': 'flame', 'fa-download': 'download',
  'fa-upload': 'upload', 'fa-comment-dots': 'message-circle', 'fa-tags': 'tags', 'fa-tag': 'tag',
  'fa-palette': 'palette', 'fa-mobile-screen-button': 'device-mobile', 'fa-minus': 'minus',
  'fa-layer-group': 'stack', 'fa-gear': 'settings', 'fa-film': 'movie', 'fa-photo-film': 'photo-video',
  'fa-file-csv': 'file-type-csv', 'fa-file-lines': 'file-text', 'fa-file-import': 'file-import',
  'fa-file-export': 'file-export', 'fa-copy': 'copy', 'fa-cloud': 'cloud', 'fa-clock': 'clock',
  'fa-chart-pie': 'chart-pie', 'fa-chart-line': 'chart-line', 'fa-chart-column': 'chart-column',
  'fa-chart-simple': 'chart-bar', 'fa-bookmark': 'bookmark', 'fa-book-open': 'book-2',
  'fa-book': 'book', 'fa-star': 'star', 'fa-square': 'square', 'fa-plus-circle': 'circle-plus',
  'fa-people-group': 'users-group', 'fa-people-roof': 'home', 'fa-people-arrows-left-right': 'arrows-exchange',
  'fa-inbox': 'inbox', 'fa-id-badge': 'id-badge', 'fa-id-card': 'id', 'fa-history': 'history',
  'fa-hand-pointer': 'hand-click', 'fa-handshake': 'heart-handshake', 'fa-ellipsis': 'dots',
  'fa-database': 'database', 'fa-crosshairs': 'crosshair', 'fa-chess-knight': 'chess-knight',
  'fa-chess-board': 'chess', 'fa-box-archive': 'archive', 'fa-bars': 'menu-2',
  'fa-angle-down': 'chevron-down', 'fa-wave-square': 'activity', 'fa-universal-access': 'accessible',
  'fa-seedling': 'plant', 'fa-scale-balanced': 'scale', 'fa-rocket': 'rocket', 'fa-reply': 'corner-up-left',
  'fa-print': 'printer', 'fa-note-sticky': 'note', 'fa-location-dot': 'map-pin', 'fa-heading': 'text-size',
  'fa-grip': 'grip-vertical', 'fa-font': 'typography', 'fa-folder-plus': 'folder-plus', 'fa-flag': 'flag',
  'fa-filter': 'filter', 'fa-droplet': 'droplet', 'fa-code-compare': 'git-compare',
  'fa-code-branch': 'git-branch', 'fa-child-reaching': 'accessible', 'fa-caret-up': 'caret-up',
  'fa-ban': 'ban', 'fa-arrow-trend-down': 'trending-down', 'fa-align-left': 'align-left',
  'fa-address-card': 'id-badge', 'fa-lightbulb': 'bulb', 'fa-link': 'link',
  'fa-list': 'list', 'fa-list-check': 'list-check', 'fa-list-ul': 'list',
  'fa-rotate-left': 'rotate-2', 'fa-rotate-right': 'rotate-clockwise', 'fa-times': 'x'
};

const TABLER_CORRECTIONS = {
  'ti-handshake': 'ti-heart-handshake',
  'ti-hard-drive': 'ti-server',
  'ti-layers': 'ti-stack',
  'ti-user-lock': 'ti-user-shield'
};

const mode = process.argv.includes('--apply') ? 'apply' : 'check';
const unknown = new Set();
const replacements = [];

for (const relativeFile of files) {
  const target = path.join(root, relativeFile);
  let content = fs.readFileSync(target, 'utf8');
  const original = content;

  // Remove Font Awesome family and presentation modifiers before converting icon names.
  content = content.replace(/\bfa-(solid|regular|brands|spin|bounce|beat|fade|flip|xs|sm|lg|xl|2x|3x|4x|5x|fw|ul|li|border|pull-left|pull-right|rotate-[0-9]+|flip-[a-z-]+)\b\s*/g, '');
  content = content.replace(/\bfa-([a-z0-9-]+)\b/g, (full) => {
    const tablerName = ICON_MAP[full];
    if (!tablerName) {
      unknown.add(full);
      return full;
    }
    return `ti ti-${tablerName}`;
  });

  for (const [legacyClass, tablerClass] of Object.entries(TABLER_CORRECTIONS)) {
    content = content.replaceAll(legacyClass, tablerClass);
  }
  content = content.replace(/class=(["'])\s+([^"']*?)\s*\1/g, 'class=$1$2$1');

  if (content !== original) {
    replacements.push(relativeFile);
    if (mode === 'apply') fs.writeFileSync(target, content);
  }
}

console.log(JSON.stringify({ mode, filesChanged: replacements, unknown: [...unknown].sort(), mapped: Object.keys(ICON_MAP).length }, null, 2));
if (unknown.size) process.exitCode = 2;
