import { routes } from '../routes.js';

export const isoDate = (date) => /^\d{4}-\d{2}-\d{2}/.exec(date || '')?.[0] || '';

export function routeMetadata(route, profile, posts = []) {
  const [page, ...segments] = route.split('/');
  const entry = routes.find((item) => item.page === page);
  if (!entry) return null;
  const slug = segments.join('/');
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

/** Shared by static HTML generation and client-side navigation. */
export function pageGraph(meta, person, siteRoot, posts = []) {
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
    image: person.image,
    keywords: post.tags?.length ? post.tags.join(', ') : undefined,
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
        ...(meta.page === 'home' ? { mainEntity: author } : {}),
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
  const setMeta = (attribute, name, content) => {
    let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, name);
      document.head.appendChild(element);
    }
    element.content = content;
  };
  let canonical = document.head.querySelector('link[rel="canonical"]');
  const siteRoot = new URL(
    import.meta.env.BASE_URL,
    canonical?.href || window.location.origin,
  ).href.replace(/\/+$/, '');
  const url = `${siteRoot}/${meta.path ? `${meta.path}/` : ''}`;
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
  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', meta.desc);
  document.head
    .querySelectorAll('meta[property^="article:"]')
    .forEach((element) => element.remove());
  if (meta.post && isoDate(meta.post.date))
    setMeta('property', 'article:published_time', isoDate(meta.post.date));
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
      ),
    );
  }
}
