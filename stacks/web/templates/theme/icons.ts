/** Icon set — CodaSignal "Signal" language. 60 marks, no icon library. Import: import { icons } from '@/ui/theme/icons'. */

// Glyphs annotate; icons afford. Where a control needs a target rather than a
// note, use this set. Every mark is drawn on a 24 box with a 20 live area, 1.25px
// stroke, square caps and mitred joins, and is NEVER filled — which is why the
// whole set themes for free: it inherits ink from its label. Rationale: the kit's
// DESIGN.md.
//
// Values are the inner markup of a `<svg viewBox="0 0 24 24">`. Render with the
// wrapper below (web) or react-native-svg's `SvgXml` (native); the wrapper owns
// `stroke="currentColor"`, the stroke width, and the caps/joins, so a mark can
// never drift from the construction rules.
//
//   <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
//        stroke="currentColor" strokeWidth={iconStroke[size]}
//        strokeLinecap="square" strokeLinejoin="miter"
//        dangerouslySetInnerHTML={{ __html: icons[name] }} />

export const icons = {
  // Direction.
  'arrow-right': '<path d="M3 12h18"/><path d="M14 5l7 7-7 7"/>',
  'arrow-up-right': '<path d="M6 18L18 6"/><path d="M9 6h9v9"/>',
  'arrow-up': '<path d="M12 21V4"/><path d="M5 11l7-7 7 7"/>',
  'chevron-down': '<path d="M5 9l7 7 7-7"/>',
  'chevron-right': '<path d="M9 4l8 8-8 8"/>',
  plus: '<path d="M12 4v16"/><path d="M4 12h16"/>',
  minus: '<path d="M4 12h16"/>',
  close: '<path d="M5 5l14 14"/><path d="M19 5L5 19"/>',
  check: '<path d="M4 12.5l5 5L20 6"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',

  // Find & arrange.
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  filter: '<path d="M3 6h18"/><path d="M6 12h12"/><path d="M10 18h4"/>',
  sort: '<path d="M6 4v15"/><path d="M3 16l3 3 3-3"/><path d="M13 6h8"/><path d="M13 12h6"/><path d="M13 18h4"/>',
  more: '<path d="M4 12h1.5"/><path d="M11.25 12h1.5"/><path d="M18.5 12h1.5"/>',
  grid: '<path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>',
  table: '<path d="M3 4h18v16H3z"/><path d="M3 9h18"/><path d="M9 9v11"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  list: '<path d="M4 6h1"/><path d="M9 6h11"/><path d="M4 12h1"/><path d="M9 12h11"/><path d="M4 18h1"/><path d="M9 18h11"/>',
  expand: '<path d="M4 9V4h5"/><path d="M15 4h5v5"/><path d="M20 15v5h-5"/><path d="M9 20H4v-5"/>',
  drag: '<path d="M9 5h1"/><path d="M14 5h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M9 19h1"/><path d="M14 19h1"/>',

  // Code & data.
  code: '<path d="M9 7l-6 5 6 5"/><path d="M15 7l6 5-6 5"/>',
  terminal: '<path d="M3 4h18v16H3z"/><path d="M6.5 9l3 3-3 3"/><path d="M12.5 15h5"/>',
  branch:
    '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10"/><path d="M6 13h8a4 4 0 004-4"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M2 12h6.5"/><path d="M15.5 12H22"/>',
  merge:
    '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10"/><path d="M8 5h4a4 4 0 014 4v1"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  folder: '<path d="M3 6h6l2 3h10v12H3z"/>',
  database:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  server:
    '<path d="M3 4h18v6H3z"/><path d="M3 14h18v6H3z"/><path d="M6.5 7h1"/><path d="M6.5 17h1"/>',
  'bar-chart': '<path d="M4 21h16"/><path d="M7 18V9"/><path d="M12 18V4"/><path d="M17 18v-6"/>',

  // Ops & time.
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l4 2.5"/>',
  calendar: '<path d="M3 5h18v16H3z"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  refresh: '<path d="M20 12a8 8 0 11-3-6.2"/><path d="M21 3v4h-4"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M9 5v14"/><path d="M15 5v14"/>',
  upload: '<path d="M12 17V4"/><path d="M6 10l6-6 6 6"/><path d="M4 21h16"/>',
  download: '<path d="M12 3v13"/><path d="M6 10l6 6 6-6"/><path d="M4 21h16"/>',
  bell: '<path d="M6 9a6 6 0 1112 0v6l2 3H4l2-3z"/><path d="M10 21h4"/>',
  gauge: '<path d="M4 18a8 8 0 1116 0"/><path d="M12 18l4-6"/>',
  trend: '<path d="M3 4v17h18"/><path d="M6 16l5-6 4 4 6-8"/>',

  // Access & identity.
  lock: '<path d="M5 11h14v10H5z"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/>',
  unlock: '<path d="M5 11h14v10H5z"/><path d="M8.5 11V8a3.5 3.5 0 016.9-.9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M17 3h3v3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  'eye-off':
    '<path d="M3 3l18 18"/><path d="M7 6.9C4 8.7 2 12 2 12s4 6 10 6c2.1 0 3.9-.6 5.4-1.5"/><path d="M11 6.1h1c6 0 10 5.9 10 5.9s-1 1.5-2.7 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5"/><path d="M16 5.5a3.5 3.5 0 010 7"/><path d="M18 15c2.4.9 4 2.9 4 6"/>',
  mail: '<path d="M3 5h18v14H3z"/><path d="M3 6l9 7 9-7"/>',
  message: '<path d="M3 4h18v13H8l-5 4z"/>',

  // State & action.
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><path d="M11.5 17h1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.5v5.5"/><path d="M11.5 8h1"/>',
  failed: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/>',
  passed: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l3 3 5-6"/>',
  live: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  link: '<path d="M9 15l6-6"/><path d="M10.5 7.5l2-2a4.2 4.2 0 016 6l-2 2"/><path d="M13.5 16.5l-2 2a4.2 4.2 0 01-6-6l2-2"/>',
  external: '<path d="M14 3h7v7"/><path d="M21 3L11 13"/><path d="M19 14v6H4V5h6"/>',
  copy: '<path d="M8 8h13v13H8z"/><path d="M16 8V3H3v13h5"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
} as const;

