// Route registry — path + <head> metadata for every top-level page.
//
// Plain JS (no JSX, no browser APIs) so scripts/prerender.mjs can import it in
// Node and use the same titles/descriptions the SPA renders. `ctx` is the
// content layer: { profile, links, resume } — read from contents/*.json.

export const routes = [
  {
    page: 'home',
    path: '',
    title: (ctx) => ctx.profile.name,
    description: (ctx) => ctx.profile.bio,
  },
  {
    page: 'projects',
    path: 'projects',
    title: (ctx) => `projects — ${ctx.profile.name}`,
    description: (ctx) => `open-source projects and public repositories by ${ctx.profile.name}.`,
  },
  {
    page: 'blog',
    path: 'blog',
    title: (ctx) => `blog — ${ctx.profile.name}`,
    description: () => 'notes on infra, tooling, and things i figure out.',
  },
  {
    page: 'links',
    path: 'links',
    title: (ctx) => `links — ${ctx.profile.name}`,
    description: () => 'find me around the web — github, gitlab, linkedin, and more.',
  },
  {
    page: 'resume',
    path: 'resume',
    title: (ctx) => `resume — ${ctx.profile.name}`,
    description: (ctx) => `${ctx.profile.name} — ${ctx.profile.title || ''}. experience, education and skills.`,
  },
];
