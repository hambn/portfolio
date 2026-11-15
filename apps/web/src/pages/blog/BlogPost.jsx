// BlogPost.jsx — single post view: the build's rendered HTML, plus diagrams.
import React, { useEffect, useRef, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { REPO } from '../../components/Footer.jsx';
import Icon from '../../components/Icon.jsx';
import { followRoute, routeHref } from '../../lib/router.js';
import { ClickableTag, fmtDate, goToTag } from './blog-ui.jsx';
import { EXTERNAL } from '../../lib/external.js';

// The post's HTML arrives finished from the build (scripts/render-post.mjs):
// highlighted, with its code-block chrome, heading anchors and table wrappers.
// Only diagrams are left for the browser, and only a post that has one pays
// for the library that draws them. The source stays on the page as written
// until its drawing is ready, so the block changes size once, and a diagram
// that fails to draw stays readable.
async function drawDiagrams(root) {
  const sources = [...root.querySelectorAll('pre > code.language-mermaid')];
  if (!sources.length) return;
  let mermaid;
  try {
    ({ default: mermaid } = await import('mermaid'));
  } catch (error) {
    console.warn('mermaid', error);
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark',
    securityLevel: 'strict',
    fontFamily: 'var(--font-mono)',
  });
  for (const [index, code] of sources.entries()) {
    const id = `diagram-${index}`;
    try {
      const { svg } = await mermaid.render(id, code.textContent);
      if (!code.isConnected) return;
      const diagram = document.createElement('div');
      diagram.className = 'mermaid';
      diagram.innerHTML = svg;
      code.parentElement.replaceWith(diagram);
    } catch (error) {
      console.warn('mermaid', error);
      // A failed render leaves its scratch element behind.
      document.getElementById(`d${id}`)?.remove();
    }
  }
}

// One click handler on the article serves every copy button in it.
async function copyCode(event) {
  const button = event.target instanceof Element ? event.target.closest('.code-copy') : null;
  const code = button?.parentElement.querySelector('pre > code');
  if (!code || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = 'copied';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'copy';
      button.classList.remove('copied');
    }, 1400);
  } catch {
    // Leave the button unchanged when clipboard access is denied.
  }
}

// A neighbouring post, at the foot of the one being read. `hotkey` is the key
// components/Keys.jsx presses this link for.
function PostStep({ post, hotkey, newer = false }) {
  const route = `blog/${post.slug}`;
  return (
    <a
      href={routeHref(route)}
      onClick={followRoute(route)}
      className={`post-step${newer ? ' is-newer' : ''}`}
      data-hotkey={hotkey}
    >
      <span className="post-step-label">
        {newer ? 'newer ' : <Icon name="arrow-left" />}
        {newer ? <Icon name="arrow-right" /> : ' older'}
      </span>
      <span className="post-step-title">{post.title}</span>
    </a>
  );
}

export default function PostView({ post, older, newer, onBack }) {
  const ref = useRef(null);
  const [html, setHtml] = useState(() => PortfolioData.peekPost(post.slug));
  // Opened from another page: the browser looked for the URL's fragment before
  // this post's headings existed, so go to it once they do.
  const arrivedLate = useRef(html == null);

  // A post's own page already contains its HTML; any other is one small file.
  useEffect(() => {
    if (html != null) return;
    let alive = true;
    PortfolioData.getPostHtml(post.slug)
      .then((rendered) => {
        if (alive) setHtml(rendered);
      })
      .catch(() => {
        // The slug is plain lowercase (scripts/blog-index.mjs), so it needs no
        // escaping; the Markdown copy sits beside the post's page.
        if (alive)
          setHtml(
            `<p>this post failed to load. <a href="${routeHref('blog')}${post.slug}.md">read it as markdown</a></p>`,
          );
      });
    return () => {
      alive = false;
    };
  }, [html, post.slug]);

  useEffect(() => {
    const root = ref.current;
    if (html == null || !root) return;
    drawDiagrams(root);
    if (!arrivedLate.current) return;
    let wanted = window.location.hash.slice(1);
    try {
      wanted = decodeURIComponent(wanted);
    } catch {
      // a malformed fragment matches no heading
    }
    if (wanted) root.querySelector(`[id="${CSS.escape(wanted)}"]`)?.scrollIntoView();
  }, [html]);

  return (
    <main className="blog-page">
      <button type="button" className="blog-back" onClick={onBack}>
        <Icon name="arrow-left" className="icon-nudge is-back" />
        all posts
      </button>

      <p className="post-date">
        <time dateTime={post.date || undefined}>{fmtDate(post.date)}</time>
        <span className="post-read">{post.minutes} min read</span>
      </p>
      <h1 className="post-title">{post.title}</h1>
      {post.tags.length > 0 && (
        <div className="post-tags post-header-tags">
          {post.tags.map((t) => (
            <ClickableTag key={t} onClick={() => goToTag(t)}>
              {t}
            </ClickableTag>
          ))}
        </div>
      )}

      <div
        ref={ref}
        className="markdown-body"
        onClick={copyCode}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />

      {post.path && (
        <a
          className="post-source"
          href={`${REPO}/blob/main/content/blogs/${post.path}`}
          {...EXTERNAL}
        >
          <Icon name="git-commit" />
          content/blogs/{post.path}
          <Icon name="arrow-up-right" className="icon-nudge is-out" />
        </a>
      )}

      {(older || newer) && (
        <nav className="post-steps" aria-label="more posts">
          {older ? <PostStep post={older} hotkey="[" /> : <span />}
          {newer && <PostStep post={newer} hotkey="]" newer />}
        </nav>
      )}
    </main>
  );
}
