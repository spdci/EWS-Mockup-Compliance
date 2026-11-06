// JSON Schemas (draft-07) for the DCI Early Warning System (EWS) interface.
//
// Sources (standards.spdci.org, Early Warning Systems and SP system interface):
//  - API.EWS.01 Event Subscription, API.EWS.02 Event Notification, API.EWS.03 Fetch Alert,
//    API.EWS.04 Create-replace, API.EWS.05 SDMX example
//  - DO.EWS.01 Alert, DO.EWS.02 CapAlert, DO.EWS.03 Info, DO.EWS.04 Resource, DO.EWS.05 Area,
//    DO.EWS.06 GeoCode, sdmx-dci-member-example (DSD DCI_MEMBER_STATISTICS)
//  - CD.EWS.01 - CD.EWS.10 code directory, CD.COM.14 language_code, DF.COM.STRING.01 date_time
//  - OASIS CAP v1.2 (the CapAlert model follows it), OGC API Features Part 1 (featureGeoJSON,
//    FeatureCollection, collection, exception) and SDMX-JSON (dimensions, series, observations)
//
// Unlike the registry interfaces, the EWS standard publishes no OpenAPI YAML and no message
// envelope for subscribe / notify. Those two use the DCI message envelope shared by every DCI
// API ({ signature, header, message }, MsgHeader / MsgCallbackHeader, Ack), with an EWS alert
// filter in subscribe_criteria and CapAlert / Alert records in notify_event. See the README,
// "Where the spec is ambiguous".
//
// Cardinalities follow the data objects: CapAlert and Info have mandatory (1...1) attributes,
// which are required here; everything optional is checked only when present. Extra attributes
// are allowed (country extensions).
//
// The same definitions are embedded in the Mockoon mocks (valid_json_schema rules), so they
// deliberately use only draft-07 keywords and ajv-formats formats (no custom ones).

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------
const DATE = '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])';
const TIME = '([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?';
const TZ = '(Z|[+-]([01]\\d|2[0-3]):?[0-5]\\d)';
// DF.COM.STRING.01 date_time: ISO 8601 date and time, timezone optional (the EWS examples send "Z").
export const DATE_TIME_PATTERN = `^${DATE}T${TIME}${TZ}?$`;
// ISO 8601 calendar date, optionally with a time (LAST_VERIFIED_DATE).
export const ISO_DATE_PATTERN = `^${DATE}(T${TIME}${TZ}?)?$`;
// DCI locale: ISO 639-3 (the DCI envelope's locale).
export const LOCALE_PATTERN = '^[a-z]{3}$';
// Info.language: CD.COM.14 says ISO 639-2 ("eng"); the Info example sends a BCP 47 tag ("en-US").
// Both are accepted.
export const LANGUAGE_PATTERN = '^([a-z]{3}|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$';
// CAP identifier / sender: no spaces, commas or restricted characters (< &).
export const CAP_TOKEN_PATTERN = '^[^\\s,<&]+$';
const NUM = '-?\\d+(\\.\\d+)?';
// CAP polygon: at least 4 "lat,lon" pairs separated by whitespace (closure and ranges are rules).
export const POLYGON_PATTERN = `^\\s*${NUM},${NUM}(\\s+${NUM},${NUM}){3,}\\s*$`;
// CAP circle: "lat,lon radius" (radius in km).
export const CIRCLE_PATTERN = `^\\s*${NUM},${NUM}\\s+\\d+(\\.\\d+)?\\s*$`;
// Media type: an IANA type ("image/jpeg") or the short codes of CD.EWS.09 ("jpeg", "mp4").
export const MIME_TYPE_PATTERN = '^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*)?$';
export const BASE64_PATTERN = '^[A-Za-z0-9+/]+={0,2}$';
// DCI_MEMBER_STATISTICS REF_AREA: an administrative area code of the country (open code list).
export const AREA_CODE_PATTERN = '^[A-Za-z0-9_-]+$';
// SDMX reference period: YYYY, YYYY-MM, YYYY-Qn or YYYY-MM-DD.
export const PERIOD_PATTERN = '^\\d{4}(-(Q[1-4]|0[1-9]|1[0-2])(-(0[1-9]|[12]\\d|3[01]))?)?$';

