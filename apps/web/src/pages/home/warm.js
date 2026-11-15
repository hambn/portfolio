// warm — what home draws beyond its content, fetched while another page is
// open: the avatar, at the size and density the page itself asks for.
import { PortfolioData } from '../../lib/data.js';
import { prefetchImage } from '../../lib/prefetch.js';
import { introAvatar } from './Intro.jsx';

export function warm() {
  return PortfolioData.getProfile().then((profile) => prefetchImage(introAvatar(profile)));
}
