// Reference EWS records: the published spec examples, verbatim, and records covering every
// attribute, scope, status, message type and the slow-onset update pattern. They are the
// fixtures of the offline data rules, the payloads the suite sends, and (through
// mock/generate-mocks.mjs) the data the mock EWS and SP serve.

// ---------------------------------------------------------------------------
// CapAlert (DO.EWS.02)
// ---------------------------------------------------------------------------

// DO.EWS.02 CapAlert example, as published.
export const specCapAlertExample = {
  identifier: 'ALERT-2026-00001',
  sender: 'ews.gov.lb',
  sent: '2026-06-22T10:00:00Z',
  status: 'Actual',
  msg_type: 'Alert',
  source: 'National Early Warning System',
  scope: 'Public',
  assessment_date: '2026-06-22T10:00:00Z',
  threshold_status: 'CROSSING_THRESHOLD_1',
  info: [
    {
      language: 'en-US',
      category: ['Met'],
      event: 'Flash Flood',
      response_type: ['Prepare'],
      urgency: 'Immediate',
      severity: 'Severe',
      certainty: 'Likely',
      headline: 'Flash Flood Warning',
      description: 'Heavy rainfall may cause flash flooding.',
      instruction: 'Move to higher ground.',
      effective: '2026-06-22T10:00:00Z',
      expires: '2026-06-22T18:00:00Z',
      area: [
        {
          areaDesc: 'Bekaa Governorate',
          polygon: ['33.85,35.45 33.95,35.45 33.95,35.55 33.85,35.55 33.85,35.45'],
          geocode: [{ valueName: 'ADMIN_CODE', value: 'LB-BI' }],
        },
        {
          areaDesc: 'Baalbek District',
          geocode: [{ valueName: 'SPMIS_DISTRICT_ID', value: 'DISTRICT_101' }],
        },
      ],
    },
  ],
};

const FLOOD_POLYGON = '-1.30,36.80 -1.20,36.80 -1.20,36.95 -1.30,36.95 -1.30,36.80';