// Record types of notify_event.data.reg_record_type, bare or namespaced ("spdci-extensions-ews:CapAlert").
const NS = '^([A-Za-z0-9_.-]+:)*';
export const CAP_ALERT_RECORD_TYPE_PATTERN = `${NS}(CapAlert|Cap_Alert)$`;
export const ALERT_RECORD_TYPE_PATTERN = `${NS}Alert$`;
export const RECORD_TYPE_PATTERN = `${NS}(CapAlert|Cap_Alert|Alert)$`;

// ---------------------------------------------------------------------------
// Code lists
// ---------------------------------------------------------------------------
// CD.EWS.01 category (CAP 3.2.2). The table publishes a code ("MET") and a value ("Met"); the
// examples exchange the value. Both are accepted.
export const categoryCodes = {
  GEO: 'Geo', MET: 'Met', SAFETY: 'Safety', SECURITY: 'Security', RESCUE: 'Rescue', FIRE: 'Fire',
  HEALTH: 'Health', ENV: 'Env', TRANSPORT: 'Transport', INFRA: 'Infra', CBRNE: 'CBRNE', OTHER: 'Other',
};

// CD.EWS.01, second table: the more detailed event (disaster) types of the HDX disaster-types
// dataset, as published (spellings included). Used for Info.event_code.
export const eventTypeCodes = {
  CW: 'Cold Wave', DR: 'Drought', EW: 'Earthquake', EP: 'Epidemic', ET: 'Extratopical Cyclone',
  FR: 'Fire', FF: 'Flash Flood', FL: 'Flood', HW: 'Heat Wave', IN: 'Insect Infestation',
  LS: 'Land Slide', MS: 'Mud Slide', OT: 'Other', ST: 'Sever Local Storm', AV: 'Snow Avalanche',
  SS: 'Storm Surge', AC: 'Technological Disaster', TC: 'Tropical Cyclone', TS: 'Tsunami',
  VO: 'Volcano', WF: 'Wild Fire',
};

// DCI_MEMBER_STATISTICS code lists (sdmx-dci-member-example).
export const sdmxCodeLists = {
  SEX: { F: 'Female', M: 'Male', U: 'Unknown' }, // CL_SEX
  DISABILITY_STATUS: { TRUE: 'Person with disability', FALSE: 'Person without disability', NA: 'Not available' }, // CL_DISABILITY_STATUS
  AGE_GROUP: { // CL_AGE_GROUP
    LT5: 'Less than 5 years', Y5T17: '5 to 17 years', Y18T64: '18 to 64 years', GE65: '65 years and above', ALL: 'All ages',
  },
  DENOMINATOR_TYPE: { IPC_3_PLUS: 'IPC Phase 3+', STRUCT_DAMAGE: 'Structural damage', GEOG_DISPLACED: 'Displaced' }, // CL_DENOMINATOR_TYPE
};

