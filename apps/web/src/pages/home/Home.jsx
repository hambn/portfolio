// Home.jsx — landing page; each section lives in its own file beside this one.
// Data: contents/home/profile.json, contents/home/resume.json, contents/links/links.json,
// and the newest posts from the blog index.
import './home.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { useContent } from '../../hooks/useContent.js';
import FooterLinks from './FooterLinks.jsx';
import Intro from './Intro.jsx';
import RecentPosts, { RECENT_COUNT } from './RecentPosts.jsx';
import Stack from './Stack.jsx';
import Timeline from './Timeline.jsx';

export default function Home() {
  const { data: profile } = useContent('profile');
  const { data: resume } = useContent('resume');
  const { data: links } = useContent('links');
  // The prerendered page carries just the newest posts; without them (dev, or
  // a page opened by navigation) they come from the blog index.
  const [recent, setRecent] = useState(
    () =>
      PortfolioData.peek('recentPosts') ||
      PortfolioData.peek('blogIndex')?.slice(0, RECENT_COUNT) ||
      null,
  );

  useEffect(() => {
    if (recent) return undefined;
    let alive = true;
    PortfolioData.getBlogIndex()
      .then((posts) => {
        if (alive) setRecent(posts.slice(0, RECENT_COUNT));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recent]);

  return (
    <main className="home-page">
      <Intro profile={profile} />
      <Timeline resume={resume} />
      <RecentPosts posts={recent} />
      <Stack skills={resume?.skills} />
      <FooterLinks links={links} />
    </main>
  );
}
