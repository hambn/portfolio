// Build-time Open Graph image generator (1200×630 PNG) using Satori + resvg-wasm.
//
// Zero native dependencies (pure WebAssembly) and self-hosted JetBrains Mono
// `.woff` files from @fontsource/jetbrains-mono, so builds are deterministic
// on Linux, macOS, Windows and Alpine Docker without network fetches.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { BRAND_ICON } from '../src/pages/links/brandIcons.js';

const require = createRequire(import.meta.url);

let ready;
let fonts;

async function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
    await initWasm(readFileSync(wasmPath));
    const regular = readFileSync(
      require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'),
    );
    const bold = readFileSync(
      require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff'),
    );
    fonts = [
      { name: 'JetBrains Mono', data: regular, weight: 400, style: 'normal' },
      { name: 'JetBrains Mono', data: bold, weight: 700, style: 'normal' },
    ];
  })();
  return ready;
}

const el = (type, style, children, extra = {}) => ({
  type,
  props: {
    ...extra,
    style,
    ...(children !== undefined ? { children } : {}),
  },
});

const clampText = (text, max) => {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const trimmed = lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${trimmed.trimEnd()}…`;
};

// Platform × Portfolio hybrid surfaces: each service card carries its own
// authentic palette blended with hgh.dev's crisp dark terminal geometry.
const SERVICE_THEMES = {
  sp: {
    outer: '#0a0f0c',
    surface: '#121814',
    headerBg: '#16231b',
    border: '#213629',
    pillBg: '#16231b',
    accent: '#1ed760',
    motif: 'bars',
  },
  dc: {
    outer: '#111218',
    surface: '#1b1d24',
    headerBg: '#20222b',
    border: '#2f3240',
    pillBg: '#232632',
    accent: '#5865f2',
  },
  gh: {
    outer: '#080b10',
    surface: '#0d1117',
    headerBg: '#141a22',
    border: '#262e39',
    pillBg: '#161b22',
    accent: '#58a6ff',
    motif: 'contrib',
  },
  gl: {
    outer: '#110d18',
    surface: '#171321',
    headerBg: '#1e182b',
    border: '#312744',
    pillBg: '#20192e',
    accent: '#fc6d26',
  },
  tg: {
    outer: '#0b1219',
    surface: '#131d27',
    headerBg: '#172330',
    border: '#233547',
    pillBg: '#182534',
    accent: '#2aabee',
  },
  x: {
    outer: '#050506',
    surface: '#0c0d10',
    headerBg: '#121317',
    border: '#2a2d32',
    pillBg: '#15171b',
    accent: '#fafafa',
  },
  li: {
    outer: '#0c1014',
    surface: '#161b20',
    headerBg: '#1b2229',
    border: '#2a343f',
    pillBg: '#1c242c',
    accent: '#71b7fb',
  },
  st: {
    outer: '#0e141c',
    surface: '#171f2a',
    headerBg: '#1c2938',
    border: '#2b4057',
    pillBg: '#1c2a3a',
    accent: '#66c0f4',
  },
  email: {
    outer: '#0b0a0c',
    surface: '#121114',
    headerBg: '#1a1517',
    border: '#2e2427',
    pillBg: '#1c1719',
    accent: '#ea4335',
  },
};

const DEFAULT_THEME = {
  outer: '#09090b',
  surface: '#0d0d10',
  headerBg: '#111115',
  border: '#27272a',
  pillBg: '#18181b',
  accent: '#3b82f6',
};

function renderMotif(motif, accent) {
  if (motif === 'bars') {
    const heights = [14, 24, 18, 28, 16];
    return el(
      'div',
      { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '28px' },
      heights.map((h) =>
        el('div', {
          width: '4px',
          height: `${h}px`,
          borderRadius: '2px',
          backgroundColor: accent,
        }),
      ),
    );
  }
  if (motif === 'contrib') {
    const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
    return el(
      'div',
      { display: 'flex', alignItems: 'center', gap: '5px' },
      colors.map((c) =>
        el('div', {
          width: '12px',
          height: '12px',
          borderRadius: '3px',
          backgroundColor: c,
        }),
      ),
    );
  }
  return null;
}

function brandGlyph(cardId, accent) {
  const path = cardId && BRAND_ICON[cardId];
  if (!path) return null;
  return el(
    'div',
    {
      width: '58px',
      height: '58px',
      borderRadius: '14px',
      backgroundColor: '#09090b',
      border: `1px solid ${accent}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    [
      {
        type: 'svg',
        props: {
          width: 30,
          height: 30,
          viewBox: '0 0 24 24',
          fill: accent,
          children: [{ type: 'path', props: { d: path } }],
        },
      },
    ],
  );
}

