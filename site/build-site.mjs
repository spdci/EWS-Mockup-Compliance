#!/usr/bin/env node
// Builds the GitHub Pages site of the EWS compliance suite:
//   index.html                      landing page: latest results, links
//   report/index.html               Cucumber HTML report of the latest run
//   report/ews-compliance.xml       JUnit results of the latest run
//   api/index.html                  Swagger UI with two specs:
//   api/ews_api_v1.0.0.yaml           - the DCI EWS interface (docs/openapi; derived by this suite,
//                                       the standard publishes no YAML)
//   api/ews_api_v1.0.0-mock.yaml      - the same API on the mock paths and ports, so
//                                       "Try it out" works against mocks started locally; each
//                                       request body defaults to a valid request built by the
//                                       test suite (test/features/support/helpers/defaults.js)
//
// Usage: node site/build-site.mjs --out <dir> [--report <report.html>] [--junit <junit.xml>]
// (requires `npm install` in test/, which provides the yaml package)

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, 'test', 'package.json'));
const YAML = require('yaml');

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, a, i, all) => (
  a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []));
if (!args.out) {
  console.error('Usage: node site/build-site.mjs --out <dir> [--report <report.html>] [--junit <junit.xml>]');
  process.exit(2);
}
const out = path.resolve(args.out);
const SPEC = 'ews_api_v1.0.0.yaml';
const MOCK_SPEC = 'ews_api_v1.0.0-mock.yaml';

// SP-side endpoints: exposed by the SP (mock on 3334); every other path is EWS side (3333).
const SP_PATHS = ['/notify', '/on-subscribe', '/on-unsubscribe', '/data/{dataflow}/{key}'];
// Endpoints of the standard the mock does not serve: left out of the mock spec.
const NOT_MOCKED = [];

mkdirSync(path.join(out, 'api'), { recursive: true });
mkdirSync(path.join(out, 'report'), { recursive: true });

// ---------------------------------------------------------------------------
// API reference
// ---------------------------------------------------------------------------
const specText = readFileSync(path.join(root, 'docs', 'openapi', SPEC), 'utf8');
writeFileSync(path.join(out, 'api', SPEC), specText);

const spec = YAML.parse(specText);
const mock = structuredClone(spec);
mock.info.title = `${spec.info.title} (local mock)`;
mock.info.description = [
  '**EWS mock of this compliance suite.** Same API as the DCI EWS interface, served on the mock paths',
  '(`/ews/...`). Start the mocks locally (`./test_entrypoint.sh`, or',
  '`npx @mockoon/cli@9.2.0 start --data mockoon-ews.json mockoon-sp.json --port 3333 3334`), then use',
  '"Try it out": EWS-side endpoints are sent to port 3333, SP-side endpoints (notify, on-subscribe,',
  'on-unsubscribe, data) to port 3334. Your browser may ask to allow access to local network devices.',
  '',
  '---',
  '',
  spec.info.description || '',
].join('\n');
mock.servers = [{ url: 'http://127.0.0.1:3333', description: 'EWS mock (EWS side)' }];
mock.paths = Object.fromEntries(Object.entries(spec.paths).filter(([p]) => !NOT_MOCKED.includes(p)).map(([p, item]) => {
  const mockPath = `/ews${p}`;
  const withServers = SP_PATHS.includes(p)
    ? { ...item, servers: [{ url: 'http://127.0.0.1:3334', description: 'SP mock (callback side)' }] }
    : item;
  return [mockPath, withServers];
}));
// Default "Try it out" bodies: the valid request the test suite sends to each endpoint (the samples
// Swagger UI derives from the schemas mix example fragments and are rejected by the mock).
// Asynchronous requests carry sender_uri = the SP mock, so the EWS mock delivers its callback there.
const helpers = path.join(root, 'test', 'features', 'support', 'helpers');
const { endpoints } = await import(pathToFileURL(path.join(helpers, 'helpers.js')));
const { buildRequest } = await import(pathToFileURL(path.join(helpers, 'defaults.js')));
for (const [mockPath, item] of Object.entries(mock.paths)) {
  for (const method of ['post', 'put']) {
    const name = Object.keys(endpoints).find((n) => `/${endpoints[n].path}` === mockPath && endpoints[n].method === method.toUpperCase());
    const contents = Object.values(item[method]?.requestBody?.content || {});
    if (!name || !contents.length) continue;
    const example = buildRequest(name);
    const { callback } = endpoints[name];
    if (callback) example.header.sender_uri = `http://127.0.0.1:3334/${callback.path}`;
    contents.forEach((content) => { content.example = example; });
  }
}

const mockText = YAML.stringify(mock, { aliasDuplicateObjects: false, lineWidth: 0 });
writeFileSync(path.join(out, 'api', MOCK_SPEC), mockText);

copyFileSync(path.join(root, 'site', 'api', 'index.html'), path.join(out, 'api', 'index.html'));

