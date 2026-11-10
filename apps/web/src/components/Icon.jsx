// Icon.jsx — the site's small line-icon set, drawn inline so an icon costs no
// request and takes its colour and size from the text around it (1em,
// currentColor). Shapes are [tag, attributes] pairs on a 24px grid.
import React from 'react';

const ICONS = {
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    [
      'path',
      {
        d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
      },
    ],
  ],
  moon: [['path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }]],
  'arrow-right': [['path', { d: 'M5 12h14M12 5l7 7-7 7' }]],
  'arrow-left': [['path', { d: 'M19 12H5M12 19l-7-7 7-7' }]],
  'arrow-up-right': [['path', { d: 'M7 17 17 7M7 7h10v10' }]],
  search: [
    ['circle', { cx: 11, cy: 11, r: 8 }],
    ['path', { d: 'm21 21-4.3-4.3' }],
  ],
  star: [
    [
      'path',
      {
        d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
        fill: 'currentColor',
      },
    ],
  ],
  x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  'git-commit': [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['path', { d: 'M3 12h6M15 12h6' }],
  ],
  collapse: [['path', { d: 'm7 20 5-5 5 5M7 4l5 5 5-5' }]],
  expand: [['path', { d: 'm7 15 5 5 5-5M7 9l5-5 5 5' }]],
  printer: [
    [
      'path',
      {
        d: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
      },
    ],
    ['rect', { x: 6, y: 14, width: 12, height: 8 }],
  ],
  globe: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    [
      'path',
      {
        d: 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
      },
    ],
  ],
  mail: [
    ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
    ['path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  ],
  file: [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8' }],
  ],
  github: [
    [
      'path',
      {
        d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
      },
    ],
    ['path', { d: 'M9 18c-4.51 2-5-2-7-2' }],
  ],
  gitlab: [
    [
      'path',
      {
        d: 'm22 13.29-3.33-10a.42.42 0 0 0-.14-.18.38.38 0 0 0-.22-.11.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18l-2.26 6.67H8.32L6.1 3.26a.42.42 0 0 0-.1-.18.38.38 0 0 0-.26-.08.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18L2 13.29a.74.74 0 0 0 .27.83L12 21l9.69-6.88a.71.71 0 0 0 .31-.83Z',
      },
    ],
  ],
  telegram: [['path', { d: 'm22 2-7 20-4-9-9-4ZM22 2 11 13' }]],
  linkedin: [
    ['path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z' }],
    ['rect', { x: 2, y: 9, width: 4, height: 12 }],
    ['circle', { cx: 4, cy: 4, r: 2 }],
  ],
  // the X mark is a solid glyph, not a line drawing
  'x-brand': [
    [
      'path',
      {
        d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
        fill: 'currentColor',
        stroke: 'none',
      },
    ],
  ],
};

/** Decorative by default: the text beside an icon carries the meaning. */
export default function Icon({ name, className }) {
  const shapes = ICONS[name];
  if (!shapes) return null;
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
