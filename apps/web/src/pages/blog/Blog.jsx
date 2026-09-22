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

  if (loading)
    return (
      <main className="blog-page">
        <p className="blog-status">loading...</p>
      </main>
    );
  if (error)
    return (
      <main className="blog-page">
        <ErrorState message="failed to load posts." onRetry={() => setAttempt((a) => a + 1)} />
      </main>
    );

  if (slug) {
    const post = posts.find((p) => p.slug === slug);
    if (post) return <BlogPost key={post.slug} post={post} onBack={() => navigate('blog')} />;
    return (
      <main className="blog-page">
        <button type="button" className="blog-back" onClick={() => navigate('blog')}>
          ← all posts
        </button>
        <p className="blog-missing">
          no post found at <InlineCode>/blog/{slug}</InlineCode>
        </p>
      </main>
    );
  }

  return <BlogList posts={posts} />;
}
