import type { Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { presenceMessage } from '../lib/presence.js';

export function attachPresence(
  server: Server,
  userId: string,
  connect = () =>
    new WebSocket('wss://api.lanyard.rest/socket', {
      handshakeTimeout: 10000,
      maxPayload: 1024 * 1024,
    }),
) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (request, socket, head) => {
    if (
      !userId ||
      !['/discord/socket', '/api/discord/socket'].includes((request.url || '').split('?')[0])
    ) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      const upstream = connect();
      const close = () => {
        client.close();
        upstream.close();
      };
      client.on('message', (data, binary) => {
        const message = binary ? null : presenceMessage(data.toString(), userId);
        if (message && upstream.readyState === WebSocket.OPEN) upstream.send(message);
      });
      upstream.on('message', (data, binary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary });
      });
      client.on('close', close);
      upstream.on('close', close);
      client.on('error', close);
      upstream.on('error', close);
    });
  });
  return () => {
    for (const client of sockets.clients) client.close(1001, 'Server stopping');
    sockets.close();
  };
}
