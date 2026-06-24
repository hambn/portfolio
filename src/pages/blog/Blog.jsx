// Blog.jsx — fully file-driven markdown blog
//
// Posts come from contents/blogs/**.md (any depth) via PortfolioData.
// Metadata is read from each file's frontmatter; the slug is the filename
// without .md and is reflected in the route (/blog/<slug>).
//
// Features: search, tag filtering, GitHub-flavored rendering with syntax
// highlighting (highlight.js), mermaid diagrams, copy-to-clipboard, tables.

const { useState, useEffect, useRef, useMemo } = React;

/* ── helpers ─────────────────────────────────────────────────────── */

const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  const date = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
};

const InlineCode = ({ children }) => (
  <code style={{
    background: 'var(--background-muted)', padding: '1px 6px',
    borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)',
    color: 'var(--foreground-muted)', border: '1px solid var(--border)',
  }}>{children}</code>
);

const Tag = ({ children }) => (
  <span style={{
    fontSize: 'var(--text-xs)', background: 'var(--background-muted)',
    color: 'var(--foreground-subtle)', borderRadius: 'var(--radius-sm)',
    padding: '2px 8px', border: '1px solid var(--border)', whiteSpace: 'nowrap',
  }}>{children}</span>
);

// A tag chip that navigates to the blog list filtered by that tag.
const ClickableTag = ({ children, onClick }) => {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        background: h ? 'var(--primary-subtle)' : 'var(--background-muted)',
        color: h ? 'var(--primary)' : 'var(--foreground-subtle)',
        borderRadius: 'var(--radius-sm)', padding: '2px 8px',
        border: `1px solid ${h ? 'var(--primary-ring)' : 'var(--border)'}`,
        whiteSpace: 'nowrap', transition: 'all var(--transition-base)',
      }}
    >{children}</button>
  );
};

// Jump to the blog list, filtered to a single tag (state lives in the URL).
const goToTag = (tag, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  window.navigate('blog?tag=' + encodeURIComponent(tag));
};

const readUrlTags = () =>
  (new URLSearchParams(window.location.search).get('tag') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

/* ── markdown rendering ──────────────────────────────────────────── */

function renderMarkdown(body) {
  if (window.marked?.setOptions) {
    window.marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
  }
  return window.marked ? window.marked.parse(body) : body;
}

// Post-process the rendered DOM: mermaid blocks, highlight.js, copy buttons.
function enhanceMarkdown(root) {
  if (!root) return;
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  // 1. Mermaid: <pre><code class="language-mermaid"> → <div class="mermaid">
  const mermaidNodes = [];
  root.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
    mermaidNodes.push(div);
  });

  // 2. Highlight everything else + add copy buttons
  root.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (pre.parentElement?.classList.contains('code-block')) return;

    if (window.hljs) {
      try { window.hljs.highlightElement(code); } catch (e) {}
    }

    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.type = 'button';
    btn.textContent = 'copy';
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(code.textContent).then(() => {
        btn.textContent = 'copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1400);
      });
    });
    wrap.appendChild(btn);
  });

  // 3. Wrap tables for horizontal scroll on mobile
  root.querySelectorAll('table').forEach((tbl) => {
    if (tbl.parentElement?.classList.contains('table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    tbl.replaceWith(wrap);
    wrap.appendChild(tbl);
  });

  // 4. Render mermaid diagrams — load the (heavy) mermaid lib on demand, only
  //    when a post actually contains a diagram, so other pages never fetch it.
  if (mermaidNodes.length) {
    ensureMermaid().then((mermaid) => {
      if (!mermaid) return;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'var(--font-mono)',
        });
        mermaid.run({ nodes: mermaidNodes });
      } catch (e) { console.warn('mermaid', e); }
    });
  }
}

// Self-hosted, code-split markdown libs — loaded once, only on post pages.
let _libsPromise = null;
function ensureMarkdownLibs() {
  if (!_libsPromise) {
    _libsPromise = import('./blog-libs.js')
      .then(({ marked, hljs }) => { window.marked = marked; window.hljs = hljs; return true; })
      .catch(() => false);
  }
  return _libsPromise;
}

