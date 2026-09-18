import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { z } from 'zod';
import { linkedinUsername } from '../../../shared/linkedin.js';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value || '';
const hasClass = (node: Element, name: string) => attr(node, 'class').split(/\s+/).includes(name);
const hidden = (node: Element) =>
  node.attrs.some((a) => a.name === 'hidden') ||
  attr(node, 'aria-hidden') === 'true' ||
  /display\s*:\s*none|visibility\s*:\s*hidden/.test(attr(node, 'style')) ||
  /(?:^|\s)(?:hidden|blurred)(?:\s|$)/.test(attr(node, 'class')) ||
  hasClass(node, 'sign-in-modal') ||
  hasClass(node, 'contextual-sign-in-modal');
function elements(root: Node, visibleOnly = true): Element[] {
  const found: Element[] = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if ('tagName' in node) {
      if (visibleOnly && (hidden(node) || ['script', 'style', 'template'].includes(node.tagName)))
        continue;
      found.push(node);
    }
    if ('childNodes' in node) pending.push(...[...node.childNodes].reverse());
  }
  return found;
}
function text(node: Node | undefined): string {
  if (!node) return '';
  const parts: string[] = [];
  const pending: (Node | string)[] = [node];
  while (pending.length) {
    const next = pending.pop()!;
    if (typeof next === 'string') {
      parts.push(next);
      continue;
    }
    if (
      'tagName' in next &&
      (hidden(next) || ['script', 'style', 'template', 'button'].includes(next.tagName))
    )
      continue;
    if (next.nodeName === '#text' && 'value' in next) parts.push(next.value);
    if ('tagName' in next && /^(div|p|li|h[1-6]|br|section)$/.test(next.tagName)) {
      parts.push(' ');
      pending.push(' ');
    }
    if ('childNodes' in next) pending.push(...[...next.childNodes].reverse());
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}
const nullable = z.string().nullable();
export const linkedinProfileSchema = z.object({
  username: z.string(),
  url: z.string(),
  name: z.string(),
  headline: nullable,
  location: nullable,
  followers: nullable,
  connections: nullable,
  avatar: nullable,
  banner: nullable,
  about: nullable,
  organizations: z.array(z.string()),
  languages: z.array(z.object({ name: z.string(), proficiency: nullable })),
});

const personSchema = z.looseObject({
  '@type': z.union([z.string(), z.array(z.string())]),
  url: z.string().optional(),
  name: z.string().optional(),
  jobTitle: z.union([z.string(), z.array(z.string())]).optional(),
  image: z
    .union([
      z.string(),
      z.object({ contentUrl: z.string().optional(), url: z.string().optional() }),
    ])
    .optional(),
  address: z
    .union([
      z.string(),
      z.object({
        addressLocality: z.string().optional(),
        addressRegion: z.string().optional(),
        addressCountry: z.string().optional(),
      }),
    ])
    .optional(),
});
function people(value: unknown): z.infer<typeof personSchema>[] {
  if (Array.isArray(value)) return value.flatMap(people);
  if (!value || typeof value !== 'object') return [];
  const person = personSchema.safeParse(value);
  if (person.success && [person.data['@type']].flat().includes('Person')) return [person.data];
  return '@graph' in value ? people(value['@graph']) : [];
}

// Read only the public profile header and visible sections, never sign-in overlays
// or the unrelated people, posts, and course recommendations in the sidebar.
export function parseLinkedInProfile(html: string, username: string) {
  const document = parse(html);
  const all = elements(document, false);
  const visible = elements(document);
  const meta = (key: string) =>
    all.find(
      (node) => node.tagName === 'meta' && (attr(node, 'property') || attr(node, 'name')) === key,
    );
  const content = (key: string) => {
    const node = meta(key);
    return node ? attr(node, 'content').trim() : '';
  };
  const canonical = all.find(
    (node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical',
  );
  const identity = content('og:url') || (canonical ? attr(canonical, 'href') : '');
  if (identity && linkedinUsername(identity) !== username) return null;
  let person: z.infer<typeof personSchema> | undefined;
  for (const script of all.filter(
    (node) => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json',
  )) {
    try {
      const raw = script.childNodes
        .filter((node) => 'value' in node)
        .map((node) => ('value' in node ? node.value : ''))
        .join('');
      person = people(JSON.parse(raw)).find(
        (candidate) => candidate.url && linkedinUsername(candidate.url) === username,
      );
      if (person) break;
    } catch {
      /* A malformed structured-data block does not discard valid public HTML. */
    }
  }
  const top = visible.find(
    (node) => hasClass(node, 'top-card-layout') || hasClass(node, 'top-card'),
  );
  if ((!top && !person) || (!identity && !person)) return null;
  const topNodes = top ? elements(top) : [];
  const classText = (nodes: Element[], name: string) =>
    text(nodes.find((node) => hasClass(node, name))) || null;
  const name =
    classText(topNodes, 'top-card-layout__title') ||
    classText(topNodes, 'top-card__name') ||
    person?.name;
  if (!name) return null;
  const section = (name: string) =>
    visible.find(
      (node) =>
        node.tagName === 'section' && (attr(node, 'data-section') === name || hasClass(node, name)),
    );
  const aboutSection = section('summary') || section('about');
  const aboutNodes = aboutSection ? elements(aboutSection) : [];
  const about =
    text(
      aboutNodes.find(
        (node) =>
          hasClass(node, 'core-section-container__content') ||
          hasClass(node, 'show-more-less-text__text--less') ||
          node.tagName === 'p',
      ),
    ) || null;
  const languageSection = section('languages');
  const languages = languageSection
    ? elements(languageSection)
        .filter((node) => node.tagName === 'li')
        .flatMap((node) => {
          const nodes = elements(node);
          const name =
            text(nodes.find((child) => /^h[34]$/.test(child.tagName))) ||
            classText(nodes, 'personal-project__title');
          const proficiency =
            text(nodes.find((child) => child.tagName === 'h4' || child.tagName === 'p')) || null;
          return name ? [{ name, proficiency }] : [];
        })
    : [];
  const stats = text(top);
  const count = (label: string) =>
    stats.match(new RegExp(`([\\d,.]+[KM]?\\+?)\\s+${label}`, 'i'))?.[1] || null;
  const image = (kind: string) => {
    const node = topNodes.find(
      (node) =>
        node.tagName === 'img' &&
        (hasClass(node, kind) ||
          attr(node, 'data-delayed-url').includes(
            kind === 'top-card__profile-image'
              ? 'profile-displayphoto'
              : 'profile-displaybackgroundimage',
          )),
    );
    return node ? attr(node, 'data-delayed-url') || attr(node, 'src') || null : null;
  };
  const address = person?.address;
  const subheader = topNodes.find((node) => hasClass(node, 'profile-info-subheader'));
  const location =
    (subheader ? text(elements(subheader).find((node) => node.tagName === 'span')) : null) ||
    text(
      topNodes.find(
        (node) =>
          hasClass(node, 'top-card__subline-item') &&
          !['currentPositionsDetails', 'educationsDetails'].includes(attr(node, 'data-section')),
      ),
    ) ||
    (typeof address === 'string'
      ? address
      : address
        ? [address.addressLocality, address.addressRegion, address.addressCountry]
            .filter(Boolean)
            .join(', ')
        : null);
  const organizations = [
    ...new Set(
      topNodes
        .filter(
          (node) =>
            hasClass(node, 'top-card-link__description') ||
            ['currentPositionsDetails', 'educationsDetails'].includes(attr(node, 'data-section')),
        )
        .map((node) => text(node))
        .filter(Boolean),
    ),
  ];
  return {
    username,
    url: `https://www.linkedin.com/in/${username}/`,
    name,
    headline:
      classText(topNodes, 'top-card-layout__headline') ||
      (typeof person?.jobTitle === 'string' && !person.jobTitle.includes('*')
        ? person.jobTitle
        : null),
    location: location || null,
    followers: count('followers'),
    connections: count('connections'),
    avatar:
      image('top-card__profile-image') ||
      (typeof person?.image === 'string'
        ? person.image
        : person?.image?.contentUrl || person?.image?.url) ||
      content('og:image') ||
      null,
    banner: image('cover-img__image'),
    about,
    organizations,
    languages,
  };
}
