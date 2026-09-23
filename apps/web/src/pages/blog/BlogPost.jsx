// BlogPost.jsx — single post view: markdown rendering + syntax highlighting.
import React, { useEffect, useRef, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { ClickableTag, fmtDate, goToTag } from './blog-ui.jsx';

// Post-process the rendered DOM: mermaid blocks, highlight.js, copy buttons.
async function enhanceMarkdown(root) {
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
  // Start the (heavy) diagram library now rather than after the highlighter
  // has loaded; both downloads run together and are applied in order below.
  const mermaidModule = mermaidNodes.length
    ? import('mermaid').catch((error) => {
        console.warn('mermaid', error);
        return null;
      })
    : null;

  // Load the highlighter only when the post contains code.
  const codes = root.querySelectorAll('pre > code');
  const hljs = codes.length
    ? await import('../../lib/highlight.js').then((m) => m.hljs).catch(() => null)
    : null;
  if (!root.isConnected) return;

  // Highlight code and add copy buttons.
  codes.forEach((code) => {
    const pre = code.parentElement;
    if (pre.parentElement?.classList.contains('code-block')) return;

    if (hljs) {
      try {
        hljs.highlightElement(code);
      } catch (e) {}
    }

    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.type = 'button';
    btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'copy';
          btn.classList.remove('copied');
        }, 1400);
      } catch {
        // Leave the button unchanged when clipboard access is denied.
      }
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

  // 4. Render mermaid diagrams. The library is only requested when a post
  //    actually contains a diagram, so other pages never fetch it.
  if (mermaidModule) {
    void mermaidModule.then(async (module) => {
      if (!module || !root.isConnected) return;
      const mermaid = module.default;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'var(--font-mono)',
        });
        await mermaid.run({ nodes: mermaidNodes });
      } catch (e) {
        console.warn('mermaid', e);
      }
    });
  }
}

export default function PostView({ post, onBack }) {
  const ref = useRef(null);
  const [html, setHtml] = useState(() => PortfolioData.peek('postHtml')?.[post.slug] ?? null);

  // Prerendered pages already contain HTML. Only SPA navigation needs a parser.
  useEffect(() => {
    if (html != null) return;
    let alive = true;
    import('../../lib/markdown.js')
      .then(({ marked }) => {
        if (alive) setHtml(marked.parse(post.body));
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
  }, [html, post.body]);

  useEffect(() => {
    if (html != null) enhanceMarkdown(ref.current);
  }, [html]);

  return (
    <main className="blog-page">
      <button type="button" className="blog-back" onClick={onBack}>
        ← all posts
      </button>

      <time className="post-date" dateTime={post.date || undefined}>
        {fmtDate(post.date)}
      </time>
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

      <div ref={ref} className="markdown-body" dangerouslySetInnerHTML={{ __html: html || '' }} />
    </main>
  );
}
