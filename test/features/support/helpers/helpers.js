// Runtime configuration of the compliance suite.
// Point EWS_BASE_URL at the Early Warning System implementation under test (EWS-side endpoints)
// and SP_BASE_URL at the SP implementation (notify, on-subscribe, on-unsubscribe and the SDMX
// member statistics). Both default to the bundled Mockoon mocks.

const withSlash = (url) => (url.endsWith('/') ? url : `${url}/`);

export const ewsBaseUrl = withSlash(process.env.EWS_BASE_URL || 'http://127.0.0.1:3333/');
export const spBaseUrl = withSlash(process.env.SP_BASE_URL || 'http://127.0.0.1:3334/');

// Local listener used as header.sender_uri for async flows, so the callbacks the
// EWS sends (on-subscribe, on-unsubscribe) can be captured and validated.
export const callbackPort = Number(process.env.CALLBACK_PORT || 3335);
export const callbackBaseUrl = withSlash(
  process.env.CALLBACK_BASE_URL || `http://127.0.0.1:${callbackPort}/`,
);

export const defaultResponseTime = Number(process.env.RESPONSE_TIMEOUT_MS || 15000);
export const callbackTimeout = Number(process.env.CALLBACK_TIMEOUT_MS || 10000);

// Optional bearer token.
export const authToken = process.env.AUTH_TOKEN || '';

export const senderId = process.env.SENDER_ID || 'spmis.example.org';
export const receiverId = process.env.RECEIVER_ID || 'ews.example.org';

// Minimum cell count for the aggregated member statistics (PRS.EWS.02: "minimum cell counts
// for anonymization"). The standard requires one but publishes no number.
export const minCellCount = Number(process.env.SDMX_MIN_CELL_COUNT || 5);

// Every endpoint of the DCI EWS interface (API.EWS.01 - API.EWS.05).
//  side          : which system exposes it (ews = early warning system, sp = SP-MIS)
//  method        : HTTP method
//  path          : mock path; {name} segments are filled per request
//  requestSchema : schema the request body must conform to
//  responseSchema: schema of the synchronous HTTP response
//  callback      : for async endpoints, the callback the EWS must send to header.sender_uri
export const endpoints = {
  // API.EWS.01 Event subscription (SP -> EWS)
  'subscribe': {
    side: 'ews', method: 'POST', path: 'ews/subscribe', action: 'subscribe',
    requestSchema: 'subscribe', responseSchema: 'ack',
    callback: { path: 'ews/on-subscribe', action: 'on-subscribe', schema: 'on-subscribe' },
  },
  'unsubscribe': {
    side: 'ews', method: 'POST', path: 'ews/unsubscribe', action: 'unsubscribe',
    requestSchema: 'unsubscribe', responseSchema: 'ack',
    callback: { path: 'ews/on-unsubscribe', action: 'on-unsubscribe', schema: 'on-unsubscribe' },
  },
  // API.EWS.03 Fetch alert (OGC API Features)
  'alerts collection': {
    side: 'ews', method: 'GET', path: 'ews/collections/alerts', responseSchema: 'collection',
  },
  'alert items': {
    side: 'ews', method: 'GET', path: 'ews/collections/alerts/items', responseSchema: 'feature-collection',
  },
  'alert item': {
    side: 'ews', method: 'GET', path: 'ews/collections/alerts/items/{alertId}', responseSchema: 'alert',
  },
  // API.EWS.04 Create-replace
  'create alert': {
    side: 'ews', method: 'POST', path: 'ews/collections/alerts/items', requestSchema: 'alert', responseSchema: 'alert',
  },
  'replace alert': {
    side: 'ews', method: 'PUT', path: 'ews/collections/alerts/items/{alertId}', requestSchema: 'alert', responseSchema: 'alert',
  },
  // API.EWS.02 Event notification (EWS -> SP)
  'notify': {
    side: 'sp', method: 'POST', path: 'ews/notify', action: 'notify',
    requestSchema: 'notify', responseSchema: 'ack',
  },
  'on-subscribe': {
    side: 'sp', method: 'POST', path: 'ews/on-subscribe', action: 'on-subscribe',
    requestSchema: 'on-subscribe', responseSchema: 'ack',
  },
  'on-unsubscribe': {
    side: 'sp', method: 'POST', path: 'ews/on-unsubscribe', action: 'on-unsubscribe',
    requestSchema: 'on-unsubscribe', responseSchema: 'ack',
  },
  // API.EWS.05 / PRS.EWS.02 Aggregated member statistics (SDMX), served by the SP
  'member statistics': {
    side: 'sp', method: 'GET', path: 'ews/data/{dataflow}/{key}', responseSchema: 'sdmx-json',
  },
};

export const endpointUrl = (name, params = {}) => {
  const endpoint = endpoints[name];
  if (!endpoint) throw new Error(`Unknown endpoint "${name}". Known: ${Object.keys(endpoints).join(', ')}`);
  const filled = endpoint.path.replace(/\{(\w+)\}/g, (_, key) => {
    if (params[key] === undefined) throw new Error(`Endpoint "${name}" needs the path parameter "${key}"`);
    // SDMX keys keep their "." "+" "*" separators readable; everything else is encoded.
    return key === 'key' ? String(params[key]).split('').map((c) => (/[A-Za-z0-9._~+*-]/.test(c) ? c : encodeURIComponent(c))).join('') : encodeURIComponent(params[key]);
  });
  return (endpoint.side === 'ews' ? ewsBaseUrl : spBaseUrl) + filled;
};
