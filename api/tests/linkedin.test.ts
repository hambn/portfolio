import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { refresh } from '../src/scheduled.js';
import {
  configuredLinkedInUsername as username,
  refreshLinkedIn,
} from '../src/providers/linkedin.js';
import { parseLinkedInProfile } from '../src/providers/linkedin-html.js';
import { linkedinUsername } from '../../shared/linkedin.js';
import { testServices } from './helpers.js';

// Representative public-page markup. Live LinkedIn access is blocked in the test environment.
const html = `<link rel="canonical" href="https://www.linkedin.com/in/${username}/">
<section class="top-card-layout">
<img class="cover-img__image" data-delayed-url="https://media.licdn.com/banner.jpg">
<img class="top-card__profile-image" data-delayed-url="https://media.licdn.com/avatar.jpg">
<h1 class="top-card-layout__title">Hamed &amp; Team</h1>
<h2 class="top-card-layout__headline">Engineer</h2>
<span class="top-card__subline-item">Tehran, Iran</span>
<span>655 followers</span><span>500+ connections</span>
<span class="top-card-link__description"><span>Example Company</span></span>
<span class="top-card-link__description">Technical University</span>
</section>
<section data-section="summary"><h2>About</h2><div class="core-section-container__content"><p>I like <strong>numbers</strong>.</p><button>see more</button></div></section>
<section data-section="languages"><h2>Languages</h2><ul><li><h3>English</h3><p>Elementary proficiency</p></li><li><h3>Persian</h3><p>Native or bilingual proficiency</p></li><li hidden><h3>Hidden language</h3></li></ul></section>
<aside><span>1,000 followers</span><h3>Recommended content</h3></aside>`;

test('public profile parsing preserves visible details and excludes unrelated or hidden sections', () => {
  const profile = parseLinkedInProfile(html, username!);
  assert.equal(profile?.name, 'Hamed & Team');
  assert.equal(profile?.headline, 'Engineer');
  assert.equal(profile?.location, 'Tehran, Iran');
  assert.equal(profile?.followers, '655');
  assert.equal(profile?.connections, '500+');
  assert.equal(profile?.about, 'I like numbers.');
  assert.deepEqual(profile?.organizations, ['Example Company', 'Technical University']);
  assert.deepEqual(profile?.languages, [
    { name: 'English', proficiency: 'Elementary proficiency' },
    { name: 'Persian', proficiency: 'Native or bilingual proficiency' },
  ]);
  assert.equal(profile?.banner, 'https://media.licdn.com/banner.jpg');
  assert.equal(parseLinkedInProfile(html, 'someone-else'), null);
  assert.equal(
    parseLinkedInProfile('<meta property="og:title" content="Sign in | LinkedIn">', username!),
    null,
  );
  assert.equal(parseLinkedInProfile('<h1>Security verification</h1>', username!), null);
  assert.equal(linkedinUsername('https://www.linkedin.com/in/Hambn/'), 'hambn');
  for (const value of [
    'https://linkedin.com.evil/in/hambn',
    'https://www.linkedin.com/in/hambn/posts',
    'https://user@linkedin.com/in/hambn',
    '../hambn',
  ])
    assert.equal(linkedinUsername(value), null);
});

test('structured data only uses the configured Person, not unrelated recommendations', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@graph': [
      { '@type': 'Person', name: 'Other', url: 'https://www.linkedin.com/in/other/' },
      {
        '@type': 'Person',
        name: 'Hamed',
        url: `https://www.linkedin.com/in/${username}/`,
        jobTitle: 'Engineer',
        address: { addressLocality: 'Tehran', addressCountry: 'Iran' },
      },
    ],
  })}</script>`;
  const profile = parseLinkedInProfile(html, username!);
  assert.equal(profile?.name, 'Hamed');
  assert.equal(profile?.location, 'Tehran, Iran');
  assert.equal(profile?.followers, null);
});

test('profile and both images are cached and survive failed hourly refreshes', async () => {
  let now = Date.now();
  let calls = 0;
  let failing = false;
  let imageFailing = false;
  const services = testServices({
    now: () => now,
    fetch: async (url) => {
      calls++;
      if (failing) return new Response(null, { status: 403 });
      if (String(url).startsWith('https://www.linkedin.com/in/')) return new Response(html);
      return imageFailing
        ? new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })
        : new Response(new Uint8Array([3, 2, 1]), { headers: { 'Content-Type': 'image/jpeg' } });
    },
  });
  const request = (path = '/api/linkedin', method = 'GET') =>
    handleRequest(new Request(`https://api.test${path}`, { method }), services);
  const first = await request();
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.match(data.avatar, /^\/api\/linkedin\/avatar\?/);
  assert.match(data.banner, /^\/api\/linkedin\/banner\?/);
  assert.equal(calls, 3);
  await request();
  for (const kind of ['avatar', 'banner']) {
    const response = await request(`/linkedin/${kind}`);
    assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([3, 2, 1]));
  }
  assert.equal(await (await request('/linkedin', 'HEAD')).text(), '');
  assert.equal(calls, 3);
  assert.equal((await request('/linkedin?username=other')).status, 400);
  assert.equal((await request('/linkedin/other')).status, 404);
  imageFailing = true;
  now += 3600000;
  await refreshLinkedIn(services);
  assert.equal((await request('/linkedin/avatar')).status, 200);
  failing = true;
  await assert.rejects(refreshLinkedIn(services));
  assert.equal((await (await request()).json()).name, 'Hamed & Team');
  now += 8 * 86400000;
  assert.equal((await request()).status, 503);
});

test('cold failures are throttled and unsafe redirects or oversized HTML cannot populate the cache', async () => {
  for (const response of [
    new Response(null, { status: 403 }),
    new Response(null, { status: 302, headers: { Location: 'https://example.com/' } }),
    new Response('x'.repeat(2 * 1024 * 1024 + 1)),
    new Response('<h1>Security verification</h1>'),
  ]) {
    let calls = 0;
    const services = testServices({
      fetch: async () => {
        calls++;
        return response;
      },
    });
    for (let i = 0; i < 3; i++) {
      const result = await handleRequest(new Request('https://api.test/linkedin'), services);
      assert.equal(result.status, 503);
      assert.equal(result.headers.get('Retry-After'), '60');
    }
    assert.equal(calls, 1);
  }
});

test('guest cookies are retried once and LinkedIn refresh is independent of other providers', async () => {
  let calls = 0;
  const services = testServices({
    fetch: async (url, init) => {
      if (!String(url).startsWith('https://www.linkedin.com/in/'))
        return new Response(null, { status: 503 });
      calls++;
      if (calls === 1)
        return new Response(null, {
          status: 403,
          headers: { 'Set-Cookie': 'bcookie=guest; Secure; Path=/' },
        });
      assert.equal(new Headers(init?.headers).get('Cookie'), 'bcookie=guest');
      return new Response(html);
    },
  });
  await assert.rejects(refresh(services));
  assert.equal(calls, 2);
  assert.ok(await services.state.get(`linkedin:profile:v1:${username}`));
});
