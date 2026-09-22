# Repository cleanup and loading audit

This pass reviewed frontend routes, shared hooks, content loading, prerendering,
build configuration, backend request/cache handling, deployment configuration,
and the existing tests. Changes focus on browser startup, static metadata and
code duplication. Public content and the design are unchanged.

## Changes

- Blog CSS loads with the blog route instead of every page.
- Direct post visits reuse the rendered HTML. The markdown parser loads only
  when navigating to a post that has no embedded HTML. Syntax highlighting
  loads only for code blocks, and Mermaid still loads only for diagrams.
- Page HTML embeds only the content used by that route. Successful content
  fetches also update the synchronous snapshot, avoiding empty initial state
  when returning to a page.
- Static generation and client navigation share metadata and structured-data
  builders. Descriptions, canonical URLs, Open Graph, article tags and JSON-LD
  now follow navigation together.
- Fixed static descriptions that silently retained homepage text because the
  old replacement expression did not match multiline meta tags.
- Canonicals, structured data, RSS and sitemap URLs now include `BASE_PATH`.
  RSS publication dates use UTC regardless of the build machine's timezone.
- Timeline dates and locations use CSS breakpoints. Server and browser markup
  match on mobile, and the graph subscribes to breakpoint changes instead of
  every resize event.
- Tag hover colors use CSS instead of component state. Removed unused content
  access and redundant module-promise caches. Blog discovery uses directory
  entry types instead of a separate filesystem stat for every entry.
- Fixed the avatar's React `fetchPriority` prop and the `/api` preconnect hint
  that caused Vite builds using a relative API URL to fail.
- Added static SEO checks to `npm run check` and browser regressions for
  hydration, metadata, code blocks, diagrams and JavaScript-free mobile content.

## Measured results

These are local production builds. Sizes below are uncompressed, rounded to
one decimal KB. Browser resource totals were measured in Chromium with provider
requests stubbed consistently before and after.

| Resource                       |   Before |    After |
| ------------------------------ | -------: | -------: |
| Shared initial CSS             |  26.1 KB |  18.7 KB |
| Blog list HTML                 |  29.9 KB |  22.3 KB |
| Welcome post HTML              |  24.7 KB |  19.3 KB |
| Welcome post loaded JavaScript | 450.0 KB | 408.0 KB |

Shared CSS is 28% smaller. Direct post visits avoid the 44.1 KB markdown-parser
chunk, about 13 KB gzip. Shared metadata handling adds roughly 2.5 KB of initial
JavaScript; home still loads about 4.8 KB less JavaScript and CSS combined.
Blog pages retain their full stylesheet and existing syntax-highlight languages.

## Validation

- `npm run check`: lint, both API type checks, 59 API/runtime regressions, Node
  and Worker builds, formatting, production prerendering and 10 static SEO tests.
- `npm run test:browser`: 8 tests. All nine generated routes retain their original
  main element after hydration at 390px and 1280px, without hydration errors or
  horizontal overflow. Tests also cover route metadata, Back navigation, syntax
  highlighting, tables, Mermaid and mobile content with JavaScript disabled.
- Root and `/portfolio/` builds pass all 10 static SEO checks. A separate browser
  check verifies navigation, canonical URLs and highlighting under `/portfolio/`.
- Eight before/after screenshots, covering home, blog list, welcome post and
  resume at both widths, have identical dimensions and zero changed pixels.
  Provider responses were stubbed for this comparison.
- `git diff --check` passes.

