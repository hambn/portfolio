import React from 'react';
import Icon from '../../components/Icon.jsx';
import { followRoute, routeHref } from '../../lib/router.js';
import SectionHead from './SectionHead.jsx';

export const RECENT_COUNT = 3;

// The newest posts, listed the way `ls -t` would: date, then name.
export default function RecentPosts({ posts }) {
  if (!posts?.length) return null;

  const allPosts = (
    <a href={routeHref('blog')} onClick={followRoute('blog')} className="link-quiet">
      all posts
      <Icon name="arrow-right" className="icon-nudge" />
    </a>
  );

  return (
    <div className="home-section">
      <SectionHead command={`ls -t blog | head -${RECENT_COUNT}`} action={allPosts}>
        <span className="sr-only"> recent posts</span>
      </SectionHead>
      <ul className="recent-posts">
        {posts.map(({ slug, title, date }) => (
          <li key={slug}>
            <a href={routeHref(`blog/${slug}`)} onClick={followRoute(`blog/${slug}`)}>
              <time dateTime={date || undefined}>{String(date || '').slice(0, 10)}</time>
              <span>{title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
