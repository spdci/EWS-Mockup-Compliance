// Offline rules matrix: proves, attribute by attribute, that EWS data (CapAlert, Alert, and the
// SDMX aggregated statistics) is accepted when correct and rejected when wrong. The same
// validator is applied to every alert and dataset returned or sent by the API scenarios.

import './parameter_types.js';
import { Given, When, Then } from '@cucumber/cucumber';
import chai from 'chai';
import { recordFixture } from '../helpers/defaults.js';
import { validateRecord, validateMessage, formatErrors } from '../helpers/validator.js';
import { codes } from '../helpers/schemas.js';
import { setPath, deletePath, encryptedMessage, callbackHeader, clone } from '../helpers/payloads.js';
import { REMOVED } from './common_steps.js';

const { expect } = chai;

const codeList = (name) => {
  if (!codes[name]) throw new Error(`Unknown code list "${name}". Known: ${Object.keys(codes).join(', ')}`);
  return codes[name];
};

Given('the {string} {recordType} record', function (name, type) {
  this.recordType = type;
  this.record = recordFixture(type, name);
});

Given('an empty {recordType} record', function (type) {
  this.recordType = type;
  this.record = {};
});

When('its {string} attribute is removed', function (path) {
  deletePath(this.record, path);
});

When('its {string} attribute is set to {string}', function (path, json) {
  if (json === REMOVED) deletePath(this.record, path);
  else setPath(this.record, path, JSON.parse(json));
});

Then('the record should be valid', function () {
  const errors = validateRecord(this.recordType, this.record);
  expect(errors, `Expected a valid ${this.recordType} record but got:\n${formatErrors(errors)}`).to.be.empty;
});

// Regex rather than {string}: expected messages may themselves contain quotes.
Then(/^the record should be rejected because of "(.*)"$/, function (expected) {
  const errors = validateRecord(this.recordType, this.record);
  expect(errors, `Expected the ${this.recordType} record to be rejected`).to.not.be.empty;
  expect(errors.some((e) => e.includes(expected)),
    `Expected an error mentioning "${expected}" but got:\n${formatErrors(errors)}`).to.be.true;
});

Then('the record should be rejected because of:', function (table) {
  const errors = validateRecord(this.recordType, this.record);
  const missing = table.raw().flat().filter((expected) => !errors.some((e) => e.includes(expected)));
  expect(missing, `Expected errors mentioning ${JSON.stringify(missing)} but got:\n${formatErrors(errors)}`).to.be.empty;
});

// Every value of a code list, one by one, as a single value or as a one-item list.
function expectEveryCodeAccepted(world, list, path, wrap) {
  const failures = [];
  for (const value of codeList(list)) {
    const record = clone(world.record);
    setPath(record, path, wrap(value));
    const errors = validateRecord(world.recordType, record);
    if (errors.length) failures.push(`${JSON.stringify(wrap(value))}:\n${formatErrors(errors)}`);
  }
  expect(failures, `Codes of "${list}" rejected for ${path}:\n${failures.join('\n')}`).to.be.empty;
}

Then('every {string} code should be accepted as {string}', function (list, path) {
  expectEveryCodeAccepted(this, list, path, (v) => v);
});

Then('every {string} code should be accepted in the list {string}', function (list, path) {
  expectEveryCodeAccepted(this, list, path, (v) => [v]);
});

// Envelope-level: encrypted payloads are validated as EncryptedMessage.
Given('an encrypted {string} message', function (action) {
  this.request = { header: { ...callbackHeader(action), is_msg_encrypted: true }, message: encryptedMessage() };
  this.messageKind = action;
});

When('its encrypted field {string} is removed', function (path) {
  deletePath(this.request.message, path);
});

Then('the encrypted message should be valid', function () {
  const errors = validateMessage(this.messageKind, this.request);
  expect(errors, formatErrors(errors)).to.be.empty;
});

Then('the encrypted message should be rejected because of {string}', function (expected) {
  const errors = validateMessage(this.messageKind, this.request);
  expect(errors.some((e) => e.includes(expected)), `Expected an error mentioning "${expected}" but got:\n${formatErrors(errors)}`).to.be.true;
});