export const capAlerts = {
  'spec example': specCapAlertExample,

  // Every attribute of CapAlert, Info, Area, GeoCode and Resource.
  full: {
    identifier: 'EWS-2026-FL-0001',
    sender: 'ews.gov.example',
    sent: '2026-10-12T06:00:00Z',
    status: 'Actual',
    msg_type: 'Alert',
    source: 'National Hydrological Service',
    scope: 'Restricted',
    restriction: 'For social protection and disaster risk management agencies only',
    addresses: ['spmis.gov.example', 'drm.gov.example'],
    code: 'DCI-EWS-1.0',
    assessment_date: '2026-10-12T05:30:00Z',
    threshold_status: 'TRIGGER',
    note: 'River gauge above the trigger level for 6 hours',
    incidents: ['INC-2026-0042'],
    info: [
      {
        language: 'eng',
        category: ['Met', 'Env'],
        event: 'River Flood',
        event_code: 'FL',
        response_type: ['Evacuate', 'Prepare'],
        urgency: 'Immediate',
        severity: 'Extreme',
        certainty: 'Observed',
        audience: 'Households in the river basin',
        effective: '2026-10-12T06:00:00Z',
        onset: '2026-10-12T08:00:00Z',
        expires: '2026-10-14T06:00:00Z',
        sender_name: 'National Hydrological Service',
        headline: 'Severe river flooding expected in the lower basin',
        description: 'The river is forecast to exceed its banks within 2 hours.',
        instruction: 'Evacuate low-lying areas and move to designated shelters.',
        web: 'https://ews.gov.example/alerts/EWS-2026-FL-0001',
        contact: '+254 700 000 000',
        parameter: [{ valueName: 'WATER_LEVEL_M', value: '4.2' }],
        area: [
          {
            areaDesc: 'Lower river basin',
            polygon: [FLOOD_POLYGON],
            circle: ['-1.25,36.87 5'],
            geocode: [{ valueName: 'ADMIN_CODE', value: 'KE-30' }, { valueName: 'SPMIS_DISTRICT_ID', value: 'DISTRICT_204' }],
          },
        ],
        resource: [
          {
            resourceDesc: 'Flood extent map',
            mimeType: 'image/jpeg',
            size: 204800,
            uri: 'https://ews.gov.example/maps/EWS-2026-FL-0001.jpg',
            digest: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
          },
        ],
        created_at: '2026-10-12T05:45:00Z',
      },
    ],
    created_at: '2026-10-12T05:45:00Z',
  },

  // Only the mandatory (1...1) attributes; info is 0...*.
  minimal: {
    identifier: 'EWS-2026-MN-0001',
    sender: 'ews.gov.example',
    sent: '2026-09-01T00:00:00Z',
    status: 'Actual',
    msg_type: 'Alert',
    scope: 'Public',
    assessment_date: '2026-09-01T00:00:00Z',
    threshold_status: 'NORMAL',
  },

  // scope Private: addresses is required.
  private: {
    identifier: 'EWS-2026-PV-0003',
    sender: 'ews.gov.example',
    sent: '2026-10-01T09:00:00Z',
    status: 'Actual',
    msg_type: 'Alert',
    scope: 'Private',
    addresses: ['spmis.gov.example'],
    assessment_date: '2026-10-01T08:00:00Z',
    threshold_status: 'WATCH',
    info: [{
      language: 'eng', category: ['Safety'], event: 'Dam Safety Concern', urgency: 'Expected', severity: 'Moderate', certainty: 'Possible',
      area: [{ areaDesc: 'Downstream of the dam', geocode: [{ valueName: 'ADMIN_CODE', value: 'KE-30' }] }],
    }],
  },

  // Slow-onset hazard, first assessment (WATCH).
  drought: {
    identifier: 'EWS-2026-DR-0007',
    sender: 'ews.gov.example',
    sent: '2026-07-01T08:00:00Z',
    status: 'Actual',
    msg_type: 'Alert',
    scope: 'Public',
    assessment_date: '2026-07-01T00:00:00Z',
    threshold_status: 'WATCH',
    info: [{
      language: 'eng',
      category: ['Env'],
      event: 'Drought',
      event_code: 'DR',
      response_type: ['Monitor'],
      urgency: 'Expected',
      severity: 'Moderate',
      certainty: 'Possible',
      onset: '2026-08-01T00:00:00Z',
      expires: '2026-12-31T23:59:59Z',
      headline: 'Below-average rainfall: drought watch',
      area: [{ areaDesc: 'Arid north', polygon: ['3.00,35.00 4.50,35.00 4.50,37.00 3.00,37.00 3.00,35.00'], geocode: [{ valueName: 'ADMIN_CODE', value: 'KE-23' }] }],
    }],
  },

  // DO.EWS.02 hint: a slow-onset update reuses the identifier and moves assessment_date forward.
  'drought update': {
    identifier: 'EWS-2026-DR-0007',
    sender: 'ews.gov.example',
    sent: '2026-09-01T08:00:00Z',
    status: 'Actual',
    msg_type: 'Update',
    scope: 'Public',
    assessment_date: '2026-09-01T00:00:00Z',
    threshold_status: 'CROSSING_THRESHOLD_1',
    info: [{
      language: 'eng',
      category: ['Env'],
      event: 'Drought',
      event_code: 'DR',
      response_type: ['Prepare'],
      urgency: 'Expected',
      severity: 'Severe',
      certainty: 'Likely',
      onset: '2026-08-01T00:00:00Z',
      expires: '2026-12-31T23:59:59Z',
      headline: 'Drought deepening: crossing the first threshold',
      area: [{ areaDesc: 'Arid north', polygon: ['3.00,35.00 4.50,35.00 4.50,37.00 3.00,37.00 3.00,35.00'], geocode: [{ valueName: 'ADMIN_CODE', value: 'KE-23' }] }],
    }],
  },

  // Rapid onset, observed; category sent as its CD.EWS.01 code ("GEO"); a circle area.
  earthquake: {
    identifier: 'EWS-2026-EQ-0002',
    sender: 'seismic.gov.example',
    sent: '2026-10-20T14:32:00+03:00',
    status: 'Actual',
    msg_type: 'Alert',
    scope: 'Public',
    assessment_date: '2026-10-20T14:31:00+03:00',
    threshold_status: 'TRIGGER',
    info: [{
      language: 'eng',
      category: ['GEO'],
      event: 'Earthquake',
      event_code: 'EW',
      response_type: ['Assess'],
      urgency: 'Past',
      severity: 'Extreme',
      certainty: 'Observed',
      headline: 'M6.4 earthquake near the rift valley',
      area: [{ areaDesc: '50 km around the epicentre', circle: ['-0.50,36.10 50'], geocode: [{ valueName: 'ADMIN_CODE', value: 'KE-31' }] }],
    }],
  },

  // Health category, geocode-only area (no polygon: no geometry).
  heatwave: {
    identifier: 'EWS-2026-HW-0004',
    sender: 'met.gov.example',
    sent: '2026-03-10T07:00:00Z',
    status: 'Actual',
    msg_type: 'Alert',
    scope: 'Public',
    assessment_date: '2026-03-10T06:00:00Z',
    threshold_status: 'WATCH',
    info: [{
      language: 'en-US',
      category: 'Health',
      event: 'Heat Wave',
      event_code: 'HW',
      response_type: 'Monitor',
      urgency: 'Future',
      severity: 'Minor',
      certainty: 'Likely',
      effective: '2026-03-12T00:00:00Z',
      expires: '2026-03-16T00:00:00Z',
      area: [{ areaDesc: 'Coastal counties', geocode: { valueName: 'ADMIN_CODE', value: 'KE-01' } }],
    }],
  },

  // status Exercise: accepted and validated, must never drive action.
  exercise: {
    identifier: 'EWS-2026-EX-0001',
    sender: 'ews.gov.example',
    sent: '2026-05-05T10:00:00Z',
    status: 'Exercise',
    msg_type: 'Alert',
    scope: 'Public',
    assessment_date: '2026-05-05T10:00:00Z',
    threshold_status: 'TRIGGER',
    note: 'National simulation exercise - not a real event',
    info: [{
      language: 'eng', category: ['Met'], event: 'Tropical Cyclone', event_code: 'TC', urgency: 'Expected', severity: 'Severe', certainty: 'Likely',
      area: [{ areaDesc: 'Coastal strip', polygon: ['-4.10,39.50 -3.90,39.50 -3.90,39.70 -4.10,39.70 -4.10,39.50'] }],
    }],
  },

  // msg_type Cancel of the flood alert (same identifier, references the original message).
  cancel: {
    identifier: 'EWS-2026-FL-0001',
    sender: 'ews.gov.example',
    sent: '2026-10-13T06:00:00Z',
    status: 'Actual',
    msg_type: 'Cancel',
    scope: 'Restricted',
    restriction: 'For social protection and disaster risk management agencies only',
    assessment_date: '2026-10-13T05:30:00Z',
    threshold_status: 'NORMAL',
    references: ['ews.gov.example,EWS-2026-FL-0001,2026-10-12T06:00:00Z'],
    note: 'River levels back below the watch level',
  },
};

