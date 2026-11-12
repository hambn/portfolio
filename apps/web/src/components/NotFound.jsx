// NotFound.jsx — the view for a URL with no page or post behind it, written as
// the shell session that would have found that out. Styled in styles/core.css.
import React from 'react';
import { followRoute, routeHref } from '../lib/router.js';

export default function NotFound({ route }) {
  // A missing post is a missing file; anything else is a missing directory.
  const post = route.startsWith('blog/');
  const tool = post ? 'cat' : 'cd';
  const path = `~/${route}${post ? '.md' : ''}`;
  const back = post ? 'blog' : 'home';

  return (
    <main className="not-found">
      <h1 className="sr-only">not found</h1>
      <pre className="not-found-session">
        <span className="not-found-sigil">$</span> {tool} {path}
        {'\n'}
        <span className="not-found-error">
          {tool}: {path}: no such file or directory
        </span>
        {'\n'}
        <span className="not-found-sigil">$</span> echo $?{'\n'}
        404
      </pre>
      <a href={routeHref(back)} onClick={followRoute(back)} className="not-found-back">
        <span className="not-found-sigil">$</span> cd ~/{post ? 'blog' : ''}
      </a>
    </main>
  );
}
