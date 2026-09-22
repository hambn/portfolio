// BlogList.jsx — post list: search, tag filtering, pagination.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { followRoute, routeHref } from '../../lib/router.js';
import { ClickableTag, fmtDate, goToTag, readUrlTags } from './blog-ui.jsx';

const POSTS_PER_PAGE = 15;

const FilterIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M1 2.5h10M2.5 6h7M4.5 9.5h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default function PostList({ posts }) {
  const [query, setQuery] = useState('');
  const [activeTags, setActive] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef(null);

  useEffect(() => setActive(readUrlTags()), []);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [query, activeTags]);

  // Close the dropdown on an outside click, only while it is open.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

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

  // Post bodies are the whole search corpus. Lowercasing them once per post
  // list, rather than once per post per keystroke, keeps typing responsive.
  const searchIndex = useMemo(
    () =>
      new Map(
        posts.map((p) => [
          p,
          [p.title, p.description, p.tags.join(' '), p.body].join(' ').toLowerCase(),
        ]),
      ),
    [posts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const tagOk = activeTags.every((t) => p.tags.includes(t));
      if (!tagOk) return false;
      if (!q) return true;
      return searchIndex.get(p).includes(q);
    });
  }, [posts, query, activeTags, searchIndex]);

  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const pagePosts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  const goToPage = (n) => {
    setPage(n);
    window.scrollTo(0, 0);
  };

  return (
    <main className="blog-page">
      <div className="blog-head">
        <h1 className="blog-title">blog</h1>
        <p className="blog-subtitle">notes on infra, tooling, and things i figure out</p>
      </div>

      <div className={`blog-toolbar${activeTags.length ? ' is-filtered' : ''}`}>
        <div className="blog-search-field">
          <span className="blog-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search posts..."
            aria-label="search posts"
            className="blog-search"
          />
        </div>

        {allTags.length > 0 && (
          <div ref={filterRef} className="blog-filter">
            <button
              type="button"
              className={`blog-filter-toggle${activeTags.length ? ' is-on' : ''}`}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <FilterIcon />
              tags{activeTags.length > 0 ? ` · ${activeTags.length}` : ''}
            </button>

            {filterOpen && (
              <div className="blog-filter-menu">
                <div className="blog-filter-options">
                  {allTags.map((t) => {
                    const on = activeTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`blog-chip${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggleTag(t)}
                      >
                        {on ? '✓ ' : ''}
                        {t}
                      </button>
                    );
                  })}
                </div>
                {activeTags.length > 0 && (
                  <button
                    type="button"
                    className="blog-chip blog-filter-clear"
                    onClick={() => setActive([])}
                  >
                    clear all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeTags.length > 0 && (
        <div className="blog-active-tags">
          {activeTags.map((t) => (
            <button key={t} type="button" className="blog-chip is-on" onClick={() => toggleTag(t)}>
              {t}
              <span className="blog-chip-remove" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="blog-count">
        {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>

      {pagePosts.length === 0 ? (
        <p className="blog-empty">no posts match.</p>
      ) : (
        <div className="post-list">
          {pagePosts.map((post) => (
            <article key={post.slug} className="post-row">
              <a
                href={routeHref(`blog/${post.slug}`)}
                onClick={followRoute(`blog/${post.slug}`)}
                className="post-row-link"
              >
                <span className="post-row-head">
                  <span className="post-row-title">{post.title}</span>
                  <time className="post-row-date" dateTime={post.date || undefined}>
                    {fmtDate(post.date)}
                  </time>
                </span>
                {post.description && <span className="post-row-desc">{post.description}</span>}
              </a>
              {post.tags.length > 0 && (
                <div className="post-tags">
                  {post.tags.map((t) => (
                    <ClickableTag key={t} onClick={(e) => goToTag(t, e)}>
                      {t}
                    </ClickableTag>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="blog-pager" aria-label="pagination">
          <button
            type="button"
            className="blog-chip blog-pager-step"
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            ← prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`blog-chip${n === page ? ' is-on' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => goToPage(n)}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            className="blog-chip blog-pager-step"
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            next →
          </button>
        </nav>
      )}
    </main>
  );
}
