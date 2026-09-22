# CLAUDE.md

Guidance for working in this repo. See the full repo structure and conventions:

@.claude/structure.md

npm-workspaces monorepo: the site is `apps/web`, the backend is `apps/api`
(Cloudflare Worker, also self-hostable on Node), code both use is
`packages/shared`, and editable content is `content/`. The backend has its own
guide: [.claude/api.md](.claude/api.md). Read it before touching `apps/api/`.
