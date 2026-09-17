import { attachPresence } from '../adapters/node-presence.js';
import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { nodeServices } from '../adapters/node.js';
import { handleRequest } from '../app.js';
import { refreshJob } from '../scheduled.js';
import type { Services } from '../contracts.js';

export function createServer(services: Services) {
  return http.createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      // Relative URLs use the public origin only when explicitly configured.
      const origin =
        process.env.API_PUBLIC_ORIGIN || `http://${incoming.headers.host || 'localhost:8787'}`;
      const request = new Request(new URL(incoming.url || '/', origin), {
        method: incoming.method,
        headers,
      });
      const response = await handleRequest(request, services);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.from(response.body), outgoing);
      else outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify({ error: 'server_error' }));
    }
  });
}

export async function start() {
  const { services, drain } = await nodeServices();
  const server = createServer(services);
  const closePresence = attachPresence(server, services.config.DISCORD_ID);
  const refresh = refreshJob(services);
  const run = () => services.background(refresh());
  run();
  const timer = setInterval(run, 3600000);
  timer.unref();
  server.listen(Number(process.env.PORT || 8787), '0.0.0.0', () =>
    console.log('API listening', server.address()),
  );
  const stop = () => {
    clearInterval(timer);
    closePresence();
    server.close(() => {
      void drain().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return server;
}
