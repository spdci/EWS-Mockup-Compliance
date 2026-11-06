import { authToken, defaultResponseTime } from './helpers.js';

// Sends a request and returns { statusCode, headers, body, rawBody, responseTime }.
export async function request(method, url, { body, rawBody, query } = {}) {
  const target = new URL(url);
  for (const [k, v] of Object.entries(query || {})) target.searchParams.set(k, v);
  const started = performance.now();
  const hasBody = rawBody !== undefined || body !== undefined;
  const response = await fetch(target, {
    method,
    headers: {
      'Accept': 'application/json, application/geo+json, application/vnd.sdmx.data+json',
      ...(hasBody ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: hasBody ? (rawBody ?? JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(defaultResponseTime),
  });
  const text = await response.text();
  const responseTime = performance.now() - started;
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: parsed,
    rawBody: text,
    responseTime,
  };
}

export const postJson = (url, body, options = {}) => request('POST', url, { body, ...options });
