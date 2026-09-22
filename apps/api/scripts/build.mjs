import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const path = (file) => fileURLToPath(new URL(`../${file}`, import.meta.url));
await build({
  entryPoints: [path('src/entrypoints/serve.ts')],
  outfile: path('dist/server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['bufferutil', 'utf-8-validate'],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  sourcemap: true,
});
