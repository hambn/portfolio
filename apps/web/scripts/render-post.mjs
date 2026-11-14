// Build-time post renderer: Markdown in, the finished article HTML out.
//
// Everything the page used to do to a post in the browser happens here once,
// at build: parsing, syntax highlighting, the code-block chrome, heading
// anchors and table wrappers. A reader downloads the result — no parser, no
// highlighter — and the page does not rearrange itself after it paints.
// Mermaid fences are left as written; the page still draws those itself.

import { marked } from 'marked';
import { parseFragment, serialize } from 'parse5';
import hljs from 'highlight.js/lib/common';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nix from 'highlight.js/lib/languages/nix';

hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nix', nix);

const HTML = 'http://www.w3.org/1999/xhtml';

const element = (tagName, attrs = {}, childNodes = []) => {
  const node = {
    nodeName: tagName,
    tagName,
    namespaceURI: HTML,
    attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    childNodes,
    parentNode: null,
  };
  for (const child of childNodes) child.parentNode = node;
  return node;
};
const text = (value) => ({ nodeName: '#text', value, parentNode: null });

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value ?? '';
const setAttr = (node, name, value) => {
  const known = node.attrs.find((a) => a.name === name);
  if (known) known.value = value;
  else node.attrs.push({ name, value });
};
const hasClass = (node, name) => attr(node, 'class').split(/\s+/).includes(name);
const textContent = (node) =>
  node.nodeName === '#text' ? node.value : (node.childNodes || []).map(textContent).join('');

function walk(node, visit) {
  for (const child of [...(node.childNodes || [])]) {
    visit(child);
    walk(child, visit);
  }
}

/** Put `wrapper` where `node` is, with `node` as its first child. */
function wrap(node, wrapper) {
  const siblings = node.parentNode.childNodes;
  siblings[siblings.indexOf(node)] = wrapper;
  wrapper.parentNode = node.parentNode;
  wrapper.childNodes.unshift(node);
  node.parentNode = wrapper;
}

/**
 * Highlight one `<pre><code>` and give it its language label and copy button.
 * A fence that names a language the highlighter does not know stays plain; one
 * that names none is detected.
 */
function codeBlock(pre, code) {
  const source = textContent(code);
  const named = /(?:^|\s)language-([\w+#.-]+)/.exec(attr(code, 'class'))?.[1];
  let label = named;
  let result = null;
  if (!named) {
    result = hljs.highlightAuto(source);
    label = result.language;
  } else if (hljs.getLanguage(named)) {
    result = hljs.highlight(source, { language: named, ignoreIllegals: true });
  }
  if (result) {
    code.childNodes = parseFragment(result.value).childNodes;
    for (const child of code.childNodes) child.parentNode = code;
    const classes = new Set(attr(code, 'class').split(/\s+/).filter(Boolean));
    classes.add('hljs');
    if (label) classes.add(`language-${label}`);
    setAttr(code, 'class', [...classes].join(' '));
  }

  const block = element('div', { class: 'code-block' });
  wrap(pre, block);
  const extras = [];
  if (label && label !== 'undefined')
    extras.push(element('span', { class: 'code-lang' }, [text(label)]));
  extras.push(element('button', { class: 'code-copy', type: 'button' }, [text('copy')]));
  for (const extra of extras) {
    extra.parentNode = block;
    block.childNodes.push(extra);
  }
}

/** Render a post body to the HTML the post page shows. */
export function renderPost(body) {
  const root = parseFragment(marked.parse(body));
  const taken = new Set();

  walk(root, (node) => {
    const tag = node.tagName;
    if (tag === 'pre') {
      const code = node.childNodes.find((child) => child.tagName === 'code');
      if (code && !hasClass(code, 'language-mermaid') && !hasClass(node.parentNode, 'code-block'))
        codeBlock(node, code);
    } else if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      // An id and a `#` link per section heading, so a section can be linked.
      const title = textContent(node).trim();
      const base =
        title
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'section';
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      taken.add(id);
      setAttr(node, 'id', id);
      const anchor = element(
        'a',
        { class: 'heading-anchor', href: `#${id}`, 'aria-label': `link to “${title}”` },
        [text('#')],
      );
      anchor.parentNode = node;
      node.childNodes.push(anchor);
    } else if (tag === 'table' && !hasClass(node.parentNode, 'table-wrap')) {
      // Wide tables scroll sideways on a phone instead of widening the page.
      wrap(node, element('div', { class: 'table-wrap' }));
    }
  });

  return serialize(root);
}
