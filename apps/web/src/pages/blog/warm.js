// warm — the newest posts' rendered HTML, fetched while another page is open,
// so opening one from home or the blog list shows it at once.
//
// Each post is one small file (a few KB). The count is capped so a growing
// blog does not turn this into a large download; older posts still load when
// their link is pointed at (App.jsx). Mermaid, for posts with a diagram, is
// left to load when such a post is opened: it is far larger than any post.
import { PortfolioData } from '../../lib/data.js';

const POSTS = 10;

export function warm() {
  return PortfolioData.getBlogIndex().then((posts) =>
    Promise.all(
      [...posts]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, POSTS)
        .map((post) => PortfolioData.getPostHtml(post.slug).catch(() => {})),
    ),
  );
}
