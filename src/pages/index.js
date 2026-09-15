// Page registry — every route is a lazy chunk so the first load ships the app
// shell plus only the page being viewed. main.jsx loads the entry route before
// hydration; other routes load when opened.
import { lazy } from 'react';

const loaders = {
  home: () => import('./home/Home.jsx'),
  projects: () => import('./projects/Projects.jsx'),
  blog: () => import('./blog/Blog.jsx'),
  links: () => import('./links/Links.jsx'),
  resume: () => import('./resume/Resume.jsx'),
};

export const pages = Object.fromEntries(
  Object.entries(loaders).map(([key, load]) => [key, lazy(load)]),
);

/** Start a route chunk download now (called before hydration). */
export function preloadPage(page) {
  return loaders[page]?.();
}
