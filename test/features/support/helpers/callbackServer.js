// Minimal SP-side listener used as header.sender_uri, so the callbacks the EWS sends for
// async requests (on-subscribe, on-unsubscribe) can be captured.

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { callbackPort } from './helpers.js';

let server;
const received = [];
const waiters = new Set();

const ack = () => JSON.stringify({
  message: { ack_status: 'ACK', timestamp: new Date().toISOString(), correlation_id: randomUUID() },
});

export async function startCallbackServer() {
  if (server) return;
  server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(data); } catch { body = undefined; }
      const entry = { path: req.url, headers: req.headers, body, rawBody: data, receivedAt: Date.now() };
      received.push(entry);
      for (const waiter of waiters) waiter(entry);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(ack());
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(callbackPort, '0.0.0.0', resolve);
  });
}

export async function stopCallbackServer() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
}

// Resolves with the first callback (already received or upcoming) matching the predicate.
export function waitForCallback(predicate, timeoutMs) {
  const existing = received.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = (entry) => {
      if (!predicate(entry)) return;
      clearTimeout(timer);
      waiters.delete(waiter);
      resolve(entry);
    };
    const timer = setTimeout(() => {
      waiters.delete(waiter);
      reject(new Error(`No matching callback received within ${timeoutMs} ms (received: ${received.map((r) => r.path).join(', ') || 'none'})`));
    }, timeoutMs);
    waiters.add(waiter);
  });
}
