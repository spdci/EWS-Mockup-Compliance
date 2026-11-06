// Alerts and statistics the suite asks for. The defaults match what the mock EWS and SP serve.
// To run against a real implementation, point TEST_DATA_FILE at a JSON file overriding any
// entry, e.g.
//   { "alerts": { "existing": "MY-ALERT-0042" },
//     "statistics": { "existing": { "dataflow": "DCI_MEMBER_STATISTICS", "key": "KE-30.*.*.ALL.2026" } } }

import { readFileSync } from 'node:fs';

const defaults = {
  // Alert identifiers in the EWS alerts collection (GET /collections/alerts/items/{alertId}).
  alerts: {
    existing: 'ALERT-2026-00001',
    'spec example': 'ALERT-2026-00001',
    full: 'EWS-2026-FL-0001',
    earthquake: 'EWS-2026-EQ-0002',
    heatwave: 'EWS-2026-HW-0004',
    unknown: 'EWS-2026-XX-9999',
  },
  // SDMX queries (GET /data/{dataflow}/{key}) and the format they are answered in.
  statistics: {
    existing: { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA001.*.*.ALL.2026' },
    'spec example': { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA001.*.*.ALL.2026' },
    suppressed: { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA002.*.*.ALL.2026' },
    'empty area': { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA003.F.TRUE.ALL.2026' },
    'dci spec example': { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA001+AREA002.*.*.*.IPC_3_PLUS', format: 'dci-json' },
    'dci by period': { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA001.*.*.*.2026', format: 'dci-json' },
    unknown: { dataflow: 'DCI_MEMBER_STATISTICS', key: 'AREA999.*.*.ALL.2026' },
  },
  regType: 'ns:org:RegistryType:EWS',
};

const overrides = process.env.TEST_DATA_FILE ? JSON.parse(readFileSync(process.env.TEST_DATA_FILE, 'utf8')) : {};

export const testData = {
  ...defaults,
  ...overrides,
  alerts: { ...defaults.alerts, ...(overrides.alerts || {}) },
  statistics: { ...defaults.statistics, ...(overrides.statistics || {}) },
};

export function testAlertId(name) {
  if (!testData.alerts[name]) throw new Error(`Unknown test alert "${name}". Known: ${Object.keys(testData.alerts).join(', ')}`);
  return testData.alerts[name];
}

export function testStatistics(name) {
  if (!testData.statistics[name]) throw new Error(`Unknown test statistics query "${name}". Known: ${Object.keys(testData.statistics).join(', ')}`);
  return testData.statistics[name];
}
