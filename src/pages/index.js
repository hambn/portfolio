// Page registry — the router renders the entry matching the current route.
import Home from './home/Home.jsx';
import Projects from './projects/Projects.jsx';
import Blog from './blog/Blog.jsx';
import Links from './links/Links.jsx';
import Resume from './resume/Resume.jsx';

export const pages = {
  home: Home,
  projects: Projects,
  blog: Blog,
  links: Links,
  resume: Resume,
};
