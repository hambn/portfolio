// Blog.jsx — fully file-driven markdown blog
//
// Posts come from contents/blogs/**.md (any depth) via PortfolioData.
// Metadata is read from each file's frontmatter; the slug is the filename
// without .md and is reflected in the route (/blog/<slug>).
//
// Features: search, tag filtering, GitHub-flavored rendering with syntax
// highlighting (highlight.js), mermaid diagrams, copy-to-clipboard, tables.
import '../../styles/blog.css';
import React from 'react';
import { useContent } from '../../hooks/useContent.js';
import { navigate } from '../../lib/router.js';
import ErrorState from '../../components/ErrorState.jsx';
import NotFound from '../../components/NotFound.jsx';
import BlogList from './BlogList.jsx';
import BlogPost from './BlogPost.jsx';

export default function Blog({ route }) {
  const { data: posts, error, retry } = useContent('blogIndex');

  // route looks like "blog" or "blog/<slug>"
  const slug = (route || 'blog').split('/').slice(1).join('/') || null;

  if (error)
    return (
      <main className="blog-page">
        <ErrorState message="failed to load posts." onRetry={retry} />
      </main>
    );
  if (!posts)
    return (
      <main className="blog-page">
        <p className="blog-status">loading...</p>
      </main>
    );

  if (slug) {
    // The index is newest first, so the post after this one is the older one.
    const at = posts.findIndex((p) => p.slug === slug);
    const post = posts[at];
    if (post)
      return (
        <BlogPost
          key={post.slug}
          post={post}
          older={posts[at + 1]}
          newer={posts[at - 1]}
          onBack={() => navigate('blog')}
        />
      );
    return <NotFound route={route} />;
  }

  return <BlogList posts={posts} />;
}
