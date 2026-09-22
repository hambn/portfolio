// Home.jsx — landing page; each section lives in its own file beside this one.
// Data: contents/home/profile.json, contents/home/resume.json, contents/links/links.json
import './home.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import FooterLinks from './FooterLinks.jsx';
import Intro from './Intro.jsx';
import Stack from './Stack.jsx';
import Timeline from './Timeline.jsx';

export default function Home() {
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));
  const [resume, setResume] = useState(() => PortfolioData.peek('resume'));
  const [links, setLinks] = useState(() => PortfolioData.peek('links'));

  useEffect(() => {
    PortfolioData.getProfile()
      .then(setProfile)
      .catch(() => {});
    PortfolioData.getResume()
      .then(setResume)
      .catch(() => {});
    PortfolioData.getLinks()
      .then(setLinks)
      .catch(() => {});
  }, []);

  return (
    <main className="home-page">
      <Intro profile={profile} />
      <Timeline resume={resume} />
      <Stack skills={resume?.skills} />
      <FooterLinks links={links} />
    </main>
  );
}
