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
//
// Mermaid bakes the theme's colours into what it draws, so a theme flip draws
// them again, from the source each drawing keeps. Only the latest pass over an
// article may change it, and a drawing's id is never used twice.
let drawings = 0;
const latestPass = new WeakMap();

async function drawDiagrams(root) {
  const blocks = [
    ...[...root.querySelectorAll('pre > code.language-mermaid')].map((code) => ({
      host: code.parentElement,
      source: code.textContent,
    })),
    ...[...root.querySelectorAll('.mermaid[data-source]')].map((host) => ({
      host,
      source: host.dataset.source,
    })),
  ];
  if (!blocks.length) return;
  const pass = {};
  latestPass.set(root, pass);
  let mermaid;
  try {
    ({ default: mermaid } = await import('mermaid'));
  } catch (error) {
    console.warn('mermaid', error);
    return;
  }
  // Drawn in the site's own colours rather than one of Mermaid's stock
  // themes: boxes are the page's raised surface, lines and labels its text
  // colours, and a label's backing is the panel the diagram sits on.
  const tokens = getComputedStyle(document.documentElement);
  const token = (name) => tokens.getPropertyValue(name).trim();
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const panel = light ? '#f6f8fa' : token('--background-subtle');
  mermaid.initialize({
    startOnLoad: false,
    // Flat boxes with a plain border; the default look adds a grey drop
    // shadow, which reads as a glow on a dark page.
    look: 'classic',
    // Drawn a little tighter than the defaults, so a left-to-right flow of
    // four or five steps still fits the reading column at a readable size.
    flowchart: { nodeSpacing: 36, rankSpacing: 30, padding: 10 },
    theme: 'base',
    themeVariables: {
      darkMode: !light,
      background: panel,
      primaryColor: light ? token('--background') : token('--background-muted'),
      primaryTextColor: token('--foreground'),
      primaryBorderColor: token('--border-strong'),
      secondaryColor: panel,
      tertiaryColor: panel,
      lineColor: token('--foreground-subtle'),
      textColor: token('--foreground-muted'),
      edgeLabelBackground: panel,
      clusterBkg: panel,
      clusterBorder: token('--border'),
      noteBkgColor: token('--background-muted'),
      noteTextColor: token('--foreground'),
      noteBorderColor: token('--border-strong'),
    },
    securityLevel: 'strict',
    fontFamily: 'var(--font-mono)',
  });
  for (const { host, source } of blocks) {
    const id = `diagram-${drawings++}`;
    try {
      const { svg } = await mermaid.render(id, source);
      if (latestPass.get(root) !== pass || !host.isConnected) return;
      const diagram = document.createElement('div');
      diagram.className = 'mermaid';
      diagram.dataset.source = source;
      diagram.innerHTML = svg;
      // Mermaid scales a drawing down to the column, however narrow. Its
      // natural width goes to the stylesheet, which stops the shrinking while
      // the labels are still readable and scrolls the panel instead.
      const natural = parseFloat(diagram.firstElementChild?.style.maxWidth);
      if (natural) diagram.style.setProperty('--diagram-width', `${Math.round(natural)}px`);
      host.replaceWith(diagram);
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
    if (html == null || !root) return undefined;
    drawDiagrams(root);
    const themed = new MutationObserver(() => drawDiagrams(root));
    themed.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    if (arrivedLate.current) {
      let wanted = window.location.hash.slice(1);
      try {
        wanted = decodeURIComponent(wanted);
      } catch {
        // a malformed fragment matches no heading
      }
      if (wanted) root.querySelector(`[id="${CSS.escape(wanted)}"]`)?.scrollIntoView();
    }
    return () => themed.disconnect();
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
