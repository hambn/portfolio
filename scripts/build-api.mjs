import { build } from 'esbuild';
await build({
  entryPoints: ['api/src/entrypoints/serve.ts'],
  outfile: 'api/dist/server.mjs',
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
