@data
Feature: Aggregated member statistics data rules (API.EWS.05, sdmx-dci-member-example)

The SP system shares counts of its registered members, never member records, as SDMX: the
dataset DCI_MEMBER_STATISTICS with the dimensions REF_AREA, SEX (CL_SEX), DISABILITY_STATUS
(CL_DISABILITY_STATUS), AGE_GROUP (CL_AGE_GROUP), TIME_PERIOD and DENOMINATOR_TYPE
(CL_DENOMINATOR_TYPE), the measure OBS_VALUE (number of members) and the attributes
OBS_STATUS, CONFIDENTIALITY, EXCLUSION_IND, NON_MATCH_COUNT, COVERAGE_RATE,
LAST_VERIFIED_DATE (observation), SOURCE and PROFILE_DENOMINATOR_DEF (dataset).

PRS.EWS.02 requires "minimum cell counts for anonymization" without a number: the suite uses
SDMX_MIN_CELL_COUNT (default 5). A count below it must be sent as null with a CONFIDENTIALITY
other than "F".

Two formats are published: SDMX-JSON (API.EWS.05 example) and the DCI JSON of the
sdmx-dci-member-example (its "//" comments removed, since they make it invalid JSON).

  @smoke
  Scenario Outline: Reference statistics "<record>" (<type>) are valid
    Given the "<record>" <type> record
    Then the record should be valid

    Examples:
      | type          | record       |
      | SdmxJson      | spec example |
      | SdmxJson      | suppressed   |
      | SdmxJson      | zero         |
      | DciStatistics | spec example |
      | DciStatistics | by period    |

  # ---------------------------------------------------------------------------
  # SDMX-JSON
  # ---------------------------------------------------------------------------
  Scenario Outline: SDMX-JSON with <case> is rejected
    Given the "spec example" SdmxJson record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples: Structure
      | case                          | attribute                                     | value                       | error                                       |
      | no structure                  | structure                                     | <removed>                   | must have required property 'structure'     |
      | an unknown dimension          | structure.dimensions.series.1.id              | "GENDER"                    | is not a dimension of DCI_MEMBER_STATISTICS |
      | a sex outside CL_SEX          | structure.dimensions.series.1.values.0.id     | "W"                         | SEX "W" is not in CL_SEX                    |
      | a disability outside its list | structure.dimensions.series.2.values.0.id     | "YES"                       | DISABILITY_STATUS "YES" is not in CL_DISABILITY_STATUS |
      | an age group outside its list | structure.dimensions.series.3.values.0.id     | "ADULT"                     | AGE_GROUP "ADULT" is not in CL_AGE_GROUP    |
      | duplicate key positions       | structure.dimensions.series.1.keyPosition     | 0                           | keyPosition values                          |
      | another measure               | structure.measures.series.0.id                | "AMOUNT"                    | /structure/measures/series/0/id must be equal to constant |
      | an unknown action             | dataSets.0.action                             | "Upsert"                    | /dataSets/0/action must be equal to one of the allowed values |

    Examples: Series and observations
      | case                          | attribute                                     | value                       | error                                       |
      | a series key too short        | dataSets.0.series.0:0:0                       | {"observations":{"0":[1]}}  | has 3 position(s)                           |
      | a series key out of range     | dataSets.0.series.0:5:0:0                     | {"observations":{"0":[100]}} | index 5 has no value in the structure      |
      | a negative count              | dataSets.0.series.0:0:0:0.observations.0      | [-3]                        | must be >= 0                                |
      | a count as text               | dataSets.0.series.0:0:0:0.observations.0      | ["3421"]                    | must be integer,null                        |
      | an unknown attribute          | dataSets.0.series.0:0:0:0.attributes.NATIONAL_ID | "123"                    | attribute "NATIONAL_ID" is not defined in DCI_MEMBER_STATISTICS |
      | an unknown dataset attribute  | dataSets.0.attributes                         | {"HOUSEHOLD_LIST":"..."}    | dataset attribute "HOUSEHOLD_LIST" is not defined |
      | OBS_STATUS outside CL_OBS_STATUS | dataSets.0.series.0:0:0:0.attributes.OBS_STATUS | "Z"                      | OBS_STATUS "Z" is not in CL_OBS_STATUS      |

  Scenario Outline: A small count is not shared: <case>
    Given the "spec example" SdmxJson record
    When its "dataSets.0.series.0:0:0:0" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples:
      | case                                | value                                                                 | error                                     |
      | a count below the minimum           | {"attributes":{"OBS_STATUS":"A"},"observations":{"0":[3]}}           | below the minimum cell count              |
      | a suppressed count marked free      | {"attributes":{"OBS_STATUS":"A","CONFIDENTIALITY":"F"},"observations":{"0":[null]}} | CONFIDENTIALITY does not say so |
      | a suppressed count without CONFIDENTIALITY | {"attributes":{"OBS_STATUS":"A"},"observations":{"0":[null]}} | CONFIDENTIALITY does not say so           |
      | a coverage rate revealing the count | {"attributes":{"CONFIDENTIALITY":"C","COVERAGE_RATE":1.5},"observations":{"0":[null]}} | could reveal it      |

  Scenario Outline: A count of <value> is shared as it is
    Given the "spec example" SdmxJson record
    When its "dataSets.0.series.0:0:0:0.observations.0" attribute is set to '[<value>]'
    Then the record should be valid

    Examples:
      | value |
      | 0     |
      | 5     |
      | 99999 |

  Scenario Outline: EXCLUSION_IND agrees with the count: <case>
    Given the "spec example" SdmxJson record
    When its "dataSets.0.series.0:0:0:0" attribute is set to '<value>'
    Then the record should be rejected because of "EXCLUSION_IND is"

    Examples:
      | case                      | value                                                                 |
      | flagged but not empty     | {"attributes":{"EXCLUSION_IND":true},"observations":{"0":[3421]}}    |
      | empty but not flagged     | {"attributes":{"EXCLUSION_IND":false},"observations":{"0":[0]}}      |

  Scenario Outline: Observation attribute <attribute> = <value> is rejected
    Given the "spec example" SdmxJson record
    When its "dataSets.0.series.0:0:0:0.attributes.<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples:
      | attribute          | value     | error                                   |
      | CONFIDENTIALITY    | "SECRET"  | is not in CL_CONF_STATUS                |
      | EXCLUSION_IND      | "no"      | EXCLUSION_IND must be a boolean         |
      | NON_MATCH_COUNT    | -1        | NON_MATCH_COUNT must be a non-negative integer |
      | COVERAGE_RATE      | 182.5     | COVERAGE_RATE must be a percentage      |
      | LAST_VERIFIED_DATE | "May 2026" | LAST_VERIFIED_DATE "May 2026" is not an ISO 8601 date |

  Scenario Outline: A TIME_PERIOD of <period> is <outcome>
    Given the "suppressed" SdmxJson record
    When its "structure.dimensions.observation.0.values.0.id" attribute is set to '"<period>"'
    Then the record should be <outcome>

    Examples:
      | period     | outcome |
      | 2026       | valid   |
      | 2026-09    | valid   |
      | 2026-Q3    | valid   |
      | 2026-09-30 | valid   |

  Scenario: A TIME_PERIOD that is not an SDMX period is rejected
    Given the "suppressed" SdmxJson record
    When its "structure.dimensions.observation.0.values.0.id" attribute is set to '"Sept 2026"'
    Then the record should be rejected because of "is not an SDMX period"

  # ---------------------------------------------------------------------------
  # DCI JSON (sdmx-dci-member-example)
  # ---------------------------------------------------------------------------
  Scenario Outline: DCI statistics with <case> are rejected
    Given the "spec example" DciStatistics record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples:
      | case                         | attribute                                              | value                     | error                                     |
      | no meta                      | meta                                                   | <removed>                 | must have required property 'meta'        |
      | another dataset              | data.dataSets.0.structureRef                           | "DCI_PERSONS"             | /data/dataSets/0/structureRef must be equal to constant |
      | a key of 2 parts             | data.dataSets.0.observations                           | {"AREA001.F":{"OBS_VALUE":1250}} | must match pattern                 |
      | a sex outside CL_SEX         | data.dataSets.0.observations                           | {"AREA001.X.TRUE.ALL.IPC_3_PLUS":{"OBS_VALUE":1250}} | SEX "X" is not in CL_SEX |
      | an unknown denominator       | data.dataSets.0.observations                           | {"AREA001.F.TRUE.ALL.FLOODED":{"OBS_VALUE":1250}} | DENOMINATOR_TYPE "FLOODED" is not in CL_DENOMINATOR_TYPE |
      | a count below the minimum    | data.dataSets.0.observations                           | {"AREA001.F.TRUE.ALL.IPC_3_PLUS":{"OBS_VALUE":2}} | below the minimum cell count |
      | an unknown dataset attribute | data.dataSets.0.attributes.BENEFICIARY_NAMES           | "..."                     | dataset attribute "BENEFICIARY_NAMES" is not defined |

  Scenario: Both published key layouts are accepted (… TIME_PERIOD and … DENOMINATOR_TYPE)
    Given the "spec example" DciStatistics record
    When its "data.dataSets.0.observations" attribute is set to '{"AREA001.F.TRUE.ALL.IPC_3_PLUS":{"OBS_VALUE":1250},"AREA001.F.TRUE.ALL.2026":{"OBS_VALUE":3421}}'
    Then the record should be valid
