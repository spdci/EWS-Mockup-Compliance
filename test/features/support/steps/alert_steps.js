// Alerts: the OGC API Features collection (API.EWS.03 / API.EWS.04) and notifications (API.EWS.02).

import './parameter_types.js';
import { Given, Then } from '@cucumber/cucumber';
import chai from 'chai';
import { recordFixture } from '../helpers/defaults.js';
import { testAlertId } from '../helpers/testdata.js';
import { notifyEvent, notifyMessage } from '../helpers/payloads.js';
import { extractRecords, capAlertOf, categoryValue } from '../helpers/validator.js';
import { ALERT_LEVEL_FILTERS } from '../helpers/schemas.js';
import { useRequest } from './common_steps.js';

const { expect } = chai;

const returnedAlerts = (world) => extractRecords(world.inspected.body, world.inspected.kind).filter((r) => r.type === 'Alert' || r.type === 'CapAlert');
const capOf = ({ type, record }) => (type === 'Alert' ? capAlertOf(record) : record);

// The CAP values of an alert for a property (alert level, or any info block).
function valuesOf(cap, property) {
  if (!cap) return [];
  if (ALERT_LEVEL_FILTERS.includes(property)) return [cap[property]];
  const values = (cap.info || []).flatMap((info) => [].concat(info?.[property] ?? []));
  return property === 'category' ? values.map(categoryValue) : values;
}

// ---------------------------------------------------------------------------
// Fetch (GET /collections/alerts/items[/{alertId}])
// ---------------------------------------------------------------------------
Given('the alert {string}', function (name) {
  this.pathParams.alertId = testAlertId(name);
});

Given('the alert identifier {string}', function (id) {
  this.pathParams.alertId = id;
});

Given('the alerts are filtered by {string} = {string}', function (property, value) {
  this.query[property] = value;
});

Given('at most {int} alert(s) are asked for', function (limit) {
  this.query.limit = String(limit);
});

Then('every returned alert should have {string} = {string}', function (property, value) {
  const found = returnedAlerts(this);
  const expected = property === 'category' ? categoryValue(value) : value;
  found.forEach((r) => expect(valuesOf(capOf(r), property), `${r.where} ${property}`).to.include(expected));
});

Then('at least {int} alert(s) should be returned', function (count) {
  expect(returnedAlerts(this).length).to.be.at.least(count);
});

Then('at most {int} alert(s) should be returned', function (count) {
  expect(returnedAlerts(this).length).to.be.at.most(count);
});

Then('no alert should be returned', function () {
  expect(returnedAlerts(this), 'returned alerts').to.be.empty;
});

Then('numberReturned should match the features returned', function () {
  const body = this.response.body;
  if (body.numberReturned !== undefined) expect(body.numberReturned, 'numberReturned').to.equal(body.features.length);
  if (body.numberMatched !== undefined) expect(body.numberMatched, 'numberMatched').to.be.at.least(body.features.length);
});

Then('the returned alert should be {string}', function (name) {
  const id = testAlertId(name);
  const body = this.response.body;
  expect(String(body.id), 'Feature id').to.equal(id);
  expect(capAlertOf(body)?.identifier, 'CapAlert identifier').to.equal(id);
});

Then('the collection should link to its items', function () {
  const links = this.response.body?.links || [];
  expect(links.some((l) => l.rel === 'items'), `links ${JSON.stringify(links)} should include rel "items"`).to.be.true;
});

Then('every alert in the collection should be a different alert', function () {
  const keys = returnedAlerts(this).map((r) => { const cap = capOf(r); return `${cap?.identifier}|${cap?.sender}`; });
  const duplicates = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
  expect(duplicates, 'alerts listed more than once (identifier|sender)').to.be.empty;
});

// ---------------------------------------------------------------------------
// Create / replace (POST /collections/alerts/items, PUT /collections/alerts/items/{alertId})
// ---------------------------------------------------------------------------
Given('the {string} Alert as the request body', function (name) {
  this.request = recordFixture('Alert', name);
  if (this.endpointName === 'replace alert') this.pathParams.alertId = String(this.request.id);
});

Given('a request body carrying the {string} CapAlert as an Alert without geometry', function (name) {
  const cap = recordFixture('CapAlert', name);
  this.request = { type: 'Feature', id: cap.identifier, geometry: null, properties: cap };
  if (this.endpointName === 'replace alert') this.pathParams.alertId = cap.identifier;
});

Then('the response should be the alert that was sent', function () {
  const body = this.response.body;
  expect(String(body?.id), 'Feature id').to.equal(String(this.request.id));
  expect(capAlertOf(body)?.identifier, 'CapAlert identifier').to.equal(capAlertOf(this.request)?.identifier);
});

// ---------------------------------------------------------------------------
// Notify (POST /notify): what an EWS sends to an SP
// ---------------------------------------------------------------------------
Given('a notify request carrying the {string} {recordType} record', function (name, type) {
  useRequest(this, notifyMessage([notifyEvent(type, [recordFixture(type, name)])]));
});

Given('a notify request carrying the {string} {recordType} record as a single object', function (name, type) {
  useRequest(this, notifyMessage([notifyEvent(type, recordFixture(type, name))]));
});

Given('a notify request carrying the {recordType} records {string}', function (type, list) {
  useRequest(this, notifyMessage([notifyEvent(type, list.split(',').map((n) => recordFixture(type, n.trim())))]));
});

// One notification with several events ("CapAlert:full, Alert:earthquake, ...").
Given('a batch notify request carrying {string}', function (list) {
  const events = list.split(',').map((p) => p.trim().split(':')).map(([type, name]) => notifyEvent(type, [recordFixture(type, name)]));
  useRequest(this, notifyMessage(events));
});
