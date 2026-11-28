// Build-time Open Graph image generator (1200×630 PNG) using Satori + resvg-wasm.
//
// Zero native dependencies (pure WebAssembly) and self-hosted JetBrains Mono
// `.woff` files from @fontsource/jetbrains-mono, so builds are deterministic
// on Linux, macOS, Windows and Alpine Docker without network fetches.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

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

/**
 * Render a clean, full-bleed 1200×630 editorial OG card as a PNG Buffer.
 * Matches hgh.dev's Zinc + Blue + JetBrains Mono identity without box clutter.
 */
export async function renderOgImage({
  path = '',
  title,
  description,
  meta = [],
  host = 'hgh.dev',
  handle = 'hambn',
  author = 'hamed ghasempour',
  accent = '#3b82f6',
  kicker = '',
}) {
  await ensureReady();
  const headline = clampText(title, 64);
  const summary = clampText(description, 180);
  const cleanPath = String(path || '')
    .replace(/^\/+|\/+$/g, '')
    .trim();
  const footItems = meta.filter(Boolean).slice(0, 3);
  const titleSize = headline.length > 36 ? 50 : headline.length > 22 ? 58 : 66;

  const tree = el(
    'div',
    {
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#09090b',
      backgroundImage:
        'radial-gradient(circle at 92% 8%, rgba(59, 130, 246, 0.16), transparent 46%), radial-gradient(circle at 12% 96%, rgba(59, 130, 246, 0.06), transparent 40%)',
      color: '#fafafa',
      fontFamily: 'JetBrains Mono',
      padding: '64px 80px 58px',
      boxSizing: 'border-box',
    },
    [
      // Crisp full-bleed top accent hairline
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: accent,
        display: 'flex',
      }),

      // Top row: minimal domain/route breadcrumb on left, quiet kicker on right
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              fontSize: '23px',
              letterSpacing: '-0.02em',
            },
            [
              el('span', { color: '#fafafa', fontWeight: 700 }, host),
              ...(cleanPath
                ? [
                    el('span', { color: accent, fontWeight: 700, margin: '0 4px' }, '/'),
                    el('span', { color: '#a1a1aa', fontWeight: 400 }, cleanPath),
                  ]
                : []),
            ],
          ),
          kicker
            ? el(
                'div',
                {
                  fontSize: '20px',
                  color: '#a1a1aa',
                  letterSpacing: '-0.01em',
                },
                kicker,
              )
            : null,
        ].filter(Boolean),
      ),

      // Center focal block: crisp blue left rule + authoritative headline + concise summary
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: '28px',
          width: '100%',
          marginTop: '12px',
          marginBottom: '12px',
        },
        [
          el('div', {
            width: '4px',
            borderRadius: '4px',
            backgroundColor: accent,
            flexShrink: 0,
            display: 'flex',
          }),
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '20px',
              flex: 1,
            },
            [
              el(
                'div',
                {
                  fontSize: `${titleSize}px`,
                  fontWeight: 700,
                  lineHeight: 1.12,
                  letterSpacing: '-0.035em',
                  color: '#fafafa',
                },
                headline,
              ),
              summary
                ? el(
                    'div',
                    {
                      fontSize: '24px',
                      fontWeight: 400,
                      lineHeight: 1.52,
                      letterSpacing: '-0.01em',
                      color: '#a1a1aa',
                      maxWidth: '940px',
                    },
                    summary,
                  )
                : null,
            ].filter(Boolean),
          ),
        ],
      ),

      // Bottom anchor: hairline divider, author + @handle left, typographic metadata right
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: '28px',
          borderTop: '1px solid #27272a',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '21px',
            },
            [
              el('span', { color: '#e4e4e7', fontWeight: 700 }, author),
              el('span', { color: '#52525b' }, '/'),
              el('span', { color: accent, fontWeight: 700 }, `@${handle}`),
            ],
          ),
          footItems.length
            ? el(
                'div',
                {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '19px',
                  color: '#71717a',
                },
                footItems.flatMap((item, idx) =>
                  idx === 0
                    ? [el('span', {}, item)]
                    : [el('span', { color: '#3f3f46' }, '·'), el('span', {}, item)],
                ),
              )
            : null,
        ].filter(Boolean),
      ),
    ],
  );

  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return Buffer.from(png);
}
