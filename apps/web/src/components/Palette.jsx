// Palette.jsx — the command palette (ctrl/cmd+k or `:`): type to find a page,
// a post or an action, Enter to run it. Loaded by Keys.jsx the first time it
// is opened, with its styles, so no other visit pays for it.
import './palette.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../hooks/useContent.js';
import { PortfolioData } from '../lib/data.js';
import { feedHref, navigate } from '../lib/router.js';
import { REPO } from './Footer.jsx';
import { toggleTheme } from './Nav.jsx';

export default function Palette({ go, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { data: posts } = useContent('blogIndex');
  const listRef = useRef(null);
  const pointer = useRef({ x: -1, y: -1 });

  // Closing hands focus back to whatever had it, unless a command moved it.
  useEffect(() => {
    const before = document.activeElement;
    return () => {
      if (document.activeElement === document.body && before instanceof HTMLElement)
        before.focus({ preventScroll: true });
    };
  }, []);

  const items = useMemo(() => {
    const links = PortfolioData.peek('links');
    const projects = PortfolioData.peek('projects');
    const email = links?.email?.address;
    const raw = [
      ...Object.entries(go).map(([key, page]) => ({
        id: `page-${page}`,
        kind: 'page',
        label: page,
        hint: `g ${key}`,
        run: () => navigate(page),
      })),
      ...(posts || []).map((post) => ({
        id: `post-${post.slug}`,
        kind: 'post',
        label: post.title,
        more: post.tags.join(' '),
        run: () => navigate(`blog/${post.slug}`),
      })),
      ...(projects?.featured || [])
        .filter((entry) => entry?.repo || entry?.url)
        .map((entry, idx) => {
          const name = entry.name || entry.repo?.split('/').pop() || `project-${idx}`;
          const target = entry.repo || entry.url;
          return {
            id: `proj-${name}`,
            kind: 'repo',
            label: name,
            more: entry.description || '',
            run: () => window.open(target, '_blank', 'noopener'),
          };
        }),
      {
        id: 'terminal',
        kind: 'action',
        label: 'open interactive shell',
        more: 'terminal cli bash sh',
        hint: '`',
        run: () => window.dispatchEvent(new CustomEvent('portfolio:terminal')),
      },
      { id: 'theme', kind: 'action', label: 'toggle theme', hint: 't', run: toggleTheme },
      ...(email
        ? [
            {
              id: 'copy-email',
              kind: 'action',
              label: `copy ${email}`,
              more: 'email contact address',
              run: () => navigator.clipboard?.writeText(email).catch(() => {}),
            },
          ]
        : []),
      {
        id: 'feed',
        kind: 'link',
        label: 'rss feed',
        run: () => window.open(feedHref(), '_blank', 'noopener'),
      },
      {
        id: 'source',
        kind: 'link',
        label: 'source on github',
        run: () => window.open(REPO, '_blank', 'noopener'),
      },
    ];
    return raw.map((item) => ({
      ...item,
      search: `${item.kind} ${item.label} ${item.more || ''}`.toLowerCase(),
    }));
  }, [go, posts]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((item) => words.every((word) => item.search.includes(word)));
  }, [items, query]);
  const at = Math.min(active, shown.length - 1);

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [at, shown]);

  const run = (item) => {
    onClose();
    item?.run();
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const by = event.key === 'ArrowDown' ? 1 : -1;
      const count = shown.length;
      if (count) setActive((was) => (Math.min(was, count - 1) + by + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(shown[at]);
    } else if (event.key === 'Escape') {
      // Keys.jsx would close it as well; this keeps the key from going further.
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      // The field is the dialog's only stop; the rows are reached with the
      // arrows, so Tab stays here instead of leaving for the page behind.
      event.preventDefault();
    }
  };

  return (
    <div
      className="palette-backdrop"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="command palette">
        <label className="palette-field">
          <span className="palette-sigil" aria-hidden="true">
            &gt;
          </span>
          <input
            autoFocus
            className="palette-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="go to a page, a post, or run a command"
            aria-label="command"
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls="palette-list"
            aria-activedescendant={shown[at] ? `palette-${shown[at].id}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd>esc</kbd>
        </label>
        {shown.length ? (
          <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
            {shown.map((item, i) => (
              <li
                key={item.id}
                id={`palette-${item.id}`}
                role="option"
                aria-selected={i === at}
                className={`palette-item${i === at ? ' is-active' : ''}`}
                onPointerMove={(event) => {
                  if (event.clientX === pointer.current.x && event.clientY === pointer.current.y)
                    return;
                  pointer.current = { x: event.clientX, y: event.clientY };
                  setActive(i);
                }}
                onClick={() => run(item)}
              >
                <span className="palette-kind">{item.kind}</span>
                <span className="palette-label">{item.label}</span>
                {item.hint && <span className="palette-hint">{item.hint}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="palette-empty">nothing matches “{query}”.</p>
        )}
      </div>
    </div>
  );
}
