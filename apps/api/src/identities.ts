import links from '../../../content/links/links.json' with { type: 'json' };
import projects from '../../../content/projects/projects.json' with { type: 'json' };
import type { ProjectsContent } from '@portfolio/shared/projects';
import { xUsername } from '@portfolio/shared/x';
import { telegramUsername } from '@portfolio/shared/telegram';
import { linkedinUsername } from '@portfolio/shared/linkedin';

// The single place the API reads content/. links.json names the accounts the
// cards may serve; projects.json names the repositories and accounts of the
// projects page. Providers import the normalized account they are pinned to
// rather than re-reading the file and re-running the shared username parsers
// themselves. Rebuild after editing either file.
export const identities = {
  // The contact form's whole configuration except its credentials: who receives,
  // which verified identity sends, and which vendor carries it.
  email: {
    address: links.email.address,
    from: links.email.from,
    provider: links.email.provider,
  },
  github: links.github.username,
  gitlab: links.gitlab.username,
  x: xUsername(links.x.handle || links.x.url),
  telegram: telegramUsername(links.telegram.url || links.telegram.handle),
  linkedin: linkedinUsername(links.linkedin.handle || links.linkedin.url),
} as const;

// Parsed by @portfolio/shared/projects, the same module the site renders it with.
export const projectsContent: ProjectsContent = projects;
