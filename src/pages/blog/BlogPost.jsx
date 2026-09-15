// BlogPost.jsx — single post view: markdown rendering + syntax highlighting.
import React, { useEffect, useRef, useState } from 'react';
import { ClickableTag, fmtDate, goToTag } from './blog-ui.jsx';

function renderMarkdown(marked, body) {
  marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
  return marked.parse(body);
}

// Post-process the rendered DOM: mermaid blocks, highlight.js, copy buttons.
function enhanceMarkdown(root, libs) {
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

    if (libs?.hljs) {
      try { libs.hljs.highlightElement(code); } catch (e) {}
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
  if (!_libsPromise) _libsPromise = import('../../lib/markdown.js').catch(() => null);
  return _libsPromise;
}

// Lazy-load mermaid (self-hosted, code-split) once; only when a post has a diagram.
let _mermaidPromise = null;
function ensureMermaid() {
  if (!_mermaidPromise) _mermaidPromise = import('mermaid').then(m => m.default).catch(() => null);
  return _mermaidPromise;
}

export default function PostView({ post, onBack }) {
  const ref = useRef(null);
  const [libs, setLibs] = useState(null);
  const [html, setHtml] = useState(null);

  // Load the markdown libs, then render the body.
  useEffect(() => {
    let alive = true;
    ensureMarkdownLibs().then((loaded) => {
      if (!alive) return;
      setLibs(loaded);
      setHtml(loaded ? renderMarkdown(loaded.marked, post.body) : post.body);
    });
    return () => { alive = false; };
  }, [post.slug]);

  useEffect(() => { if (html != null) enhanceMarkdown(ref.current, libs); }, [html, libs]);

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
