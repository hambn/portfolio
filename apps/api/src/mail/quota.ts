import type { Services } from '../contracts.js';
import { DAY, HOUR } from '../lib/ttl.js';

// Limits sized under the provider's own 100/day and 3000/month plan allowance,
// so a burst can never consume the whole quota and lock out the real senders.
export const MAIL_LIMITS = {
  day: 60,
  month: 1200,
  ipHour: 2,
  ipDay: 4,
} as const;

// How long a minted form token stays usable, and how new it must be. A bot that
// POSTs the instant it sees the page is filling nothing in.
const TOKEN_MAX_AGE_MS = 30 * 60 * 1000;
const TOKEN_MIN_AGE_MS = 3000;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function digest(secret: string, value: string): Promise<string> {
  return base64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(value)));
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hashed(value: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(value))).slice(0, 22);
}

// The submission secret. Tokens are only unforgeable while this is private, so
// a deployment without one is a deployment that cannot send.
export function tokenSecret(services: Services): string {
  return services.config.MAIL_TOKEN_SECRET || services.config.MAIL_API_KEY;
}

export async function mintToken(services: Services, secret: string): Promise<string> {
  const issued = String(services.now());
  return `${issued}.${await digest(secret, issued)}`;
}

// Signature and age only; nothing is written, so a rejected submission costs
// no storage. crypto.subtle.verify compares in constant time.
export async function verifyToken(
  services: Services,
  secret: string,
  token: string,
): Promise<boolean> {
  const [issued, signature] = token.split('.');
  if (!issued || !signature || !/^\d{10,15}$/.test(issued)) return false;
  const bytes = fromBase64url(signature);
  if (
    !bytes ||
    !(await crypto.subtle.verify('HMAC', await hmacKey(secret), bytes, encoder.encode(issued)))
  )
    return false;
  const age = services.now() - Number(issued);
  return age >= TOKEN_MIN_AGE_MS && age <= TOKEN_MAX_AGE_MS;
}

// Single-use: the signature is remembered for as long as the token could still
// be replayed, so the same token cannot send twice. Call only after
// verifyToken, inside the contact route's critical section.
export async function spendToken(services: Services, token: string): Promise<boolean> {
  const key = `mail:token:${token.split('.')[1].slice(0, 32)}`;
  if (await services.state.get(key)) return false;
  await services.state.put(key, '1', { expirationTtl: Math.ceil(TOKEN_MAX_AGE_MS / 1000) });
  return true;
}

async function counter(services: Services, key: string): Promise<number> {
  return Number((await services.state.get(key)) || 0);
}

function periods(now: number) {
  const stamp = new Date(now).toISOString();
  return {
    day: stamp.slice(0, 10),
    month: stamp.slice(0, 7),
    hour: stamp.slice(0, 13),
  };
}

type QuotaVerdict = { ok: true } | { ok: false; reason: 'ip_rate_limited' | 'mail_paused' };

// Checked before the message is sent. The counters are reserved before the
// send and released if the provider refuses it, so concurrent submissions
// cannot all pass the check and a failed send still costs no allowance.
export async function checkQuota(services: Services, ip: string): Promise<QuotaVerdict> {
  const { day, month, hour } = periods(services.now());
  const who = await hashed(ip);
  const [sentDay, sentMonth, fromIpHour, fromIpDay] = await Promise.all([
    counter(services, `mail:count:day:${day}`),
    counter(services, `mail:count:month:${month}`),
    counter(services, `mail:ip:hour:${who}:${hour}`),
    counter(services, `mail:ip:day:${who}:${day}`),
  ]);
  if (fromIpHour >= MAIL_LIMITS.ipHour || fromIpDay >= MAIL_LIMITS.ipDay)
    return { ok: false, reason: 'ip_rate_limited' };
  if (sentDay >= MAIL_LIMITS.day || sentMonth >= MAIL_LIMITS.month)
    return { ok: false, reason: 'mail_paused' };
  return { ok: true };
}

async function counters(services: Services, ip: string, now: number) {
  const { day, month, hour } = periods(now);
  const who = await hashed(ip);
  return [
    [`mail:count:day:${day}`, 2 * DAY],
    [`mail:count:month:${month}`, 40 * DAY],
    [`mail:ip:hour:${who}:${hour}`, HOUR],
    [`mail:ip:day:${who}:${day}`, DAY],
  ] as const;
}

// Returns the release for this reservation; periods are fixed at reservation
// time so a send that crosses an hour boundary releases what it took.
export async function reserveSend(
  services: Services,
  ip: string,
  fingerprint: string,
): Promise<() => Promise<void>> {
  const keys = await counters(services, ip, services.now());
  const duplicate = `mail:dup:${await hashed(fingerprint)}`;
  const shift = (key: string, ttl: number, by: number) =>
    counter(services, key).then((value) =>
      services.state.put(key, String(Math.max(0, value + by)), { expirationTtl: ttl }),
    );
  await Promise.all([
    ...keys.map(([key, ttl]) => shift(key, ttl, 1)),
    services.state.put(duplicate, '1', { expirationTtl: 600 }),
  ]);
  return async () => {
    await Promise.all([
      ...keys.map(([key, ttl]) => shift(key, ttl, -1)),
      services.state.delete(duplicate),
    ]);
  };
}

// The same message twice in ten minutes is a double-click or a retry loop. Only
// a delivered message is remembered, so retrying after a failure still works.
export async function isDuplicate(services: Services, fingerprint: string): Promise<boolean> {
  return Boolean(await services.state.get(`mail:dup:${await hashed(fingerprint)}`));
}

// Cloudflare sets CF-Connecting-IP in front of the Worker; the Node entrypoint
// drops any client-supplied copy and sets it from the socket or its trusted
// proxy header. An unidentifiable caller shares one bucket rather than
// escaping the per-sender limit entirely.
export function clientAddress(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