// ---------------------------------------------------------------------------
// Alert (DO.EWS.01): GeoJSON Feature carrying a CapAlert
// ---------------------------------------------------------------------------

// DO.EWS.01 Alert example, as published (properties.capAlert).
export const specAlertExample = {
  type: 'Feature',
  id: 'ALERT-2026-00001',
  geometry: {
    type: 'MultiPolygon',
    coordinates: [[[[35.45, 33.85], [35.55, 33.85], [35.55, 33.95], [35.45, 33.95], [35.45, 33.85]]]],
  },
  properties: { capAlert: structuredClone(specCapAlertExample) },
};

// GeoJSON MultiPolygon from the CAP polygons ("lat,lon" -> [lon, lat]), or null.
export function geometryOf(capAlert) {
  const polygons = (capAlert.info || []).flatMap((i) => i.area || []).flatMap((a) => a.polygon || [])
    .map((p) => [p.trim().split(/\s+/).map((pair) => { const [lat, lon] = pair.split(',').map(Number); return [lon, lat]; })]);
  return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
}

const featureOf = (capAlert, geometry = geometryOf(capAlert)) => ({
  type: 'Feature', id: capAlert.identifier, geometry, properties: structuredClone(capAlert),
});

export const alerts = {
  'spec example': specAlertExample,
  // properties is the CapAlert itself (DO.EWS.01 attribute table).
  full: featureOf(capAlerts.full),
  drought: featureOf(capAlerts['drought update']),
  // Point geometry at the epicentre.
  earthquake: featureOf(capAlerts.earthquake, { type: 'Point', coordinates: [36.10, -0.50] }),
  // No polygon: geometry null.
  heatwave: featureOf(capAlerts.heatwave),
  exercise: featureOf(capAlerts.exercise),
  private: featureOf(capAlerts.private),
  minimal: featureOf(capAlerts.minimal),
};

// The alerts collection of the mock EWS: the latest version of each alert.
export const alertCollection = ['spec example', 'full', 'drought', 'earthquake', 'heatwave', 'exercise', 'private'].map((n) => alerts[n]);

