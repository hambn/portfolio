// Keys.jsx — keyboard navigation, and the footer button and panel that list it.
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router.js';
import { toggleTheme } from './Nav.jsx';

const Palette = lazy(() => import('./Palette.jsx'));
const Terminal = lazy(() => import('./Terminal.jsx'));

// `g` then a letter opens a page, the way vim and most consoles do it.
const GO = { h: 'home', p: 'projects', b: 'blog', l: 'links', r: 'resume' };
const GO_WINDOW = 1200; // ms the `g` prefix stays armed

const ROWS = [
  ...Object.entries(GO).map(([key, page]) => ({ keys: ['g', key], label: page })),
  { keys: ['ctrl', 'k'], label: 'command palette' },
  { keys: ['`'], label: 'interactive shell' },
  { keys: ['j', 'k'], label: 'next / previous row' },
  { keys: ['/'], label: 'search posts / repos' },
  { keys: ['[', ']'], label: 'older / newer post' },
  { keys: ['t'], label: 'toggle theme' },
  { keys: ['?'], label: 'this list' },
];

// What `j` and `k` step through: the rows of a list, on whichever page has one.
const ROWS_OF_A_PAGE = '.post-row-link, .project-card-name a, .recent-posts a';

/** Move focus `by` rows down the page's list; Enter then opens the row. */
function stepRow(by) {
  const rows = [...document.querySelectorAll(ROWS_OF_A_PAGE)];
  if (!rows.length) return;
  const at = rows.indexOf(document.activeElement);
  const next =
    at < 0 ? (by > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + by));
  rows[next].focus({ preventScroll: true });
  rows[next].scrollIntoView({ block: 'center' });
}

const typing = (el) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    Boolean(el.closest('.term-window')));

/** Focus the active page's search field, or open the blog search. */
function focusSearch() {
  const local = document.querySelector('.blog-search, .projects-search');
  if (local) {
    local.focus();
    return;
  }
  let tries = 0;
  const find = () => {
    const field = document.querySelector('.blog-search');
    if (field) field.focus();
    else if (tries++ < 40) window.requestAnimationFrame(find);
  };
  navigate('blog');
  find();
}

export default function Keys() {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  // 'closed' | 'open' | 'minimized' — pressing ` while minimized restores the session.
  const [termState, setTermState] = useState('closed');
  const wrapRef = useRef(null);

  useEffect(() => {
    // When `g` was pressed. Never, to begin with: a timestamp counts from the
    // page load, so 0 would arm the chord for the first moments of a visit.
    let armed = -Infinity;
    const onKey = (event) => {
      if (event.defaultPrevented || event.altKey) return undefined;
      // The palette opens from anywhere, a field being typed in included.
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() !== 'k' || event.shiftKey) return undefined;
        event.preventDefault();
        setOpen(false);
        setTermState((cur) => (cur === 'open' ? 'minimized' : cur));
        return setPalette((was) => !was);
      }
      if (event.key === 'Escape') {
        setPalette(false);
        return setOpen(false);
      }
      if (typing(event.target)) return undefined;

      const key = event.key.toLowerCase();
      const page = GO[key];
      if (page && event.timeStamp - armed < GO_WINDOW) {
        armed = -Infinity;
        setOpen(false);
        return navigate(page);
      }
      armed = key === 'g' ? event.timeStamp : -Infinity;

      if (event.key === '?') setOpen((was) => !was);
      else if (event.key === '`') {
        event.preventDefault();
        setOpen(false);
        setPalette(false);
        setTermState((cur) => (cur === 'open' ? 'minimized' : 'open'));
      } else if (event.key === ':') {
        // otherwise the colon is typed into the palette it opens
        event.preventDefault();
        setOpen(false);
        setPalette(true);
      } else if (key === 't') toggleTheme();
      else if (key === 'j') stepRow(1);
      else if (key === 'k') stepRow(-1);
      // a link that names this key as its hotkey (the post steps in BlogPost)
      else if (key === '[' || key === ']')
        document.querySelector(`a[data-hotkey="${key}"]`)?.click();
      else if (key === '/') {
        // otherwise the slash is typed into the field it focuses
        event.preventDefault();
        setOpen(false);
        focusSearch();
      }
      return undefined;
    };
    const onPalette = () => {
      setOpen(false);
      setPalette((was) => !was);
    };
    const onTerminal = () => {
      setOpen(false);
      setPalette(false);
      setTermState((cur) => (cur === 'open' ? 'minimized' : 'open'));
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('portfolio:palette', onPalette);
    window.addEventListener('portfolio:terminal', onTerminal);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('portfolio:palette', onPalette);
      window.removeEventListener('portfolio:terminal', onTerminal);
    };
  }, []);

  // An open panel closes on a press anywhere outside it.
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="keys" ref={wrapRef}>
      <button
        type="button"
        className="keys-hint"
        aria-expanded={open}
        aria-controls="keys-panel"
        onClick={() => setOpen((was) => !was)}
      >
        <kbd>?</kbd> keys
      </button>
      {open && (
        <div className="keys-panel" id="keys-panel" role="group" aria-label="keyboard shortcuts">
          <dl>
            {ROWS.map(({ keys, label }) => (
              <div key={label}>
                <dt>
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {palette && (
        <Suspense fallback={null}>
          <Palette go={GO} onClose={() => setPalette(false)} />
        </Suspense>
      )}
      {termState !== 'closed' && (
        <Suspense fallback={null}>
          <Terminal
            minimized={termState === 'minimized'}
            onMinimize={() => setTermState('minimized')}
            onRestore={() => setTermState('open')}
            onClose={() => setTermState('closed')}
          />
        </Suspense>
      )}
    </div>
  );
}