// ---------------------------------------------------------------------------
// Latest test report
// ---------------------------------------------------------------------------
const hasReport = args.report && existsSync(args.report);
const hasJunit = args.junit && existsSync(args.junit);
if (hasReport) copyFileSync(args.report, path.join(out, 'report', 'index.html'));
if (hasJunit) copyFileSync(args.junit, path.join(out, 'report', 'ews-compliance.xml'));

let results;
if (hasJunit) {
  const suite = readFileSync(args.junit, 'utf8').match(/<testsuite\b[^>]*>/)?.[0] ?? '';
  const attr = (name) => Number(suite.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1] ?? 0);
  results = { tests: attr('tests'), failures: attr('failures') + attr('errors'), skipped: attr('skipped') };
  results.passed = results.tests - results.failures - results.skipped;
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const repo = process.env.GITHUB_REPOSITORY || 'spdci/EWS-Mockup-Compliance';
const sha = process.env.GITHUB_SHA;
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
const builtAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
const status = !results ? { cls: 'none', text: 'No results' }
  : results.failures ? { cls: 'fail', text: `${results.failures} failing` }
    : { cls: 'pass', text: 'All passing' };

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EWS Compliance</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --text:#1d1d1b; --muted:#5f5f5a; --line:#e2e1dc; --accent:#1f5f8b;
          --pass:#1e7a46; --pass-bg:#e5f3ea; --fail:#b3261e; --fail-bg:#fbe9e7; --none:#5f5f5a; --none-bg:#eeeeea; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#161615; --card:#1f1f1d; --text:#ecebe6; --muted:#a3a29b; --line:#33322f; --accent:#7fb6dc;
            --pass:#7dd3a0; --pass-bg:#1c3326; --fail:#f2a59e; --fail-bg:#3a1f1c; --none:#a3a29b; --none-bg:#2a2a27; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:880px; margin:0 auto; padding:40px 16px 64px; }
  h1 { font-size:1.6rem; margin:0 0 4px; }
  p.lead { color:var(--muted); margin:0 0 28px; }
  .status { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:600; font-size:.85rem; }
  .status.pass { color:var(--pass); background:var(--pass-bg); }
  .status.fail { color:var(--fail); background:var(--fail-bg); }
  .status.none { color:var(--none); background:var(--none-bg); }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin:16px 0 8px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .stat b { display:block; font-size:1.6rem; font-variant-numeric:tabular-nums; }
  .stat span { color:var(--muted); font-size:.85rem; }
  .meta { color:var(--muted); font-size:.85rem; margin-bottom:32px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
  a.card { display:block; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px;
           color:inherit; text-decoration:none; }
  a.card:hover { border-color:var(--accent); }
  a.card h2 { font-size:1.05rem; margin:0 0 6px; color:var(--accent); }
  a.card p { margin:0; color:var(--muted); font-size:.92rem; }
  a { color:var(--accent); }
  code { font-size:.9em; }
</style>
</head>
<body>
<main>
  <h1>DCI Early Warning System compliance</h1>
  <p class="lead">Compliance suite and mock API for the DCI Early Warning System and SP system interface: alert
    subscriptions and notifications, the alerts collection (OGC API Features), aggregated member statistics (SDMX),
    with the CAP-based alert data rules and the statistics privacy rules.</p>

  <section aria-label="Latest run">
    <span class="status ${status.cls}">${esc(status.text)}</span>
    ${results ? `<div class="stats">
      <div class="stat"><b>${results.tests}</b><span>scenarios</span></div>
      <div class="stat"><b>${results.passed}</b><span>passed</span></div>
      <div class="stat"><b>${results.failures}</b><span>failed</span></div>
      <div class="stat"><b>${results.skipped}</b><span>skipped</span></div>
    </div>` : ''}
    <div class="meta">Latest run against the bundled mocks, built ${esc(builtAt)} UTC${sha ? ` from <a href="https://github.com/${esc(repo)}/commit/${esc(sha)}"><code>${esc(sha.slice(0, 7))}</code></a>` : ''}${runUrl ? ` · <a href="${esc(runUrl)}">workflow run</a>` : ''}</div>
  </section>

  <div class="cards">
    ${hasReport ? `<a class="card" href="report/"><h2>Test report</h2><p>Every scenario of the latest run, by feature, with step details.</p></a>` : ''}
    <a class="card" href="api/"><h2>API reference</h2><p>Swagger UI for the DCI EWS interface (derived: no YAML is published), and the same API on the local mocks to try requests.</p></a>
    ${hasJunit ? `<a class="card" href="report/ews-compliance.xml"><h2>JUnit results</h2><p>Machine-readable results of the latest run.</p></a>` : ''}
    <a class="card" href="https://github.com/${esc(repo)}"><h2>Source</h2><p>Run the suite against your own EWS or SP implementation.</p></a>
  </div>
</main>
</body>
</html>
`;
writeFileSync(path.join(out, 'index.html'), html);
console.log(`Site built in ${out}${results ? ` (${results.passed}/${results.tests} passed)` : ''}`);
