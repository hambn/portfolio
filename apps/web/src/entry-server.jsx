import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import Shell from './components/Shell.jsx';
import Home from './pages/home/Home.jsx';
import Projects from './pages/projects/Projects.jsx';
import Blog from './pages/blog/Blog.jsx';
import Links from './pages/links/Links.jsx';
import Resume from './pages/resume/Resume.jsx';
import { PortfolioData } from './lib/data.js';

const pages = { home: Home, projects: Projects, blog: Blog, links: Links, resume: Resume };

export function render(route, data) {
  PortfolioData.seed(data);
  const page = (route || 'home').split('/')[0];
  const Page = pages[page] || Home;
  return renderToString(
    <Shell page={page}>
      <Suspense fallback={null}>
        <Page route={route} />
      </Suspense>
    </Shell>,
  );
}
