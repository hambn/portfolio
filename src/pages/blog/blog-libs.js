// Markdown rendering libs, self-hosted and code-split. Dynamically imported by
// Blog.jsx so they ship as a separate chunk loaded only on blog post pages —
// no third-party CDN, and other pages never download them.
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nix from 'highlight.js/lib/languages/nix';

hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nix', nix);

export { marked, hljs };
