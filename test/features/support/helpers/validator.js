// Validation of DCI EWS payloads: JSON Schema (structure, types, formats, code lists) plus the
// rules a schema cannot express (real calendar dates, chronology, CAP polygon / circle geometry,
// GeoJSON axis order against the CAP polygons, duplicate alerts, SDMX key / codelist / privacy
// rules, and request/response correlation).

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  schemas, codes, sdmxCodeLists, categoryCodes, CAP_ALERT_RECORD_TYPE_PATTERN, ALERT_RECORD_TYPE_PATTERN,
  AREA_CODE_PATTERN, PERIOD_PATTERN, ISO_DATE_PATTERN,
} from './schemas.js';
import { minCellCount } from './helpers.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const compiled = {};
const compile = (name) => {
  if (!schemas[name]) throw new Error(`Unknown schema "${name}". Known: ${Object.keys(schemas).join(', ')}`);
  compiled[name] ??= ajv.compile(schemas[name]);
  return compiled[name];
};

const formatAjvErrors = (errors = []) => {
  // anyOf/if branches produce noisy duplicates, keep the most specific ones.
  const seen = new Set();
  const deeper = (e) => errors.some((o) => o.instancePath.startsWith(`${e.instancePath}/`));
  return errors
    .filter((e) => !['anyOf', 'if', 'oneOf'].includes(e.keyword))
    .filter((e) => !(e.keyword === 'type' && deeper(e)))
    .map((e) => {
      const where = e.instancePath || '(root)';
      const extra = e.keyword === 'enum' ? ` ${JSON.stringify(e.params.allowedValues)}`
        : e.keyword === 'const' ? ` ${JSON.stringify(e.params.allowedValue)}`
          : e.keyword === 'required' ? '' : '';
      return `${where} ${e.message}${extra}`;
    })
    .filter((m) => (seen.has(m) ? false : seen.add(m)));
};

