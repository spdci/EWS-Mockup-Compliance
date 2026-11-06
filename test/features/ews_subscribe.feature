@method=POST @endpoint=ews/subscribe
Feature: Subscribe to early warning alerts (API.EWS.01, POST /subscribe)

API.EWS.01 Event Subscription: "An SP system can subscribe to receive alerts and define what
type of events and severity." The SP system names the alerts it wants (filter: event, event
code, category, severity, urgency, certainty, threshold status, status, message type, area)
and how they are delivered (notify_record_type: CapAlert or Alert). The EWS acknowledges the
request and delivers the subscription result to the on-subscribe callback.

The standard publishes no envelope for this API: the suite uses the DCI message envelope
shared by every DCI API, with the EWS alert filter in subscribe_criteria.

  Background:
    Given the "subscribe" endpoint

  @smoke
  Scenario: A subscription to severe and extreme floods is acknowledged
    Given a subscribe request for "floods of severe or extreme severity"
    Then the request should be a valid "subscribe" message
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be received within 15000 ms
    And the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario Outline: A subscription to <filter>, notified as <type> records, is acknowledged
    Given a subscribe request for "<filter>" notified as <type> records
    Then the request should be a valid "subscribe" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

    Examples: Event types and severity (API.EWS.01)
      | filter                                 | type     |
      | floods of severe or extreme severity   | CapAlert |
      | droughts by event code                 | CapAlert |
      | immediate alerts                       | Alert    |
      | alerts crossing a threshold            | Alert    |

    Examples: Categories, as values and as CD.EWS.01 codes
      | filter                                 | type     |
      | meteorological alerts                  | CapAlert |
      | meteorological alerts by category code | CapAlert |

    Examples: Areas and message types
      | filter                                 | type     |
      | alerts for an administrative area      | Alert    |
      | alerts for a polygon                   | Alert    |
      | actual alerts only                     | CapAlert |

  @functional
  Scenario: A batch subscription with several filters is acknowledged
    Given a batch subscribe request for "floods of severe or extreme severity; droughts by event code; alerts for an administrative area"
    Then the request should be a valid "subscribe" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

  # ---------------------------------------------------------------------------
  # Full async round trip
  # ---------------------------------------------------------------------------
  @callback
  Scenario Outline: The subscription result for <filter> is delivered to the on-subscribe callback
    Given a subscribe request for "<filter>" notified as <type> records
    And the callback listener is used as sender_uri
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"
    And an "on-subscribe" callback should be received
    And the callback should be a valid "on-subscribe" message
    And every subscription should be confirmed with a subscription code
    And every subscription should echo the requested filter and record type

    Examples:
      | filter                               | type     |
      | floods of severe or extreme severity | CapAlert |
      | alerts for an administrative area    | Alert    |

  @callback
  Scenario: Every item of a batch subscription is confirmed in the callback
    Given a batch subscribe request for "immediate alerts; alerts crossing a threshold"
    And the callback listener is used as sender_uri
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"
    And an "on-subscribe" callback should be received
    And the callback should be a valid "on-subscribe" message
    And every subscription should be confirmed with a subscription code

  # ---------------------------------------------------------------------------
  # Invalid requests
  # ---------------------------------------------------------------------------
  @negative
  Scenario Outline: An invalid subscription is rejected: <case>
    Given a valid request
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the request should be rejected according to the DCI error model

    Examples: Envelope
      | case                     | field                                                  | value                  |
      | missing header           | header                                                 | <removed>              |
      | wrong action             | header.action                                          | "notify"               |
      | missing sender_id        | header.sender_id                                       | <removed>              |
      | missing message          | message                                                | <removed>              |
      | missing transaction_id   | message.transaction_id                                 | <removed>              |
      | empty subscribe_request  | message.subscribe_request                              | []                     |
      | missing reference_id     | message.subscribe_request.0.reference_id               | <removed>              |
      | missing criteria         | message.subscribe_request.0.subscribe_criteria         | <removed>              |
      | invalid locale           | message.subscribe_request.0.locale                     | "en-GB"                |

    Examples: Alert filter (API.EWS.01: what type of events and severity)
      | case                          | field                                                                 | value                    |
      | missing filter                | message.subscribe_request.0.subscribe_criteria.filter                 | <removed>                |
      | empty filter                  | message.subscribe_request.0.subscribe_criteria.filter                 | {}                       |
      | severity outside CD.EWS.02    | message.subscribe_request.0.subscribe_criteria.filter.severity        | ["High"]                 |
      | severity as a single value    | message.subscribe_request.0.subscribe_criteria.filter.severity        | "Severe"                 |
      | empty severity list           | message.subscribe_request.0.subscribe_criteria.filter.severity        | []                       |
      | category outside CD.EWS.01    | message.subscribe_request.0.subscribe_criteria.filter.category        | ["Weather"]              |
      | urgency outside CD.EWS.06     | message.subscribe_request.0.subscribe_criteria.filter.urgency         | ["Now"]                  |
      | certainty outside CD.EWS.07   | message.subscribe_request.0.subscribe_criteria.filter.certainty       | ["Certain"]              |
      | threshold outside CD.EWS.10   | message.subscribe_request.0.subscribe_criteria.filter.threshold_status | ["RED"]                 |
      | status outside CD.EWS.03      | message.subscribe_request.0.subscribe_criteria.filter.status          | ["Real"]                 |
      | event code outside CD.EWS.01  | message.subscribe_request.0.subscribe_criteria.filter.event_code      | ["XX"]                   |
      | area without description      | message.subscribe_request.0.subscribe_criteria.filter.area            | [{}]                     |
      | area polygon not lat,lon      | message.subscribe_request.0.subscribe_criteria.filter.area            | [{"polygon":["33.85 35.45"]}] |
      | missing notify_record_type    | message.subscribe_request.0.subscribe_criteria.notify_record_type     | <removed>                |
      | unknown notify_record_type    | message.subscribe_request.0.subscribe_criteria.notify_record_type     | "Person"                 |
      | incomplete frequency          | message.subscribe_request.0.subscribe_criteria.frequency              | {"frequency":"daily"}    |

  @negative
  Scenario: A body that is not JSON is rejected
    When the raw body "not json" is sent
    Then the request should be rejected according to the DCI error model