// Lazy-load mermaid (self-hosted, code-split) once; only when a post has a diagram.
let _mermaidPromise = null;
function ensureMermaid() {
  if (!_mermaidPromise) _mermaidPromise = import('mermaid').then(m => m.default).catch(() => null);
  return _mermaidPromise;
}

/* ── post view ───────────────────────────────────────────────────── */

function PostView({ post, onBack }) {
  const ref = useRef(null);
  const [html, setHtml] = useState(null);

  // Load the markdown libs, then render the body.
  useEffect(() => {
    let alive = true;
    ensureMarkdownLibs().then(() => { if (alive) setHtml(renderMarkdown(post.body)); });
    return () => { alive = false; };
  }, [post.slug]);

  useEffect(() => { if (html != null) enhanceMarkdown(ref.current); }, [html]);

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(72px, 10vw, 88px) clamp(18px, 5vw, 24px) 80px' }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 28px',
        color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px',
      }}>← all posts</button>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-subtle)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
        {fmtDate(post.date)}
      </p>
      <h1 style={{ fontSize: 'clamp(1.6rem, 6vw, 2rem)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.2 }}>
        {post.title}
      </h1>
      {post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '36px' }}>
          {post.tags.map(t => <ClickableTag key={t} onClick={() => goToTag(t)}>{t}</ClickableTag>)}
        </div>
      )}

      <div ref={ref} className="markdown-body" dangerouslySetInnerHTML={{ __html: html || '' }} />
    </main>
  );
}

/* ── list view ───────────────────────────────────────────────────── */

const POSTS_PER_PAGE = 15;

