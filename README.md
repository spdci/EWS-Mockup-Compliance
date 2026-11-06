# EARLY WARNING SYSTEM Compliance and Mockup

Compliance test suite and mock API for the **DCI Early Warning Systems and SP system interface**
([standards.spdci.org](https://standards.spdci.org/standards/dci-standards/early-warning-systems)).
It checks the EWS APIs API.EWS.01 to API.EWS.05, the alert data objects Alert (DO.EWS.01), CapAlert
(DO.EWS.02), Info (DO.EWS.03), Resource (DO.EWS.04), Area (DO.EWS.05) and GeoCode (DO.EWS.06), the
code directory CD.EWS.01 to CD.EWS.10, and the aggregated member statistics `DCI_MEMBER_STATISTICS`
(SDMX). The alert model follows OASIS CAP v1.2, the alerts collection OGC API Features, and the
statistics SDMX-JSON.

Unlike the registry standards, **the EWS standard publishes no OpenAPI YAML**. This suite derives
one from the standard pages: [`docs/openapi/ews_api_v1.0.0.yaml`](docs/openapi/ews_api_v1.0.0.yaml),
generated from the suite's own schemas (`node mock/generate-openapi.mjs`). Replace it with the
published YAML once DCI releases one. See [Where the spec is ambiguous](#where-the-spec-is-ambiguous).

## What is covered

All the endpoints of the standard, split by the system that exposes them:

| Side | Endpoint (mock path) | Spec | Mock behaviour |
|---|---|---|---|
| EWS | `POST ews/subscribe` | API.EWS.01 `/subscribe` | ACK, then `on-subscribe` callback to `header.sender_uri` |
| EWS | `POST ews/unsubscribe` | API.EWS.01 `/unsubscribe` | ACK, then `on-unsubscribe` callback |
| EWS | `GET ews/collections/alerts` | API.EWS.03 | The alerts collection (OGC API Features) |
| EWS | `GET ews/collections/alerts/items` | API.EWS.03 | Alerts as a GeoJSON `FeatureCollection`, filtered by a CAP property (`event`, `severity`, `urgency`, ...) and `limit` |
| EWS | `GET ews/collections/alerts/items/{alertId}` | API.EWS.03 | One alert, or an OGC `NotFound` exception (404) |
| EWS | `POST ews/collections/alerts/items` | API.EWS.04 create | 201 with the alert |
| EWS | `PUT ews/collections/alerts/items/{alertId}` | API.EWS.04 replace | 200 with the alert, 404 for an alert that is not in the collection |
| SP | `POST ews/notify` | API.EWS.02 `/notify` | ACK |
| SP | `POST ews/on-subscribe` | callback of API.EWS.01 | ACK |
| SP | `POST ews/on-unsubscribe` | callback of API.EWS.01 | ACK |
| SP | `GET ews/data/{dataflow}/{key}` | API.EWS.05 `/data/DCI_MEMBER_STATISTICS/AREA001.*.*.ALL.2026` | Aggregated member statistics as SDMX-JSON, or the DCI JSON with `?format=dci-json` |

Every mock endpoint validates the request against the schema and refuses what does not conform:

- DCI endpoints answer an `ERR` acknowledgement (`err.request.bad`, HTTP 400);
- the alerts collection answers an OGC exception (`InvalidParameterValue`, HTTP 400; `NotFound`, 404);
- the statistics answer an `HttpErrorResponse` (400 for an invalid key or format, 404 for an unknown
  dataflow or a key with no data).

The test suite (`test/features`, 413 scenarios) checks, per endpoint:

- **smoke**: status, JSON content type (`application/json`, `application/geo+json`,
  `application/vnd.sdmx.data+json`), response time, response schema;
- **functional**: subscriptions by event, event code, category (value and code), severity,
  urgency, certainty, threshold status, status, message type and area (geocode or polygon), and in
  batches; notifications carrying CapAlert or Alert records of every scope, status and message
  type, including a slow-onset alert with its update; alerts filtered on every CAP property, with
  `limit`, and fetched by identifier; creating and replacing alerts; statistics in both formats,
  with suppressed and empty cells;
- **callback**: the full async round trip. The suite starts a listener, sends it as
  `header.sender_uri`, and validates the callback the EWS sends back;
- **negative**: requests that break the standard must be refused using one of the error forms
  above;
- **data** (`ews_cap_alert_data.feature`, `ews_alert_feature_data.feature`,
  `ews_sdmx_data.feature`, `ews_encrypted_messages.feature`, offline): the EWS data rules.

### EWS data rules

Every alert sent or returned by any endpoint (notifications, the alerts collection, create and
replace) and every statistics dataset is checked against the rules of its type. Country
extensions (extra attributes) are allowed. Code lists accept the codes exactly as published: a
different case (`"actual"`) is rejected.

**Alert (CapAlert, DO.EWS.02)**. Unlike the registry data objects, the CapAlert has mandatory
attributes.

| Attribute | Rule |
|---|---|
| `identifier`, `sender` | **required**; CAP tokens: no spaces, commas or `<` `&` |
| `sent`, `assessment_date` | **required**; ISO 8601 date and time (DF.COM.STRING.01), a real calendar date; `sent` not in the future |
| `status` | **required**; CD.EWS.03: Actual, Exercise, System, Test, Draft |
| `msg_type` | **required**; CD.EWS.04: Alert, Update, Cancel, Ack, Error |
| `scope` | **required**; CD.EWS.05: Public, Restricted, Private |
| `threshold_status` | **required**; CD.EWS.10: NORMAL, WATCH, CROSSING_THRESHOLD_1, TRIGGER |
| `addresses` | **required when `scope` is Private** (DO.EWS.02), optional otherwise; a non-empty list |
| `restriction` | required when `scope` is Restricted (CAP 1.2 §3.2.1) |
| `references`, `incidents` | non-empty lists of non-empty strings |
| `info` | list of Info (0...*) |

**Info (DO.EWS.03)**

| Attribute | Rule |
|---|---|
| `category` | **required**; CD.EWS.01, as the value (`Met`) or the code (`MET`), one value or a list, listed once |
| `event` | **required** |
| `urgency`, `severity`, `certainty` | **required**; CD.EWS.06, CD.EWS.02, CD.EWS.07 |
| `response_type` | CD.EWS.08, one value or a list, listed once; `None` / `All clear` stand alone |
| `event_code` | CD.EWS.01 event type (CW, DR, EW, ... WF) when sent by the mock; any non-empty code is accepted |
| `language` | ISO 639-2 (`eng`, CD.COM.14) or BCP 47 (`en-US`, the Info example) |
| `effective`, `onset`, `expires`, `created_at` | ISO 8601 date and time, real dates; `expires` after `effective` (or after `sent` when `effective` is absent, as CAP says) and not before `onset` |
| `web` | absolute URI |
| `parameter` | a string (the table) or CAP valueName / value pairs |
| `area` | list of Area: **`areaDesc` required**; `polygon` = at least 4 `"lat,lon"` points, closed, latitude -90..90, longitude -180..180; `circle` = `"lat,lon radius"`; `geocode` = GeoCode or list of GeoCode (**`valueName` and `value` required**) |
| `resource` | list of Resource: **`resourceDesc` and `mimeType` required**; `mimeType` an IANA media type or a CD.EWS.09 code; `size` integer ≥ 0; `uri` a URI reference; `derefUri` base64 |

**Alert feature (DO.EWS.01)**: a GeoJSON Feature (OGC featureGeoJSON): `type` "Feature",
`geometry` (Point, Polygon, MultiPolygon, ... or null; positions `[lon, lat]` in range; rings closed
with at least 4 positions), `properties` the CapAlert itself or `{ capAlert }`. The CapAlert rules
apply inside. When both are present, `id` is the CapAlert `identifier`, and **every CAP polygon
appears in the geometry as `[lon, lat]` positions** (any winding). A geometry giving the polygon
in `lat,lon` order is reported as such.

**Notification**: the same version of an alert (same `identifier`, `sender`, `assessment_date`
and `msg_type`) sent twice in one notification is a duplicate (DO.EWS.02 dedup hint). A slow-onset
update (same identifier, newer `assessment_date`) is not.

**Aggregated member statistics (`DCI_MEMBER_STATISTICS`)**

| Item | Rule |
|---|---|
| Dimensions | REF_AREA (area code), SEX (CL_SEX: F, M, U), DISABILITY_STATUS (CL_DISABILITY_STATUS: TRUE, FALSE, NA), AGE_GROUP (CL_AGE_GROUP: LT5, Y5T17, Y18T64, GE65, ALL), TIME_PERIOD (YYYY, YYYY-MM, YYYY-Qn, YYYY-MM-DD), DENOMINATOR_TYPE (CL_DENOMINATOR_TYPE: IPC_3_PLUS, STRUCT_DAMAGE, GEOG_DISPLACED); no other dimension |
| SDMX-JSON structure | series dimensions with `keyPosition` 0..n-1, each once; measure `OBS_VALUE`; series keys with one index per series dimension, each pointing at a value of the structure |
| DCI JSON keys | `REF_AREA.SEX.DISABILITY_STATUS.AGE_GROUP` followed by `TIME_PERIOD` or `DENOMINATOR_TYPE` |
| `OBS_VALUE` | integer ≥ 0, or null when suppressed |
| **Minimum cell count** | a count above 0 and below `SDMX_MIN_CELL_COUNT` (default 5) must not be shared: it is sent as `null`. A null count needs a `CONFIDENTIALITY` other than `F`, and must not carry `COVERAGE_RATE` or `NON_MATCH_COUNT`, which could reveal it |
| Attributes | observation: OBS_STATUS (SDMX CL_OBS_STATUS), CONFIDENTIALITY (SDMX CL_CONF_STATUS), EXCLUSION_IND (boolean, true exactly when the count is 0), NON_MATCH_COUNT (integer ≥ 0), COVERAGE_RATE (0..100), LAST_VERIFIED_DATE (ISO 8601 date), UNIT_MEASURE; dataset: SOURCE, PROFILE_DENOMINATOR_DEF. **Any other attribute is rejected**, so no member data can travel as an attribute |
| No member records | the statistics responses must not carry member fields (`member_identifier`, `given_name`, `birth_date`, ...) |

The rules live in `test/features/support/helpers/schemas.js` (JSON Schema) and
`test/features/support/helpers/validator.js` (cross-field rules). The data features prove each
rule: they accept every code of every code list and every allowed form, and reject incorrect values.

### Where the spec is ambiguous

The published sources leave gaps or disagree in places. The suite's choices:

- **No YAML, no envelope for subscribe and notify.** API.EWS.01 and API.EWS.02 give the paths
  (`/subscribe`, `/unsubscribe`, `/notify`) but no request or response bodies and no HTTP
  methods. The suite uses the DCI message envelope shared by every DCI API (`header` +
  `message`, MsgHeader / MsgCallbackHeader, Ack), with an alert filter in `subscribe_criteria.filter`
  (the "type of events and severity" of API.EWS.01: event, event_code, category, severity, urgency,
  certainty, threshold_status, status, msg_type, area) and CapAlert or Alert records in
  `notify_event[].data.reg_records`, named by `reg_record_type`. The subscribe and unsubscribe
  results come back on `on-subscribe` / `on-unsubscribe`, as in the registry APIs.
- **Alert feature properties**: the DO.EWS.01 table makes `properties` the CapAlert; its example
  nests it under `properties.capAlert`. Both are accepted.
- **Cardinality vs. examples**: `category` (1...1), `response_type` (0...1) and `geocode` (0...1)
  are lists in the examples. A single value and a list are both accepted.
- **Category**: CD.EWS.01 publishes a code (`MET`) and a value (`Met`); the examples use the value.
  Both are accepted. Its second table (CW, DR, EW, ... WF, from the HDX disaster types) is an event
  type list: the suite uses it for `event_code`. Its spellings are kept as published
  ("Extratopical Cyclone", "Sever Local Storm").
- **Language**: CD.COM.14 says ISO 639-2 (`eng`); the Info example sends `en-US`. Both accepted.
- **Dates**: DF.COM.STRING.01 makes the time zone optional and also shows a 12-hour `AM/PM` form,
  which is not ISO 8601: the suite accepts ISO 8601 with or without a time zone and rejects
  `AM/PM`. A date without a time is rejected for a date_time.
- **mime_type**: CD.EWS.09 lists only `mp4` and `jpeg` then "...": any IANA media type or short
  code is accepted.
- **parameter**: a string in the table, valueName / value pairs in CAP: both accepted.
- **Updates**: CAP chains updates through `references`; the DO.EWS.02 hint says a slow-onset
  update reuses the `identifier` and moves `assessment_date` forward, without chaining. The suite
  follows the hint and does not require `references` for Update or Cancel.
- **restriction**: required for a Restricted alert, from CAP 1.2 §3.2.1 (the DCI table is silent).
- **Statistics formats**: the API.EWS.05 example is SDMX-JSON (`header` / `structure` /
  `dataSets`, index-based series keys); the sdmx-dci-member-example is another JSON (`meta` /
  `data`, dotted keys) and is not valid JSON as published (it has `//` comments). Both formats
  are tested (`?format=dci-json` for the second).
- **Statistics key**: the DSD declares five key dimensions including DENOMINATOR_TYPE; the
  API.EWS.05 query (`AREA001.*.*.ALL.2026`) puts TIME_PERIOD fifth and its response has no time
  dimension; the member example puts DENOMINATOR_TYPE fifth. Both layouts are accepted.
- **Minimum cell count**: required by PRS.EWS.02 without a number. The suite uses 5, configurable
  with `SDMX_MIN_CELL_COUNT`. `CONFIDENTIALITY` has no published code list: the SDMX cross-domain
  CL_CONF_STATUS is used (`F` free, `C` confidential, ...).
- **Not testable from outside**: that only `Actual` alerts drive programmatic action (CD.EWS.03),
  that a Cancel is not reversed after the SP "point of no return" (CD.EWS.04), the geocode
  crosswalk, and the immutable audit of duplicates are SP-internal behaviours. The suite sends
  alerts of every status and message type and checks they are accepted and validated.
- **Not covered**: PRS.EWS.02 Example 2 post-intervention indicators (left to country
  extensions by the standard) and a push channel for scheduled SDMX feeds (no endpoint is
  published).

## Prerequisites

Docker and Docker Compose. To run without Docker you need Node.js 18 or later.

## Run the mocks

```bash
./test_entrypoint.sh
```

The EWS endpoints are served on port **3333** and the SP endpoints on port **3334**. Run
`GET /healthcheck` on either port to check they are up. Without Docker:

```bash
npx @mockoon/cli@9.2.0 start --data mockoon-ews.json mockoon-sp.json --port 3333 3334
```

The mocks are generated from the test suite's schemas and records, so the two always agree.
After changing `schemas.js` or `fixtures/records.js`, regenerate them (and the derived OpenAPI)
and rebuild:

```bash
node mock/generate-mocks.mjs
node mock/generate-openapi.mjs
```

The generated `mockoon-ews.json` and `mockoon-sp.json` can be opened in the Mockoon desktop app
(v9 or later).

Mock test data. The mock EWS holds the latest version of seven alerts:

| Alert | Profile | Identifier |
|---|---|---|
| spec example | the published DO.EWS.01 example: flash flood, `properties.capAlert` | `ALERT-2026-00001` |
| full | every attribute: river flood, Restricted, TRIGGER, resource, circle | `EWS-2026-FL-0001` |
| drought | slow onset, the Update of a WATCH alert (CROSSING_THRESHOLD_1) | `EWS-2026-DR-0007` |
| earthquake | observed, category as the code `GEO`, Point geometry | `EWS-2026-EQ-0002` |
| heatwave | Health, geocode only, no geometry | `EWS-2026-HW-0004` |
| exercise | status Exercise | `EWS-2026-EX-0001` |
| private | scope Private with addresses | `EWS-2026-PV-0003` |

`/items` returns the alerts matching the **first** filter given (status, msg_type, scope,
threshold_status, category, severity, urgency, certainty, event, event_code) and honours `limit`.
A filter value outside its code list is a 400.

The mock SP answers these statistics queries (any other valid key: 404):

| Key | Format | Content |
|---|---|---|
| `AREA001.*.*.ALL.2026` | SDMX-JSON | the published API.EWS.05 example |
| `AREA002.*.*.ALL.2026` | SDMX-JSON | a suppressed cell (`null`, `C`), an empty cell (`0`, `EXCLUSION_IND`), with TIME_PERIOD and dataset attributes |
| `AREA003.F.TRUE.ALL.2026` | SDMX-JSON | an explicitly requested area with no registered member |
| `AREA001+AREA002.*.*.*.IPC_3_PLUS` | `?format=dci-json` | the published sdmx-dci-member-example (comments removed) |
| `AREA001.*.*.*.2026` | `?format=dci-json` | the API.EWS.05 key layout in the DCI JSON |

## Run the compliance tests

With Docker:

```bash
cd test && ./test_entrypoint.sh
```

Without Docker:

```bash
cd test && npm install && npx cucumber-js
```

Reports are written to `test/result` (HTML, JUnit XML, Cucumber messages).

### Continuous integration

`.github/workflows/compliance.yml` runs on every push to `main` and every pull request. It
checks that `mockoon-*.json` and `docs/openapi/ews_api_v1.0.0.yaml` are up to date with the test
schemas and fixtures, starts the mocks, runs the whole suite and reports:

- a pass / fail **EWS compliance** check on the pull request;
- a per-feature results table, with the failing scenarios, on the run's summary page
  (written by `test/ci/summary.mjs`);
- the HTML, JUnit and Cucumber JSON reports as the `ews-compliance-report` artifact;
- on `main`, a site published to GitHub Pages, <https://spdci.github.io/EWS-Mockup-Compliance/>
  (built by `site/build-site.mjs`; pull requests attach it as the `ews-compliance-site` artifact):
  - the results and HTML report of the latest run;
  - `api/`: a Swagger UI with two definitions: the **DCI EWS interface** as derived by this suite
    (`docs/openapi/ews_api_v1.0.0.yaml`), and the **EWS mock**, the same API on the mock paths
    (`/ews/...`) and ports (3333 EWS side, 3334 SP side). Start the mocks locally and use "Try it
    out" to send requests to them ([`api/?spec=mock`](https://spdci.github.io/EWS-Mockup-Compliance/api/?spec=mock)
    opens it directly). Each request body defaults to the valid request the suite sends, and
    asynchronous requests name the SP mock as `sender_uri`, so their callbacks land there.

To build the site locally (after `npm install` in `test/`):

```bash
node site/build-site.mjs --out site-out --report test/result/ews_compliance_report.html --junit test/result/ews_compliance.xml
```

### Testing your own implementation

| Variable | Default | Purpose |
|---|---|---|
| `EWS_BASE_URL` | `http://127.0.0.1:3333/` | EWS under test (subscribe, unsubscribe, collections/alerts) |
| `SP_BASE_URL` | `http://127.0.0.1:3334/` | SP under test (notify, on-subscribe, on-unsubscribe, data) |
| `CALLBACK_PORT` / `CALLBACK_BASE_URL` | `3335` / `http://127.0.0.1:3335/` | Listener used as `header.sender_uri`; must be reachable from the EWS under test |
| `TEST_DATA_FILE` | none | JSON overriding the alerts and statistics queried (see `helpers/testdata.js`) |
| `SDMX_MIN_CELL_COUNT` | `5` | Minimum cell count of the aggregated statistics, as agreed in your country |
| `AUTH_TOKEN` | none | Sent as `Authorization: Bearer <token>` |
| `RESPONSE_TIMEOUT_MS` / `CALLBACK_TIMEOUT_MS` | `15000` / `10000` | Timeouts |
| `CUCUMBER_TAGS` (Docker only) | none | Tag expression to select scenarios |

Endpoint paths are listed in `test/features/support/helpers/helpers.js`.

A `TEST_DATA_FILE` names an alert that exists in your EWS and a statistics key your SP answers:

```json
{
  "alerts": { "existing": "MY-ALERT-0042" },
  "statistics": { "existing": { "dataflow": "DCI_MEMBER_STATISTICS", "key": "KE-30.*.*.ALL.2026" } }
}
```

Select scenarios with tags:

| Tag | Scenarios |
|---|---|
| `@smoke` | basic checks for each endpoint |
| `@functional` | use cases |
| `@callback` | async round trips (need the listener to be reachable) |
| `@negative` | invalid requests |
| `@data` | offline EWS data rules |
| `@strict-data` | SP must reject notifications with invalid alert data |
| `@mock` | relies on mock-only test data |

For example, to test a real EWS:

```bash
EWS_BASE_URL=https://ews.example.org/ TEST_DATA_FILE=./my-data.json npx cucumber-js --tags "not @mock" features/ews_subscribe.feature features/ews_unsubscribe.feature features/ews_alerts_collection.feature features/ews_alerts_create_replace.feature
```
