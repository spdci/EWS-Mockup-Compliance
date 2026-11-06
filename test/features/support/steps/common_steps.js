import './parameter_types.js';
import { Given, When, Then } from '@cucumber/cucumber';
import chai from 'chai';
import { endpoints, endpointUrl, callbackBaseUrl, callbackTimeout } from '../helpers/helpers.js';
import { request } from '../helpers/http.js';
import { buildRequest } from '../helpers/defaults.js';
import { validateSchema, validateMessage, validateResponse, formatErrors } from '../helpers/validator.js';
import { setPath, deletePath } from '../helpers/payloads.js';
import { startCallbackServer, waitForCallback } from '../helpers/callbackServer.js';

const { expect } = chai;

export const REMOVED = '<removed>';

export function useRequest(world, message) {
  world.request = buildRequest(world.endpointName, message);
}

export function expectNoErrors(errors, what) {
  expect(errors, `${what}:\n${formatErrors(errors)}`).to.be.empty;
}

const shown = (world) => world.response.rawBody?.slice(0, 500);

// ---------------------------------------------------------------------------
// Request set-up
// ---------------------------------------------------------------------------
Given('the {string} endpoint', function (name) {
  if (!endpoints[name]) throw new Error(`Unknown endpoint "${name}". Known: ${Object.keys(endpoints).join(', ')}`);
  this.endpointName = name;
  this.pathParams = {};
  this.query = {};
});

Given('a valid request', function () {
  useRequest(this);
});

Given('the request field {string} is set to {string}', function (path, json) {
  setPath(this.request, path, JSON.parse(json));
});

Given('the request field {string} is removed', function (path) {
  deletePath(this.request, path);
});

// For Scenario Outlines: value is JSON, or <removed> to delete the field.
Given('the request field {string} becomes {string}', function (path, value) {
  if (value === REMOVED) deletePath(this.request, path);
  else setPath(this.request, path, JSON.parse(value));
});

Given('the query parameter {string} is {string}', function (name, value) {
  this.query[name] = value;
});

Given('the callback listener is used as sender_uri', async function () {
  const { callback } = endpoints[this.endpointName];
  if (!callback) throw new Error(`"${this.endpointName}" is not an async endpoint`);
  await startCallbackServer();
  this.request.header.sender_uri = callbackBaseUrl + callback.path;
});

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
export async function send(world) {
  const endpoint = endpoints[world.endpointName];
  world.response = await request(endpoint.method, endpointUrl(world.endpointName, world.pathParams), {
    body: endpoint.method === 'GET' ? undefined : world.request,
    query: world.query,
  });
  world.inspected = { source: 'response', kind: world.responseKind || endpoint.responseSchema, body: world.response.body };
}

When('the request is sent', async function () {
  await send(this);
});

When('the raw body {string} is sent', async function (raw) {
  const endpoint = endpoints[this.endpointName];
  this.response = await request(endpoint.method, endpointUrl(this.endpointName, this.pathParams), { rawBody: raw });
  this.inspected = { source: 'response', kind: endpoint.responseSchema, body: this.response.body };
});

// ---------------------------------------------------------------------------
// Transport-level checks
// ---------------------------------------------------------------------------
Then('the HTTP status should be {int}', function (status) {
  expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.equal(status);
});

// application/json, or a JSON media type: application/geo+json (OGC), application/vnd.sdmx.data+json (SDMX).
Then('the response should have a JSON content type', function () {
  expect(this.response.headers['content-type'] || '', 'Content-Type header').to.match(/^application\/([a-z0-9.-]+\+)?json/i);
});

Then('the response should have the content type {string}', function (type) {
  expect(this.response.headers['content-type'] || '', 'Content-Type header').to.match(new RegExp(`^${type.replace(/[.+]/g, '\\$&')}`, 'i'));
});

Then('the response should be received within {int} ms', function (ms) {
  expect(this.response.responseTime).to.be.lessThan(ms);
});

// ---------------------------------------------------------------------------
// Message-level checks
// ---------------------------------------------------------------------------
Then('the request should be a valid {string} message', function (kind) {
  expectNoErrors(validateMessage(kind, this.request), `The request built by the suite is not a valid "${kind}" message`);
});