function PostList({ posts, onOpen }) {
  const [query, setQuery]       = useState('');
  const [activeTags, setActive] = useState(readUrlTags);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage]         = useState(1);
  const filterRef               = useRef(null);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [query, activeTags]);

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
    const url = activeTags.length ? base + '?tag=' + activeTags.map(encodeURIComponent).join(',') : base;
    window.history.replaceState(window.history.state, '', url);
  }, [activeTags]);

  useEffect(() => {
    const onPop = () => setActive(readUrlTags());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const allTags = useMemo(() => {
    const counts = {};
    posts.forEach(p => p.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [posts]);

  const toggleTag = (t) =>
    setActive(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(p => {
      const tagOk = activeTags.every(t => p.tags.includes(t));
      if (!tagOk) return false;
      if (!q) return true;
      const hay = [p.title, p.description, p.tags.join(' '), p.body].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, activeTags]);

  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const pagePosts  = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(72px, 10vw, 88px) clamp(18px, 5vw, 24px) 80px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: '6px' }}>blog</h2>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>
          notes on infra, tooling, and things i figure out
        </p>
      </div>

      {/* search + filter row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: activeTags.length > 0 ? '10px' : '14px' }}>
        {/* search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--foreground-subtle)', fontSize: 'var(--text-sm)', pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="search posts..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px 10px 32px',
              background: 'var(--input)', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* tag filter button */}
        {allTags.length > 0 && (
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              style={{
                height: '100%', padding: '0 14px',
                background: activeTags.length > 0 ? 'var(--primary-subtle)' : 'var(--input)',
                color: activeTags.length > 0 ? 'var(--primary)' : 'var(--foreground-muted)',
                border: `1px solid ${activeTags.length > 0 ? 'var(--primary-ring)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                transition: 'all var(--transition-base)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <line x1="1" y1="2.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4.5" y1="9.5" x2="7.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              tags{activeTags.length > 0 ? ` · ${activeTags.length}` : ''}
            </button>

            {/* dropdown */}
            {filterOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
                background: 'var(--background-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px',
                width: '272px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
              }}>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px',
                  maxHeight: '200px', overflowY: 'auto',
                  paddingRight: '2px',
                }}>
                  {allTags.map(t => {
                    const on = activeTags.includes(t);
                    return (
                      <button key={t} onClick={() => toggleTag(t)} style={{
                        cursor: 'pointer', fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)', padding: '3px 9px',
                        borderRadius: 'var(--radius-sm)',
                        background: on ? 'var(--primary-subtle)' : 'var(--background-muted)',
                        color: on ? 'var(--primary)' : 'var(--foreground-subtle)',
                        border: `1px solid ${on ? 'var(--primary-ring)' : 'var(--border)'}`,
                        transition: 'all var(--transition-base)',
                      }}>
                        {on ? '✓ ' : ''}{t}
                      </button>
                    );
                  })}
                </div>
                {activeTags.length > 0 && (
                  <button
                    onClick={() => { setActive([]); }}
                    style={{
                      marginTop: '10px', width: '100%',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                      padding: '5px', borderRadius: 'var(--radius-sm)',
                      background: 'none', color: 'var(--foreground-muted)',
                      border: '1px solid var(--border)',
                      transition: 'all var(--transition-base)',
                    }}
                  >clear all</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* active tag pills */}
      {activeTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {activeTags.map(t => (
            <button key={t} onClick={() => toggleTag(t)} style={{
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)', padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-subtle)', color: 'var(--primary)',
              border: '1px solid var(--primary-ring)',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all var(--transition-base)',
            }}>
              {t}
              <span style={{ opacity: 0.7, fontSize: '11px', lineHeight: 1 }}>×</span>
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-faint)', margin: '0 0 18px', fontFamily: 'var(--font-mono)' }}>
        {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>

      {/* list */}
      {pagePosts.length === 0 ? (
        <p style={{ color: 'var(--foreground-subtle)', fontSize: 'var(--text-sm)', padding: '24px 0' }}>
          no posts match.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {pagePosts.map(post => (
            <div
              key={post.slug}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(post.slug)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(post.slug); } }}
              style={{
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                fontFamily: 'var(--font-mono)', padding: '18px 0',
                display: 'flex', flexDirection: 'column', gap: '7px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '14px' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--foreground)' }}>
                  {post.title}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-subtle)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {fmtDate(post.date)}
                </span>
              </div>
              {post.description && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--foreground-muted)', lineHeight: 1.55 }}>
                  {post.description}
                </span>
              )}
              {post.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                  {post.tags.map(t => (
                    <ClickableTag key={t} onClick={(e) => goToTag(t, e)}>{t}</ClickableTag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '5px', marginTop: '36px', fontFamily: 'var(--font-mono)',
        }}>
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
            disabled={page === 1}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--background-muted)', color: 'var(--foreground-muted)',
              cursor: page === 1 ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              opacity: page === 1 ? 0.35 : 1,
              transition: 'all var(--transition-base)',
            }}
          >← prev</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => { setPage(n); window.scrollTo(0, 0); }}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${n === page ? 'var(--primary-ring)' : 'var(--border)'}`,
                background: n === page ? 'var(--primary-subtle)' : 'var(--background-muted)',
                color: n === page ? 'var(--primary)' : 'var(--foreground-subtle)',
                cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                fontWeight: n === page ? 600 : 400,
                transition: 'all var(--transition-base)',
              }}
            >{n}</button>
          ))}

          <button
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
            disabled={page === totalPages}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--background-muted)', color: 'var(--foreground-muted)',
              cursor: page === totalPages ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              opacity: page === totalPages ? 0.35 : 1,
              transition: 'all var(--transition-base)',
            }}
          >next →</button>
        </div>
      )}
    </main>
  );
}

/* ── container ───────────────────────────────────────────────────── */

function Blog({ route }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // route looks like "blog" or "blog/<slug>"
  const slug = (route || 'blog').split('/').slice(1).join('/') || null;

  useEffect(() => {
    window.PortfolioData.getBlogIndex()
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const wrap = { maxWidth: '760px', margin: '0 auto', padding: '88px 24px 80px' };

  if (loading) return <main style={wrap}><p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>loading...</p></main>;
  if (error)   return <main style={wrap}><p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)' }}>failed to load posts.</p></main>;

  if (slug) {
    const post = posts.find(p => p.slug === slug);
    if (post) return <PostView post={post} onBack={() => window.navigate('blog')} />;
    return (
      <main style={wrap}>
        <button onClick={() => window.navigate('blog')} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 24px',
          color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
        }}>← all posts</button>
        <p style={{ color: 'var(--foreground-subtle)', fontSize: 'var(--text-base)' }}>
          no post found at <InlineCode>/blog/{slug}</InlineCode>
        </p>
      </main>
    );
  }

  return <PostList posts={posts} onOpen={(s) => window.navigate('blog/' + s)} />;
}

Object.assign(window, { Blog });
