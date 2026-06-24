---
title: Rebuilding the Blog
date: 2026-06-22
description: How this blog works now — drop a markdown file anywhere under contents/blogs and it shows up automatically.
tags: [meta, markdown, devops]
---

# Rebuilding the Blog

This blog is now **fully file-driven**. There's no registry to maintain — every `.md`
file under `contents/blogs/` (at _any_ folder depth) becomes a post automatically.

## How it works

1. The route slug is just the filename without `.md`. So `welcome.md` lives at `/blog/welcome`.
2. All metadata lives in the frontmatter block at the top of the file:

```yaml
---
title: Rebuilding the Blog
date: 2026-06-22
description: A short summary shown in the list.
tags: [meta, markdown, devops]
---
```

3. Posts are sorted by `date`, newest first.

> Drop a file in `contents/blogs/`, give it frontmatter, done. No JSON to edit.

## What renders

Everything GitHub-flavored markdown supports — `inline code`, **bold**, _italic_,
tables, task lists, blockquotes, and fenced code with syntax highlighting.

| Feature        | Supported |
| -------------- | :-------: |
| Code blocks    | ✅        |
| Tables         | ✅        |
| Mermaid        | ✅        |
| Task lists     | ✅        |

- [x] frontmatter metadata
- [x] recursive discovery
- [ ] write more posts
