# Hello, World

This is a sample post. Delete this file and write your own posts in `contents/blogs/`.

## How to add a post

1. Create a `.md` file here, e.g. `contents/blogs/my-post.md`
2. Register it in `contents/blogs/index.json`:

```json
[
  {
    "slug": "my-post",
    "title": "My First Post",
    "date": "2026-06-21",
    "tags": ["devops", "linux"],
    "excerpt": "A short summary shown in the post list."
  }
]
```

That's it — the blog page picks it up automatically.

## Markdown support

Everything `marked` supports works here — headings, **bold**, _italic_, `inline code`, fenced code blocks, lists, blockquotes, links, tables.

```bash
# example shell snippet
systemctl status nginx
```

> NixOS is a rabbit hole. A very good rabbit hole.

## Next.js migration

In Next.js, replace the `fetch()` calls with:
- `import data from '@/contents/blogs/index.json'` for the post list
- `fs.readFileSync` + `gray-matter` + `remark` for individual posts
