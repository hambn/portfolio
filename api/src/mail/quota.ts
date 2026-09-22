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

async function digest(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
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

// Single-use: the signature is remembered for as long as the token could still
// be replayed, so the same token cannot send twice.
export async function redeemToken(
  services: Services,
  secret: string,
  token: string,
): Promise<boolean> {
  const [issued, signature] = token.split('.');
  if (!issued || !signature || !/^\d{10,15}$/.test(issued)) return false;
  if ((await digest(secret, issued)) !== signature) return false;
  const age = services.now() - Number(issued);
  if (age < TOKEN_MIN_AGE_MS || age > TOKEN_MAX_AGE_MS) return false;
  const key = `mail:token:${signature.slice(0, 32)}`;
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

// Checked before the message is sent; the counters are only advanced once the
// provider has accepted it, so a failed send does not burn anyone's allowance.
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

export async function recordSend(
  services: Services,
  ip: string,
  fingerprint: string,
): Promise<void> {
  const { day, month, hour } = periods(services.now());
  const who = await hashed(ip);
  const bump = async (key: string, ttl: number) =>
    services.state.put(key, String((await counter(services, key)) + 1), { expirationTtl: ttl });
  await Promise.all([
    bump(`mail:count:day:${day}`, 2 * DAY),
    bump(`mail:count:month:${month}`, 40 * DAY),
    bump(`mail:ip:hour:${who}:${hour}`, HOUR),
    bump(`mail:ip:day:${who}:${day}`, DAY),
    services.state.put(`mail:dup:${await hashed(fingerprint)}`, '1', { expirationTtl: 600 }),
  ]);
}

// The same message twice in ten minutes is a double-click or a retry loop. Only
// a delivered message is remembered, so retrying after a failure still works.
export async function isDuplicate(services: Services, fingerprint: string): Promise<boolean> {
  return Boolean(await services.state.get(`mail:dup:${await hashed(fingerprint)}`));
}

// Cloudflare sets CF-Connecting-IP; nginx sets X-Forwarded-For. Both are added
// by our own edge, and an unidentifiable caller shares one bucket rather than
// escaping the per-sender limit entirely.
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
  return request.headers.get('CF-Connecting-IP') || forwarded || 'unknown';
}