export function validateSchema(name, data) {
  const validate = compile(name);
  const valid = validate(data);
  return { valid, errors: valid ? [] : formatAjvErrors(validate.errors) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const RECORD_TYPES = ['CapAlert', 'Alert', 'SdmxJson', 'DciStatistics'];

export function recordTypeOf(value) {
  if (typeof value !== 'string') return undefined;
  if (new RegExp(CAP_ALERT_RECORD_TYPE_PATTERN).test(value)) return 'CapAlert';
  if (new RegExp(ALERT_RECORD_TYPE_PATTERN).test(value)) return 'Alert';
  return undefined;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const isoDateRe = new RegExp(ISO_DATE_PATTERN);

export function isRealDate(value) {
  if (typeof value !== 'string' || !isoDateRe.test(value)) return false;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Instant of a date_time; a value without timezone is read as UTC (the standard does not say).
const instant = (value) => {
  if (typeof value !== 'string' || !isRealDate(value)) return undefined;
  const t = Date.parse(/T.*(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(t) ? undefined : t;
};
const SKEW_MS = 24 * 3600 * 1000; // clock-skew tolerance for "not in the future"

// The CapAlert carried by an Alert Feature (properties, or properties.capAlert as in the example).
export function capAlertOf(feature) {
  const properties = feature?.properties;
  if (!isObject(properties)) return undefined;
  return isObject(properties.capAlert) ? properties.capAlert : properties;
}

// CD.EWS.01: a category sent as its code ("MET") is the same category as its value ("Met").
export const categoryValue = (c) => categoryCodes[c] ?? c;

// "33.85,35.45 33.95,35.45 ..." -> [[lat, lon], ...]
export const capPoints = (polygon) => String(polygon).trim().split(/\s+/).map((pair) => pair.split(',').map(Number));

// ---------------------------------------------------------------------------
// CapAlert (DO.EWS.02 - DO.EWS.06)
// ---------------------------------------------------------------------------
const ALERT_DATES = ['sent', 'assessment_date', 'created_at'];
const INFO_DATES = ['effective', 'onset', 'expires', 'created_at'];

function checkDates(record, fields, where) {
  const errors = [];
  for (const field of fields) {
    const value = record[field];
    if (typeof value !== 'string') continue; // type errors are reported by the schema
    if (!isRealDate(value)) errors.push(`${where}.${field} "${value}" is not a real calendar date`);
  }
  return errors;
}

function checkPolygon(polygon, where) {
  if (typeof polygon !== 'string') return [];
  const points = capPoints(polygon);
  if (points.some((p) => p.length !== 2 || p.some(Number.isNaN))) return []; // format reported by the schema
  const errors = [];
  points.forEach(([lat, lon], i) => {
    if (lat < -90 || lat > 90) errors.push(`${where} point ${i + 1} latitude ${lat} is outside -90..90 (CAP polygons are "lat,lon")`);
    if (lon < -180 || lon > 180) errors.push(`${where} point ${i + 1} longitude ${lon} is outside -180..180`);
  });
  const [first, last] = [points[0], points.at(-1)];
  if (first[0] !== last[0] || first[1] !== last[1]) errors.push(`${where} is not closed: the first point ${first.join(',')} must equal the last ${last.join(',')}`);
  return errors;
}

function checkCircle(circle, where) {
  if (typeof circle !== 'string') return [];
  const [center] = circle.trim().split(/\s+/);
  const [lat, lon] = center.split(',').map(Number);
  const errors = [];
  if (lat < -90 || lat > 90) errors.push(`${where} centre latitude ${lat} is outside -90..90 (CAP circles are "lat,lon radius")`);
  if (lon < -180 || lon > 180) errors.push(`${where} centre longitude ${lon} is outside -180..180`);
  return errors;
}

function checkInfo(info, where, alert) {
  if (!isObject(info)) return [];
  const errors = [...checkDates(info, INFO_DATES, where)];

  const categories = asList(info.category).map(categoryValue);
  const dupCategories = [...new Set(categories.filter((c, i) => categories.indexOf(c) !== i))];
  if (dupCategories.length) errors.push(`${where}.category lists ${dupCategories.join(', ')} more than once`);
  const responses = asList(info.response_type);
  const dupResponses = [...new Set(responses.filter((c, i) => responses.indexOf(c) !== i))];
  if (dupResponses.length) errors.push(`${where}.response_type lists ${dupResponses.join(', ')} more than once`);
  if (responses.length > 1 && (responses.includes('None') || responses.includes('All clear'))) {
    errors.push(`${where}.response_type "None" / "All clear" cannot be combined with other responses`);
  }

  // Chronology: effective (default: sent) and onset happen before expires.
  const expires = instant(info.expires);
  const effective = instant(info.effective) ?? instant(alert?.sent);
  const onset = instant(info.onset);
  if (expires !== undefined && effective !== undefined && expires <= effective) {
    errors.push(`${where}.expires ${info.expires} is not after ${info.effective ? `effective ${info.effective}` : `sent ${alert.sent}`}`);
  }
  if (expires !== undefined && onset !== undefined && expires < onset) {
    errors.push(`${where}.expires ${info.expires} is before onset ${info.onset}`);
  }

  asList(info.area).forEach((area, i) => {
    if (!isObject(area)) return;
    asList(area.polygon).forEach((p, j) => errors.push(...checkPolygon(p, `${where}.area[${i}].polygon[${j}]`)));
    asList(area.circle).forEach((c, j) => errors.push(...checkCircle(c, `${where}.area[${i}].circle[${j}]`)));
  });
  return errors;
}

export function checkCapAlertRules(alert, where = 'record') {
  if (!isObject(alert)) return [];
  const errors = [...checkDates(alert, ALERT_DATES, where)];
  const sent = instant(alert.sent);
  if (sent !== undefined && sent > Date.now() + SKEW_MS) errors.push(`${where}.sent ${alert.sent} is in the future`);
  // CAP 1.2 3.2.1: restriction is used when scope is "Restricted".
  if (alert.scope === 'Restricted' && !alert.restriction) errors.push(`${where}.restriction is required when scope is "Restricted"`);
  asList(alert.info).forEach((info, i) => errors.push(...checkInfo(info, `${where}.info[${i}]`, alert)));
  return errors;
}

// ---------------------------------------------------------------------------
// Alert Feature (DO.EWS.01)
// ---------------------------------------------------------------------------
const rings = (geometry) => {
  if (!isObject(geometry) || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
};
const positions = (geometry) => {
  if (!isObject(geometry) || !Array.isArray(geometry.coordinates)) return [];
  const flatten = (c) => (typeof c[0] === 'number' ? [c] : c.flatMap(flatten));
  return flatten(geometry.coordinates);
};
// Same ring whatever its starting point and winding (RFC 7946 recommends counter-clockwise
// exterior rings; the DO.EWS.01 example winds its geometry the other way round from its CAP polygon).
const pointSet = (r) => new Set(r.filter((p) => Array.isArray(p)).map((p) => `${p[0]},${p[1]}`));
const sameRing = (a, b) => {
  const [sa, sb] = [pointSet(a), pointSet(b)];
  return sa.size === sb.size && [...sa].every((p) => sb.has(p));
};

export function checkAlertRules(feature, where = 'record') {
  if (!isObject(feature)) return [];
  const errors = [];
  const geometry = feature.geometry;

  positions(geometry).forEach((p, i) => {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return;
    if (p[0] < -180 || p[0] > 180) errors.push(`${where}.geometry position ${i + 1} longitude ${p[0]} is outside -180..180 (GeoJSON is [lon, lat])`);
    if (p[1] < -90 || p[1] > 90) errors.push(`${where}.geometry position ${i + 1} latitude ${p[1]} is outside -90..90 (GeoJSON is [lon, lat])`);
  });
  rings(geometry).forEach((r, i) => {
    if (!Array.isArray(r) || r.length < 4) return;
    const [first, last] = [r[0], r.at(-1)];
    if (first?.[0] !== last?.[0] || first?.[1] !== last?.[1]) errors.push(`${where}.geometry ring ${i + 1} is not closed`);
  });

  const cap = capAlertOf(feature);
  if (cap) {
    errors.push(...checkCapAlertRules(cap, `${where}.properties${feature.properties.capAlert ? '.capAlert' : ''}`));
    if (feature.id !== undefined && cap.identifier !== undefined && String(feature.id) !== cap.identifier) {
      errors.push(`${where}.id "${feature.id}" is not the identifier of the alert it carries ("${cap.identifier}")`);
    }
    // Every CAP polygon ("lat,lon") must appear in the geometry as [lon, lat].
    const geoRings = rings(geometry);
    if (geoRings.length) {
      asList(cap.info).flatMap((info) => asList(info?.area)).flatMap((a) => asList(a?.polygon)).forEach((polygon) => {
        if (typeof polygon !== 'string') return;
        const points = capPoints(polygon);
        if (points.some((p) => p.length !== 2 || p.some(Number.isNaN))) return;
        const lonLat = points.map(([lat, lon]) => [lon, lat]);
        if (geoRings.some((r) => sameRing(r, lonLat))) return;
        if (geoRings.some((r) => sameRing(r, points))) {
          errors.push(`${where}.geometry gives the CAP polygon "${polygon}" in lat,lon order: GeoJSON positions are [lon, lat]`);
        } else {
          errors.push(`${where}.geometry does not contain the CAP polygon "${polygon}" (as [lon, lat] positions)`);
        }
      });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// SDMX: aggregated member statistics (API.EWS.05, sdmx-dci-member-example)
// ---------------------------------------------------------------------------
export const SDMX_DIMENSIONS = ['REF_AREA', 'SEX', 'DISABILITY_STATUS', 'AGE_GROUP', 'TIME_PERIOD', 'DENOMINATOR_TYPE'];
export const SDMX_OBS_ATTRIBUTES = ['OBS_STATUS', 'CONFIDENTIALITY', 'EXCLUSION_IND', 'NON_MATCH_COUNT', 'COVERAGE_RATE', 'LAST_VERIFIED_DATE', 'UNIT_MEASURE'];
export const SDMX_DATASET_ATTRIBUTES = ['SOURCE', 'PROFILE_DENOMINATOR_DEF'];
// The two key layouts published: API.EWS.05 (… TIME_PERIOD) and the member example (… DENOMINATOR_TYPE).
export const SDMX_KEY_LAYOUTS = [
  ['REF_AREA', 'SEX', 'DISABILITY_STATUS', 'AGE_GROUP', 'TIME_PERIOD'],
  ['REF_AREA', 'SEX', 'DISABILITY_STATUS', 'AGE_GROUP', 'DENOMINATOR_TYPE'],
  ['REF_AREA', 'SEX', 'DISABILITY_STATUS', 'AGE_GROUP'],
];

export function checkSdmxCode(dimension, code, where) {
  if (typeof code !== 'string') return [`${where} ${dimension} code must be a string`];
  if (dimension === 'REF_AREA') return new RegExp(AREA_CODE_PATTERN).test(code) ? [] : [`${where} REF_AREA "${code}" is not an area code`];
  if (dimension === 'TIME_PERIOD') return new RegExp(PERIOD_PATTERN).test(code) ? [] : [`${where} TIME_PERIOD "${code}" is not an SDMX period (YYYY, YYYY-MM, YYYY-Qn, YYYY-MM-DD)`];
  const list = sdmxCodeLists[dimension];
  if (!list) return [`${where} dimension "${dimension}" is not a dimension of DCI_MEMBER_STATISTICS (${SDMX_DIMENSIONS.join(', ')})`];
  return Object.hasOwn(list, code) ? [] : [`${where} ${dimension} "${code}" is not in CL_${dimension} (${Object.keys(list).join(', ')})`];
}

// Observation-level rules, shared by both formats.
function checkObservation(value, attributes, where) {
  const errors = [];
  const attrs = isObject(attributes) ? attributes : {};
  for (const key of Object.keys(attrs)) {
    if (!SDMX_OBS_ATTRIBUTES.includes(key) && key !== 'OBS_VALUE') errors.push(`${where} attribute "${key}" is not defined in DCI_MEMBER_STATISTICS (only codes, counts and the DSD attributes may be shared)`);
  }
  if (attrs.OBS_STATUS !== undefined && !codes.obsStatus.includes(attrs.OBS_STATUS)) errors.push(`${where} OBS_STATUS "${attrs.OBS_STATUS}" is not in CL_OBS_STATUS`);
  if (attrs.CONFIDENTIALITY !== undefined && !codes.confStatus.includes(attrs.CONFIDENTIALITY)) errors.push(`${where} CONFIDENTIALITY "${attrs.CONFIDENTIALITY}" is not in CL_CONF_STATUS`);
  if (attrs.EXCLUSION_IND !== undefined && typeof attrs.EXCLUSION_IND !== 'boolean') errors.push(`${where} EXCLUSION_IND must be a boolean`);
  if (attrs.NON_MATCH_COUNT !== undefined && !(Number.isInteger(attrs.NON_MATCH_COUNT) && attrs.NON_MATCH_COUNT >= 0)) errors.push(`${where} NON_MATCH_COUNT must be a non-negative integer`);
  if (attrs.COVERAGE_RATE !== undefined && !(typeof attrs.COVERAGE_RATE === 'number' && attrs.COVERAGE_RATE >= 0 && attrs.COVERAGE_RATE <= 100)) errors.push(`${where} COVERAGE_RATE must be a percentage (0..100)`);
  if (attrs.LAST_VERIFIED_DATE !== undefined && !isRealDate(attrs.LAST_VERIFIED_DATE)) errors.push(`${where} LAST_VERIFIED_DATE "${attrs.LAST_VERIFIED_DATE}" is not an ISO 8601 date`);

  // EXCLUSION_IND flags an affected area with zero registered members.
  if (typeof attrs.EXCLUSION_IND === 'boolean' && typeof value === 'number' && attrs.EXCLUSION_IND !== (value === 0)) {
    errors.push(`${where} EXCLUSION_IND is ${attrs.EXCLUSION_IND} but OBS_VALUE is ${value}`);
  }
  // PRS.EWS.02: minimum cell counts for anonymization.
  if (typeof value === 'number' && value > 0 && value < minCellCount) {
    errors.push(`${where} OBS_VALUE ${value} is below the minimum cell count ${minCellCount} and must be suppressed (null, CONFIDENTIALITY "C")`);
  }
  if (value === null) {
    if (attrs.CONFIDENTIALITY === undefined || attrs.CONFIDENTIALITY === 'F') errors.push(`${where} OBS_VALUE is suppressed (null) but CONFIDENTIALITY does not say so (expected a code other than "F", e.g. "C")`);
    for (const revealing of ['COVERAGE_RATE', 'NON_MATCH_COUNT']) {
      if (attrs[revealing] !== undefined) errors.push(`${where} ${revealing} is sent with a suppressed OBS_VALUE and could reveal it`);
    }
  }
  return errors;
}

function checkDatasetAttributes(attributes, where) {
  if (!isObject(attributes)) return [];
  return Object.keys(attributes).filter((k) => !SDMX_DATASET_ATTRIBUTES.includes(k))
    .map((k) => `${where} dataset attribute "${k}" is not defined in DCI_MEMBER_STATISTICS`);
}

export function checkSdmxJsonRules(message, where = 'record') {
  if (!isObject(message)) return [];
  const errors = [];
  const seriesDims = message.structure?.dimensions?.series;
  const obsDims = message.structure?.dimensions?.observation || [];
  if (!Array.isArray(seriesDims)) return errors;

  const positionsSeen = seriesDims.map((d) => d?.keyPosition).filter((p) => p !== undefined);
  const sortedPositions = [...positionsSeen].sort((a, b) => a - b);
  if (positionsSeen.length && !sortedPositions.every((p, i) => p === i)) {
    errors.push(`${where}.structure.dimensions.series keyPosition values ${JSON.stringify(positionsSeen)} must be 0..${seriesDims.length - 1}, each once`);
  }
  const ordered = positionsSeen.length === seriesDims.length ? [...seriesDims].sort((a, b) => a.keyPosition - b.keyPosition) : seriesDims;
  const ids = [...ordered, ...obsDims].map((d) => d?.id);
  [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].forEach((id) => errors.push(`${where}.structure.dimensions lists ${id} more than once`));
  for (const required of ['REF_AREA']) {
    if (!ids.includes(required)) errors.push(`${where}.structure.dimensions has no ${required} dimension`);
  }
  [...ordered, ...obsDims].forEach((d, i) => {
    if (!isObject(d)) return;
    (d.values || []).forEach((v, j) => errors.push(...checkSdmxCode(d.id, v?.id, `${where}.structure.dimensions.${d.id}.values[${j}]`)));
  });

  (message.dataSets || []).forEach((dataSet, s) => {
    const at = `${where}.dataSets[${s}]`;
    errors.push(...checkDatasetAttributes(dataSet?.attributes, `${at}.attributes`));
    for (const [key, series] of Object.entries(dataSet?.series || {})) {
      const indexes = key.split(':').map(Number);
      if (indexes.length !== ordered.length) {
        errors.push(`${at}.series["${key}"] has ${indexes.length} position(s); the structure has ${ordered.length} series dimension(s)`);
        continue;
      }
      indexes.forEach((idx, p) => {
        if (!ordered[p]?.values?.[idx]) errors.push(`${at}.series["${key}"] position ${p} (${ordered[p]?.id}) index ${idx} has no value in the structure`);
      });
      for (const [obsKey, observation] of Object.entries(series?.observations || {})) {
        const where2 = `${at}.series["${key}"].observations["${obsKey}"]`;
        if (obsDims.length && !obsDims[0]?.values?.[Number(obsKey)]) errors.push(`${where2} index ${obsKey} has no ${obsDims[0]?.id} value in the structure`);
        const [value, obsAttrs] = Array.isArray(observation) ? observation : [];
        errors.push(...checkObservation(value, { ...(series?.attributes || {}), ...(isObject(obsAttrs) ? obsAttrs : {}) }, where2));
      }
    }
  });
  return errors;
}

export function checkDciStatisticsRules(message, where = 'record') {
  if (!isObject(message)) return [];
  const errors = [];
  (message.data?.dataSets || []).forEach((dataSet, s) => {
    const at = `${where}.data.dataSets[${s}]`;
    errors.push(...checkDatasetAttributes(dataSet?.attributes, `${at}.attributes`));
    for (const [key, observation] of Object.entries(dataSet?.observations || {})) {
      const parts = key.split('.');
      // The layout whose codes all match; otherwise TIME_PERIOD when the last part looks like a
      // date, DENOMINATOR_TYPE when it does not.
      const layout = SDMX_KEY_LAYOUTS.find((l) => l.length === parts.length
        && parts.every((code, i) => checkSdmxCode(l[i], code, '').length === 0))
        || SDMX_KEY_LAYOUTS.find((l) => l.length === parts.length
          && (parts.length < 5 || (l[4] === 'TIME_PERIOD') === /^\d/.test(parts[4])));
      const where2 = `${at}.observations["${key}"]`;
      if (!layout) {
        errors.push(`${where2} key must be REF_AREA.SEX.DISABILITY_STATUS.AGE_GROUP followed by TIME_PERIOD or DENOMINATOR_TYPE`);
        continue;
      }
      parts.forEach((code, i) => errors.push(...checkSdmxCode(layout[i], code, where2)));
      if (isObject(observation)) errors.push(...checkObservation(observation.OBS_VALUE, observation, where2));
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
const rulesByType = {
  CapAlert: checkCapAlertRules,
  Alert: checkAlertRules,
  SdmxJson: checkSdmxJsonRules,
  DciStatistics: checkDciStatisticsRules,
};

export function checkRecordRules(type, record, where = 'record') {
  return rulesByType[type](record, where);
}

// Schema + rules for one record of the given type.
export function validateRecord(type, record, where = 'record') {
  const { errors } = validateSchema(type, record);
  return [...errors.map((e) => where + e.replace(/^\(root\)/, '')), ...checkRecordRules(type, record, where)];
}

const recordsOf = (regRecords) => (Array.isArray(regRecords) ? regRecords : isObject(regRecords) ? [regRecords] : []);

// Every alert of a message or response, with the record type it must conform to.
export function extractRecords(body, kind) {
  const out = [];
  if (kind === 'alert' && isObject(body)) out.push({ type: 'Alert', record: body, where: 'body' });
  if (kind === 'feature-collection') (body?.features || []).forEach((f, i) => out.push({ type: 'Alert', record: f, where: `body.features[${i}]` }));
  if (kind === 'sdmx-json' && isObject(body)) out.push({ type: 'SdmxJson', record: body, where: 'body' });
  if (kind === 'dci-json' && isObject(body)) out.push({ type: 'DciStatistics', record: body, where: 'body' });
  const events = body?.message?.notify_event;
  (Array.isArray(events) ? events : []).forEach((event, i) => {
    const type = recordTypeOf(event?.data?.reg_record_type);
    if (!type) return;
    recordsOf(event.data.reg_records).forEach((record, j) => out.push({ type, record, where: `message.notify_event[${i}].data.reg_records[${j}]` }));
  });
  return out;
}

// The CapAlerts of a list of records (an Alert carries one).
export const capAlertsOf = (records) => records.map(({ type, record }) => (type === 'Alert' ? capAlertOf(record) : type === 'CapAlert' ? record : undefined)).filter(Boolean);

// ---------------------------------------------------------------------------
// Message-level rules
// ---------------------------------------------------------------------------
export function checkCallbackHeaderRules(header) {
  const errors = [];
  if (!header) return errors;
  if (Number.isInteger(header.total_count) && Number.isInteger(header.completed_count) && header.completed_count > header.total_count) {
    errors.push(`header.completed_count ${header.completed_count} is greater than header.total_count ${header.total_count}`);
  }
  if (header.status === 'rjct' && !header.status_reason_code) {
    errors.push('header.status is "rjct" but no header.status_reason_code explains the rejection');
  }
  return errors;
}

function checkFrequency(frequency, where) {
  if (!isObject(frequency)) return [];
  const start = Date.parse(frequency.start_time);
  const end = Date.parse(frequency.end_time);
  return !Number.isNaN(start) && !Number.isNaN(end) && end <= start
    ? [`${where}.end_time ${frequency.end_time} is not after start_time ${frequency.start_time}`] : [];
}

const echoTransaction = (message, request) => (request?.message && message.transaction_id !== request.message.transaction_id
  ? [`[rule] message.transaction_id "${message.transaction_id}" does not echo the request's "${request.message.transaction_id}"`] : []);

// Dedup (DO.EWS.02): identifier + sender identify an alert; the same version of an alert
// (same assessment_date and msg_type) sent twice in one notification is a duplicate.
function checkDuplicateAlerts(records) {
  const seen = new Map();
  const errors = [];
  capAlertsOf(records).forEach((alert, i) => {
    const key = [alert.identifier, alert.sender, alert.assessment_date, alert.msg_type].join('|');
    if (seen.has(key)) errors.push(`alert "${alert.identifier}" from "${alert.sender}" (assessment_date ${alert.assessment_date}, ${alert.msg_type}) is sent twice in the same notification (records ${seen.get(key) + 1} and ${i + 1})`);
    else seen.set(key, i);
  });
  return errors;
}

const CALLBACK_KINDS = ['notify'];

export function validateMessage(kind, body, request) {
  const errors = validateSchema(kind, body).errors.map((e) => `[schema] ${e}`);
  if (!body || typeof body !== 'object') return errors;

  const header = body.header;
  const message = body.message;
  const encrypted = header?.is_msg_encrypted === true;

  if (CALLBACK_KINDS.includes(kind)) errors.push(...checkCallbackHeaderRules(header).map((e) => `[rule] ${e}`));
  if (encrypted || !isObject(message)) return errors;

  if (['on-subscribe', 'on-unsubscribe'].includes(kind)) errors.push(...echoTransaction(message, request));
  if (kind === 'on-subscribe') {
    (message.subscribe_response || []).forEach((item, i) => {
      if (item.status === 'rjct' && !item.status_reason_code) errors.push(`[rule] message.subscribe_response[${i}].status is "rjct" but no status_reason_code is given`);
      if (item.status === 'succ' && !(item.subscriptions || []).length) errors.push(`[rule] message.subscribe_response[${i}].status is "succ" but no subscription code is returned`);
      (item.subscriptions || []).forEach((s, j) => errors.push(...checkFrequency(s.frequency, `message.subscribe_response[${i}].subscriptions[${j}].frequency`).map((e) => `[rule] ${e}`)));
    });
  }
  if (kind === 'subscribe') {
    (message.subscribe_request || []).forEach((item, i) => errors.push(...checkFrequency(item?.subscribe_criteria?.frequency, `message.subscribe_request[${i}].subscribe_criteria.frequency`).map((e) => `[rule] ${e}`)));
  }
  if (kind === 'on-unsubscribe' && message.status === 'rjct' && !message.status_reason_code) {
    errors.push('[rule] message.status is "rjct" but no status_reason_code is given');
  }

  const records = extractRecords(body, kind);
  if (kind === 'notify') errors.push(...checkDuplicateAlerts(records).map((e) => `[rule] ${e}`));
  for (const { type, record, where } of records) {
    errors.push(...checkRecordRules(type, record, where).map((e) => `[data] ${e}`));
  }
  return errors;
}

// Responses that are not DCI envelopes (OGC API Features, SDMX): schema + data rules.
export function validateResponse(kind, body) {
  const errors = validateSchema(kind, body).errors.map((e) => `[schema] ${e}`);
  for (const { type, record, where } of extractRecords(body, kind)) {
    errors.push(...checkRecordRules(type, record, where).map((e) => `[data] ${e}`));
  }
  return errors;
}

export function formatErrors(errors) {
  return errors.map((e) => `  - ${e}`).join('\n');
}