/**
 * Render a 1200×630 terminal-editorial OG card as a PNG Buffer.
 * Pass `cardId` (`sp`, `dc`, `gh`, `gl`, `tg`, `x`, `li`, `st`, `email`) for
 * a platform × portfolio hybrid surface with the brand's own colors & mark.
 */
export async function renderOgImage({
  path,
  title,
  description,
  meta = [],
  host,
  handle,
  accent,
  cardId = '',
  badge = '',
}) {
  await ensureReady();
  const base = SERVICE_THEMES[cardId] || DEFAULT_THEME;
  const theme = accent ? { ...base, accent } : base;
  const prompt = path ? `~/${path}` : `~/../${handle || 'hambn'}`;
  const headline = clampText(title, 68);
  const summary = clampText(description, 195);
  const pills = meta.filter(Boolean).slice(0, 4);
  const glyph = brandGlyph(cardId, theme.accent);
  const motif = renderMotif(theme.motif, theme.accent);

  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      backgroundColor: theme.outer,
      color: '#fafafa',
      fontFamily: 'JetBrains Mono',
      padding: '24px',
      boxSizing: 'border-box',
    },
    [
      el(
        'div',
        {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '18px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        },
        [
          // Top brand/route accent bar
          el('div', {
            width: '100%',
            height: '4px',
            backgroundColor: theme.accent,
            display: 'flex',
          }),
          // Terminal-style header bar in subtle tinted surface
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.headerBg,
              borderBottom: `1px solid ${theme.border}`,
              padding: '20px 44px',
              fontSize: '21px',
            },
            [
              el('div', { display: 'flex', alignItems: 'center', gap: '12px' }, [
                el('span', { color: theme.accent, fontWeight: 700 }, '$'),
                el('span', { color: '#d4d4d8' }, prompt),
              ]),
              el(
                'div',
                { display: 'flex', alignItems: 'center', gap: '14px' },
                [
                  motif,
                  badge
                    ? el(
                        'span',
                        {
                          fontSize: '15px',
                          fontWeight: 700,
                          color: theme.accent,
                          backgroundColor: theme.outer,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          padding: '3px 10px',
                        },
                        badge,
                      )
                    : null,
                  el('span', { color: '#93939d', fontSize: '20px' }, host || 'hgh.dev'),
                ].filter(Boolean),
              ),
            ],
          ),
          // Center body: brand mark (for service cards) + headline + summary
          el(
            'div',
            {
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '22px',
              padding: '32px 44px',
              boxSizing: 'border-box',
            },
            [
              el(
                'div',
                { display: 'flex', alignItems: 'center', gap: '20px' },
                [
                  glyph,
                  el(
                    'div',
                    {
                      fontSize: headline.length > 40 ? '42px' : '52px',
                      fontWeight: 700,
                      lineHeight: 1.18,
                      letterSpacing: '-0.03em',
                      color: '#fafafa',
                    },
                    headline,
                  ),
                ].filter(Boolean),
              ),
              summary
                ? el(
                    'div',
                    {
                      fontSize: '22px',
                      fontWeight: 400,
                      lineHeight: 1.55,
                      color: '#b4b4bd',
                    },
                    summary,
                  )
                : null,
            ].filter(Boolean),
          ),
          // Footer metadata & handle
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid ${theme.border}`,
              padding: '20px 44px',
              backgroundColor: theme.headerBg,
            },
            [
              el(
                'div',
                { display: 'flex', alignItems: 'center', gap: '10px' },
                pills.length
                  ? pills.map((label) =>
                      el(
                        'span',
                        {
                          fontSize: '17px',
                          color: '#d4d4d8',
                          backgroundColor: theme.pillBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          padding: '6px 14px',
                        },
                        label,
                      ),
                    )
                  : [
                      el(
                        'span',
                        { fontSize: '19px', color: theme.accent, fontWeight: 700 },
                        `@${handle || 'hambn'}`,
                      ),
                    ],
              ),
              el(
                'div',
                {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '18px',
                  color: '#a1a1aa',
                },
                [
                  el('span', {
                    width: '10px',
                    height: '10px',
                    borderRadius: '9999px',
                    backgroundColor: theme.accent,
                  }),
                  el('span', {}, handle ? `${handle} · ${host || 'hgh.dev'}` : host || 'hgh.dev'),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );

  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return Buffer.from(png);
}
