#!/usr/bin/env node
// Turns the Cucumber JSON report into a Markdown summary (GitHub Actions job summary):
// totals, one row per feature and the failing scenarios with their first error.
//   node ci/summary.mjs result/cucumber.json >> "$GITHUB_STEP_SUMMARY"

import { readFileSync } from 'node:fs';

const features = JSON.parse(readFileSync(process.argv[2] || 'result/cucumber.json', 'utf8'));

// A scenario fails if any step failed, is undefined or ambiguous; it is skipped if a step was skipped or pending.
const outcome = (scenario) => {
  const statuses = (scenario.steps || []).map((s) => s.result?.status);
  if (statuses.some((s) => ['failed', 'undefined', 'ambiguous'].includes(s))) return 'failed';
  if (statuses.some((s) => ['skipped', 'pending'].includes(s))) return 'skipped';
  return 'passed';
};
const firstError = (scenario) => (scenario.steps || []).find((s) => s.result?.error_message)?.result.error_message
  .split('\n').find((line) => line.trim()) ?? 'step undefined or ambiguous';

const rows = [];
const failures = [];
const total = { passed: 0, failed: 0, skipped: 0 };
for (const feature of features) {
  const count = { passed: 0, failed: 0, skipped: 0 };
  for (const scenario of (feature.elements || []).filter((e) => e.type === 'scenario')) {
    const result = outcome(scenario);
    count[result] += 1;
    total[result] += 1;
    if (result === 'failed') failures.push(`- **${feature.uri}**: ${scenario.name}\n  \`${firstError(scenario).slice(0, 300)}\``);
  }
  const icon = count.failed ? '❌' : '✅';
  rows.push(`| ${icon} | \`${feature.uri.replace(/^features\//, '')}\` | ${count.passed} | ${count.failed} | ${count.skipped} |`);
}

const scenarios = total.passed + total.failed + total.skipped;
console.log(`## DCI EWS compliance: ${total.failed ? '❌' : '✅'} ${total.passed} / ${scenarios} scenarios passed\n`);
console.log('| | Feature | Passed | Failed | Skipped |');
console.log('|---|---|---:|---:|---:|');
rows.forEach((r) => console.log(r));
console.log(`| | **Total** | **${total.passed}** | **${total.failed}** | **${total.skipped}** |\n`);
if (failures.length) {
  console.log(`### Failing scenarios (${failures.length})\n`);
  console.log(failures.slice(0, 100).join('\n'));
  if (failures.length > 100) console.log(`\n…and ${failures.length - 100} more, see the HTML report artifact.`);
} else {
  console.log('The full HTML and JUnit reports are attached to this run as the **ews-compliance-report** artifact.');
}
