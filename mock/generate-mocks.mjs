#!/usr/bin/env node
// Generates the Mockoon environments of the DCI Early Warning System (EWS) interface:
//   mockoon-ews.json   EWS side, port 3003:
//                      subscribe, unsubscribe (API.EWS.01), and the alerts collection as OGC API
//                      Features: GET collections/alerts, GET collections/alerts/items[/{alertId}]
//                      (API.EWS.03), POST items and PUT items/{alertId} (API.EWS.04)
//   mockoon-sp.json    SP side, port 3004:
//                      notify (API.EWS.02), on-subscribe, on-unsubscribe, and the aggregated member
//                      statistics GET data/{dataflow}/{key} (API.EWS.05, SDMX)
//
// Every POST / PUT validates the request against the schema (Mockoon valid_json_schema rule)
// and answers an ERR acknowledgement (DCI endpoints) or an OGC exception (alerts collection)
// when it does not conform. Async EWS endpoints ACK and then call header.sender_uri back.
//
// Schemas and records are imported from the test suite so that the mocks and the compliance
// tests always agree. Run after changing them:
//   node mock/generate-mocks.mjs

import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { schemas, codes, itemFilters, sdmxCodeLists, PERIOD_PATTERN } from '../test/features/support/helpers/schemas.js';
import { alertCollection, itemsIndex, sdmxResponses } from '../test/features/support/fixtures/records.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Stable UUIDs so regenerating produces minimal diffs.
const uuid = (seed) => {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const REG_TYPE = 'ns:org:RegistryType:EWS';
const EWS_ID = 'ews.example.org';
const NOW = '{{now "yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx"}}';
const JSON_HEADERS = [{ key: 'Content-Type', value: 'application/json' }];
const GEOJSON_HEADERS = [{ key: 'Content-Type', value: 'application/geo+json' }];
const SDMX_HEADERS = [{ key: 'Content-Type', value: 'application/vnd.sdmx.data+json; charset=utf-8' }];
// Environment headers: CORS on every response, so the Swagger UI (site/api) can call the mocks from a browser.
const ENV_HEADERS = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Origin, Accept, Authorization, Content-Length, X-Requested-With' },
];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const json = (value) => JSON.stringify(value, null, 2);

// ---------------------------------------------------------------------------
// Handlebars templates
// ---------------------------------------------------------------------------
const ack = (status = 'ACK') => `{
  "message": {
    "ack_status": "${status}",
    "timestamp": "${NOW}",
    "correlation_id": "{{guid}}"
  }
}`;

const err = (what) => `{
  "message": {
    "ack_status": "ERR",
    "timestamp": "${NOW}",
    "error": {
      "code": "err.request.bad",
      "message": "Request does not conform to the DCI EWS ${what} schema"
    },
    "correlation_id": "{{guid}}"
  }
}`;

const ogcException = (code, description) => json({ code, description });
const httpError = (code, message) => json({ errors: [{ code, message }] });

const msgHeader = (action, countPath) => `{
    "version": "1.0.0",
    "message_id": "{{guid}}",
    "message_ts": "${NOW}",
    "action": "${action}",
    "sender_id": "${EWS_ID}",
    "receiver_id": "{{bodyRaw 'header.sender_id'}}",
    "total_count": ${countPath ? `{{len (bodyRaw '${countPath}')}}` : 1},
    "is_msg_encrypted": false
  }`;

const subscribeMessage = `{
    "transaction_id": "{{bodyRaw 'message.transaction_id'}}",
    "correlation_id": "{{guid}}",
    "subscribe_response": [
      {{#each (bodyRaw 'message.subscribe_request')}}
      {
        "reference_id": "{{this.reference_id}}",
        "timestamp": "${NOW}",
        "status": "succ",
        "subscriptions": [
          {
            "version": "1.0.0",
            "code": "SUB-{{guid}}",
            "status": "subscribe",
            "timestamp": "${NOW}",
            "reg_type": "{{#if this.subscribe_criteria.reg_type}}{{this.subscribe_criteria.reg_type}}{{else}}${REG_TYPE}{{/if}}",
            {{#if this.subscribe_criteria.frequency}}"frequency": {{{stringify this.subscribe_criteria.frequency}}},{{/if}}
            "filter": {{{stringify this.subscribe_criteria.filter}}},
            "notify_record_type": "{{this.subscribe_criteria.notify_record_type}}",
            "locale": "{{#if this.locale}}{{this.locale}}{{else}}eng{{/if}}"
          }
        ],
        "locale": "{{#if this.locale}}{{this.locale}}{{else}}eng{{/if}}"
      }{{#unless @last}},{{/unless}}
      {{/each}}
    ]
  }`;

