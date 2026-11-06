@method=GET @endpoint=ews/data
Feature: Share aggregated member statistics with the EWS (API.EWS.05, SDMX)

API.EWS.05 and PRS.EWS.02: the SP system shares aggregated counts of its registered members
with the EWS (impact-based early warning), as SDMX: GET /data/DCI_MEMBER_STATISTICS/{key},
for example AREA001.*.*.ALL.2026. The dataset DCI_MEMBER_STATISTICS breaks members down by
REF_AREA, SEX, DISABILITY_STATUS, AGE_GROUP and the reference period (TIME_PERIOD) or the
denominator profile (DENOMINATOR_TYPE). Only counts are shared, never member records, and small
counts are suppressed ("minimum cell counts for anonymization").

The response is SDMX-JSON (the API.EWS.05 example) or, with format=dci-json, the DCI JSON of
the sdmx-dci-member-example.

  Background:
    Given the "member statistics" endpoint

  @smoke
  Scenario: The statistics of the API.EWS.05 query are returned as SDMX-JSON
    Given the member statistics query "existing"
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be received within 15000 ms
    And the response should be a valid "sdmx-json"
    And at least 1 observation should be returned
    And every observation should match the query key
    And no member record should be in the response

  @functional @mock
  Scenario: The API.EWS.05 example counts are returned
    Given the member statistics query "spec example"
    When the request is sent
    Then the response should be a valid "sdmx-json"
    And the observation "AREA001.F.TRUE.ALL" should be 3421
    And the observation "AREA001.F.FALSE.ALL" should be 60391
    And the observation "AREA001.M.TRUE.ALL" should be 2876
    And the observation "AREA001.M.FALSE.ALL" should be 58642

  @functional @mock
  Scenario: A small count is suppressed and an empty cell flagged
    Given the member statistics query "suppressed"
    When the request is sent
    Then the response should be a valid "sdmx-json"
    And every observation should match the query key
    And the observation "AREA002.F.TRUE.ALL.2026" should be suppressed
    And the observation "AREA002.M.TRUE.ALL.2026" should flag an area with no registered member
    And the observation "AREA002.F.FALSE.ALL.2026" should be 5120

  @functional @mock
  Scenario: An area with no registered member is answered with a zero, not left out
    Given the member statistics query "empty area"
    When the request is sent
    Then the response should be a valid "sdmx-json"
    And the observation "AREA003.F.TRUE.ALL.2026" should flag an area with no registered member

  @functional @mock
  Scenario Outline: The statistics are returned in the DCI JSON format: <query>
    Given the member statistics query "<query>"
    When the request is sent
    Then the response should be a valid "dci-json"
    And every observation should match the query key
    And no member record should be in the response

    Examples:
      | query            |
      | dci spec example |
      | dci by period    |

  @functional @mock
  Scenario: The sdmx-dci-member-example counts are returned
    Given the member statistics query "dci spec example"
    When the request is sent
    Then the response should be a valid "dci-json"
    And the observation "AREA001.F.TRUE.ALL.IPC_3_PLUS" should be 1250
    And the observation "AREA002.M.FALSE.LT5.IPC_3_PLUS" should flag an area with no registered member

  @negative
  Scenario: A key with no data is not found
    Given the member statistics query "unknown"
    When the request is sent
    Then the response should be an HTTP error with status 404

  @negative
  Scenario: An unknown dataflow is not found
    Given the member statistics query "existing"
    And the dataflow "DCI_PERSON_RECORDS"
    When the request is sent
    Then the response should be an HTTP error with status 404

  @negative
  Scenario Outline: An invalid key is rejected: <case>
    Given the member statistics key "<key>"
    When the request is sent
    Then the response should be an HTTP error with status 400

    Examples:
      | case                         | key                     |
      | too few parts                | AREA001.F               |
      | too many parts               | AREA001.F.TRUE.ALL.2026.X |
      | sex outside CL_SEX           | AREA001.X.*.ALL.2026    |
      | disability outside its list  | AREA001.*.YES.ALL.2026  |
      | age group outside its list   | AREA001.*.*.ADULT.2026  |
      | period not an SDMX period    | AREA001.*.*.ALL.26      |
      | lower-case sex               | AREA001.f.*.ALL.2026    |

  @negative
  Scenario: An unsupported format is rejected
    Given the member statistics query "existing"
    And the statistics are asked for in the "xml" format
    When the request is sent
    Then the response should be an HTTP error with status 400
