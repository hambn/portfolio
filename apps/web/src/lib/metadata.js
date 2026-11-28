import { routes } from '../routes.js';

export const isoDate = (date) => /^\d{4}-\d{2}-\d{2}/.exec(date || '')?.[0] || '';

// Defaults are conservative: ask explicitly for full-size image previews and
// untruncated snippets so results aren't capped at a thumbnail and 160 chars.
export const INDEX_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

export const notFoundTitle = (profile) => `not found — ${profile.name}`;

/** Relative path (no leading slash) of a route's build-time 1200×630 OG card. */
export const ogImagePath = (meta) =>
  meta?.post
    ? `og/blog-${meta.post.slug}.png`
    : meta?.service
      ? `og/links-${meta.service}.png`
      : `og/${meta?.page || 'home'}.png`;

/** Relative path (no leading slash) of a route's static oEmbed JSON. */
export const oembedPath = (meta) =>
  meta?.post
    ? `oembed/blog-${meta.post.slug}.json`
    : meta?.service
      ? `oembed/links-${meta.service}.json`
      : `oembed/${meta?.page || 'home'}.json`;

function setMeta(attribute, name, content) {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

/** Client navigation to a URL with no page or post: keep it out of the index. */
export function updateNotFoundMetadata(profile) {
  document.title = notFoundTitle(profile);
  setMeta('name', 'robots', 'noindex');
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
  document.head
    .querySelectorAll('meta[property^="article:"]')
    .forEach((element) => element.remove());
}

export function routeMetadata(route, profile, posts = []) {
  const [page, ...segments] = route.split('/');
  const entry = routes.find((item) => item.page === page);
  if (!entry) return null;
  const slug = segments.join('/');
  if (page === 'links' && segments.length === 1 && slug) {
    return {
      page,
      path: `links/${slug}`,
      title: `${slug} — ${profile.name}`,
      desc: entry.description({ profile }),
      type: 'website',
      post: null,
      service: slug,
    };
  }
  const post = page === 'blog' && slug ? posts.find((item) => item.slug === slug) : null;
  if (segments.length && !post) return null;
  return {
    page,
    path: post ? `blog/${post.slug}` : entry.path,
    title: post ? `${post.title} — ${profile.name}` : entry.title({ profile }),
    desc: post ? post.description || post.title : entry.description({ profile }),
    type: post ? 'article' : 'website',
    post,
  };
}

/**
 * The featured projects as schema.org source code entries, for the projects
 * page. Takes the cards exactly as the page renders them.
 */
export function projectListLd(projects = []) {
  if (!projects.length) return undefined;
  return {
    '@type': 'ItemList',
    numberOfItems: projects.length,
    itemListElement: projects.map((project, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SoftwareSourceCode',
        name: project.name,
        description: project.description || undefined,
        url: project.homepage || project.repo || undefined,
        codeRepository: project.repo || undefined,
        programmingLanguage: project.language || undefined,
        keywords: project.topics?.length ? project.topics.join(', ') : undefined,
      },
    })),
  };
}

/**
 * Shared by static HTML generation and client-side navigation. `mainEntity`
 * is what a collection page lists (see projectListLd).
 */
