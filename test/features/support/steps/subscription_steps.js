import './parameter_types.js';
import { Given, Then } from '@cucumber/cucumber';
import chai from 'chai';
import {
  subscribeItem, subscribeMessage, unsubscribeMessage, subscribeResponseMessage, unsubscribeResponseMessage,
} from '../helpers/payloads.js';
import { useRequest } from './common_steps.js';

const { expect } = chai;

// ---------------------------------------------------------------------------
// EWS-side requests (API.EWS.01)
// ---------------------------------------------------------------------------
Given('a subscribe request for {string} notified as {recordType} records', function (filter, type) {
  useRequest(this, subscribeMessage([subscribeItem(filter, type)]));
});

Given('a subscribe request for {string}', function (filter) {
  useRequest(this, subscribeMessage([subscribeItem(filter)]));
});

Given('a batch subscribe request for {string}', function (list) {
  useRequest(this, subscribeMessage(list.split(';').map((f) => subscribeItem(f.trim()))));
});

Given('an unsubscribe request for the subscription codes {string}', function (list) {
  useRequest(this, unsubscribeMessage(list.split(',').map((c) => c.trim())));
});

Then('every subscription should be confirmed with a subscription code', function () {
  const items = this.inspected.body?.message?.subscribe_response || [];
  expect(items, 'subscribe_response').to.not.be.empty;
  items.forEach((item, i) => {
    expect(item.status, `subscribe_response[${i}].status`).to.equal('succ');
    expect(item.subscriptions, `subscribe_response[${i}].subscriptions`).to.not.be.empty;
    item.subscriptions.forEach((s, j) => expect(s.status, `subscriptions[${j}].status`).to.equal('subscribe'));
  });
});

Then('every subscription should echo the requested filter and record type', function () {
  const asked = Object.fromEntries(this.request.message.subscribe_request.map((i) => [i.reference_id, i.subscribe_criteria]));
  (this.inspected.body?.message?.subscribe_response || []).forEach((item, i) => {
    const criteria = asked[item.reference_id];
    expect(criteria, `subscribe_response[${i}].reference_id ${item.reference_id} was not requested`).to.exist;
    (item.subscriptions || []).forEach((s, j) => {
      if (s.filter !== undefined) expect(s.filter, `subscriptions[${j}].filter`).to.deep.equal(criteria.filter);
      if (s.notify_record_type !== undefined) expect(s.notify_record_type, `subscriptions[${j}].notify_record_type`).to.equal(criteria.notify_record_type);
    });
  });
});

Then('every subscription code should be reported as unsubscribed', function () {
  const message = this.inspected.body?.message;
  const asked = this.request.message.subscription_codes;
  expect(message.status, 'message.status').to.equal('succ');
  const reported = (message.subscription_status || []).filter((s) => s.status === 'unsubscribe').map((s) => s.code);
  expect(reported, 'unsubscribed codes').to.have.members(asked);
});

// ---------------------------------------------------------------------------
// SP-side callbacks (what an EWS sends to an SP)
// ---------------------------------------------------------------------------
Given('an on-subscribe callback confirming the subscription', function () {
  useRequest(this, subscribeResponseMessage());
});

Given('an on-subscribe callback rejected with reason code {string}', function (code) {
  useRequest(this, subscribeResponseMessage({ status: 'rjct', reasonCode: code }));
});

Given('an on-unsubscribe callback confirming the unsubscription', function () {
  useRequest(this, unsubscribeResponseMessage());
});

Given('an on-unsubscribe callback rejected with reason code {string}', function (code) {
  useRequest(this, unsubscribeResponseMessage({ status: 'rjct', reasonCode: code }));
});
