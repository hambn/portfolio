import { presenceMessage } from '../lib/presence.js';
import { json } from '../lib/http.js';

export async function presence(userId: string): Promise<Response> {
  if (!userId) return json({ error: 'discord_not_configured' }, 503);
  const response = await fetch('https://api.lanyard.rest/socket', {
    headers: { Upgrade: 'websocket' },
  });
  const upstream = response.webSocket;
  if (!upstream) return json({ error: 'presence_unavailable' }, 502);
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  upstream.accept();
  const close = () => {
    if (server.readyState < WebSocket.CLOSING) server.close(1000, 'Relay closed');
    if (upstream.readyState < WebSocket.CLOSING) upstream.close(1000, 'Relay closed');
  };
  server.addEventListener('message', (event) => {
    const message = typeof event.data === 'string' ? presenceMessage(event.data, userId) : null;
    if (message && upstream.readyState === WebSocket.OPEN) upstream.send(message);
  });
  upstream.addEventListener('message', (event) => {
    if (server.readyState === WebSocket.OPEN) server.send(event.data);
  });
  server.addEventListener('close', close);
  upstream.addEventListener('close', close);
  server.addEventListener('error', close);
  upstream.addEventListener('error', close);
  return new Response(null, { status: 101, webSocket: client });
}