export const codes = {
  status: ['Actual', 'Exercise', 'System', 'Test', 'Draft'], // CD.EWS.03
  msgType: ['Alert', 'Update', 'Cancel', 'Ack', 'Error'], // CD.EWS.04
  scope: ['Public', 'Restricted', 'Private'], // CD.EWS.05
  urgency: ['Immediate', 'Expected', 'Future', 'Past', 'Unknown'], // CD.EWS.06
  certainty: ['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'], // CD.EWS.07
  severity: ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'], // CD.EWS.02
  responseType: ['Shelter', 'Evacuate', 'Prepare', 'Execute', 'Avoid', 'Monitor', 'Assess', 'All clear', 'None'], // CD.EWS.08
  category: Object.values(categoryCodes), // CD.EWS.01 values
  categoryCode: Object.keys(categoryCodes), // CD.EWS.01 codes
  thresholdStatus: ['NORMAL', 'WATCH', 'CROSSING_THRESHOLD_1', 'TRIGGER'], // CD.EWS.10
  eventType: Object.keys(eventTypeCodes), // CD.EWS.01 second table

  // SDMX (DCI_MEMBER_STATISTICS)
  sdmxSex: Object.keys(sdmxCodeLists.SEX),
  sdmxDisabilityStatus: Object.keys(sdmxCodeLists.DISABILITY_STATUS),
  sdmxAgeGroup: Object.keys(sdmxCodeLists.AGE_GROUP),
  sdmxDenominatorType: Object.keys(sdmxCodeLists.DENOMINATOR_TYPE),
  // SDMX cross-domain code lists for the observation attributes.
  obsStatus: ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'S', 'U', 'V'], // CL_OBS_STATUS
  confStatus: ['F', 'N', 'C', 'D', 'S', 'A', 'O', 'T', 'G', 'M', 'E'], // CL_CONF_STATUS
  sdmxAction: ['Information', 'Append', 'Replace', 'Delete'],

  // ----- DCI API -----
  requestStatus: ['rcvd', 'pdng', 'succ', 'rjct'],
  ackStatus: ['ACK', 'NACK', 'ERR'],
  subscriptionStatus: ['subscribe', 'unsubscribe'],
  subscribeStatusReasonCode: [
    'rjct.reference_id.invalid', 'rjct.reference_id.duplicate', 'rjct.timestamp.invalid',
    'rjct.notify_types.invalid', 'rjct.notify_details.invalid', 'rjct.filter.invalid',
    'rjct.event.already_subscribed',
  ],
  unsubscribeStatusReasonCode: [
    'rjct.reference_id.invalid', 'rjct.reference_id.duplicate', 'rjct.timestamp.invalid',
    'rjct.subscription_code.invalid', 'rjct.requester.invalid', 'rjct.event.already_unsubscribed',
  ],
  headerStatusReasonCode: [
    'rjct.version.invalid', 'rjct.message_id.duplicate', 'rjct.message_ts.invalid',
    'rjct.action.invalid', 'rjct.action.not_supported', 'rjct.total_count.invalid',
    'rjct.total_count.limit_exceeded', 'rjct.errors.too_many',
  ],
  errorCode: [
    'err.request.bad', 'err.request.unauthorized', 'err.request.forbidden', 'err.request.not_found',
    'err.request.timeout', 'err.version.not_supported', 'err.request.too_many_requests',
    'err.sender_id.invalid', 'err.sender_uri.invalid', 'err.receiver_id.invalid',
    'err.signature.missing', 'err.signature.invalid', 'err.encryption.invalid',
    'err.service.unavailable',
  ],
};

// The CAP fields an OGC /items filter may name (API.EWS.03), and the code list of each.
export const itemFilters = {
  status: 'status', msg_type: 'msgType', scope: 'scope', threshold_status: 'thresholdStatus',
  category: 'category', severity: 'severity', urgency: 'urgency', certainty: 'certainty',
};
export const ALERT_LEVEL_FILTERS = ['status', 'msg_type', 'scope', 'threshold_status'];

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
const ref = (name) => ({ $ref: `#/definitions/${name}` });
const str = { type: 'string' };
const nonEmptyStr = { type: 'string', minLength: 1 };
const enumOf = (values) => ({ type: 'string', enum: values });
// A single value or a non-empty list of values (the tables say 1...1 / 0...1, the examples send lists).
const oneOrMany = (item) => ({ anyOf: [item, { type: 'array', minItems: 1, items: item }] });
const listOf = (item) => ({ type: 'array', minItems: 1, items: item });
const arrayOf = (item) => ({ type: 'array', items: item });

