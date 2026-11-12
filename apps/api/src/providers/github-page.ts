import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { z } from 'zod';

// What github.com/<user> shows that the REST API does not: the profile status,
// achievements, pinned repositories and the profile README. Read from the
// public, signed-out page. Every field is optional: a markup change upstream
// drops the part it broke and keeps the rest.

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value ?? '';
const classes = (node: Element) => attr(node, 'class').split(/\s+/);
const hasClass = (node: Element, name: string) => classes(node).includes(name);

function elements(root: Node): Element[] {
  const found: Element[] = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if ('tagName' in node) {
      if (['script', 'style', 'template', 'svg', 'tool-tip'].includes(node.tagName)) continue;
      found.push(node);
    }
    if ('childNodes' in node) pending.push(...[...node.childNodes].reverse());
  }
  return found;
}

const find = (root: Node, test: (el: Element) => boolean) => elements(root).find(test);
const byClass = (root: Node, name: string) => find(root, (el) => hasClass(el, name));

function text(node: Node | undefined): string {
  if (!node) return '';
  const parts: string[] = [];
  const pending: Node[] = [node];
  while (pending.length) {
    const next = pending.pop()!;
    if (
      'tagName' in next &&
      ['script', 'style', 'template', 'svg', 'tool-tip'].includes(next.tagName)
    )
      continue;
    if (next.nodeName === '#text' && 'value' in next) parts.push(next.value);
    if ('tagName' in next && /^(div|p|li|h[1-6]|br|tr)$/.test(next.tagName)) parts.push(' ');
    if ('childNodes' in next) pending.push(...[...next.childNodes].reverse());
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

const count = (value: string) => {
  const match = /^([\d.,]+)\s*([kKmM])?$/.exec(value.trim());
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const scale = { k: 1e3, m: 1e6 }[match[2]?.toLowerCase() as 'k' | 'm'] ?? 1;
  return Math.round(n * scale);
};

const MAX_README = 360;
const MAX_TEXT = 200;
const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

const nullable = z.string().nullable();
export const githubPageSchema = z.object({
  status: z.object({ emoji: nullable, message: nullable }).nullable(),
  achievements: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      tier: nullable,
      count: nullable,
    }),
  ),
  pinned: z.array(
    z.object({
      owner: z.string(),
      name: z.string(),
      url: z.string(),
      description: nullable,
      language: nullable,
      color: nullable,
      stars: z.number(),
      forks: z.number(),
      label: nullable,
    }),
  ),
  organizations: z.array(z.object({ login: z.string(), url: z.string(), image: nullable })),
  readme: nullable,
  followers: z.number().nullable(),
  following: z.number().nullable(),
});
export type GitHubPage = z.infer<typeof githubPageSchema>;

function status(document: Node): GitHubPage['status'] {
  // The page carries the status twice (mobile and desktop layouts); either will do.
  const container = byClass(document, 'user-status-container');
  if (!container) return null;
  const emojiBox = byClass(container, 'user-status-emoji-container');
  // Custom emoji are images (alt is the :shortcode:); unicode ones are text,
  // sometimes wrapped in <g-emoji>.
  const image = emojiBox && find(emojiBox, (el) => el.tagName === 'img');
  const emoji = (image ? '' : text(emojiBox)) || null;
  const message = text(byClass(container, 'user-status-message-wrapper')) || null;
  if (!emoji && !message) return null;
  return {
    emoji: emoji && [...emoji].length <= 8 ? emoji : null,
    message: message && clip(message, 80),
  };
}

