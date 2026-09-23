# content/

Everything the site shows is edited here; no code changes needed. The site
serves these files at `<base>/contents/`, and the API reads `links/links.json`
for the accounts it may serve. Rebuild and redeploy the site (and the API, for
`links.json`) after editing.

```
content/
├── home/
│   ├── profile.json   name, handle, title, bio, intro paragraphs, avatar URL
│   └── resume.json    CV entries, the home-page git graph, skills
├── links/
│   └── links.json     one block per card on the links page
└── blogs/
    └── **/*.md        posts; metadata in frontmatter, any folder depth
```

## Profile

`home/profile.json` holds `name`, `handle`, `title`, `bio` (also the site
description), `intro` (paragraphs on the home page) and `avatar`.

## Resume and timeline

`home/resume.json`:

- `items[]` is the CV (resume page and structured data). Each entry has a
  `type` (`work` or `education`), dates as `Mon YYYY`, and `"end": "present"`
  for a current role.
- `branches[]` drives the git graph on the home page: one branch per company,
  degree or project, whose `commits[]` are its roles or stages (`text` is the
  subject line, `body[]` the message). `milestone: true` draws a hollow dot.
- `skills[]` and `born` round it out. The file's own `_comment` explains the
  graph in more detail.

## Links

`links/links.json` has one block per card. Remove a block to hide that card.

- `email` — `address` (the only inbox the contact form sends to), `from` (the
  vendor-verified sending identity) and `provider`.
- `discord.userId`, `spotify.userId`, `github.username`, `gitlab.username`,
  `steam.handle`, and `handle` + `url` for `x`, `telegram` and `linkedin`.
- `apiEndpoint` points a card at the API route that serves it.

The API only serves the accounts named here; a request cannot ask it for any
other.

## Blog posts

Drop a `.md` file anywhere under `blogs/` (e.g. `blogs/devops/my-post.md`):

```yaml
---
title: My Post Title
date: 2026-06-21
description: One line shown in the post list, search results and meta tags.
tags: [devops, linux]
---

Write the post in Markdown…
```

- The route is the file name: `my-post.md` → `/blog/my-post/`. File names
  are lowercase letters, digits and hyphens, unique across folders.
- `date` is a real `YYYY-MM-DD` date; posts are listed newest first.
- Frontmatter is one `key: value` per line, with tags as `[a, b]`. The build
  stops and names the file if it finds anything else.
- A post without a `title`, or with `draft: true`, is a draft and is not
  published.
- Don't repeat the title as a `# heading` at the top; the page already shows
  it (a repeated one is dropped).
- Markdown is GitHub-flavored: fenced code with syntax highlighting and a copy
  button, tables, task lists, and Mermaid diagrams in a ```` ```mermaid ````
  block.
