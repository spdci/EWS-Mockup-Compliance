@data
Feature: EWS alert data rules (DO.EWS.02 CapAlert, DO.EWS.03 Info, DO.EWS.04 Resource, DO.EWS.05 Area, DO.EWS.06 GeoCode)

The CapAlert follows OASIS CAP v1.2. Unlike the registry data objects, several attributes are
mandatory (1...1): identifier, sender, sent, status, msg_type, scope, assessment_date and
threshold_status on the alert; category, event, urgency, severity and certainty on each info
block; areaDesc on each area; valueName and value on each geocode; resourceDesc and mimeType
on each resource. Everything else is optional, but correct whenever it is sent.

This feature is the rule book. It runs offline (no API) and proves that the validator applied
to every alert sent or returned by the API scenarios accepts correct alerts and rejects
incorrect ones.

Sources: DO.EWS.02 - DO.EWS.06, CD.EWS.01 - CD.EWS.08, CD.EWS.10, CD.COM.14,
DF.COM.STRING.01, OASIS CAP v1.2 (3.2.1 restriction, 3.2.4 polygon and circle).

  # ---------------------------------------------------------------------------
  # Reference records
  # ---------------------------------------------------------------------------
  @smoke
  Scenario Outline: Reference alert "<record>" is valid EWS data
    Given the "<record>" CapAlert record
    Then the record should be valid

    Examples:
      | record         |
      | spec example   |
      | full           |
      | minimal        |
      | private        |
      | drought        |
      | drought update |
      | earthquake     |
      | heatwave       |
      | exercise       |
      | cancel         |

  Scenario: An empty alert is rejected (the alert attributes are mandatory)
    Given an empty CapAlert record
    Then the record should be rejected because of:
      | must have required property 'identifier'       |
      | must have required property 'sender'           |
      | must have required property 'sent'             |
      | must have required property 'status'           |
      | must have required property 'msg_type'         |
      | must have required property 'scope'            |
      | must have required property 'assessment_date'  |
      | must have required property 'threshold_status' |

  # ---------------------------------------------------------------------------
  # Mandatory and optional attributes
  # ---------------------------------------------------------------------------
  Scenario Outline: Mandatory attribute "<attribute>" (1...1) may not be omitted
    Given the "full" CapAlert record
    When its "<attribute>" attribute is removed
    Then the record should be rejected because of "must have required property '<property>'"

    Examples:
      | attribute                          | property         |
      | identifier                         | identifier       |
      | sender                             | sender           |
      | sent                               | sent             |
      | status                             | status           |
      | msg_type                           | msg_type         |
      | scope                              | scope            |
      | assessment_date                    | assessment_date  |
      | threshold_status                   | threshold_status |
      | info.0.category                    | category         |
      | info.0.event                       | event            |
      | info.0.urgency                     | urgency          |
      | info.0.severity                    | severity         |
      | info.0.certainty                   | certainty        |
      | info.0.area.0.areaDesc             | areaDesc         |
      | info.0.area.0.geocode.0.valueName  | valueName        |
      | info.0.area.0.geocode.0.value      | value            |
      | info.0.resource.0.resourceDesc     | resourceDesc     |
      | info.0.resource.0.mimeType         | mimeType         |

  Scenario Outline: Optional attribute "<attribute>" may be omitted
    Given the "full" CapAlert record
    When its "<attribute>" attribute is removed
    Then the record should be valid

    Examples:
      | attribute                     |
      | source                        |
      | addresses                     |
      | code                          |
      | note                          |
      | incidents                     |
      | info                          |
      | created_at                    |
      | info.0.language               |
      | info.0.response_type          |
      | info.0.audience               |
      | info.0.effective              |
      | info.0.event_code             |
      | info.0.onset                  |
      | info.0.expires                |
      | info.0.sender_name            |
      | info.0.headline               |
      | info.0.description            |
      | info.0.instruction            |
      | info.0.web                    |
      | info.0.contact                |
      | info.0.parameter              |
      | info.0.area                   |
      | info.0.resource               |
      | info.0.created_at             |
      | info.0.area.0.polygon         |
      | info.0.area.0.circle          |
      | info.0.area.0.geocode         |
      | info.0.resource.0.size        |
      | info.0.resource.0.uri         |
      | info.0.resource.0.digest      |

  # ---------------------------------------------------------------------------
  # Code lists
  # ---------------------------------------------------------------------------
  Scenario Outline: Every <list> code is accepted for <attribute>
    Given the "full" CapAlert record
    Then every "<list>" code should be accepted as "<attribute>"

    Examples:
      | list            | attribute             |
      | status          | status                |
      | msgType         | msg_type              |
      | thresholdStatus | threshold_status      |
      | urgency         | info.0.urgency        |
      | severity        | info.0.severity       |
      | certainty       | info.0.certainty      |

  Scenario Outline: Every <list> code is accepted for <attribute>, alone or in a list
    Given the "full" CapAlert record
    Then every "<list>" code should be accepted as "<attribute>"
    And every "<list>" code should be accepted in the list "<attribute>"

    Examples: CD.EWS.01 category as its value ("Met") and as its code ("MET"), CD.EWS.08 response type
      | list         | attribute            |
      | category     | info.0.category      |
      | categoryCode | info.0.category      |
      | responseType | info.0.response_type |

  Scenario: Every CD.EWS.01 event type (CW, DR, EW, ... WF) is accepted as an event code
    Given the "full" CapAlert record
    Then every "eventType" code should be accepted as "info.0.event_code"

  Scenario Outline: scope "<scope>" is accepted with what it requires
    Given the "full" CapAlert record
    When its "scope" attribute is set to '"<scope>"'
    Then the record should be valid

    Examples:
      | scope      |
      | Public     |
      | Restricted |
      | Private    |

  Scenario Outline: <attribute> = <value> is rejected (<reason>)
    Given the "full" CapAlert record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples: Values outside the code lists (case matters)
      | attribute             | value          | reason                     | error                                            |
      | status                | "actual"       | CD.EWS.03, lower case      | /status must be equal to one of the allowed values |
      | status                | "Real"         | not in CD.EWS.03           | /status must be equal to one of the allowed values |
      | msg_type              | "New"          | not in CD.EWS.04           | /msg_type must be equal to one of the allowed values |
      | scope                 | "Everyone"     | not in CD.EWS.05           | /scope must be equal to one of the allowed values |
      | threshold_status      | "TRIGGERED"    | not in CD.EWS.10           | /threshold_status must be equal to one of the allowed values |
      | info.0.urgency        | "Now"          | not in CD.EWS.06           | /info/0/urgency must be equal to one of the allowed values |
      | info.0.severity       | "High"         | not in CD.EWS.02           | /info/0/severity must be equal to one of the allowed values |
      | info.0.certainty      | "Certain"      | not in CD.EWS.07           | /info/0/certainty must be equal to one of the allowed values |
      | info.0.category       | ["Weather"]    | not in CD.EWS.01           | /info/0/category/0 must be equal to one of the allowed values |
      | info.0.category       | []             | empty list                 | /info/0/category must NOT have fewer than 1 items |
      | info.0.response_type  | ["Run"]        | not in CD.EWS.08           | /info/0/response_type/0 must be equal to one of the allowed values |

    Examples: Identifiers, dates and formats
      | attribute               | value                       | reason                              | error                                   |
      | identifier              | "EWS 2026 FL 0001"          | CAP: no spaces                      | /identifier must match pattern          |
      | identifier              | "EWS-2026,FL"               | CAP: no commas                      | /identifier must match pattern          |
      | sender                  | "ews gov"                   | CAP: no spaces                      | /sender must match pattern              |
      | sent                    | "2026-10-12"                | date_time needs a time              | /sent must match pattern                |
      | sent                    | "2026-10-12T06:00:00 PM"    | AM/PM is not ISO 8601               | /sent must match pattern                |
      | sent                    | "12/10/2026 06:00"          | not ISO 8601                        | /sent must match pattern                |
      | sent                    | "2026-02-30T06:00:00Z"      | not a real date                     | is not a real calendar date             |
      | sent                    | "2099-01-01T00:00:00Z"      | in the future                       | is in the future                        |
      | assessment_date         | "last week"                 | not ISO 8601                        | /assessment_date must match pattern     |
      | info.0.expires          | "2026-10-12T05:00:00Z"      | expires before effective            | is not after effective                  |
      | info.0.onset            | "2026-10-15T00:00:00Z"      | onset after expires                 | is before onset                         |
      | info.0.language         | "English"                   | not ISO 639-2 nor BCP 47            | /info/0/language must match pattern     |
      | info.0.web              | "ews.gov.example/alerts"    | not an absolute URI                 | /info/0/web must match format "uri"     |
      | addresses               | []                          | empty list                          | /addresses must NOT have fewer than 1 items |
      | references              | [""]                        | empty reference                     | /references/0 must NOT have fewer than 1 characters |

    Examples: Areas, geocodes and resources
      | attribute                          | value                                           | reason                         | error                                       |
      | info.0.area                        | []                                              | empty list                     | /info/0/area must NOT have fewer than 1 items |
      | info.0.area.0.polygon              | ["-1.30,36.80 -1.20,36.80 -1.30,36.80"]         | 3 points                       | /info/0/area/0/polygon/0 must match pattern |
      | info.0.area.0.polygon              | ["-1.30 36.80, -1.20 36.80, -1.20 36.95, -1.30 36.80"] | lon lat, comma-separated | /info/0/area/0/polygon/0 must match pattern |
      | info.0.area.0.polygon              | ["-1.30,36.80 -1.20,36.80 -1.20,36.95 -1.30,36.95"] | not closed                | is not closed                               |
      | info.0.area.0.polygon              | ["36.80,-1.30 36.80,-1.20 136.95,-1.20 36.80,-1.30"] | latitude 136.95          | latitude 136.95 is outside -90..90          |
      | info.0.area.0.circle               | ["-1.25,36.87"]                                 | no radius                      | /info/0/area/0/circle/0 must match pattern  |
      | info.0.area.0.circle               | ["95.0,36.87 5"]                                | latitude 95                    | centre latitude 95 is outside -90..90       |
      | info.0.area.0.geocode              | [{"valueName":"ADMIN_CODE","value":""}]         | empty geocode value            | /info/0/area/0/geocode/0/value must NOT have fewer than 1 characters |
      | info.0.resource.0.size             | -1                                              | negative size                  | /info/0/resource/0/size must be >= 0        |
      | info.0.resource.0.size             | "200KB"                                         | size as text                   | /info/0/resource/0/size must be integer     |
      | info.0.resource.0.mimeType         | "image jpeg"                                    | not a media type               | /info/0/resource/0/mimeType must match pattern |
      | info.0.resource.0.derefUri         | "not base64!"                                   | not base64                     | /info/0/resource/0/derefUri must match pattern |

  Scenario Outline: Duplicate <attribute> values are rejected
    Given the "full" CapAlert record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples:
      | attribute            | value                    | error                                  |
      | info.0.category      | ["Met", "MET"]           | category lists Met more than once      |
      | info.0.response_type | ["Prepare", "Prepare"]   | response_type lists Prepare more than once |
      | info.0.response_type | ["Prepare", "None"]      | cannot be combined with other responses |

  # ---------------------------------------------------------------------------
  # Accepted forms where the sources disagree
  # ---------------------------------------------------------------------------
  Scenario Outline: <attribute> = <value> is accepted (<why>)
    Given the "full" CapAlert record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be valid

    Examples:
      | attribute             | value                                           | why                                         |
      | info.0.category       | "Met"                                           | 1...1 in the table: a single value          |
      | info.0.category       | ["MET", "ENV"]                                  | CD.EWS.01 codes                             |
      | info.0.response_type  | "Evacuate"                                      | 0...1 in the table: a single value          |
      | info.0.language       | "eng"                                           | CD.COM.14: ISO 639-2                        |
      | info.0.language       | "en-US"                                         | the Info example: BCP 47                    |
      | info.0.area.0.geocode | {"valueName":"ADMIN_CODE","value":"KE-30"}      | 0...1 in the table: a single geocode        |
      | info.0.parameter      | "WATER_LEVEL_M=4.2"                             | the table types parameter as a string       |
      | sent                  | "2026-10-12T09:00:00+03:00"                     | DF.COM.STRING.01: UTC offset                |
      | sent                  | "2026-10-12T06:00:00"                           | DF.COM.STRING.01: no time zone              |
      | sent                  | "2026-10-12T06:00:00.250Z"                      | fractional seconds                          |
      | info.0.resource.0.mimeType | "jpeg"                                     | CD.EWS.09 short code                        |
      | info.0.resource.0.derefUri | "aGVsbG8gd29ybGQ="                         | base64 content                              |

  # ---------------------------------------------------------------------------
  # Conditional rules
  # ---------------------------------------------------------------------------
  Scenario: A Private alert must name its addresses (DO.EWS.02)
    Given the "private" CapAlert record
    When its "addresses" attribute is removed
    Then the record should be rejected because of "must have required property 'addresses'"

  Scenario: A Public alert may also carry addresses (DO.EWS.02: optional otherwise)
    Given the "spec example" CapAlert record
    When its "addresses" attribute is set to '["spmis.gov.example"]'
    Then the record should be valid

  Scenario: A Restricted alert must say who it is restricted to (CAP 1.2 3.2.1)
    Given the "full" CapAlert record
    When its "restriction" attribute is removed
    Then the record should be rejected because of "restriction is required when scope is"

  Scenario: Without effective, expires is checked against sent
    Given the "full" CapAlert record
    When its "info.0.effective" attribute is removed
    And its "info.0.onset" attribute is removed
    And its "info.0.expires" attribute is set to '"2026-10-12T05:00:00Z"'
    Then the record should be rejected because of "is not after sent"

  Scenario: Country extensions (extra attributes) are allowed
    Given the "full" CapAlert record
    When its "x_country_programme" attribute is set to '"ANTICIPATORY-CASH"'
    And its "info.0.x_impact_score" attribute is set to '7'
    Then the record should be valid
