// Keys.jsx — keyboard navigation, and the footer button and panel that list it.
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router.js';
import { toggleTheme } from './Nav.jsx';

const Palette = lazy(() => import('./Palette.jsx'));

// `g` then a letter opens a page, the way vim and most consoles do it.
const GO = { h: 'home', p: 'projects', b: 'blog', l: 'links', r: 'resume' };
const GO_WINDOW = 1200; // ms the `g` prefix stays armed

const ROWS = [
  ...Object.entries(GO).map(([key, page]) => ({ keys: ['g', key], label: page })),
  { keys: ['ctrl', 'k'], label: 'command palette' },
  { keys: ['j', 'k'], label: 'next / previous row' },
  { keys: ['/'], label: 'search posts' },
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
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Focus the blog search, opening the blog first when it is not on screen. */
function focusSearch() {
  let tries = 0;
  const find = () => {
    const field = document.querySelector('.blog-search');
    if (field) field.focus();
    else if (tries++ < 40) window.requestAnimationFrame(find);
  };
  if (!document.querySelector('.blog-search')) navigate('blog');
  find();
}

export default function Keys() {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let armed = 0; // when `g` was pressed
    const onKey = (event) => {
      if (event.defaultPrevented || event.altKey) return undefined;
      // The palette opens from anywhere, a field being typed in included.
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() !== 'k' || event.shiftKey) return undefined;
        event.preventDefault();
        setOpen(false);
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
        armed = 0;
        setOpen(false);
        return navigate(page);
      }
      armed = key === 'g' ? event.timeStamp : 0;

      if (event.key === '?') setOpen((was) => !was);
      else if (event.key === ':') {
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
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
        <div className="keys-panel" id="keys-panel" role="dialog" aria-label="keyboard shortcuts">
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
    </div>
  );
}
