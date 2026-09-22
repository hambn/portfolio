import type { Services } from './contracts.js';
import { handle as spotify } from './providers/spotify.js';
import { handle as steam } from './providers/steam.js';
import { handle as discord } from './providers/discord.js';
import { handle as linkedin } from './providers/linkedin.js';
import { handle as x } from './providers/x.js';
import { handle as telegram } from './providers/telegram.js';
import { handle as gitlab } from './providers/gitlab.js';
import { handle as github } from './providers/github.js';
import { handle as media } from './media/handler.js';
import { handle as links } from './links.js';
import { handle as contact } from './mail/contact.js';

export type Handler = (request: Request, services: Services) => Promise<Response>;
export interface Route {
  handler: Handler;
  // Methods beyond the read-only set every route answers. Only the contact
  // form accepts a body, and it says so here rather than in app.ts.
  writes?: boolean;
}

// Every path the API answers, in one place, so an unroutable path is decided
// here once and a handler never sees one.
const exact: Record<string, Route> = {
  '/links': { handler: links },
  '/contact': { handler: contact, writes: true },
  '/spotify': { handler: spotify },
  '/steam': { handler: steam },
  '/discord': { handler: discord },
  '/discord/avatar': { handler: discord },
  '/github': { handler: github },
  '/github/repos': { handler: github },
  '/github/contributions': { handler: github },
  '/gitlab': { handler: gitlab },
};

// Paths whose handler also accepts an optional image kind and trailing slash.
const patterns: [RegExp, Route][] = [
  [/^\/x(?:\/(?:avatar|banner))?\/?$/, { handler: x }],
  [/^\/telegram(?:\/avatar)?\/?$/, { handler: telegram }],
  [/^\/linkedin(?:\/(?:avatar|banner))?\/?$/, { handler: linkedin }],
  [/^\/media\/[a-z]+\/[A-Za-z0-9_-]{1,4096}$/, { handler: media }],
];

export function matchRoute(pathname: string): Route | undefined {
  if (Object.hasOwn(exact, pathname)) return exact[pathname];
  return patterns.find(([pattern]) => pattern.test(pathname))?.[1];
}

export const allowedMethods = (route: Route) =>
  route.writes ? 'GET, HEAD, POST, OPTIONS' : 'GET, HEAD, OPTIONS';