const position = { type: 'array', minItems: 2, maxItems: 3, items: { type: 'number' } };
const ring = { type: 'array', minItems: 4, items: position };

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------
export const definitions = {
  // ----- common types -----
  DateTime: { type: 'string', pattern: DATE_TIME_PATTERN },
  IsoDate: { type: 'string', pattern: ISO_DATE_PATTERN },
  TransactionId: { type: 'string', minLength: 1, maxLength: 99 },
  CorrelationId: { type: 'string', minLength: 1, maxLength: 99, pattern: '^[a-zA-Z0-9-]+$' },
  ReferenceId: nonEmptyStr,
  SubscriptionCode: { type: 'string', minLength: 1, maxLength: 99 },
  Locale: { type: 'string', pattern: LOCALE_PATTERN },
  RequestStatus: enumOf(codes.requestStatus),
  StatusReasonMessage: { type: 'string', maxLength: 999 },
  Version: nonEmptyStr,
  RegType: nonEmptyStr,
  RegRecordType: { type: 'string', pattern: RECORD_TYPE_PATTERN },
  Frequency: {
    type: 'object',
    required: ['start_time', 'end_time', 'frequency'],
    properties: { start_time: ref('DateTime'), end_time: ref('DateTime'), frequency: nonEmptyStr },
  },

  // ----- message envelope (common to every DCI API) -----
  MsgSignature: nonEmptyStr,
  Meta: { type: 'object' },
  MsgHeader: {
    type: 'object',
    required: ['message_id', 'message_ts', 'action', 'sender_id', 'total_count'],
    properties: {
      version: ref('Version'),
      message_id: nonEmptyStr,
      message_ts: { type: 'string', format: 'date-time' },
      action: nonEmptyStr,
      sender_id: nonEmptyStr,
      sender_uri: { type: 'string', format: 'uri' },
      receiver_id: nonEmptyStr,
      total_count: { type: 'integer', minimum: 0 },
      is_msg_encrypted: { type: 'boolean' },
      meta: ref('Meta'),
    },
  },
  MsgCallbackHeader: {
    type: 'object',
    required: ['message_id', 'message_ts', 'action', 'status'],
    properties: {
      version: ref('Version'),
      message_id: nonEmptyStr,
      message_ts: { type: 'string', format: 'date-time' },
      action: nonEmptyStr,
      status: ref('RequestStatus'),
      status_reason_code: enumOf(codes.headerStatusReasonCode),
      status_reason_message: ref('StatusReasonMessage'),
      total_count: { type: 'integer', minimum: 0 },
      completed_count: { type: 'integer', minimum: 0 },
      sender_id: nonEmptyStr,
      receiver_id: nonEmptyStr,
      is_msg_encrypted: { type: 'boolean' },
      meta: ref('Meta'),
    },
  },
  EncryptedMessage: {
    type: 'object',
    required: ['header', 'ciphertext', 'encrypted_key', 'tag', 'iv'],
    properties: {
      header: {
        type: 'object',
        required: ['alg', 'enc', 'kid'],
        properties: { alg: nonEmptyStr, enc: nonEmptyStr, kid: nonEmptyStr },
      },
      ciphertext: nonEmptyStr,
      encrypted_key: nonEmptyStr,
      tag: nonEmptyStr,
      iv: nonEmptyStr,
    },
  },
  Error: {
    type: 'object',
    properties: {
      code: enumOf(codes.errorCode),
      message: { type: 'string', maxLength: 999 },
    },
  },

  // ----- EWS data objects -----
  // DO.EWS.06 GeoCode
  GeoCode: {
    type: 'object',
    required: ['valueName', 'value'],
    properties: { valueName: nonEmptyStr, value: nonEmptyStr },
  },
  // DO.EWS.05 Area. geocode is 0...1 in the table, a list in the CapAlert example: both accepted.
  Area: {
    type: 'object',
    required: ['areaDesc'],
    properties: {
      areaDesc: nonEmptyStr,
      polygon: listOf({ type: 'string', pattern: POLYGON_PATTERN }),
      circle: listOf({ type: 'string', pattern: CIRCLE_PATTERN }),
      geocode: oneOrMany(ref('GeoCode')),
    },
  },
  // DO.EWS.04 Resource
  Resource: {
    type: 'object',
    required: ['resourceDesc', 'mimeType'],
    properties: {
      resourceDesc: nonEmptyStr,
      mimeType: { type: 'string', pattern: MIME_TYPE_PATTERN },
      size: { type: 'integer', minimum: 0 },
      uri: { type: 'string', format: 'uri-reference' },
      derefUri: { type: 'string', pattern: BASE64_PATTERN },
      digest: nonEmptyStr,
    },
  },
  // CAP parameter: the table types it as a string; CAP sends valueName / value pairs. Both accepted.
  Parameter: {
    anyOf: [str, ref('GeoCode'), listOf(ref('GeoCode'))],
  },
  Category: { type: 'string', enum: [...new Set([...codes.category, ...codes.categoryCode])] },
  // DO.EWS.03 Info
  Info: {
    type: 'object',
    required: ['category', 'event', 'urgency', 'severity', 'certainty'],
    properties: {
      language: { type: 'string', pattern: LANGUAGE_PATTERN },
      category: oneOrMany(ref('Category')),
      event: nonEmptyStr,
      response_type: oneOrMany(enumOf(codes.responseType)),
      urgency: enumOf(codes.urgency),
      severity: enumOf(codes.severity),
      certainty: enumOf(codes.certainty),
      audience: str,
      effective: ref('DateTime'),
      event_code: nonEmptyStr,
      onset: ref('DateTime'),
      expires: ref('DateTime'),
      sender_name: str,
      headline: str,
      description: str,
      instruction: str,
      web: { type: 'string', format: 'uri' },
      contact: str,
      parameter: ref('Parameter'),
      area: listOf(ref('Area')),
      resource: listOf(ref('Resource')),
      created_at: ref('DateTime'),
    },
  },
  // DO.EWS.02 CapAlert
  CapAlert: {
    type: 'object',
    required: ['identifier', 'sender', 'sent', 'status', 'msg_type', 'scope', 'assessment_date', 'threshold_status'],
    properties: {
      identifier: { type: 'string', pattern: CAP_TOKEN_PATTERN },
      sender: { type: 'string', pattern: CAP_TOKEN_PATTERN },
      sent: ref('DateTime'),
      status: enumOf(codes.status),
      msg_type: enumOf(codes.msgType),
      source: str,
      scope: enumOf(codes.scope),
      restriction: nonEmptyStr,
      addresses: listOf(nonEmptyStr),
      code: str,
      assessment_date: ref('DateTime'),
      threshold_status: enumOf(codes.thresholdStatus),
      note: str,
      references: listOf(nonEmptyStr),
      incidents: listOf(nonEmptyStr),
      info: arrayOf(ref('Info')),
      created_at: ref('DateTime'),
    },
    // DO.EWS.02: addresses is required when scope is "Private".
    if: { properties: { scope: { const: 'Private' } }, required: ['scope'] },
    then: { required: ['addresses'] },
  },

  // ----- GeoJSON / OGC API Features -----
  Geometry: {
    type: 'object',
    required: ['type', 'coordinates'],
    properties: {
      type: enumOf(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']),
      coordinates: { type: 'array' },
      bbox: { type: 'array', items: { type: 'number' } },
    },
    allOf: [
      { if: { properties: { type: { const: 'Point' } } }, then: { properties: { coordinates: position } } },
      { if: { properties: { type: { const: 'Polygon' } } }, then: { properties: { coordinates: listOf(ring) } } },
      { if: { properties: { type: { const: 'MultiPolygon' } } }, then: { properties: { coordinates: listOf(listOf(ring)) } } },
    ],
  },
  // DO.EWS.01 properties: the CapAlert itself (attribute table) or { capAlert } (the example).
  AlertProperties: {
    anyOf: [
      ref('CapAlert'),
      { type: 'object', required: ['capAlert'], properties: { capAlert: ref('CapAlert') } },
    ],
  },
  // DO.EWS.01 Alert: a GeoJSON Feature (OGC featureGeoJSON: type, geometry, properties required;
  // geometry may be null).
  Alert: {
    type: 'object',
    required: ['type', 'geometry', 'properties'],
    properties: {
      type: { const: 'Feature' },
      id: { type: ['string', 'integer'] },
      geometry: { anyOf: [{ type: 'null' }, ref('Geometry')] },
      properties: ref('AlertProperties'),
      links: arrayOf(ref('Link')),
    },
  },
  Link: {
    type: 'object',
    required: ['href'],
    properties: { href: nonEmptyStr, rel: str, type: str, title: str },
  },
  FeatureCollection: {
    type: 'object',
    required: ['type', 'features'],
    properties: {
      type: { const: 'FeatureCollection' },
      features: arrayOf(ref('Alert')),
      links: arrayOf(ref('Link')),
      timeStamp: { type: 'string', format: 'date-time' },
      numberMatched: { type: 'integer', minimum: 0 },
      numberReturned: { type: 'integer', minimum: 0 },
    },
  },
  Collection: {
    type: 'object',
    required: ['id', 'links'],
    properties: {
      id: { const: 'alerts' },
      title: str,
      description: str,
      itemType: { const: 'feature' },
      links: listOf(ref('Link')),
      extent: { type: 'object' },
      crs: arrayOf(str),
    },
  },
  // OGC API exception (exception.yaml): code required.
  OgcException: {
    type: 'object',
    required: ['code'],
    properties: { code: nonEmptyStr, description: str },
  },

  // ----- subscribe (API.EWS.01): what type of events and severity -----
  AreaFilter: {
    type: 'object',
    minProperties: 1,
    properties: {
      areaDesc: nonEmptyStr,
      geocode: oneOrMany(ref('GeoCode')),
      polygon: listOf({ type: 'string', pattern: POLYGON_PATTERN }),
    },
  },
  AlertFilter: {
    type: 'object',
    minProperties: 1,
    properties: {
      event: listOf(nonEmptyStr),
      event_code: listOf(enumOf(codes.eventType)),
      category: listOf(ref('Category')),
      severity: listOf(enumOf(codes.severity)),
      urgency: listOf(enumOf(codes.urgency)),
      certainty: listOf(enumOf(codes.certainty)),
      threshold_status: listOf(enumOf(codes.thresholdStatus)),
      status: listOf(enumOf(codes.status)),
      msg_type: listOf(enumOf(codes.msgType)),
      area: listOf(ref('AreaFilter')),
    },
  },
  SubscribeCriteria: {
    type: 'object',
    required: ['filter', 'notify_record_type'],
    properties: {
      version: ref('Version'),
      reg_type: ref('RegType'),
      frequency: ref('Frequency'),
      filter: ref('AlertFilter'),
      notify_record_type: ref('RegRecordType'),
    },
  },
  SubscribeRequest: {
    type: 'object',
    required: ['transaction_id', 'subscribe_request'],
    properties: {
      transaction_id: ref('TransactionId'),
      subscribe_request: listOf({
        type: 'object',
        required: ['reference_id', 'timestamp', 'subscribe_criteria'],
        properties: {
          reference_id: ref('ReferenceId'),
          timestamp: { type: 'string', format: 'date-time' },
          subscribe_criteria: ref('SubscribeCriteria'),
          locale: ref('Locale'),
        },
      }),
    },
  },
  Subscription: {
    type: 'object',
    required: ['code', 'status', 'timestamp'],
    properties: {
      version: ref('Version'),
      code: ref('SubscriptionCode'),
      status: enumOf(codes.subscriptionStatus),
      timestamp: { type: 'string', format: 'date-time' },
      reg_type: ref('RegType'),
      frequency: ref('Frequency'),
      filter: ref('AlertFilter'),
      notify_record_type: ref('RegRecordType'),
      locale: ref('Locale'),
    },
  },
  SubscribeResponse: {
    type: 'object',
    required: ['transaction_id', 'correlation_id', 'subscribe_response'],
    properties: {
      transaction_id: ref('TransactionId'),
      correlation_id: ref('CorrelationId'),
      subscribe_response: arrayOf({
        type: 'object',
        required: ['reference_id', 'timestamp', 'status'],
        properties: {
          reference_id: ref('ReferenceId'),
          timestamp: { type: 'string', format: 'date-time' },
          status: ref('RequestStatus'),
          status_reason_code: enumOf(codes.subscribeStatusReasonCode),
          status_reason_message: ref('StatusReasonMessage'),
          subscriptions: arrayOf(ref('Subscription')),
          locale: ref('Locale'),
        },
      }),
    },
  },
  UnSubscribeRequest: {
    type: 'object',
    required: ['transaction_id', 'timestamp', 'subscription_codes'],
    properties: {
      transaction_id: ref('TransactionId'),
      timestamp: { type: 'string', format: 'date-time' },
      subscription_codes: listOf(ref('SubscriptionCode')),
    },
  },
  UnSubscribeResponse: {
    type: 'object',
    required: ['transaction_id', 'correlation_id', 'timestamp', 'status'],
    properties: {
      transaction_id: ref('TransactionId'),
      correlation_id: ref('CorrelationId'),
      timestamp: { type: 'string', format: 'date-time' },
      status: ref('RequestStatus'),
      status_reason_code: enumOf(codes.unsubscribeStatusReasonCode),
      status_reason_message: ref('StatusReasonMessage'),
      subscription_status: arrayOf({
        type: 'object',
        required: ['code', 'status'],
        properties: { code: ref('SubscriptionCode'), status: enumOf(codes.subscriptionStatus) },
      }),
    },
  },

  // ----- notify (API.EWS.02): CapAlert or Alert records -----
  NotifyData: {
    type: 'object',
    required: ['reg_record_type', 'reg_records'],
    properties: {
      version: ref('Version'),
      reg_type: ref('RegType'),
      reg_event_type: nonEmptyStr,
      reg_record_type: ref('RegRecordType'),
      reg_records: { type: ['array', 'object'] },
    },
    allOf: [
      {
        if: { properties: { reg_record_type: { pattern: CAP_ALERT_RECORD_TYPE_PATTERN } }, required: ['reg_record_type'] },
        then: { properties: { reg_records: { anyOf: [listOf(ref('CapAlert')), ref('CapAlert')] } } },
      },
      {
        if: { properties: { reg_record_type: { pattern: ALERT_RECORD_TYPE_PATTERN } }, required: ['reg_record_type'] },
        then: { properties: { reg_records: { anyOf: [listOf(ref('Alert')), ref('Alert')] } } },
      },
    ],
  },
  NotifyEventRequest: {
    type: 'object',
    required: ['transaction_id', 'notify_event'],
    properties: {
      transaction_id: ref('TransactionId'),
      notify_event: listOf({
        type: 'object',
        required: ['reference_id', 'timestamp', 'data'],
        properties: {
          reference_id: ref('ReferenceId'),
          timestamp: { type: 'string', format: 'date-time' },
          data: ref('NotifyData'),
          locale: ref('Locale'),
        },
      }),
    },
  },

  // ----- SDMX (API.EWS.05): aggregated member statistics -----
  SdmxValue: {
    type: 'object',
    required: ['id'],
    properties: { id: nonEmptyStr, name: str },
  },
  SdmxDimension: {
    type: 'object',
    required: ['id', 'values'],
    properties: {
      id: nonEmptyStr,
      name: str,
      keyPosition: { type: 'integer', minimum: 0 },
      role: str,
      values: listOf(ref('SdmxValue')),
    },
  },
  SdmxObservationValue: { type: ['integer', 'null'], minimum: 0 },
  // API.EWS.05 example: header / structure / dataSets with index-based series keys ("0:1:0:0").
  SdmxJson: {
    type: 'object',
    required: ['structure', 'dataSets'],
    properties: {
      header: {
        type: 'object',
        required: ['id', 'prepared', 'sender'],
        properties: {
          id: nonEmptyStr,
          prepared: { type: 'string', format: 'date-time' },
          sender: { type: 'object', required: ['id'], properties: { id: nonEmptyStr } },
        },
      },
      structure: {
        type: 'object',
        required: ['dimensions', 'measures'],
        properties: {
          name: str,
          dimensions: {
            type: 'object',
            required: ['series'],
            properties: {
              series: listOf(ref('SdmxDimension')),
              observation: arrayOf(ref('SdmxDimension')),
            },
          },
          measures: {
            type: 'object',
            required: ['series'],
            properties: {
              series: listOf({ type: 'object', required: ['id'], properties: { id: { const: 'OBS_VALUE' }, name: str, unit: str } }),
            },
          },
        },
      },
      dataSets: listOf({
        type: 'object',
        required: ['series'],
        properties: {
          action: enumOf(codes.sdmxAction),
          attributes: { type: 'object' },
          series: {
            type: 'object',
            propertyNames: { pattern: '^\\d+(:\\d+)*$' },
            additionalProperties: {
              type: 'object',
              required: ['observations'],
              properties: {
                attributes: { type: 'object' },
                observations: {
                  type: 'object',
                  minProperties: 1,
                  propertyNames: { pattern: '^\\d+$' },
                  additionalProperties: { type: 'array', minItems: 1, items: [ref('SdmxObservationValue')] },
                },
              },
            },
          },
        },
      }),
    },
  },
  // sdmx-dci-member-example: meta / data.dataSets with full dotted keys ("AREA001.F.TRUE.ALL.IPC_3_PLUS").
  DciStatistics: {
    type: 'object',
    required: ['meta', 'data'],
    properties: {
      meta: {
        type: 'object',
        required: ['id', 'prepared', 'sender'],
        properties: {
          schema: str,
          id: nonEmptyStr,
          prepared: { type: 'string', format: 'date-time' },
          sender: { type: 'object', required: ['id'], properties: { id: nonEmptyStr } },
          receiver: { type: 'object', required: ['id'], properties: { id: nonEmptyStr } },
        },
      },
      data: {
        type: 'object',
        required: ['dataSets'],
        properties: {
          dataSets: listOf({
            type: 'object',
            required: ['structureRef', 'observations'],
            properties: {
              action: enumOf(codes.sdmxAction),
              structureRef: { const: 'DCI_MEMBER_STATISTICS' },
              attributes: { type: 'object' },
              observations: {
                type: 'object',
                propertyNames: { pattern: '^[^.]+(\\.[^.]+){3,5}$' },
                additionalProperties: {
                  type: 'object',
                  required: ['OBS_VALUE'],
                  properties: { OBS_VALUE: ref('SdmxObservationValue') },
                },
              },
            },
          }),
        },
      },
    },
  },

  // ----- acknowledgements and errors -----
  AckResponse: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'object',
        required: ['ack_status', 'timestamp', 'correlation_id'],
        properties: {
          ack_status: enumOf(codes.ackStatus),
          timestamp: { type: 'string', format: 'date-time' },
          error: ref('Error'),
          correlation_id: ref('CorrelationId'),
        },
        // An ERR acknowledgement must explain itself with an error code.
        if: { properties: { ack_status: { const: 'ERR' } }, required: ['ack_status'] },
        then: { required: ['error'], properties: { error: { required: ['code'] } } },
      },
    },
  },
  HttpErrorResponse: {
    type: 'object',
    required: ['errors'],
    properties: {
      errors: listOf({ type: 'object', required: ['code'], properties: { code: nonEmptyStr, message: str } }),
    },
  },
};

