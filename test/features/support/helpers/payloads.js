// Builders for DCI EWS requests ({ signature, header, message }).

import { randomUUID } from 'node:crypto';
import { senderId, receiverId } from './helpers.js';
import { testData } from './testdata.js';

const nowTs = () => new Date().toISOString();
const shortId = (prefix) => `${prefix}${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

export const newTransactionId = () => shortId('TXN');
export const newReferenceId = () => shortId('REF');

export function msgHeader(action, { totalCount = 1, senderUri } = {}) {
  return {
    version: '1.0.0',
    message_id: randomUUID(),
    message_ts: nowTs(),
    action,
    sender_id: senderId,
    ...(senderUri ? { sender_uri: senderUri } : {}),
    receiver_id: receiverId,
    total_count: totalCount,
    is_msg_encrypted: false,
  };
}

// Header of what the EWS sends (notify): the EWS is the sender, the SP the receiver.
export function callbackHeader(action, { status = 'succ', totalCount = 1, completedCount = totalCount } = {}) {
  return {
    version: '1.0.0',
    message_id: randomUUID(),
    message_ts: nowTs(),
    action,
    status,
    total_count: totalCount,
    completed_count: completedCount,
    sender_id: receiverId,
    receiver_id: senderId,
    is_msg_encrypted: false,
  };
}

export const envelope = (header, message) => ({ header, message });

// ----- subscriptions (API.EWS.01: "what type of events and severity") -----
// Named alert filters, as an SP system would subscribe.
export const alertFilters = {
  'floods of severe or extreme severity': { event: ['Flood', 'Flash Flood', 'River Flood'], severity: ['Severe', 'Extreme'] },
  'meteorological alerts': { category: ['Met'] },
  'meteorological alerts by category code': { category: ['MET', 'ENV'] },
  'alerts crossing a threshold': { threshold_status: ['CROSSING_THRESHOLD_1', 'TRIGGER'] },
  'immediate alerts': { urgency: ['Immediate'], certainty: ['Observed', 'Likely'] },
  'droughts by event code': { event_code: ['DR'] },
  'alerts for an administrative area': { area: [{ geocode: [{ valueName: 'ADMIN_CODE', value: 'LB-BI' }] }] },
  'alerts for a polygon': { area: [{ areaDesc: 'Bekaa', polygon: ['33.85,35.45 33.95,35.45 33.95,35.55 33.85,35.55 33.85,35.45'] }] },
  'actual alerts only': { status: ['Actual'], msg_type: ['Alert', 'Update', 'Cancel'] },
};

export function alertFilter(name) {
  if (!alertFilters[name]) throw new Error(`Unknown alert filter "${name}". Known: ${Object.keys(alertFilters).join(', ')}`);
  return structuredClone(alertFilters[name]);
}

export function subscribeItem(filterName = 'floods of severe or extreme severity', recordType = 'CapAlert') {
  const start = new Date();
  const end = new Date(start.getTime() + 365 * 24 * 3600 * 1000);
  return {
    reference_id: newReferenceId(),
    timestamp: nowTs(),
    subscribe_criteria: {
      version: '1.0.0',
      reg_type: testData.regType,
      frequency: { start_time: start.toISOString(), end_time: end.toISOString(), frequency: 'on event' },
      filter: alertFilter(filterName),
      notify_record_type: recordType,
    },
    locale: 'eng',
  };
}

export const subscribeMessage = (items) => ({ transaction_id: newTransactionId(), subscribe_request: items });

export const unsubscribeMessage = (codes) => ({ transaction_id: newTransactionId(), timestamp: nowTs(), subscription_codes: codes });

const correlationId = () => `EWS-${randomUUID().slice(0, 8)}`;

export function subscribeResponseMessage({ status = 'succ', reasonCode } = {}) {
  const item = subscribeItem();
  return {
    transaction_id: newTransactionId(),
    correlation_id: correlationId(),
    subscribe_response: [{
      reference_id: item.reference_id,
      timestamp: nowTs(),
      status,
      ...(reasonCode ? { status_reason_code: reasonCode, status_reason_message: 'Subscription refused' } : {}),
      ...(status === 'succ' ? {
        subscriptions: [{ code: 'SUB-EWS-0001', status: 'subscribe', timestamp: nowTs(), ...item.subscribe_criteria, locale: 'eng' }],
      } : {}),
      locale: 'eng',
    }],
  };
}

export function unsubscribeResponseMessage({ status = 'succ', reasonCode } = {}) {
  return {
    transaction_id: newTransactionId(),
    correlation_id: correlationId(),
    timestamp: nowTs(),
    status,
    ...(reasonCode ? { status_reason_code: reasonCode, status_reason_message: 'Unsubscribe refused' } : {}),
    subscription_status: [{ code: 'SUB-EWS-0001', status: 'unsubscribe' }],
  };
}

// ----- notify (API.EWS.02) -----
export function notifyEvent(recordType, records) {
  return {
    reference_id: newReferenceId(),
    timestamp: nowTs(),
    data: {
      version: '1.0.0',
      reg_type: testData.regType,
      reg_event_type: 'alert',
      reg_record_type: recordType,
      reg_records: records,
    },
    locale: 'eng',
  };
}

export const notifyMessage = (events) => ({ transaction_id: newTransactionId(), notify_event: events });

export const encryptedMessage = () => ({
  header: { alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: `${receiverId}|key-1` },
  ciphertext: 'eyJ0cmFuc2FjdGlvbl9pZCI6IlRYTjEyMyJ9',
  encrypted_key: 'OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGeipsEdY3mx',
  tag: 'Mz-VPPyU4RlcuYv1IwIvzw',
  iv: '48V1_ALb6US04U3b',
});

// ----- path helpers ("message.notify_event.0.data.reg_records.0.status") -----
const parsePath = (path) => path.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));

export function getPath(obj, path) {
  return parsePath(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = parsePath(path);
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = typeof keys[i + 1] === 'number' ? [] : {};
    o = o[k];
  });
  o[keys.at(-1)] = value;
}

export function deletePath(obj, path) {
  const keys = parsePath(path);
  const parent = keys.length === 1 ? obj : getPath(obj, keys.slice(0, -1).join('.'));
  if (parent && typeof parent === 'object') {
    if (Array.isArray(parent)) parent.splice(keys.at(-1), 1);
    else delete parent[keys.at(-1)];
  }
}

export const clone = (o) => structuredClone(o);
