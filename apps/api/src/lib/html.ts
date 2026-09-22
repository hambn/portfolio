const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeHtml(value: unknown) {
  return String(value ?? '')
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/gi,
      (entity) => ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const value =
        code[0].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10);
      if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return _;
      try {
        return String.fromCodePoint(value);
      } catch {
        return _;
      }
    });
}

export function stripHtml(value: unknown) {
  return decodeHtml(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export function htmlAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(tag))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  return attrs;
}

// Telegram has used both property/name and different attribute orders over
// time. Reading the complete meta tag keeps the scraper tolerant of either.
export function metaContent(html: string, key: string) {
  const wanted = key.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = htmlAttributes(tag);
    if ((attrs.property || attrs.name || '').toLowerCase() === wanted && attrs.content != null) {
      return decodeHtml(attrs.content).trim() || null;
    }
  }
  return null;
}
