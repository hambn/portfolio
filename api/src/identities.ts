import links from '../../public/contents/links/links.json' with { type: 'json' };
import { xUsername } from '../../shared/x.js';
import { telegramUsername } from '../../shared/telegram.js';
import { linkedinUsername } from '../../shared/linkedin.js';

// The single place the API reads contents/links/links.json. Providers import
// the normalized account they are pinned to rather than re-reading the file and
// re-running the shared username parsers themselves. Rebuild after editing it.
export const identities = {
  github: links.github.username,
  gitlab: links.gitlab.username,
  x: xUsername(links.x.handle || links.x.url),
  telegram: telegramUsername(links.telegram.url || links.telegram.handle),
  linkedin: linkedinUsername(links.linkedin.handle || links.linkedin.url),
} as const;
