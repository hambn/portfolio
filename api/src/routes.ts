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

export type Handler = (request: Request, services: Services) => Promise<Response | null>;

// Every path the API answers, in one place. Handlers no longer have to be
// reached by guessing a provider from the first path segment and then
// re-matching their own pathname, so an unroutable path is decided here once.
const exact: Record<string, Handler> = {
  '/links': links,
  '/spotify': spotify,
  '/steam': steam,
  '/discord': discord,
  '/discord/avatar': discord,
  '/github': github,
  '/github/repos': github,
  '/github/contributions': github,
  '/gitlab': gitlab,
};

// Paths whose handler also accepts an optional image kind and trailing slash.
const patterns: [RegExp, Handler][] = [
  [/^\/x(?:\/(?:avatar|banner))?\/?$/, x],
  [/^\/telegram(?:\/avatar)?\/?$/, telegram],
  [/^\/linkedin(?:\/(?:avatar|banner))?\/?$/, linkedin],
  [/^\/media\/[a-z]+\/[A-Za-z0-9_-]{1,4096}$/, media],
];

export function matchRoute(pathname: string): Handler | undefined {
  if (Object.hasOwn(exact, pathname)) return exact[pathname];
  return patterns.find(([pattern]) => pattern.test(pathname))?.[1];
}