const unsubscribeMessage = `{
    "transaction_id": "{{bodyRaw 'message.transaction_id'}}",
    "correlation_id": "{{guid}}",
    "timestamp": "${NOW}",
    "status": "succ",
    "subscription_status": [
      {{#each (bodyRaw 'message.subscription_codes')}}
      { "code": "{{this}}", "status": "unsubscribe" }{{#unless @last}},{{/unless}}
      {{/each}}
    ]
  }`;

// /items: the alerts matching the first filter given (status, msg_type, scope, threshold_status,
// category, severity, urgency, certainty, event, event_code), looked up in the "index" bucket,
// or the whole collection; "limit" caps the number returned.
const FILTER_ORDER = ['status', 'msg_type', 'scope', 'threshold_status', 'category', 'severity', 'urgency', 'certainty', 'event', 'event_code'];
const itemsBody = `{{setVar 'fk' 'all'}}
${[...FILTER_ORDER].reverse().map((f) => `{{#if (queryParamRaw '${f}')}}{{setVar 'fk' (concat '${f}|' (queryParamRaw '${f}'))}}{{/if}}`).join('')}
{{setVar 'all' (dataRaw 'index' @fk)}}
{{#unless @all}}{{setVar 'all' (array)}}{{/unless}}
{{setVar 'limit' (add (queryParamRaw 'limit' 10) 0)}}
{
  "type": "FeatureCollection",
  "timeStamp": "${NOW}",
  "numberMatched": {{len @all}},
  "numberReturned": {{len (slice @all 0 @limit)}},
  "features": {{{stringify (slice @all 0 @limit)}}},
  "links": [
    { "href": "/ews/collections/alerts/items", "rel": "self", "type": "application/geo+json" },
    { "href": "/ews/collections/alerts", "rel": "collection", "type": "application/json" }
  ]
}`;

// ---------------------------------------------------------------------------
// Environment builders
// ---------------------------------------------------------------------------
const response = (seed, { statusCode = 200, label, body, rules = [], rulesOperator = 'OR', isDefault = false, callbacks = [], headers = JSON_HEADERS }) => ({
  uuid: uuid(seed),
  body,
  latency: 0,
  statusCode,
  label,
  headers,
  bodyType: 'INLINE',
  filePath: '',
  databucketID: '',
  sendFileAsBody: false,
  rules,
  rulesOperator,
  disableTemplating: false,
  fallbackTo404: false,
  default: isDefault,
  crudKey: 'id',
  callbacks,
});

const rule = (target, modifier, operator, value = '', invert = false) => ({ target, modifier, value, invert, operator });
const invalidBody = (schemaName) => [rule('body', '', 'valid_json_schema', `schemas.${schemaName}`, true)];

function httpRoute(env, method, endpoint, documentation, responses) {
  return {
    uuid: uuid(`${env}:${method}:${endpoint}`),
    type: 'http',
    documentation,
    method,
    endpoint,
    responses,
    responseMode: null,
    streamingMode: null,
    streamingInterval: 0,
  };
}

// POST route of a DCI endpoint: ERR when the request breaks the schema, otherwise `ok`.
const dciRoute = (env, endpoint, documentation, schemaName, ok) => httpRoute(env, 'post', endpoint, documentation, [
  response(`${env}:${endpoint}:ok`, { ...ok, isDefault: true }),
  response(`${env}:${endpoint}:err`, {
    statusCode: 400, label: `Request not conforming to the ${schemaName} schema`, body: err(schemaName), rules: invalidBody(schemaName),
  }),
]);

const healthcheck = (env) => httpRoute(env, 'get', 'healthcheck', 'Liveness probe used by the test runner', [
  response(`${env}:healthcheck:ok`, { label: 'UP', body: '{ "status": "UP" }', isDefault: true }),
]);

const callback = (env, name, documentation, body) => ({
  uuid: uuid(`${env}:callback:${name}`),
  id: name,
  uri: "{{bodyRaw 'header.sender_uri'}}",
  name,
  documentation,
  method: 'post',
  headers: JSON_HEADERS,
  bodyType: 'INLINE',
  body,
  databucketID: '',
  filePath: '',
  sendFileAsBody: true,
});

const bucket = (env, name, documentation, value) => ({
  uuid: uuid(`${env}:bucket:${name}`), id: name, name, documentation, value: JSON.stringify(value, null, 2),
});

function environment({ key, name, port, routes, data, callbacks = [] }) {
  return {
    uuid: uuid(`env:${key}`),
    lastMigration: 33,
    name,
    endpointPrefix: '',
    latency: 0,
    port,
    hostname: '',
    folders: [],
    routes,
    rootChildren: routes.map((r) => ({ type: 'route', uuid: r.uuid })),
    proxyMode: false,
    proxyHost: '',
    proxyRemovePrefix: false,
    tlsOptions: { enabled: false, type: 'CERT', pfxPath: '', certPath: '', keyPath: '', caPath: '', passphrase: '' },
    cors: true,
    headers: ENV_HEADERS,
    proxyReqHeaders: [{ key: '', value: '' }],
    proxyResHeaders: [{ key: '', value: '' }],
    data,
    callbacks,
  };
}

// ---------------------------------------------------------------------------
// EWS side
// ---------------------------------------------------------------------------
const ewsCallbacks = [
  callback('ews', 'on-subscribe', 'Subscription result sent to header.sender_uri',
    `{\n  "header": ${msgHeader('on-subscribe', 'message.subscribe_request')},\n  "message": ${subscribeMessage}\n}`),
  callback('ews', 'on-unsubscribe', 'Unsubscribe result sent to header.sender_uri',
    `{\n  "header": ${msgHeader('on-unsubscribe')},\n  "message": ${unsubscribeMessage}\n}`),
];
const fire = (name) => [{ uuid: uuid(`ews:callback:${name}`), latency: 300 }];

const collection = {
  id: 'alerts',
  title: 'Early warning alerts',
  description: 'DCI EWS alerts: DO.EWS.01 Alert features carrying DO.EWS.02 CapAlert properties',
  itemType: 'feature',
  crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
  links: [
    { href: '/ews/collections/alerts', rel: 'self', type: 'application/json', title: 'This collection' },
    { href: '/ews/collections/alerts/items', rel: 'items', type: 'application/geo+json', title: 'Alerts' },
  ],
};

// An /items filter value outside its code list is a 400 (OGC InvalidParameterValue).
const allowed = (param) => (param === 'category' ? [...new Set([...codes.category, ...codes.categoryCode])] : codes[itemFilters[param]]);
const invalidFilterResponses = Object.keys(itemFilters).map((param) => response(`ews:items:invalid:${param}`, {
  statusCode: 400,
  label: `Invalid ${param}`,
  body: ogcException('InvalidParameterValue', `${param} must be one of: ${allowed(param).join(', ')}`),
  rules: [rule('query', param, 'null', '', true), rule('query', param, 'regex', `^(${allowed(param).map(escapeRe).join('|')})$`, true)],
  rulesOperator: 'AND',
}));

const ids = alertCollection.map((f) => f.id);
const itemResponses = alertCollection.map((feature) => response(`ews:item:${feature.id}`, {
  label: `Alert ${feature.id}`, body: json(feature), rules: [rule('params', 'alertId', 'equals', feature.id)], headers: GEOJSON_HEADERS,
}));
const notFound = (seed, label) => response(seed, {
  statusCode: 404, label, body: ogcException('NotFound', 'No alert with this identifier in the collection'), isDefault: true,
});

const ews = environment({
  key: 'ews',
  name: 'DCI Early Warning System - EWS',
  port: 3003,
  routes: [
    dciRoute('ews', 'ews/subscribe', 'API.EWS.01 POST /subscribe - subscribe to alerts by event type, severity, area...; result sent to header.sender_uri (on-subscribe)', 'subscribe', {
      label: 'ACK, then on-subscribe callback', body: ack(), callbacks: fire('on-subscribe'),
    }),
    dciRoute('ews', 'ews/unsubscribe', 'API.EWS.01 POST /unsubscribe - cancel subscriptions; result sent to header.sender_uri (on-unsubscribe)', 'unsubscribe', {
      label: 'ACK, then on-unsubscribe callback', body: ack(), callbacks: fire('on-unsubscribe'),
    }),
    httpRoute('ews', 'get', 'ews/collections/alerts', 'API.EWS.03 GET /collections/alerts - the alerts collection (OGC API Features)', [
      response('ews:collection', { label: 'Collection', body: json(collection), isDefault: true }),
    ]),
    httpRoute('ews', 'get', 'ews/collections/alerts/items', 'API.EWS.03 GET /collections/alerts/items - alerts, filtered by a CAP property (event, severity, urgency, ...) and limit', [
      ...invalidFilterResponses,
      response('ews:items:invalid:limit', {
        statusCode: 400, label: 'Invalid limit', body: ogcException('InvalidParameterValue', 'limit must be a positive integer'),
        rules: [rule('query', 'limit', 'null', '', true), rule('query', 'limit', 'regex', '^[1-9][0-9]*$', true)], rulesOperator: 'AND',
      }),
      response('ews:items:ok', { label: 'FeatureCollection', body: itemsBody, isDefault: true, headers: GEOJSON_HEADERS }),
    ]),
    httpRoute('ews', 'get', 'ews/collections/alerts/items/:alertId', 'API.EWS.03 GET /collections/alerts/items/{alertId} - one alert', [
      ...itemResponses,
      notFound('ews:item:404', 'Unknown alert'),
    ]),
    httpRoute('ews', 'post', 'ews/collections/alerts/items', 'API.EWS.04 POST /collections/alerts/items - create an alert (Alert Feature)', [
      response('ews:create:err', {
        statusCode: 400, label: 'Not a valid Alert Feature', body: ogcException('InvalidParameterValue', 'The body is not a DCI EWS Alert Feature'), rules: invalidBody('alert'),
      }),
      response('ews:create:ok', { statusCode: 201, label: 'Created', body: '{{{body}}}', isDefault: true, headers: GEOJSON_HEADERS }),
    ]),
    httpRoute('ews', 'put', 'ews/collections/alerts/items/:alertId', 'API.EWS.04 PUT /collections/alerts/items/{alertId} - replace an alert', [
      response('ews:replace:err', {
        statusCode: 400, label: 'Not a valid Alert Feature', body: ogcException('InvalidParameterValue', 'The body is not a DCI EWS Alert Feature'), rules: invalidBody('alert'),
      }),
      response('ews:replace:404', {
        statusCode: 404, label: 'Unknown alert', body: ogcException('NotFound', 'No alert with this identifier in the collection'),
        rules: [rule('params', 'alertId', 'regex', `^(${ids.map(escapeRe).join('|')})$`, true)],
      }),
      response('ews:replace:ok', { label: 'Replaced', body: '{{{body}}}', isDefault: true, headers: GEOJSON_HEADERS }),
    ]),
    healthcheck('ews'),
  ],
  data: [
    bucket('ews', 'index', 'Alerts by "<CAP property>|<value>" for /items filters, and the whole collection (latest version of each alert) under "all"', { all: alertCollection, ...itemsIndex() }),
    bucket('ews', 'schemas', 'DCI EWS request schemas (generated from test/features/support/helpers/schemas.js)',
      Object.fromEntries(['subscribe', 'unsubscribe', 'alert'].map((k) => [k, schemas[k]]))),
  ],
  callbacks: ewsCallbacks,
});

// ---------------------------------------------------------------------------
// SP side
// ---------------------------------------------------------------------------
const alt = (values) => values.map(escapeRe).join('|');
const part = (values) => `(\\*|(${values})(\\+(${values}))*)`;
const PERIOD = PERIOD_PATTERN.slice(1, -1);
// REF_AREA.SEX.DISABILITY_STATUS.AGE_GROUP.(TIME_PERIOD | DENOMINATOR_TYPE)
const KEY_PATTERN = `^${[
  part('[A-Za-z0-9_-]+'),
  part(alt(Object.keys(sdmxCodeLists.SEX))),
  part(alt(Object.keys(sdmxCodeLists.DISABILITY_STATUS))),
  part(alt(Object.keys(sdmxCodeLists.AGE_GROUP))),
  part(`${PERIOD}|${alt(Object.keys(sdmxCodeLists.DENOMINATOR_TYPE))}`),
].join('\\.')}$`;

const sdmxRoute = httpRoute('sp', 'get', 'ews/data/:dataflow/:key', 'API.EWS.05 GET /data/{dataflow}/{key} - aggregated member statistics (SDMX-JSON; ?format=dci-json for the DCI JSON)', [
  response('sp:data:dataflow', {
    statusCode: 404, label: 'Unknown dataflow', body: httpError('err.request.not_found', 'Unknown dataflow: only DCI_MEMBER_STATISTICS is served'),
    rules: [rule('params', 'dataflow', 'equals', 'DCI_MEMBER_STATISTICS', true)],
  }),
  response('sp:data:key', {
    statusCode: 400, label: 'Invalid key', body: httpError('err.request.bad', 'The key must be REF_AREA.SEX.DISABILITY_STATUS.AGE_GROUP.(TIME_PERIOD|DENOMINATOR_TYPE) with codes from the DCI_MEMBER_STATISTICS code lists'),
    rules: [rule('params', 'key', 'regex', KEY_PATTERN, true)],
  }),
  response('sp:data:format', {
    statusCode: 400, label: 'Unsupported format', body: httpError('err.request.bad', 'format must be sdmx-json or dci-json'),
    rules: [rule('query', 'format', 'null', '', true), rule('query', 'format', 'regex', '^(sdmx-json|dci-json)$', true)], rulesOperator: 'AND',
  }),
  ...Object.entries(sdmxResponses['dci-json']).map(([key, body]) => response(`sp:data:dci:${key}`, {
    label: `DCI JSON ${key}`, body: json(body), rules: [rule('query', 'format', 'equals', 'dci-json'), rule('params', 'key', 'equals', key)], rulesOperator: 'AND',
  })),
  response('sp:data:dci:none', {
    statusCode: 404, label: 'No DCI JSON results', body: httpError('err.request.not_found', 'No results found for this key'),
    rules: [rule('query', 'format', 'equals', 'dci-json')],
  }),
  ...Object.entries(sdmxResponses['sdmx-json']).map(([key, body]) => response(`sp:data:sdmx:${key}`, {
    label: `SDMX-JSON ${key}`, body: json(body), rules: [rule('params', 'key', 'equals', key)], headers: SDMX_HEADERS,
  })),
  response('sp:data:none', {
    statusCode: 404, label: 'No results', body: httpError('err.request.not_found', 'No results found for this key'), isDefault: true,
  }),
]);

const sp = environment({
  key: 'sp',
  name: 'DCI Early Warning System - SP',
  port: 3004,
  routes: [
    dciRoute('sp', 'ews/notify', 'API.EWS.02 POST /notify - receive alerts (CapAlert or Alert records) from the EWS', 'notify', { label: 'ACK', body: ack() }),
    dciRoute('sp', 'ews/on-subscribe', 'POST /on-subscribe - receive the subscription result', 'on-subscribe', { label: 'ACK', body: ack() }),
    dciRoute('sp', 'ews/on-unsubscribe', 'POST /on-unsubscribe - receive the unsubscribe result', 'on-unsubscribe', { label: 'ACK', body: ack() }),
    sdmxRoute,
    healthcheck('sp'),
  ],
  data: [bucket('sp', 'schemas', 'DCI EWS SP-side schemas (generated from test/features/support/helpers/schemas.js)',
    Object.fromEntries(['notify', 'on-subscribe', 'on-unsubscribe'].map((k) => [k, schemas[k]])))],
});

writeFileSync(path.join(root, 'mockoon-ews.json'), `${JSON.stringify(ews, null, 2)}\n`);
writeFileSync(path.join(root, 'mockoon-sp.json'), `${JSON.stringify(sp, null, 2)}\n`);
console.log('Generated mockoon-ews.json and mockoon-sp.json');