export type IconName = keyof typeof icons;

/** Catalogue order. A picker or docs page renders the set in these six groups. */
export const iconGroups = {
  direction: [
    'arrow-right',
    'arrow-up-right',
    'arrow-up',
    'chevron-down',
    'chevron-right',
    'plus',
    'minus',
    'close',
    'check',
    'menu',
  ],
  'find-arrange': [
    'search',
    'filter',
    'sort',
    'more',
    'grid',
    'table',
    'layers',
    'list',
    'expand',
    'drag',
  ],
  'code-data': [
    'code',
    'terminal',
    'branch',
    'commit',
    'merge',
    'file',
    'folder',
    'database',
    'server',
    'bar-chart',
  ],
  'ops-time': [
    'clock',
    'calendar',
    'refresh',
    'play',
    'pause',
    'upload',
    'download',
    'bell',
    'gauge',
    'trend',
  ],
  'access-identity': [
    'lock',
    'unlock',
    'key',
    'shield',
    'eye',
    'eye-off',
    'user',
    'users',
    'mail',
    'message',
  ],
  'state-action': [
    'alert',
    'info',
    'failed',
    'passed',
    'live',
    'link',
    'external',
    'copy',
    'trash',
    'edit',
  ],
} as const satisfies Record<string, readonly IconName[]>;

/**
 * The glyph layer — drawn with the mono font, not with SVG. Use a glyph where the
 * mark annotates (a rail, a seam, a section mark); use an icon where it affords.
 * One glyph per element; never a glyph pair as decoration.
 */
export const glyphs = {
  next: '→',
  external: '↗',
  toTop: '↑',
  seam: '┼',
  railOpen: '├─',
  railClose: '─┤',
  joint: '·',
  section: '§',
  done: '✓',
  expand: '+',
  collapse: '–',
  crumb: '/',
} as const;

export type GlyphName = keyof typeof glyphs;