Canonical URLs and page-specific descriptions follow
[Google's canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
and [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
The timeline change preserves React's requirement that
[hydrated markup match the server output](https://react.dev/reference/react-dom/client/hydrateRoot).

## Remaining limits

Live provider content still depends on API availability and response times.
Mermaid remains a large optional dependency. No production Core Web Vitals or
search ranking improvement is claimed from these local checks. Chrome DevTools
MCP and the embedded preview host were unavailable; validation used Playwright's
local Chromium.

The dependency audit reports existing high-severity advisories, including
Mermaid's transitive `lodash-es` dependencies. The suggested automatic fix changes
Mermaid's major version. Dependency versions were left unchanged in this pass.

Changes have not been deployed.

## Follow-up after pulling `0c54c9b`

The upstream branch already contained the stylesheet split, smaller page data,
shared route metadata, and deferred Markdown highlighting. Those changes and the
updated home page were retained.

Additional changes:

- Clear the links batch request timeout as soon as the request settles.
- Cancel the clipboard feedback timer on unmount and reset it on repeated copies.
- Add explicit Twitter image metadata and image descriptions for social previews.
- Escape canonical and Open Graph URL attributes.
- Reject duplicate published blog slugs during builds instead of silently
  overwriting a generated page. Drafts remain excluded.
- Extend static-site checks for social image metadata and duplicate slugs.

These changes preserve the current page layout and content. The performance
measurements earlier in this document describe the existing upstream changes;
no new page-load timing improvement is claimed for this follow-up.

Validation for this follow-up: `npm run check` and all eight browser tests passed.
Both the default build and a `/portfolio/` build passed all 11 static-site tests.
The development server runs on port 5174 because port 5173 was already occupied.

## Cleanup pass: dead CSS, nav styling, search index, crawler hints

Rendered output is unchanged. Screenshots of `/`, `/projects/`, `/blog/`,
`/resume/`, `/blog/welcome/` and `404.html` at 1280px and 390px are identical
byte for byte against the previous build, with provider responses stubbed.

- Removed the unused half of `core.css` — badge, card, input, avatar, divider,
  status-dot and focus-ring rules, plus five unused button variants. None had a
  single usage outside the stylesheet. This file is render-blocking on every
  route, so every rule in it is downloaded by every visitor.
- Moved the top navigation's inline style objects into `core.css`. The bar is
  static chrome, so it no longer rebuilds ~100 lines of style objects per
  render, and the mobile overrides no longer need `!important` to outrank inline
  styles. The active route is expressed as `aria-current="page"`, which CSS and
  assistive technology now read from the same attribute.
- Repo card hover moved from React state to `:hover` in a new
  `apps/web/src/pages/projects/projects.css`, so moving the pointer across the grid no
  longer re-renders a component.
- The blog search corpus is lowercased once per post list instead of once per
  post per keystroke.
- The favicon is drawn during an idle callback (load event as fallback) rather
  than at module scope, so its image fetch and canvas export no longer compete
  with hydration.
- Dropped the unused `@fontsource-variable/open-sans` dependency, and pointed
  SpotifyCard at the same `dm-sans/wght.css` entry DiscordCard already used.
- Crawler hints: explicit `robots` directives (`max-image-preview:large`,
  `max-snippet:-1`, `max-video-preview:-1`) on indexable routes, `og:site_name`
  and `og:locale`, and a `WebSite` node in the JSON-LD `@graph` that every page
  declares itself `isPartOf`. The blog index and each post's `isPartOf` now
  share one `#blog` `@id` instead of describing two separate Blog entities.

| Resource     | Before (raw / gzip) | After (raw / gzip) |
| ------------ | ------------------: | -----------------: |
| Shared CSS   |    18,741 / 6,637 B |   16,285 / 6,174 B |
| Entry JS     |    14,879 / 5,851 B |   14,194 / 5,617 B |
| Projects JS  |     3,890 / 1,699 B |    3,507 / 1,556 B |
| Links CSS    |   47,233 / 10,543 B |  46,538 / 10,514 B |
| Home HTML    |            18,742 B |           18,074 B |
| Blog list    |            22,403 B |           21,856 B |
| Welcome post |            19,491 B |           18,778 B |

Projects also gains a 409 B (256 B gzip) route stylesheet, loaded only with that
page. Blog's route chunk grows 59 B for the memoized search index.

No image preload was added for the home avatar: React already emits one for it
because the element renders with `fetchPriority="high"`.

Validation: `npm run lint`, `npm run format:check`, `npm run build`, all 11
static-site tests and all 8 browser tests pass. No Core Web Vitals or ranking
improvement is claimed — these are local build measurements.

## Cleanup pass: critical CSS, inline styles, fonts, re-renders, API dedupe

Rendered output is unchanged apart from one intended fix. Full-page screenshots
of `/`, `/projects/`, `/blog/`, `/blog/?tag=devops`, `/resume/` and `/links/`
in dark and light themes at 1280px and 390px are pixel-identical against the
previous commit, with provider requests stubbed and the GitLab placeholder
grid's `Math.random` seeded. The fix: every post body opened with `# <title>`,
so posts showed their title twice and had two `<h1>`s. The blog index now drops
that one line when it repeats the frontmatter title, and `test:site` asserts
exactly one `<h1>` per page.

- Home-only rules (buttons, avatar, git-log timeline, stack chips) moved from
  `core.css` to `pages/home/home.css`. The CSS inlined into every page
  (tokens + core) went from 12.2 KB to 6.8 KB. Home still inlines its own sheet.
- Blog, resume, projects and home chrome moved from inline style objects to
  classes. Those objects were rebuilt every render and serialized into every
  prerendered page. The resume print stylesheet is plain `@media print` CSS
  instead of a `<style>` injected from an effect, so printing works before
  hydration. Its hover (and the search box focus) no longer go through state.
- GitLab Sans is a latin subset (325 KB → 67 KB, both variable axes kept) and
  `@gitlab/fonts` is no longer a dependency.
- In-app links share `routeHref()`/`followRoute()`. Ctrl/cmd/middle-click on
  nav, intro, timeline and post links now open a new tab instead of being
  swallowed by `preventDefault()`.
- X card banner: the `height="500"` attribute pinned the banner at 500px tall
  (a 710×500 crop instead of 3:1); `height: auto` lets `aspect-ratio` apply.
- Home timeline hover: lanes had 16px-wide invisible hit strokes 14–20px
  apart, layered over rows that belong to other branches, so small pointer
  moves alternated between lanes and rows. One pointer handler on the log now
  picks the nearest lane within half a lane spacing over the graph, and the row
  under the pointer elsewhere. Lanes pack closer (down to 7px) when many
  branches would push the graph past 30% of the log width, and the hover card
  is clamped inside the log.
- Nav theme toggle reads/writes `data-theme` directly instead of mirroring it
  in state.
- /links: every non-Discord card is `React.memo`, so Discord presence messages
  no longer re-render all nine cards. The contribution grid is memoized and its
  hover ring is CSS. The Discord clock stops while the card is collapsed.
  Unused theme keys, CSS variables, props and rules were removed.
- API: snapshot avatar/banner routes go through the response cache keyed by
  snapshot version (they re-read and base64-decoded the snapshot every request),
  the X/Telegram/LinkedIn host check, image schema, image download loop and
  image path builder are shared, unreachable 404 branches were removed with a
  narrowed `Handler` type, and expired Node state files are deleted on read.

| Resource (raw)          |    Before |    After |
| ----------------------- | --------: | -------: |
| Inlined shared CSS      |  12,215 B |  6,793 B |
| Projects HTML           |  21,311 B | 16,883 B |
| Resume HTML             |  33,257 B | 25,540 B |
| Blog list HTML          |  41,766 B | 37,805 B |
| Links HTML              |  96,295 B | 90,771 B |
| Blog route JS           |  14,530 B |  9,784 B |
| Resume route JS         |   7,475 B |  3,576 B |
| GitLab Sans (on /links) | 324,924 B | 66,936 B |

Validation: `npm run check` (lint, both API type checks, 55 API + 5 runtime
tests, Worker dry run, formatting, build, 11 static SEO tests) and all 8
Playwright tests pass.
