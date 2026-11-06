@method=POST @endpoint=ews/notify
Feature: Receive alerts from the EWS (API.EWS.02, POST /notify)

API.EWS.02 Event Notification is implemented on the SP side: "event data will be sent on the
REST endpoint/notify (EWS -> SP system)". The suite plays the EWS. Every notification is first
checked against the standard (DCI envelope, DO.EWS.02 CapAlert or DO.EWS.01 Alert records and
the EWS data rules), then the SP system must acknowledge it, and refuse what breaks the
standard.

Records are CapAlert (bare) or Alert (GeoJSON Feature) records, named by reg_record_type.
Alerts of every status are received: the CD.EWS.03 hint says Exercise, Test and System
messages are accepted, validated and logged, and only Actual may drive action.

  Background:
    Given the "notify" endpoint

  @smoke
  Scenario: The published CapAlert example is acknowledged
    Given a notify request carrying the "spec example" CapAlert record
    Then the request should be a valid "notify" message
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be received within 15000 ms
    And the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario Outline: A notification carrying the <record> <type> record is acknowledged
    Given a notify request carrying the "<record>" <type> record
    Then the request should be a valid "notify" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

    Examples: CapAlert records (scopes, statuses, message types, slow onset)
      | type     | record         |
      | CapAlert | spec example   |
      | CapAlert | full           |
      | CapAlert | minimal        |
      | CapAlert | private        |
      | CapAlert | drought        |
      | CapAlert | drought update |
      | CapAlert | earthquake     |
      | CapAlert | heatwave       |
      | CapAlert | exercise       |
      | CapAlert | cancel         |

    Examples: Alert records (GeoJSON Feature, properties as the CapAlert or { capAlert })
      | type  | record       |
      | Alert | spec example |
      | Alert | full         |
      | Alert | earthquake   |
      | Alert | heatwave     |
      | Alert | drought      |

  @functional
  Scenario Outline: reg_records may be a single <type> object
    Given a notify request carrying the "full" <type> record as a single object
    Then the request should be a valid "notify" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

    Examples:
      | type     |
      | CapAlert |
      | Alert    |

  @functional
  Scenario: A slow-onset alert and its update (same identifier, newer assessment_date) travel together
    Given a notify request carrying the CapAlert records "drought, drought update"
    Then the request should be a valid "notify" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario: A batch notification carries CapAlert and Alert records
    Given a batch notify request carrying "CapAlert:full, Alert:earthquake, CapAlert:heatwave, Alert:spec example"
    Then the request should be a valid "notify" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

  Scenario: The same version of an alert twice in one notification is a duplicate
    Given a notify request carrying the CapAlert records "full, full"
    Then the request should not be a valid "notify" message because of "is sent twice in the same notification"

  @negative
  Scenario Outline: An invalid notification is rejected: <case>
    Given a valid request
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the request should be rejected according to the DCI error model

    Examples: Envelope and event
      | case                     | field                                       | value       |
      | missing header           | header                                      | <removed>   |
      | wrong action             | header.action                               | "subscribe" |
      | missing header status    | header.status                               | <removed>   |
      | missing transaction_id   | message.transaction_id                      | <removed>   |
      | missing notify_event     | message.notify_event                        | <removed>   |
      | empty notify_event       | message.notify_event                        | []          |
      | missing reference_id     | message.notify_event.0.reference_id         | <removed>   |
      | missing data             | message.notify_event.0.data                 | <removed>   |
      | missing reg_record_type  | message.notify_event.0.data.reg_record_type | <removed>   |
      | unknown reg_record_type  | message.notify_event.0.data.reg_record_type | "Person"    |
      | missing reg_records      | message.notify_event.0.data.reg_records     | <removed>   |
      | empty reg_records        | message.notify_event.0.data.reg_records     | []          |
      | invalid locale           | message.notify_event.0.locale               | "en-US"     |

    @strict-data
    Examples: CapAlert data in the notification
      | case                              | field                                                       | value                    |
      | missing identifier                | message.notify_event.0.data.reg_records.0.identifier        | <removed>                |
      | identifier with a space           | message.notify_event.0.data.reg_records.0.identifier        | "ALERT 2026 00001"       |
      | missing sent                      | message.notify_event.0.data.reg_records.0.sent              | <removed>                |
      | sent as a date only               | message.notify_event.0.data.reg_records.0.sent              | "2026-06-22"             |
      | status outside CD.EWS.03          | message.notify_event.0.data.reg_records.0.status            | "Real"                   |
      | status in lower case              | message.notify_event.0.data.reg_records.0.status            | "actual"                 |
      | msg_type outside CD.EWS.04        | message.notify_event.0.data.reg_records.0.msg_type          | "New"                    |
      | scope outside CD.EWS.05           | message.notify_event.0.data.reg_records.0.scope             | "Everyone"               |
      | missing assessment_date           | message.notify_event.0.data.reg_records.0.assessment_date   | <removed>                |
      | missing threshold_status          | message.notify_event.0.data.reg_records.0.threshold_status  | <removed>                |
      | threshold outside CD.EWS.10       | message.notify_event.0.data.reg_records.0.threshold_status  | "RED"                    |
      | private alert without addresses   | message.notify_event.0.data.reg_records.0.scope             | "Private"                |
      | info without category             | message.notify_event.0.data.reg_records.0.info.0.category   | <removed>                |
      | category outside CD.EWS.01        | message.notify_event.0.data.reg_records.0.info.0.category   | ["Weather"]              |
      | severity outside CD.EWS.02        | message.notify_event.0.data.reg_records.0.info.0.severity   | "High"                   |
      | urgency outside CD.EWS.06         | message.notify_event.0.data.reg_records.0.info.0.urgency    | "Now"                    |
      | certainty outside CD.EWS.07       | message.notify_event.0.data.reg_records.0.info.0.certainty  | "Certain"                |
      | response_type outside CD.EWS.08   | message.notify_event.0.data.reg_records.0.info.0.response_type | ["Run"]               |
      | area without areaDesc             | message.notify_event.0.data.reg_records.0.info.0.area.0.areaDesc | <removed>           |
      | polygon in lon lat format         | message.notify_event.0.data.reg_records.0.info.0.area.0.polygon | ["35.45 33.85, 35.55 33.85"] |
      | geocode without value             | message.notify_event.0.data.reg_records.0.info.0.area.0.geocode | [{"valueName":"ADMIN_CODE"}] |

    @strict-data
    Examples: Alert data in the notification
      | case                         | field                                       | value                                                             |
      | alert record that is no Feature | message.notify_event.0.data              | {"reg_record_type":"Alert","reg_records":[{"type":"Point","coordinates":[1,2]}]} |
      | alert without properties     | message.notify_event.0.data                 | {"reg_record_type":"Alert","reg_records":[{"type":"Feature","geometry":null}]} |
