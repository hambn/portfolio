# Website loading audit

## Reload flash fixed

The old prerenderer inserted a separate, plain-text page into `#root`.
`createRoot` then replaced it with the React design. Adding more CSS preloads
could not fix that mismatch.

The build now renders the actual React components. The client waits for the
entry route and hydrates the existing markup. Embedded public JSON supplies
initial content without extra requests. Responsive navigation, home layout,
and social-card styles use CSS available before JavaScript runs.

Other changes:

- Preload the primary font and deduplicate asset links.
- Load additional routes on demand instead of downloading every route after startup.
- Keep code-block spacing stable when syntax highlighting adds controls.
- Preserve saved theme and card preferences without hydration mismatches.
- Add page-level headings, a named blog search field, visible keyboard focus for
  search and code-copy buttons, and reduced-motion rules.
- Keep navigation links compatible with the configured deployment base.
- Keep a GitHub link available while the projects page fetches repositories.

The implementation follows React's [hydration model](https://react.dev/reference/react-dom/client/hydrateRoot)
and Vite's [static rendering workflow](https://vite.dev/guide/ssr).

## Validation

- `npm run check` passed: ESLint, Prettier, production build, nine generated pages.
- `git diff --check` passed.
- Chromium checks covered all nine generated pages at 390px and 1280px widths
  with JavaScript requests held back. Every page had a visible heading and
  styled content before scripts loaded. React retained the original main
  element, with no hydration errors or horizontal overflow before startup.
- Separate checks covered saved light theme after reload, URL tag filtering,
  and readable home, blog post, links, and resume content with JavaScript disabled.
- A local initial-load sample measured zero layout shift for home, blog list,
  the welcome post, and resume at both widths. Links measured zero on mobile
  and 0.000116 on desktop. These are short local samples, not field metrics
  or guarantees about later live API updates.
- Initial local-content requests were zero on the six sampled routes because
  the initial data was embedded in the HTML.

## Remaining findings

- Projects and social cards still depend on external APIs. Their final content,
  latency, and later layout changes depend on those services. This audit did
  not establish production API reliability or measure a full polling cycle.
- `usePolledJSON` still polls while the tab is hidden. Pausing hidden-tab polls
  would save requests, but it is separate from static-page startup.
- Mermaid's core chunk is about 621 KB before compression, 149 KB gzip. It is
  already loaded only when a post contains a diagram. Static diagram generation
  would remove that browser cost, but needs a separate diagram build workflow.
- The Chrome DevTools MCP required by the web-perf skill was unavailable.
  Browser checks used local Chromium instead. Production caching, compression,
  real-user LCP/INP, and a full accessibility audit remain unmeasured.

Changes are local and have not been deployed.
