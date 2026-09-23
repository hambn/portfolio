import { z } from 'zod';
import type { Services } from '../contracts.js';
import { identities } from '../identities.js';
import { json, readBytes } from '../lib/http.js';
import { domainAcceptsMail, parseAddress } from './address.js';
import { mailProvider } from './provider.js';
import {
  checkQuota,
  clientAddress,
  isDuplicate,
  mintToken,
  reserveSend,
  spendToken,
  tokenSecret,
  verifyToken,
} from './quota.js';

const MAX_BODY_BYTES = 16 * 1024;

// State reads and writes are separate calls, so the check-then-write steps run
// one submission at a time. This makes them atomic on Node (one process per
// data directory) and within one Worker isolate; KV is eventually consistent
// across locations, so two Workers elsewhere can still race.
let critical: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = critical.then(task);
  critical = run.catch(() => {});
  return run;
}

const submission = z.object({
  from: z.string().max(254),
  subject: z.string().max(200).optional().default(''),
  message: z.string().max(5000),
  token: z.string().max(200),
  // Honeypot: a real form leaves this empty because it is never shown.
  website: z.string().max(200).optional().default(''),
});

// CR/LF can never reach a header field, so a subject is flattened to one line.
const singleLine = (value: string) => value.replace(/\p{Cc}+/gu, ' ').trim();
// A message keeps its paragraphs and loses every other control character.
const multiLine = (value: string) =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(/\p{Cc}/gu, (character) => (character === '\n' ? character : ' '))
    .trim();

// The only recipient this API will ever address, and the only identity it sends
// as. Both come from links.json, not from the request, so there is no input
// that redirects a message elsewhere.
const { address: recipient, from: sendingIdentity, provider: vendor } = identities.email;

export async function handle(request: Request, services: Services): Promise<Response> {
  const provider = mailProvider(vendor);
  const secret = tokenSecret(services);
  if (!provider || !provider.configured(services) || !secret || !sendingIdentity)
    return json({ error: 'contact_not_configured' }, 503);

  // GET mints the form token the submission has to carry.
  if (request.method !== 'POST')
    return json({ to: recipient, token: await mintToken(services, secret) });

  if (!request.headers.get('Content-Type')?.includes('application/json'))
    return json({ error: 'unsupported_media_type' }, 415);
  const bytes = await readBytes(request, MAX_BODY_BYTES);
  if (!bytes) return json({ error: 'payload_too_large' }, 413);
  let parsed;
  try {
    parsed = submission.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  // A filled honeypot is answered exactly like a success so the bot learns
  // nothing, but nothing is sent and no quota is spent.
  if (parsed.website.trim()) return json({ ok: true });

  // Everything up to the critical section only reads, so a rejected submission
  // writes nothing.
  if (!(await verifyToken(services, secret, parsed.token)))
    return json({ error: 'invalid_token' }, 403);

  const sender = parseAddress(parsed.from);
  if (!sender) return json({ error: 'invalid_from', field: 'from' }, 400);

  const subject = singleLine(parsed.subject).slice(0, 150);
  const message = multiLine(parsed.message);
  if (message.length < 10) return json({ error: 'message_too_short', field: 'message' }, 400);

  const ip = clientAddress(request);
  const early = await checkQuota(services, ip);
  if (!early.ok) return json({ error: early.reason }, 429);

  if (!(await domainAcceptsMail(services, sender.domain, new URL(request.url).origin)))
    return json({ error: 'undeliverable_from', field: 'from' }, 400);

  const fingerprint = `${sender.address}|${subject}|${message}`;
  const claim = await exclusive(async () => {
    const quota = await checkQuota(services, ip);
    if (!quota.ok) return json({ error: quota.reason }, 429);
    if (await isDuplicate(services, fingerprint)) return json({ error: 'duplicate_message' }, 429);
    if (!(await spendToken(services, parsed.token))) return json({ error: 'invalid_token' }, 403);
    return reserveSend(services, ip, fingerprint);
  });
  if (claim instanceof Response) return claim;

  try {
    await provider.send(services, {
      // Always our own verified sending identity: the visitor's address travels
      // as Reply-To, which is what keeps the domain's reputation intact.
      from: sendingIdentity,
      to: recipient,
      replyTo: sender.address,
      subject: subject ? `[portfolio] ${subject}` : `[portfolio] Message from ${sender.address}`,
      text: `From: ${sender.address}\n\n${message}\n`,
    });
  } catch (error) {
    console.error('Contact send failed', error instanceof Error ? error.message : 'unknown');
    await exclusive(claim);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}
