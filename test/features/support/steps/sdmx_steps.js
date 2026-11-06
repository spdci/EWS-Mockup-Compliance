// Aggregated member statistics (API.EWS.05, PRS.EWS.02): GET /data/{dataflow}/{key}.

import './parameter_types.js';
import { Given, Then } from '@cucumber/cucumber';
import chai from 'chai';
import { testStatistics } from '../helpers/testdata.js';
import { SDMX_KEY_LAYOUTS } from '../helpers/validator.js';

const { expect } = chai;

Given('the member statistics query {string}', function (name) {
  const { dataflow, key, format } = testStatistics(name);
  this.pathParams = { dataflow, key };
  this.query = format ? { format } : {};
  this.responseKind = format === 'dci-json' ? 'dci-json' : 'sdmx-json';
});

Given('the member statistics key {string}', function (key) {
  this.pathParams = { dataflow: this.pathParams.dataflow || 'DCI_MEMBER_STATISTICS', key };
});

Given('the dataflow {string}', function (dataflow) {
  this.pathParams.dataflow = dataflow;
});

Given('the statistics are asked for in the {string} format', function (format) {
  this.query.format = format;
  this.responseKind = format === 'dci-json' ? 'dci-json' : 'sdmx-json';
});

// Every observation as { codes: { dimension: code }, key: "A.B.C...", value, attributes }.
export function observationsOf(body, kind) {
  const out = [];
  if (kind === 'dci-json') {
    for (const dataSet of body?.data?.dataSets || []) {
      for (const [key, o] of Object.entries(dataSet.observations || {})) {
        const parts = key.split('.');
        const layout = SDMX_KEY_LAYOUTS.find((l) => l.length === parts.length) || [];
        out.push({ key, codes: Object.fromEntries(layout.map((d, i) => [d, parts[i]])), value: o.OBS_VALUE, attributes: o });
      }
    }
    return out;
  }
  const series = [...(body?.structure?.dimensions?.series || [])].sort((a, b) => (a.keyPosition ?? 0) - (b.keyPosition ?? 0));
  const obsDim = body?.structure?.dimensions?.observation?.[0];
  for (const dataSet of body?.dataSets || []) {
    for (const [seriesKey, s] of Object.entries(dataSet.series || {})) {
      const codes = Object.fromEntries(seriesKey.split(':').map((idx, p) => [series[p]?.id, series[p]?.values?.[Number(idx)]?.id]));
      for (const [obsKey, [value, obsAttrs]] of Object.entries(s.observations || {})) {
        const all = { ...codes, ...(obsDim ? { [obsDim.id]: obsDim.values?.[Number(obsKey)]?.id } : {}) };
        out.push({ key: Object.values(all).join('.'), codes: all, value, attributes: { ...(s.attributes || {}), ...(obsAttrs || {}) } });
      }
    }
  }
  return out;
}

const observation = (world, key) => {
  const all = observationsOf(world.response.body, world.inspected.kind);
  const found = all.find((o) => o.key === key);
  expect(found, `observation "${key}" (returned: ${all.map((o) => o.key).join(', ')})`).to.exist;
  return found;
};

Then('the observation {string} should be {int}', function (key, value) {
  expect(observation(this, key).value).to.equal(value);
});

Then('the observation {string} should be suppressed', function (key) {
  const o = observation(this, key);
  expect(o.value, 'OBS_VALUE of a suppressed cell').to.equal(null);
  expect(o.attributes.CONFIDENTIALITY, 'CONFIDENTIALITY of a suppressed cell').to.not.equal('F');
});

Then('the observation {string} should flag an area with no registered member', function (key) {
  const o = observation(this, key);
  expect(o.value, 'OBS_VALUE').to.equal(0);
  expect(o.attributes.EXCLUSION_IND, 'EXCLUSION_IND').to.equal(true);
});

Then('at least {int} observation(s) should be returned', function (count) {
  expect(observationsOf(this.response.body, this.inspected.kind).length).to.be.at.least(count);
});

// Each returned code is one the key asked for ("*" = any; "A+B" = A or B).
Then('every observation should match the query key', function () {
  const parts = this.pathParams.key.split('.');
  const all = observationsOf(this.response.body, this.inspected.kind);
  expect(all, 'observations').to.not.be.empty;
  const layout = SDMX_KEY_LAYOUTS.find((l) => l.length === parts.length && (l[4] !== 'DENOMINATOR_TYPE' || /^[A-Z_0-9]+$/.test(parts[4].split('+')[0]) && !/^\d/.test(parts[4])))
    || SDMX_KEY_LAYOUTS[0];
  for (const o of all) {
    layout.forEach((dimension, i) => {
      const wanted = parts[i];
      if (!wanted || wanted === '*' || o.codes[dimension] === undefined) return;
      expect(wanted.split('+'), `${o.key} ${dimension}`).to.include(o.codes[dimension]);
    });
  }
});

Then('no member record should be in the response', function () {
  const text = JSON.stringify(this.response.body);
  for (const field of ['member_identifier', 'identifier_value', 'given_name', 'surname', 'birth_date', 'phone_number', 'demographic_info']) {
    expect(text, `aggregated statistics must not carry "${field}"`).to.not.include(`"${field}"`);
  }
});