function achievements(document: Node): GitHubPage['achievements'] {
  const seen = new Map<string, GitHubPage['achievements'][number]>();
  for (const img of elements(document)) {
    if (img.tagName !== 'img' || !hasClass(img, 'achievement-badge-sidebar')) continue;
    const slug = /\/achievements\/([\w-]+)\//.exec(attr(img, 'data-hovercard-url'))?.[1];
    if (!slug || seen.has(slug)) continue;
    const name =
      attr(img, 'alt')
        .replace(/^Achievement:\s*/i, '')
        .trim() || slug;
    const src = attr(img, 'src');
    seen.set(slug, {
      slug,
      name,
      image: src.startsWith('https://') ? src : null,
      tier: null,
      count: null,
    });
  }
  // Tier labels ("x2", bronze/silver/gold) sit next to their badge image.
  for (const link of elements(document)) {
    if (link.tagName !== 'a') continue;
    const slug = /[?&]achievement=([\w-]+)/.exec(attr(link, 'href'))?.[1];
    const entry = slug && seen.get(slug);
    if (!entry || entry.count) continue;
    const label = find(link, (el) => hasClass(el, 'achievement-tier-label'));
    if (!label) continue;
    entry.count = text(label) || null;
    entry.tier =
      classes(label)
        .map((name) => /^achievement-tier-label--(\w+)$/.exec(name)?.[1])
        .find(Boolean) ?? null;
  }
  return [...seen.values()].slice(0, 12);
}

function pinned(document: Node): GitHubPage['pinned'] {
  const items = elements(document).filter(
    (el) => el.tagName === 'li' && hasClass(el, 'pinned-item-list-item'),
  );
  const found: GitHubPage['pinned'] = [];
  for (const item of items) {
    const link = find(
      item,
      (el) => el.tagName === 'a' && /^\/[\w.-]+\/[\w.-]+$/.test(attr(el, 'href')),
    );
    if (!link) continue; // pinned gists and anything else without a repository path
    const [, owner, name] = attr(link, 'href').split('/');
    const meta = (suffix: string) =>
      count(text(find(item, (el) => el.tagName === 'a' && attr(el, 'href').endsWith(suffix))));
    const swatch = byClass(item, 'repo-language-color');
    const color = /background-color:\s*(#[0-9a-f]{3,8})/i.exec(attr(swatch ?? item, 'style'))?.[1];
    const description = text(byClass(item, 'pinned-item-desc'));
    found.push({
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
      description: description ? clip(description, MAX_TEXT) : null,
      language: text(find(item, (el) => attr(el, 'itemprop') === 'programmingLanguage')) || null,
      color: swatch ? (color ?? null) : null,
      stars: meta('/stargazers') ?? 0,
      forks: meta('/forks') ?? 0,
      label: text(find(item, (el) => hasClass(el, 'Label'))) || null,
    });
  }
  return found.slice(0, 6);
}

function organizations(document: Node): GitHubPage['organizations'] {
  const found = new Map<string, GitHubPage['organizations'][number]>();
  for (const link of elements(document)) {
    if (link.tagName !== 'a' || attr(link, 'data-hovercard-type') !== 'organization') continue;
    if (!hasClass(link, 'avatar-group-item')) continue;
    const login = /^\/([\w-]+)$/.exec(attr(link, 'href'))?.[1];
    if (!login || found.has(login)) continue;
    const src = attr(find(link, (el) => el.tagName === 'img') ?? link, 'src');
    found.set(login, {
      login,
      url: `https://github.com/${login}`,
      image: src.startsWith('https://') ? src : null,
    });
  }
  return [...found.values()].slice(0, 12);
}

function readme(document: Node): string | null {
  const article = find(
    document,
    (el) =>
      el.tagName === 'article' && hasClass(el, 'markdown-body') && attr(el, 'itemprop') === 'text',
  );
  const body = text(article);
  return body ? clip(body, MAX_README) : null;
}

function social(document: Node, tab: 'followers' | 'following') {
  const link = find(
    document,
    (el) => el.tagName === 'a' && new RegExp(`[?&]tab=${tab}$`).test(attr(el, 'href')),
  );
  const figure = link && find(link, (el) => hasClass(el, 'text-bold'));
  return figure ? count(text(figure)) : null;
}

/** The profile page's extras, or null when the page is not a user profile at all. */
export function parseGitHubPage(html: string): GitHubPage | null {
  const document = parse(html);
  // Signed-out profile pages always carry the vcard; anything else (a login
  // wall, an error page, an organisation) is not something to read from.
  if (!byClass(document, 'vcard-names')) return null;
  return {
    status: status(document),
    achievements: achievements(document),
    pinned: pinned(document),
    organizations: organizations(document),
    readme: readme(document),
    followers: social(document, 'followers'),
    following: social(document, 'following'),
  };
}
