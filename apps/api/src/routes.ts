import type { Services } from './contracts.js';
import { handle as spotify } from './providers/spotify.js';
import { handle as steam } from './providers/steam.js';
import { handle as discord } from './providers/discord.js';
import { handle as linkedin } from './providers/linkedin.js';
import { handle as x } from './providers/x.js';
import { handle as telegram } from './providers/telegram.js';
import { handle as gitlab } from './providers/gitlab.js';
import { handle as github } from './providers/github.js';
import { handle as projects } from './providers/projects.js';
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
  '/site': { handler: links },
  '/links': { handler: links },
  '/contact': { handler: contact, writes: true },
  '/spotify': { handler: spotify },
  '/steam': { handler: steam },
  '/discord': { handler: discord },
  '/discord/avatar': { handler: discord },
  '/github': { handler: github },
  '/github/contributions': { handler: github },
  '/github/repos': { handler: github },
  '/gitlab': { handler: gitlab },
  '/gitlab/contributions': { handler: gitlab },
  '/projects': { handler: projects },
};

// Paths whose handler also accepts an optional image kind and trailing slash.
const patterns: [RegExp, Route][] = [
  [/^\/x(?:\/(?:avatar|banner))?\/?$/, { handler: x }],
  [/^\/telegram(?:\/avatar)?\/?$/, { handler: telegram }],
  [/^\/linkedin(?:\/(?:avatar|banner))?\/?$/, { handler: linkedin }],
  [/^\/media\/[a-z]+\/[A-Za-z0-9_-]{1,4096}$/, { handler: media }],
];

/**
 * What each route answers and the query options it takes, for the index at
 * `/`. A route added to the tables above is listed there even without an entry
 * here; this only adds the description.
 */
const about: Record<string, { about: string; query?: Record<string, string> }> = {
  '/site': {
    about: 'Every card and the projects listing in one response.',
    query: { include: 'comma-separated card keys to answer', exclude: 'card keys to leave out' },
  },
  '/links': { about: 'Older name of /site.' },
  '/contact': { about: 'GET mints a form token; POST sends one message.' },
  '/spotify': {
    about: 'Spotify library and playback.',
    query: { playback: '1 for playback only' },
  },
  '/steam': { about: 'Steam profile, level and recent games.' },
  '/discord': { about: 'Discord profile and presence.' },
  '/discord/avatar': { about: 'Discord avatar image.' },
  '/discord/socket': { about: 'WebSocket relay of live Discord presence.' },
  '/github': { about: 'GitHub profile: stars, languages, pull requests, profile page extras.' },
  '/github/contributions': {
    about: 'GitHub contribution calendar.',
    query: { year: 'a calendar year, e.g. 2025; default is the last 12 months' },
  },
  '/github/repos': {
    about: 'Public GitHub repositories.',
    query: {
      sort: 'interest (default), stars, pushed or name',
      limit: '1 to 100',
      forks: '0 to leave forks out',
      archived: '0 to leave archived repositories out',
      language: 'keep one language',
    },
  },
  '/gitlab': { about: 'GitLab profile.' },
  '/gitlab/contributions': { about: 'GitLab activity calendar for the last 12 months.' },
  '/projects': {
    about: 'Featured projects and every public repository per git host.',
    query: { host: 'comma-separated hosts to list: github, codeberg, gitlab' },
  },
  '/x': { about: 'X profile; /x/avatar and /x/banner are its images.' },
  '/telegram': { about: 'Telegram profile; /telegram/avatar is its image.' },
  '/linkedin': { about: 'LinkedIn profile; /linkedin/avatar and /linkedin/banner are its images.' },
  '/media/<provider>/<asset>': { about: 'Allowlisted raster image proxy.' },
};

/** Every exact path, for the index at `/`. */
export const routePaths = () => Object.keys(exact);

/** Every route with what it answers, for the index at `/`. */
export const routeIndex = (prefix: string) =>
  [...new Set([...Object.keys(exact), ...Object.keys(about)])].map((path) => ({
    path: `${prefix}${path}`,
    ...about[path],
  }));

export function matchRoute(pathname: string): Route | undefined {
  if (Object.hasOwn(exact, pathname)) return exact[pathname];
  return patterns.find(([pattern]) => pattern.test(pathname))?.[1];
}

export const allowedMethods = (route: Route) =>
  route.writes ? 'GET, HEAD, POST, OPTIONS' : 'GET, HEAD, OPTIONS';
