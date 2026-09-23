// Lanyard presence over the API's WebSocket relay (INIT_STATE arrives on
// subscribe). Held only while the card is expanded (`enabled`) and the tab is
// in the foreground; a collapsed card or a backgrounded tab holds no socket.
import { useEffect, useState } from 'react';
import { socketUrl } from '../../../lib/api.js';

export function useLanyardPresence(userId, enabled) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!userId || !enabled) return;

    let ws;
    let heartbeat;
    let reconnect;
    let handshake;
    let failures = 0;
    let cancelled = false;

    function teardown() {
      clearTimeout(reconnect);
      clearTimeout(handshake);
      clearInterval(heartbeat);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
        ws = null;
      }
      setData(null);
    }

    function connect() {
      // Offline, the 'online' listener below reconnects when it can succeed.
      if (cancelled || document.hidden || navigator.onLine === false) return;
      teardown();
      const socket = new WebSocket(socketUrl());
      ws = socket;
      // A socket can remain CONNECTING after a network change.
      handshake = setTimeout(() => socket.close(), 15000);
      socket.onmessage = (event) => {
        if (cancelled || socket !== ws) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        const { op, d } = message;
        if (op === 1) {
          clearInterval(heartbeat);
          heartbeat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 3 }));
          }, d.heartbeat_interval);
          socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
        }
        if (op === 0 && d) {
          clearTimeout(handshake);
          failures = 0;
          setData(d);
        }
      };
      socket.onclose = () => {
        clearInterval(heartbeat);
        clearTimeout(handshake);
        if (!cancelled) {
          setData(null);
          // 4 s, doubling to a minute, with jitter so many open tabs do not
          // reconnect in step while the relay is down.
          const delay = Math.min(60000, 4000 * 2 ** failures++);
          reconnect = setTimeout(connect, delay / 2 + Math.random() * (delay / 2));
        }
      };
      socket.onerror = () => socket.close();
    }

    function resume() {
      if (document.hidden) teardown();
      // 'online' also fires while a socket is healthy; keep that one.
      else if (!ws || ws.readyState > WebSocket.OPEN) connect();
    }

    connect();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelled = true;
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      teardown();
    };
  }, [userId, enabled]);
  return data;
}
