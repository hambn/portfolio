// BlogPost.jsx — single post view: the build's rendered HTML, plus diagrams.
import React, { useEffect, useRef, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { REPO } from '../../components/Footer.jsx';
import Icon from '../../components/Icon.jsx';
import { followRoute, routeHref } from '../../lib/router.js';
import { ClickableTag, fmtDate, goToTag, readMinutes } from './blog-ui.jsx';

// The post's HTML arrives finished from the build (scripts/render-post.mjs):
// highlighted, with its code-block chrome, heading anchors and table wrappers.
// Only diagrams are left for the browser, and only a post that has one pays
// for the library that draws them.
async function drawDiagrams(root) {
  const nodes = [];
  root.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
    nodes.push(div);
  });
  if (!nodes.length) return;
  try {
    const { default: mermaid } = await import('mermaid');
    if (!root.isConnected) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark',
      securityLevel: 'strict',
      fontFamily: 'var(--font-mono)',
    });
    await mermaid.run({ nodes });
  } catch (error) {
    console.warn('mermaid', error);
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
function PostStep({ post, hotkey, label, className = '' }) {
  const route = `blog/${post.slug}`;
  return (
    <a
      href={routeHref(route)}
      onClick={followRoute(route)}
      className={`post-step ${className}`}
      data-hotkey={hotkey}
    >
      <span className="post-step-label">{label}</span>
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
        if (alive)
          setHtml(
            post.body.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
          );
      });
    return () => {
      alive = false;
    };
  }, [html, post.slug, post.body]);

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
        <span className="post-read">{readMinutes(post.body)} min read</span>
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
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="git-commit" />
          content/blogs/{post.path}
          <Icon name="arrow-up-right" className="icon-nudge is-out" />
        </a>
      )}

      {(older || newer) && (
        <nav className="post-steps" aria-label="more posts">
          {older ? <PostStep post={older} hotkey="[" label="← older" /> : <span />}
          {newer && <PostStep post={newer} hotkey="]" label="newer →" className="is-newer" />}
        </nav>
      )}
    </main>
  );
}