const capOf = (feature) => feature.properties.capAlert || feature.properties;
const CATEGORY_CODE = { Geo: 'GEO', Met: 'MET', Safety: 'SAFETY', Security: 'SECURITY', Rescue: 'RESCUE', Fire: 'FIRE', Health: 'HEALTH', Env: 'ENV', Transport: 'TRANSPORT', Infra: 'INFRA', CBRNE: 'CBRNE', Other: 'OTHER' };
const CATEGORY_VALUE = Object.fromEntries(Object.entries(CATEGORY_CODE).map(([v, c]) => [c, v]));

// The CAP values of an alert for an /items filter (alert-level, or any info block).
export function filterValues(feature, param) {
  const cap = capOf(feature);
  if (['status', 'msg_type', 'scope', 'threshold_status'].includes(param)) return [cap[param]].filter(Boolean);
  const values = (cap.info || []).flatMap((info) => [].concat(info[param] ?? []));
  return param === 'category' ? values.map((c) => CATEGORY_VALUE[c] ?? c) : values;
}

// "<param>|<value>" -> features, for every filterable CAP field and value present (category
// indexed by value and by code).
export function itemsIndex() {
  const index = {};
  for (const feature of alertCollection) {
    for (const param of ['status', 'msg_type', 'scope', 'threshold_status', 'category', 'severity', 'urgency', 'certainty', 'event', 'event_code']) {
      for (const value of new Set(filterValues(feature, param))) {
        const keys = param === 'category' ? [value, CATEGORY_CODE[value]] : [value];
        for (const key of keys) (index[`${param}|${key}`] ??= []).push(feature);
      }
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Aggregated member statistics (SDMX)
// ---------------------------------------------------------------------------
const obs = (value, attributes = { OBS_STATUS: 'A' }) => ({ attributes, observations: { 0: [value] } });
const sdmxStructure = (areas) => ({
  name: 'DCI Member Statistics',
  dimensions: {
    series: [
      { id: 'REF_AREA', name: 'Reference Area', keyPosition: 0, values: areas },
      { id: 'SEX', name: 'Sex', keyPosition: 1, values: [{ id: 'F', name: 'Female' }, { id: 'M', name: 'Male' }] },
      { id: 'DISABILITY_STATUS', name: 'Disability Status', keyPosition: 2, values: [{ id: 'TRUE', name: 'With disability' }, { id: 'FALSE', name: 'Without disability' }] },
      { id: 'AGE_GROUP', name: 'Age Group', keyPosition: 3, values: [{ id: 'ALL', name: 'All ages' }] },
    ],
  },
  measures: { series: [{ id: 'OBS_VALUE', name: 'Number of Members', unit: 'PERSONS' }] },
});

// API.EWS.05 SDMX-JSON example, as published (GET /data/DCI_MEMBER_STATISTICS/AREA001.*.*.ALL.2026).
export const specSdmxJsonExample = {
  header: { id: 'DCI_MEMBER_STATISTICS', prepared: '2026-07-31T13:00:00Z', sender: { id: 'DCI_COUNTRY_SYSTEM' } },
  structure: sdmxStructure([{ id: 'AREA001', name: 'District A' }]),
  dataSets: [{
    action: 'Information',
    series: {
      '0:0:0:0': obs(3421),
      '0:0:1:0': obs(60391),
      '0:1:0:0': obs(2876),
      '0:1:1:0': obs(58642),
    },
  }],
};

// sdmx-dci-member-example payload, as published except for its "//" comments (not valid JSON).
export const specDciStatisticsExample = {
  meta: {
    schema: 'https://githubusercontent.com',
    id: 'IREP000012',
    prepared: '2026-09-22T08:45:00Z',
    sender: { id: 'SP' },
    receiver: { id: 'DRM' },
  },
  data: {
    dataSets: [{
      action: 'Information',
      structureRef: 'DCI_MEMBER_STATISTICS',
      attributes: {
        SOURCE: 'EWS-Shock-Tracker-V2',
        PROFILE_DENOMINATOR_DEF: 'All households residing within landslide zone buffers with structural damage greater than 40% certified by local municipal engineers.',
      },
      observations: {
        'AREA001.F.TRUE.ALL.IPC_3_PLUS': { OBS_VALUE: 1250, EXCLUSION_IND: false, NON_MATCH_COUNT: 45, COVERAGE_RATE: 82.5, OBS_STATUS: 'A', CONFIDENTIALITY: 'F' },
        'AREA002.M.FALSE.LT5.IPC_3_PLUS': { OBS_VALUE: 0, EXCLUSION_IND: true, NON_MATCH_COUNT: 12, COVERAGE_RATE: 0.0, OBS_STATUS: 'A', CONFIDENTIALITY: 'F' },
      },
    }],
  },
};

export const statistics = {
  SdmxJson: {
    'spec example': specSdmxJsonExample,
    // A small count suppressed and a zero count flagged, with a time dimension and dataset attributes.
    suppressed: {
      header: { id: 'DCI_MEMBER_STATISTICS', prepared: '2026-10-01T09:00:00Z', sender: { id: 'spmis.example.org' } },
      structure: {
        ...sdmxStructure([{ id: 'AREA002', name: 'District B' }]),
        dimensions: {
          ...sdmxStructure([{ id: 'AREA002', name: 'District B' }]).dimensions,
          observation: [{ id: 'TIME_PERIOD', name: 'Time Period', role: 'time', values: [{ id: '2026' }] }],
        },
      },
      dataSets: [{
        action: 'Information',
        attributes: { SOURCE: 'SPMIS' },
        series: {
          '0:0:0:0': obs(null, { OBS_STATUS: 'A', CONFIDENTIALITY: 'C', EXCLUSION_IND: false }),
          '0:0:1:0': obs(5120, { OBS_STATUS: 'A', CONFIDENTIALITY: 'F', EXCLUSION_IND: false, LAST_VERIFIED_DATE: '2026-09-15' }),
          '0:1:0:0': obs(0, { OBS_STATUS: 'A', CONFIDENTIALITY: 'F', EXCLUSION_IND: true }),
          '0:1:1:0': obs(4980, { OBS_STATUS: 'A', CONFIDENTIALITY: 'F', EXCLUSION_IND: false, COVERAGE_RATE: 61.2 }),
        },
      }],
    },
    // An explicitly requested area with no registered member.
    zero: {
      header: { id: 'DCI_MEMBER_STATISTICS', prepared: '2026-10-01T09:00:00Z', sender: { id: 'spmis.example.org' } },
      structure: {
        name: 'DCI Member Statistics',
        dimensions: {
          series: [
            { id: 'REF_AREA', keyPosition: 0, values: [{ id: 'AREA003', name: 'District C' }] },
            { id: 'SEX', keyPosition: 1, values: [{ id: 'F', name: 'Female' }] },
            { id: 'DISABILITY_STATUS', keyPosition: 2, values: [{ id: 'TRUE', name: 'With disability' }] },
            { id: 'AGE_GROUP', keyPosition: 3, values: [{ id: 'ALL', name: 'All ages' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', role: 'time', values: [{ id: '2026' }] }],
        },
        measures: { series: [{ id: 'OBS_VALUE', name: 'Number of Members', unit: 'PERSONS' }] },
      },
      dataSets: [{ action: 'Information', series: { '0:0:0:0': obs(0, { OBS_STATUS: 'A', CONFIDENTIALITY: 'F', EXCLUSION_IND: true }) } }],
    },
  },
  DciStatistics: {
    'spec example': specDciStatisticsExample,
    // The API.EWS.05 key layout (… TIME_PERIOD) in the DCI JSON format.
    'by period': {
      meta: { id: 'IREP000013', prepared: '2026-10-01T09:00:00Z', sender: { id: 'spmis.example.org' }, receiver: { id: 'ews.example.org' } },
      data: {
        dataSets: [{
          action: 'Information',
          structureRef: 'DCI_MEMBER_STATISTICS',
          attributes: { SOURCE: 'SPMIS' },
          observations: {
            'AREA001.F.TRUE.ALL.2026': { OBS_VALUE: 3421, OBS_STATUS: 'A', CONFIDENTIALITY: 'F', EXCLUSION_IND: false },
            'AREA001.M.TRUE.Y5T17.2026': { OBS_VALUE: null, OBS_STATUS: 'A', CONFIDENTIALITY: 'C', EXCLUSION_IND: false },
          },
        }],
      },
    },
  },
};

// SDMX query key -> response, for the mock SP (GET /data/DCI_MEMBER_STATISTICS/{key}).
export const sdmxResponses = {
  'sdmx-json': {
    'AREA001.*.*.ALL.2026': statistics.SdmxJson['spec example'],
    'AREA002.*.*.ALL.2026': statistics.SdmxJson.suppressed,
    'AREA003.F.TRUE.ALL.2026': statistics.SdmxJson.zero,
  },
  'dci-json': {
    'AREA001+AREA002.*.*.*.IPC_3_PLUS': statistics.DciStatistics['spec example'],
    'AREA001.*.*.*.2026': statistics.DciStatistics['by period'],
  },
};

export const records = {
  CapAlert: capAlerts,
  Alert: alerts,
  SdmxJson: statistics.SdmxJson,
  DciStatistics: statistics.DciStatistics,
};
