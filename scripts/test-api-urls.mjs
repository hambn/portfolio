import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

for (const base of ['/api', 'https://api.example.test/api']) {
  test(`frontend media URLs respect API base ${base}`, async () => {
    const result = await build({
      entryPoints: ['src/lib/api.js'],
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
  });
}