Then('the response should be a valid acknowledgement with ack_status {string}', function (ackStatus) {
  expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.be.within(200, 299);
  expectNoErrors(validateSchema('ack', this.response.body).errors, 'The acknowledgement does not follow the spec');
  expect(this.response.body.message.ack_status).to.equal(ackStatus);
});

Then(/^the (response|callback) should be a valid "([^"]*)" message$/, function (source, kind) {
  const body = source === 'response' ? this.response.body : this.callback.body;
  if (source === 'response') {
    expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.be.within(200, 299);
  }
  this.inspected = { source, kind, body };
  expectNoErrors(validateMessage(kind, body, this.request), `The ${source} is not a valid "${kind}" message`);
});

// OGC API Features and SDMX responses are not DCI envelopes.
Then('the response should be a valid {string}', function (kind) {
  expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.be.within(200, 299);
  this.inspected = { source: 'response', kind, body: this.response.body };
  expectNoErrors(validateResponse(kind, this.response.body), `The response is not a valid "${kind}"`);
});

// A request that breaks the spec must be refused using one of the error forms of the API:
//  - DCI endpoints: HTTP 4xx with an ERR acknowledgement or an HttpErrorResponse, or HTTP 2xx
//    with ack_status ERR;
//  - OGC API Features endpoints: HTTP 4xx with an OGC exception ({ code, description });
//  - SDMX: HTTP 4xx with an HttpErrorResponse.
Then('the request should be rejected according to the DCI error model', function () {
  const { statusCode, body } = this.response;
  if (statusCode >= 500) expect.fail(`Server error ${statusCode} instead of a client-side rejection: ${shown(this)}`);

  const ack = validateSchema('ack', body);
  if (ack.valid && body.message.ack_status === 'ERR') return;

  if (statusCode >= 400) {
    const httpError = validateSchema('http-error', body);
    const ogc = validateSchema('ogc-exception', body);
    expect(ack.valid || httpError.valid || ogc.valid,
      `HTTP ${statusCode} rejection body is neither an acknowledgement, an HttpErrorResponse nor an OGC exception:\n${formatErrors([...ack.errors, ...httpError.errors, ...ogc.errors])}\nbody: ${shown(this)}`).to.be.true;
    if (ack.valid) expect(body.message.ack_status, 'ack_status of a rejected request').to.equal('ERR');
    return;
  }
  expect.fail(`The invalid request was accepted (HTTP ${statusCode}): ${shown(this)}`);
});

Then('the response should be an OGC exception with HTTP status {int}', function (status) {
  expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.equal(status);
  expectNoErrors(validateSchema('ogc-exception', this.response.body).errors, 'The error body is not an OGC API exception ({ code, description })');
});

Then('the response should be an HTTP error with status {int}', function (status) {
  expect(this.response.statusCode, `HTTP status (body: ${shown(this)})`).to.equal(status);
  const httpError = validateSchema('http-error', this.response.body);
  const ogc = validateSchema('ogc-exception', this.response.body);
  expect(httpError.valid || ogc.valid, `The error body is neither an HttpErrorResponse nor an OGC exception:\n${formatErrors([...httpError.errors, ...ogc.errors])}`).to.be.true;
});

// ---------------------------------------------------------------------------
// Async callbacks
// ---------------------------------------------------------------------------
Then('an {string} callback should be received', async function (action) {
  const { callback } = endpoints[this.endpointName];
  expect(callback?.action, `"${this.endpointName}" does not produce an "${action}" callback`).to.equal(action);
  const transactionId = this.request.message.transaction_id;
  this.callback = await waitForCallback(
    (c) => c.path.replace(/^\//, '').startsWith(callback.path) && c.body?.message?.transaction_id === transactionId,
    callbackTimeout,
  );
  this.inspected = { source: 'callback', kind: callback.schema, body: this.callback.body };
});

// Regex rather than {string}: expected messages may contain quotes.
Then(/^the request should not be a valid "([^"]*)" message because of "(.*)"$/, function (kind, expected) {
  const errors = validateMessage(kind, this.request);
  expect(errors.some((e) => e.includes(expected)), `Expected an error mentioning "${expected}" but got:\n${formatErrors(errors)}`).to.be.true;
});
