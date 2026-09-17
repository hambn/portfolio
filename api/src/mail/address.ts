import type { Services } from '../contracts.js';
import { DAY } from '../lib/ttl.js';
import { readJSON } from '../lib/http.js';
import { z } from 'zod';

// Local part: dot-separated atoms of the characters RFC 5322 allows unquoted.
// Quoted local parts are legal and never used by real senders, so they are out.
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const LOCAL = new RegExp(`^${ATOM}(?:\\.${ATOM})*$`);
// Domain labels: alphanumeric with inner hyphens, and a final alphabetic TLD.
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const DOMAIN = new RegExp(`^(?:${LABEL}\\.)+[A-Za-z]{2,63}$`);

// Throwaway-inbox domains, which exist to make a reply address useless.
const DISPOSABLE = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'sharklasers.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'throwawaymail.com',
  'mohmal.com',
  'emailondeck.com',
  'spam4.me',
  'mailnesia.com',
  'tempr.email',
  'moakt.com',
  'inboxkitten.com',
]);

export interface AddressParts {
  address: string;
  local: string;
  domain: string;
}

// Structural checks only — no network, no vendor. Everything here is decided
// from the string itself.
export function parseAddress(input: string): AddressParts | null {
  const address = input.trim();
  if (address.length < 6 || address.length > 254) return null;
  // A header-injecting sender never gets as far as the provider envelope.
  if (/[\s<>,;"\\()[\]]/.test(address)) return null;
  const at = address.lastIndexOf('@');
  if (at < 1) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1).toLowerCase();
  if (local.length > 64 || !LOCAL.test(local)) return null;
  if (domain.length > 253 || !DOMAIN.test(domain)) return null;
  if (DISPOSABLE.has(domain)) return null;
  return { address: `${local}@${domain}`, local, domain };
}

const dnsAnswer = z.object({
  Status: z.number(),
  Answer: z.array(z.object({ type: z.number(), data: z.string() })).optional(),
});

// DNS-over-HTTPS against a public resolver. This is name resolution, the same
// lookup an MTA does before delivery — not an email-verification service, and
// nothing about the address is disclosed: only its domain is queried.
async function lookup(services: Services, domain: string, type: 'MX' | 'A'): Promise<number> {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', domain);
  url.searchParams.set('type', type);
  const response = await services.fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('dns_unavailable');
  }
  const body = await readJSON(response, dnsAnswer);
  // NXDOMAIN (3) is a definite no; anything else is judged on the records.
  if (body.Status === 3) return 0;
  if (body.Status !== 0) throw new Error('dns_unavailable');
  return (body.Answer || []).filter((record) => record.type === (type === 'MX' ? 15 : 1)).length;
}

// Can this domain receive mail at all? A domain with neither an MX nor an A
// record has nowhere to deliver, so the reply address would be dead on arrival.
// Resolver outages fail open — a flaky lookup must not silently eat a message.
export async function domainAcceptsMail(services: Services, domain: string): Promise<boolean> {
  const key = `mail:domain:${domain}`;
  const cached = await services.state.get(key);
  if (cached) return cached === '1';
  let deliverable: boolean;
  try {
    deliverable = (await lookup(services, domain, 'MX')) > 0;
    if (!deliverable) deliverable = (await lookup(services, domain, 'A')) > 0;
  } catch (error) {
    console.warn('DNS check skipped', domain, error instanceof Error ? error.message : 'unknown');
    return true;
  }
  // Negative answers expire sooner: a domain being set up should not stay
  // blocked for a day after its records appear.
  await services.state.put(key, deliverable ? '1' : '0', {
    expirationTtl: deliverable ? DAY : 3600,
  });
  return deliverable;
}
