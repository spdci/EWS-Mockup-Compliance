// A valid, realistic request for every endpoint.

import { endpoints } from './helpers.js';
import { records } from '../fixtures/records.js';
import {
  msgHeader, callbackHeader, envelope, subscribeItem, subscribeMessage, unsubscribeMessage,
  subscribeResponseMessage, unsubscribeResponseMessage, notifyEvent, notifyMessage,
} from './payloads.js';

// A reference record: records.<type>.<name> (the published examples are named "spec example").
export function recordFixture(type, name) {
  if (!records[type]) throw new Error(`Unknown record type "${type}". Known: ${Object.keys(records).join(', ')}`);
  if (!records[type][name]) throw new Error(`Unknown ${type} fixture "${name}". Known: ${Object.keys(records[type]).join(', ')}`);
  return structuredClone(records[type][name]);
}

export function defaultMessage(endpointName) {
  switch (endpointName) {
    case 'subscribe':
      return subscribeMessage([subscribeItem()]);
    case 'unsubscribe':
      return unsubscribeMessage(['SUB-EWS-0001']);
    case 'on-subscribe':
      return subscribeResponseMessage();
    case 'on-unsubscribe':
      return unsubscribeResponseMessage();
    case 'notify':
      return notifyMessage([notifyEvent('CapAlert', [recordFixture('CapAlert', 'spec example')])]);
    default:
      throw new Error(`No default message for endpoint "${endpointName}"`);
  }
}

const usesCallbackHeader = new Set(['notify']);

// DCI envelope for the DCI endpoints; the Alert Feature itself for create / replace.
export function buildRequest(endpointName, message) {
  if (['create alert', 'replace alert'].includes(endpointName)) return message ?? recordFixture('Alert', 'full');
  const body = message ?? defaultMessage(endpointName);
  const { action } = endpoints[endpointName];
  const items = body.subscribe_request || body.subscribe_response || body.notify_event || [body];
  const header = usesCallbackHeader.has(endpointName)
    ? callbackHeader(action, { totalCount: items.length })
    : msgHeader(action, { totalCount: items.length });
  return envelope(header, body);
}