export function pageGraph(meta, person, siteRoot, posts = [], mainEntity) {
  const abs = (path = '') => `${siteRoot}/${path ? `${path}/` : ''}`;
  const author = { '@id': person['@id'] };
  const postNode = (post) => ({
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description || post.title,
    url: abs(`blog/${post.slug}`),
    mainEntityOfPage: abs(`blog/${post.slug}`),
    datePublished: isoDate(post.date) || undefined,
    dateModified: isoDate(post.date) || undefined,
    inLanguage: 'en',
    isAccessibleForFree: true,
    image: `${siteRoot}/og/blog-${post.slug}.png`,
    keywords: post.tags?.length ? post.tags.join(', ') : undefined,
    wordCount: post.words || undefined,
    timeRequired: post.minutes ? `PT${post.minutes}M` : undefined,
    author,
    publisher: author,
    isPartOf: {
      '@id': `${siteRoot}/#blog`,
      '@type': 'Blog',
      name: `blog — ${person.name}`,
      url: abs('blog'),
    },
  });
  const types = {
    home: 'ProfilePage',
    projects: 'CollectionPage',
    links: 'CollectionPage',
    blog: 'Blog',
  };
  // One WebSite entity every page points at, so search engines treat the routes
  // as one site with one publisher instead of unrelated documents.
  const site = {
    '@type': 'WebSite',
    '@id': `${siteRoot}/#website`,
    url: abs(),
    name: person.name,
    description: person.description || undefined,
    inLanguage: 'en',
    publisher: author,
  };
  const partOf = { '@id': site['@id'] };
  const page = meta.post
    ? postNode(meta.post)
    : {
        '@type': types[meta.page] || 'WebPage',
        name: meta.title,
        description: meta.desc,
        url: abs(meta.path),
        inLanguage: 'en',
        isPartOf: partOf,
        about: author,
        ...(meta.page === 'home' ? { mainEntity: author } : mainEntity ? { mainEntity } : {}),
        // Same @id the posts' isPartOf points at — one Blog entity, not two.
        ...(meta.page === 'blog'
          ? { '@id': `${siteRoot}/#blog`, author, blogPost: posts.map(postNode) }
          : {}),
      };
  const trail = [['home', '']];
  if (meta.page !== 'home') trail.push([meta.page, meta.page]);
  if (meta.post) trail.push([meta.post.title, meta.path]);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      page,
      site,
      ...(trail.length > 1
        ? [
            {
              '@type': 'BreadcrumbList',
              itemListElement: trail.map(([name, path], index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name,
                item: abs(path),
              })),
            },
          ]
        : []),
    ],
  };
}

export function updateDocumentMetadata(meta, profile, posts) {
  document.title = meta.title;
  // A 404 view earlier in the session may have set noindex.
  setMeta('name', 'robots', INDEX_ROBOTS);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  const siteRoot = new URL(
    import.meta.env.BASE_URL,
    canonical?.href || window.location.origin,
  ).href.replace(/\/+$/, '');
  const url = `${siteRoot}/${meta.path ? `${meta.path}/` : ''}`;
  const ogImage = `${siteRoot}/${ogImagePath(meta)}`;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
  setMeta('name', 'description', meta.desc);
  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', meta.desc);
  setMeta('property', 'og:type', meta.type);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', ogImage);
  setMeta('property', 'og:image:alt', meta.title);
  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', meta.desc);
  setMeta('name', 'twitter:image', ogImage);
  setMeta('name', 'twitter:image:alt', meta.title);
  document.head
    .querySelectorAll('meta[property^="article:"]')
    .forEach((element) => element.remove());
  if (meta.post) {
    if (isoDate(meta.post.date))
      setMeta('property', 'article:published_time', isoDate(meta.post.date));
    if (profile?.name) setMeta('property', 'article:author', profile.name);
  }
  for (const tag of meta.post?.tags || []) {
    const element = document.createElement('meta');
    element.setAttribute('property', 'article:tag');
    element.content = tag;
    document.head.appendChild(element);
  }
  const structured = document.head.querySelector('script[type="application/ld+json"]');
  if (structured) {
    const previous = JSON.parse(structured.textContent);
    const person = previous['@graph']?.find((node) => node['@type'] === 'Person') || previous;
    structured.textContent = JSON.stringify(
      pageGraph(
        meta,
        {
          ...person,
          '@id': `${siteRoot}/#person`,
          name: profile.name,
          url: `${siteRoot}/`,
        },
        siteRoot,
        posts,
        // What the static page listed stays listed: the list is built from
        // content at prerender, and re-rendering the same URL must not drop it.
        previous['@graph']?.find((node) => node.url === url && node.mainEntity?.['@type'])
          ?.mainEntity,
      ),
    );
  }
}
