# AGENTS.md

Guidance for coding agents working in this repo.

npm-workspaces monorepo: the site is `apps/web`, the backend is `apps/api`
(Cloudflare Worker, also self-hostable on Node), code both use is
`packages/shared`, and editable content is `content/`.

## Read before working

These guides are not loaded automatically; open them yourself.

- [.agents/structure.md](.agents/structure.md): read before any change. Repo
  layout, key conventions, common edits, and the checks to run before shipping.
- [.agents/api.md](.agents/api.md): read before touching `apps/api/` or
  `packages/shared/media.ts`. Backend layout, commands, configuration, routes
  and cache policy.

## Commands

Install from the root with `npm ci`; run `npm run check` before shipping and
`npm run test:browser` for the Playwright regressions. What each covers is in
[.agents/structure.md](.agents/structure.md) (Key conventions and Common edits);
the `api:*` and `test:container` scripts are in [.agents/api.md](.agents/api.md).
