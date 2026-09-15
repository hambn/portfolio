// BlogList.jsx — post list: search, tag filtering, pagination.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClickableTag, fmtDate, goToTag, readUrlTags } from './blog-ui.jsx';

const POSTS_PER_PAGE = 15;

export default function PostList({ posts, onOpen }) {
  const [query, setQuery] = useState('');
  const [activeTags, setActive] = useState(readUrlTags);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef(null);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [query, activeTags]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reflect the active tags in the URL, and react to tag links elsewhere.
  useEffect(() => {
    const base = window.location.pathname;
    const url = activeTags.length
      ? base + '?tag=' + activeTags.map(encodeURIComponent).join(',')
      : base;
    window.history.replaceState(window.history.state, '', url);
  }, [activeTags]);

  useEffect(() => {
    const onPop = () => setActive(readUrlTags());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const allTags = useMemo(() => {
    const counts = {};
    posts.forEach((p) =>
      p.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      }),
    );
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [posts]);

  const toggleTag = (t) =>
    setActive((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const tagOk = activeTags.every((t) => p.tags.includes(t));
      if (!tagOk) return false;
      if (!q) return true;
      const hay = [p.title, p.description, p.tags.join(' '), p.body].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, activeTags]);

  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const pagePosts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <main
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: 'clamp(72px, 10vw, 88px) clamp(18px, 5vw, 24px) 80px',
      }}
    >
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: '6px' }}>blog</h2>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>
          notes on infra, tooling, and things i figure out
        </p>
      </div>

      {/* search + filter row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: activeTags.length > 0 ? '10px' : '14px',
        }}
      >
        {/* search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-subtle)',
              fontSize: 'var(--text-sm)',
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search posts..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px 10px 32px',
              background: 'var(--input)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* tag filter button */}
        {allTags.length > 0 && (
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                height: '100%',
                padding: '0 14px',
                background: activeTags.length > 0 ? 'var(--primary-subtle)' : 'var(--input)',
                color: activeTags.length > 0 ? 'var(--primary)' : 'var(--foreground-muted)',
                border: `1px solid ${activeTags.length > 0 ? 'var(--primary-ring)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-base)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <line
                  x1="1"
                  y1="2.5"
                  x2="11"
                  y2="2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="2.5"
                  y1="6"
                  x2="9.5"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="4.5"
                  y1="9.5"
                  x2="7.5"
                  y2="9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              tags{activeTags.length > 0 ? ` · ${activeTags.length}` : ''}
            </button>

            {/* dropdown */}
            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 50,
                  background: 'var(--background-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px',
                  width: '272px',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '2px',
                  }}
                >
                  {allTags.map((t) => {
                    const on = activeTags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        style={{
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          padding: '3px 9px',
                          borderRadius: 'var(--radius-sm)',
                          background: on ? 'var(--primary-subtle)' : 'var(--background-muted)',
                          color: on ? 'var(--primary)' : 'var(--foreground-subtle)',
                          border: `1px solid ${on ? 'var(--primary-ring)' : 'var(--border)'}`,
                          transition: 'all var(--transition-base)',
                        }}
                      >
                        {on ? '✓ ' : ''}
                        {t}
                      </button>
                    );
                  })}
                </div>
                {activeTags.length > 0 && (
                  <button
                    onClick={() => {
                      setActive([]);
                    }}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      padding: '5px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'none',
                      color: 'var(--foreground-muted)',
                      border: '1px solid var(--border)',
                      transition: 'all var(--transition-base)',
                    }}
                  >
                    clear all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* active tag pills */}
      {activeTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {activeTags.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              style={{
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-ring)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all var(--transition-base)',
              }}
            >
              {t}
              <span style={{ opacity: 0.7, fontSize: '11px', lineHeight: 1 }}>×</span>
            </button>
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--foreground-faint)',
          margin: '0 0 18px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>

      {/* list */}
      {pagePosts.length === 0 ? (
        <p
          style={{
            color: 'var(--foreground-subtle)',
            fontSize: 'var(--text-sm)',
            padding: '24px 0',
          }}
        >
          no posts match.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {pagePosts.map((post) => (
            <div
              key={post.slug}
              className="post-row"
              style={{
                borderBottom: '1px solid var(--border)',
                padding: '18px 0',
              }}
            >
              {/* Stretched link: the whole row is clickable, and tag chips sit
                  above it instead of being nested inside an interactive element. */}
              <a
                href={'/blog/' + post.slug + '/'}
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(post.slug);
                }}
                className="post-row-link"
                style={{
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '14px',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-base)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {post.title}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--foreground-subtle)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtDate(post.date)}
                  </span>
                </div>
                {post.description && (
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--foreground-muted)',
                      lineHeight: 1.55,
                    }}
                  >
                    {post.description}
                  </span>
                )}
              </a>
              {post.tags.length > 0 && (
                <div
                  className="post-tags"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}
                >
                  {post.tags.map((t) => (
                    <ClickableTag key={t} onClick={(e) => goToTag(t, e)}>
                      {t}
                    </ClickableTag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            marginTop: '36px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <button
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              window.scrollTo(0, 0);
            }}
            disabled={page === 1}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--background-muted)',
              color: 'var(--foreground-muted)',
              cursor: page === 1 ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              opacity: page === 1 ? 0.35 : 1,
              transition: 'all var(--transition-base)',
            }}
          >
            ← prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => {
                setPage(n);
                window.scrollTo(0, 0);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${n === page ? 'var(--primary-ring)' : 'var(--border)'}`,
                background: n === page ? 'var(--primary-subtle)' : 'var(--background-muted)',
                color: n === page ? 'var(--primary)' : 'var(--foreground-subtle)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: n === page ? 600 : 400,
                transition: 'all var(--transition-base)',
              }}
            >
              {n}
            </button>
          ))}

          <button
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo(0, 0);
            }}
            disabled={page === totalPages}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--background-muted)',
              color: 'var(--foreground-muted)',
              cursor: page === totalPages ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              opacity: page === totalPages ? 0.35 : 1,
              transition: 'all var(--transition-base)',
            }}
          >
            next →
          </button>
        </div>
      )}
    </main>
  );
}
