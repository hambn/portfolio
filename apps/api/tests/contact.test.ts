import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { handleRequest } from '../src/app.js';
import { createServer } from '../src/entrypoints/node.js';
import { parseAddress } from '../src/mail/address.js';
import { mailProvider } from '../src/mail/provider.js';
import { identities } from '../src/identities.js';
import { MAIL_LIMITS } from '../src/mail/quota.js';
import { testServices } from './helpers.js';
import type { Services } from '../src/contracts.js';

const INBOX = identities.email.address;

interface Sent {
  url: string;
  body: Record<string, unknown>;
}

// A services stub with the mail provider configured, DNS answering "has MX",
// and every provider send captured instead of performed.
function mailServices(overrides: Partial<Services> = {}) {
  const sent: Sent[] = [];
  let now = 1_700_000_000_000;
  const services = testServices({
    now: () => now,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://cloudflare-dns.com'))
        return new Response(JSON.stringify({ Status: 0, Answer: [{ type: 15, data: '10 mx' }] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      sent.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response('{"id":"1"}', { headers: { 'Content-Type': 'application/json' } });
    },
    ...overrides,
  });
  services.config.MAIL_API_KEY = 'key';
  services.config.MAIL_TOKEN_SECRET = 'secret';
  return { services, sent, advance: (ms: number) => (now += ms) };
}

async function token(services: Services) {
  const response = await handleRequest(new Request('https://api.test/contact'), services);
  return ((await response.json()) as { token: string }).token;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://api.test/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });

async function send(
  services: Services,
  advance: (ms: number) => void,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const form = await token(services);
  advance(5000);
  return handleRequest(
    post(
      {
        from: 'visitor@example.com',
        subject: 'Hello',
        message: 'A real message.',
        token: form,
        ...extra,
      },
      headers,
    ),
    services,
  );
}

test('address parsing accepts real addresses and rejects junk without a network call', () => {
  for (const good of ['a.b@example.com', "o'neil+tag@sub.example.co.uk", 'x_y@example.io'])
    assert.ok(parseAddress(good), good);
  for (const bad of [
    'no-at-sign',
    'a@b',
    'a@@example.com',
    '.leading@example.com',
    'trailing.@example.com',
    'spa ce@example.com',
    'inject@example.com\r\nBcc: victim@example.com',
    '<a@example.com>',
    'a@example.com.',
    'a@-example.com',
    'burner@mailinator.com',
    `${'a'.repeat(65)}@example.com`,
  ])
    assert.equal(parseAddress(bad), null, bad);
  // Domains normalise to lower case so the DNS cache key is stable.
  assert.equal(parseAddress('Me@EXAMPLE.com')?.address, 'Me@example.com');
});

test('a valid submission is sent to the configured inbox with the visitor as reply-to', async () => {
  const { services, sent, advance } = mailServices();
  const response = await send(services, advance);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(sent[0].body.to, [INBOX]);
  assert.equal(sent[0].body.from, identities.email.from);
  assert.equal(sent[0].body.reply_to, 'visitor@example.com');
  assert.equal(sent[0].body.subject, '[portfolio] Hello');
});

test('no request input can redirect the message or forge an envelope', async () => {
  const { services, sent, advance } = mailServices();
  // `to`/`from` in the payload are simply not part of the accepted schema.
  const response = await send(services, advance, {
    to: 'victim@example.com',
    subject: 'Subject\r\nBcc: victim@example.com',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(sent[0].body.to, [INBOX]);
  assert.ok(!String(sent[0].body.subject).includes('\r'));
  assert.ok(!String(sent[0].body.subject).includes('\n'));
});

test('a submission without a fresh, single-use token is refused', async () => {
  const { services, sent, advance } = mailServices();
  const missing = await handleRequest(
    post({ from: 'visitor@example.com', message: 'A real message.', token: '' }),
    services,
  );
  assert.equal(missing.status, 403);

  const forged = await handleRequest(
    post({ from: 'visitor@example.com', message: 'A real message.', token: '1700000000000.abc' }),
    services,
  );
  assert.equal(forged.status, 403);

  // Instant submission: nobody types a message in under three seconds.
  const instant = await handleRequest(
    post({
      from: 'visitor@example.com',
      message: 'A real message.',
      token: await token(services),
    }),
    services,
  );
  assert.equal(instant.status, 403);

  // Replay of a token that already sent.
  const form = await token(services);
  advance(5000);
  const body = { from: 'visitor@example.com', message: 'A real message.', token: form };
  assert.equal((await handleRequest(post(body), services)).status, 200);
  const replay = await handleRequest(post({ ...body, message: 'Another message.' }), services);
  assert.equal(replay.status, 403);
  assert.equal(sent.length, 1);
});

test('the honeypot answers success and sends nothing', async () => {
  const { services, sent, advance } = mailServices();
  const response = await send(services, advance, { website: 'http://spam.example' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(sent.length, 0);
});

test('bad addresses, short messages and undeliverable domains never reach the provider', async () => {
  const { services, sent, advance } = mailServices();
  assert.equal((await send(services, advance, { from: 'nope' })).status, 400);
  assert.equal((await send(services, advance, { message: 'short' })).status, 400);

  const dead = mailServices({
    fetch: async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://cloudflare-dns.com'))
        return new Response(JSON.stringify({ Status: 3 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      throw new Error('provider must not be called');
    },
  });
  dead.services.config.MAIL_API_KEY = 'key';
  dead.services.config.MAIL_TOKEN_SECRET = 'secret';
  const response = await send(dead.services, dead.advance);
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as { error: string }).error, 'undeliverable_from');
  assert.equal(sent.length, 0);
});

test('a resolver outage fails open rather than swallowing the message', async () => {
  const sent: Sent[] = [];
  const { services, advance } = mailServices({
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('https://cloudflare-dns.com')) throw new Error('offline');
      sent.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    },
  });
  assert.equal((await send(services, advance)).status, 200);
  assert.equal(sent.length, 1);
});

test('per-sender and per-day limits cap what one visitor and one day can spend', async () => {
  const { services, sent, advance } = mailServices();
  for (let attempt = 0; attempt < MAIL_LIMITS.ipHour; attempt++) {
    const response = await send(services, advance, { message: `Message number ${attempt}.` });
    assert.equal(response.status, 200);
  }
  const limited = await send(services, advance, { message: 'One message too many.' });
  assert.equal(limited.status, 429);
  assert.equal(((await limited.json()) as { error: string }).error, 'ip_rate_limited');
  assert.equal(sent.length, MAIL_LIMITS.ipHour);

  // A different visitor is unaffected; the same message twice is not.
  const other = { 'CF-Connecting-IP': '198.51.100.4' };
  assert.equal((await send(services, advance, { message: 'Fresh message.' }, other)).status, 200);
  const duplicate = await send(services, advance, { message: 'Fresh message.' }, other);
  assert.equal(duplicate.status, 429);
  assert.equal(((await duplicate.json()) as { error: string }).error, 'duplicate_message');
});

test('the Node server decides the sender address; forged headers do not reset the limit', async (t) => {
  const { services, advance } = mailServices();
  // Through the HTTP server, so the entrypoint's header handling is exercised.
  const through = async (trusted: string, headers: (i: number) => Record<string, string>) => {
    const previous = process.env.API_CLIENT_IP_HEADER;
    process.env.API_CLIENT_IP_HEADER = trusted;
    const server = createServer(services);
    process.env.API_CLIENT_IP_HEADER = previous;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
    const { port } = server.address() as AddressInfo;
    const statuses: number[] = [];
    for (let i = 0; i <= MAIL_LIMITS.ipHour; i++) {
      const form = await token(services);
      advance(5000);
      const response = await fetch(`http://127.0.0.1:${port}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers(i) },
        body: JSON.stringify({
          from: 'visitor@example.com',
          message: `Message ${trusted} ${i}.`,
          token: form,
        }),
      });
      statuses.push(response.status);
    }
    return statuses;
  };

  // No trusted proxy: every forged address still counts as the one socket.
  const forged = (i: number) => ({
    'CF-Connecting-IP': `203.0.113.${i}`,
    'X-Forwarded-For': `198.51.100.${i}`,
    'X-Real-IP': `192.0.2.${i}`,
  });
  assert.deepEqual(await through('', forged), [200, 200, 429]);

  // Behind nginx the proxy's header identifies each visitor separately.
  const proxied = (i: number) => ({ 'X-Real-IP': `192.0.2.${100 + i}` });
  assert.deepEqual(await through('x-real-ip', proxied), [200, 200, 200]);
});

test('parallel submissions cannot replay a token or overrun the limits', async () => {
  const { services, sent, advance } = mailServices();
  const form = await token(services);
  advance(5000);
  const replays = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      handleRequest(
        post({ from: 'visitor@example.com', message: `Replay number ${i}.`, token: form }),
        services,
      ),
    ),
  );
  assert.deepEqual(replays.map((response) => response.status).sort(), [200, ...Array(9).fill(403)]);

  // Fresh tokens from one sender, all at once: only the hourly allowance goes out.
  const forms = await Promise.all(Array.from({ length: 10 }, () => token(services)));
  advance(5000);
  const burst = await Promise.all(
    forms.map((form, i) =>
      handleRequest(
        post({ from: 'visitor@example.com', message: `Burst number ${i}.`, token: form }),
        services,
      ),
    ),
  );
  assert.equal(burst.filter((response) => response.status === 200).length, MAIL_LIMITS.ipHour - 1);
  assert.equal(sent.length, MAIL_LIMITS.ipHour);
});

test('a rejected submission writes no state', async () => {
  const { services, advance } = mailServices();
  const writes: string[] = [];
  const put = services.state.put.bind(services.state);
  services.state.put = async (key, value, options) => {
    writes.push(key);
    return put(key, value, options);
  };
  assert.equal((await send(services, advance, { from: 'nope' })).status, 400);
  assert.equal((await send(services, advance, { message: 'short' })).status, 400);
  assert.equal((await send(services, advance, { token: '1700000000000.abc' })).status, 403);
  assert.deepEqual(writes, []);
});

test('a provider failure reports an error and spends no quota', async () => {
  const { services, advance } = mailServices({
    fetch: async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://cloudflare-dns.com'))
        return new Response(JSON.stringify({ Status: 0, Answer: [{ type: 15, data: 'mx' }] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      return new Response('rate limited', { status: 429 });
    },
  });
  services.config.MAIL_API_KEY = 'key';
  services.config.MAIL_TOKEN_SECRET = 'secret';
  const response = await send(services, advance);
  assert.equal(response.status, 502);
  // The failure did not count against the sender's allowance.
  assert.equal((await send(services, advance)).status, 502);
});

test('the vendor named in links.json is the one that carries the message', async () => {
  const { services, sent } = mailServices();
  // Swapping vendors is renaming it in links.json; every provider takes the
  // same message and addresses the same inbox.
  const postmark = mailProvider('postmark')!;
  await postmark.send(services, {
    from: identities.email.from,
    to: INBOX,
    replyTo: 'visitor@example.com',
    subject: 'Hello',
    text: 'A real message.',
  });
  assert.equal(sent[0].url, 'https://api.postmarkapp.com/email');
  assert.equal(sent[0].body.To, INBOX);
  assert.equal(sent[0].body.ReplyTo, 'visitor@example.com');

  assert.equal(mailProvider('resend')?.name, 'resend');
  assert.equal(mailProvider('')?.name, 'resend');
  assert.equal(mailProvider('unknown-vendor'), null);

  // No API key configured at all: the route refuses instead of half-working.
  const bare = testServices();
  assert.equal((await handleRequest(new Request('https://api.test/contact'), bare)).status, 503);
});

test('the route accepts POST and preflight while other routes still do not', async () => {
  const { services } = mailServices();
  const preflight = await handleRequest(
    new Request('https://api.test/contact', { method: 'OPTIONS' }),
    services,
  );
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, POST, OPTIONS');
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Content-Type');

  const wrongType = await handleRequest(
    new Request('https://api.test/contact', { method: 'POST', body: 'x' }),
    services,
  );
  assert.equal(wrongType.status, 415);

  const put = await handleRequest(
    new Request('https://api.test/contact', { method: 'PUT' }),
    services,
  );
  assert.equal(put.status, 405);
  assert.equal(put.headers.get('Allow'), 'GET, HEAD, POST, OPTIONS');

  const oversized = await handleRequest(
    post({ from: 'visitor@example.com', message: 'x'.repeat(20000), token: 'a' }),
    services,
  );
  assert.equal(oversized.status, 413);
});
