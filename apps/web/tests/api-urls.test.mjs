import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

for (const base of ['/api', 'https://api.example.test/api', 'http://192.168.1.10:8787/api']) {
  test(`frontend media URLs respect API base ${base}`, async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL('../src/lib/api.js', import.meta.url))],
      bundle: true,
      write: false,
      format: 'esm',
      define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(base) },
    });
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
    );
    assert.equal(module.mediaUrl('/api/media/spotify/test'), `${base}/media/spotify/test`);
    assert.equal(module.mediaUrl('/contents/local.png'), '/contents/local.png');
    assert.equal(module.mediaUrl('https://untrusted.example/photo.png'), null);
    assert.match(
      module.mediaUrl('https://i.scdn.co/image/test'),
      new RegExp(`^${base}/media/spotify/`),
    );

    // A proxied image names the provider's own URL, which is what the page
    // loads instead when the API is down; anything else has no such fallback.
    const avatar = 'https://avatars.githubusercontent.com/u/1?v=4';
    assert.equal(module.upstreamSource(module.mediaUrl(avatar)), avatar);
    assert.equal(module.upstreamSource(`${base}/discord/avatar`), null);
    assert.equal(module.upstreamSource('/contents/local.png'), null);
    // API data is drawn through the proxy at the size asked for; data the
    // browser fetched from the provider keeps the provider's URL.
    assert.equal(
      module.upstreamSource(module.cardImage(avatar, 48)),
      'https://avatars.githubusercontent.com/u/1?v=4&s=96',
    );
    assert.equal(
      module.cardImage(avatar, 48, true),
      'https://avatars.githubusercontent.com/u/1?v=4&s=96',
    );
    assert.equal(module.cardImage(null, 48), undefined);
  });
}
