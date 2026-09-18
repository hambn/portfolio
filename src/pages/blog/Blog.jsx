// Blog.jsx — fully file-driven markdown blog
//
// Posts come from contents/blogs/**.md (any depth) via PortfolioData.
// Metadata is read from each file's frontmatter; the slug is the filename
// without .md and is reflected in the route (/blog/<slug>).
//
// Features: search, tag filtering, GitHub-flavored rendering with syntax
// highlighting (highlight.js), mermaid diagrams, copy-to-clipboard, tables.
import '../../styles/blog.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { navigate } from '../../lib/router.js';
import ErrorState from '../../components/ErrorState.jsx';
import { InlineCode } from './blog-ui.jsx';
import BlogList from './BlogList.jsx';
import BlogPost from './BlogPost.jsx';

export default function Blog({ route }) {
  const [posts, setPosts] = useState(() => PortfolioData.peek('blogIndex') || []);
  const [loading, setLoading] = useState(() => !PortfolioData.peek('blogIndex'));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // route looks like "blog" or "blog/<slug>"
  const slug = (route || 'blog').split('/').slice(1).join('/') || null;

  useEffect(() => {
    let alive = true;
    setLoading(!PortfolioData.peek('blogIndex'));
    setError(false);
    PortfolioData.getBlogIndex()
      .then((data) => {
        if (alive) {
          setPosts(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const wrap = { maxWidth: '760px', margin: '0 auto', padding: '88px 24px 80px' };

  if (loading)
    return (
      <main style={wrap}>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>loading...</p>
      </main>
    );
  if (error)
    return (
      <main style={wrap}>
        <ErrorState message="failed to load posts." onRetry={() => setAttempt((a) => a + 1)} />
      </main>
    );

  if (slug) {
    const post = posts.find((p) => p.slug === slug);
    if (post) return <BlogPost key={post.slug} post={post} onBack={() => navigate('blog')} />;
    return (
      <main style={wrap}>
        <button
          onClick={() => navigate('blog')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 0 24px',
            color: 'var(--foreground-muted)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ← all posts
        </button>
        <p style={{ color: 'var(--foreground-subtle)', fontSize: 'var(--text-base)' }}>
          no post found at <InlineCode>/blog/{slug}</InlineCode>
        </p>
      </main>
    );
  }

  return <BlogList posts={posts} onOpen={(s) => navigate('blog/' + s)} />;
}
