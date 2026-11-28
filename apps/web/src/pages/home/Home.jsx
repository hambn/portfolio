// Home.jsx — landing page; each section lives in its own file beside this one.
// Data: contents/home/profile.json, contents/home/resume.json, contents/links/links.json,
// and the newest posts from the blog index.
import './home.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { useContent } from '../../hooks/useContent.js';
import Intro from './Intro.jsx';
import RecentPosts, { RECENT_COUNT } from './RecentPosts.jsx';
import Stack from './Stack.jsx';
import Timeline from './Timeline.jsx';

// Fetches the avatar ahead of a visit; called by warmPages().
export { warm } from './warm.js';

export default function Home() {
  const { data: profile } = useContent('profile');
  const { data: resume } = useContent('resume');
  // The prerendered page carries just the newest posts; without them (dev, or
  // a page opened by navigation) they come from the blog index.
  const [recent, setRecent] = useState(
    () =>
      PortfolioData.peek('recentPosts') ||
      PortfolioData.peek('blogIndex')?.slice(0, RECENT_COUNT) ||
      null,
  );
  const [blogTags, setBlogTags] = useState(
    () =>
      PortfolioData.peek('blogTags') ||
      PortfolioData.peek('blogIndex')?.flatMap((p) => p.tags || []) ||
      null,
  );

  useEffect(() => {
    if (recent && blogTags) return undefined;
    let alive = true;
    PortfolioData.getBlogIndex()
      .then((posts) => {
        if (!alive) return;
        setRecent((cur) => cur || posts.slice(0, RECENT_COUNT));
        setBlogTags((cur) => cur || [...new Set(posts.flatMap((p) => p.tags || []))]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recent, blogTags]);

  return (
    <main className="home-page">
      <Intro profile={profile} />
      <Timeline resume={resume} />
      <RecentPosts posts={recent} />
      <Stack skills={resume?.skills} blogTags={blogTags} />
    </main>
  );
}