// ---------------------------------------------------------------------------
// Envelopes: { signature, header, message } per DCI endpoint
// ---------------------------------------------------------------------------
const encryptedIf = {
  properties: {
    header: { properties: { is_msg_encrypted: { const: true } }, required: ['is_msg_encrypted'] },
  },
  required: ['header'],
};

function envelope({ headerDef, action, messageDef, messageRequired }) {
  return {
    type: 'object',
    required: messageRequired ? ['header', 'message'] : ['header'],
    properties: {
      signature: ref('MsgSignature'),
      header: {
        allOf: [ref(headerDef), { type: 'object', properties: { action: { const: action } } }],
      },
      message: { type: 'object' },
    },
    // message is the plain payload, or an EncryptedMessage when header.is_msg_encrypted is true.
    if: encryptedIf,
    then: { properties: { message: ref('EncryptedMessage') } },
    else: { properties: { message: ref(messageDef) } },
  };
}

const request = (action, messageDef) => envelope({ headerDef: 'MsgHeader', action, messageDef, messageRequired: true });
const callback = (action, messageDef) => envelope({ headerDef: 'MsgCallbackHeader', action, messageDef, messageRequired: false });

export const envelopeDefinitions = {
  // EWS side (requests)
  'subscribe': request('subscribe', 'SubscribeRequest'),
  'unsubscribe': request('unsubscribe', 'UnSubscribeRequest'),
  // SP side (callbacks and notifications)
  'on-subscribe': request('on-subscribe', 'SubscribeResponse'),
  'on-unsubscribe': request('on-unsubscribe', 'UnSubscribeResponse'),
  'notify': callback('notify', 'NotifyEventRequest'),
};

// Top-level, self-contained schemas (every one embeds all definitions so it can be compiled
// on its own, which is what Mockoon's valid_json_schema rule needs).
const standalone = (root) => ({ ...root, definitions });

export const schemas = {
  ...Object.fromEntries(Object.entries(envelopeDefinitions).map(([k, v]) => [k, standalone(v)])),
  'ack': standalone(definitions.AckResponse),
  'http-error': standalone(definitions.HttpErrorResponse),
  'ogc-exception': standalone(definitions.OgcException),
  'collection': standalone(definitions.Collection),
  'feature-collection': standalone(definitions.FeatureCollection),
  'alert': standalone(definitions.Alert),
  'sdmx-json': standalone(definitions.SdmxJson),
  'dci-json': standalone(definitions.DciStatistics),
  'CapAlert': standalone(definitions.CapAlert),
  'Alert': standalone(definitions.Alert),
  'SdmxJson': standalone(definitions.SdmxJson),
  'DciStatistics': standalone(definitions.DciStatistics),
};
