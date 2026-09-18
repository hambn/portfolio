import hljs from 'highlight.js/lib/common';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nix from 'highlight.js/lib/languages/nix';

hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nix', nix);

export { hljs };
