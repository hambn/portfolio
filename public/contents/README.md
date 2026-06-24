# contents/

All portfolio content lives here. Edit these files to update your site — no code changes needed.

## Structure

```
contents/
├── home/
│   ├── profile.json   — name, handle, title, bio, avatar URL
│   └── resume.json    — work experience[], education[], skills[]
├── links/
│   └── links.json     — social profiles (discord, github, spotify, steam, x, telegram, linkedin)
└── blogs/
    ├── manifest.json  — auto-generated list of every .md path (any depth)
    └── **/*.md         — posts; metadata lives in frontmatter
```

## Editing your profile

Open `home/profile.json` and update the fields:

```json
{
  "name": "your full name",
  "handle": "yourusername",
  "title": "your role",
  "bio": "one or two lines about yourself.",
  "avatar": "https://avatars.githubusercontent.com/yourusername"
}
```

## Editing work / education

Open `home/resume.json`. Add or remove entries in `experience[]` and `education[]`.
Set `"end": "present"` for your current role — it renders as active in the timeline.

## Editing social links

Open `links/links.json`. Each platform has its own block:

- `discord.userId` — your numeric Discord ID (enables live Lanyard presence)
- `spotify.userId` — your Spotify user ID (shows now-playing via Lanyard)
- `github.username` — drives the repo list on the Projects page
- `steam.handle` — your Steam vanity URL handle
- `x / telegram / linkedin` — handle + url

Remove any block to hide that card from the Links page.

## Adding a blog post

No registry to edit — the blog is fully file-driven.

1. Create a `.md` file **anywhere** under `contents/blogs/` (any folder depth works,
   e.g. `blogs/devops/kubernetes/my-post.md`).
2. Put the metadata in a frontmatter block at the very top:

```yaml
---
title: My Post Title
date: 2026-06-21
description: Short description shown in the post list.
tags: [devops, linux]
---

# My Post

Write in Markdown...
```

- The **slug / route** is the filename without `.md` — `my-post.md` → `/blog/my-post`.
  Keep filenames unique across folders.
- Posts are **sorted by `date`**, newest first.
- The list shows `title`, `description`, and `tags`; the blog page has search + tag filters.
- Rendering is GitHub-flavored: fenced code with syntax highlighting, tables, task
  lists, blockquotes, and **mermaid** diagrams (use a ```` ```mermaid ```` block).

### manifest.json

Browsers can't list a directory, so `blogs/manifest.json` holds every `.md` path.
Regenerate it after adding/removing files (a recursive listing of `*.md` paths).
In Next.js this is replaced by `fs.readdirSync(..., { recursive: true })` at build time.

## Next.js migration

| This prototype        | Next.js equivalent                              |
|-----------------------|-------------------------------------------------|
| `fetch profile.json`  | `import` or `getStaticProps`                    |
| `fetch resume.json`   | `import` or `getStaticProps`                    |
| `fetch links.json`    | `import` or `getStaticProps`                    |
| `fetch *.md`          | `fs.readdirSync(recursive)` + `gray-matter` + `remark` |
