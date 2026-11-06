@method=POST @endpoint=ews/on-subscribe
Feature: Receive the subscription result (POST /on-subscribe)

Exposed by the SP system. After a subscribe request the EWS sends the result here: one
subscription code per accepted subscription, or a rejection with its reason. The suite plays
the EWS; the SP system must acknowledge valid results and refuse invalid ones.

  Background:
    Given the "on-subscribe" endpoint

  @smoke
  Scenario: A confirmed subscription is acknowledged
    Given an on-subscribe callback confirming the subscription
    Then the request should be a valid "on-subscribe" message
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario Outline: A rejected subscription (<code>) is acknowledged
    Given an on-subscribe callback rejected with reason code "<code>"
    Then the request should be a valid "on-subscribe" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

    Examples:
      | code                          |
      | rjct.reference_id.invalid     |
      | rjct.filter.invalid           |
      | rjct.notify_types.invalid     |
      | rjct.event.already_subscribed |

  @negative
  Scenario Outline: An invalid subscription result is rejected: <case>
    Given an on-subscribe callback confirming the subscription
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the request should be rejected according to the DCI error model

    Examples:
      | case                        | field                                                     | value          |
      | wrong action                | header.action                                             | "subscribe"    |
      | missing correlation_id      | message.correlation_id                                    | <removed>      |
      | unknown status              | message.subscribe_response.0.status                       | "done"         |
      | unknown reason code         | message.subscribe_response.0.status_reason_code           | "rjct.unknown" |
      | subscription without code   | message.subscribe_response.0.subscriptions.0.code         | <removed>      |
      | unknown subscription status | message.subscribe_response.0.subscriptions.0.status       | "active"       |
      | filter severity outside list | message.subscribe_response.0.subscriptions.0.filter.severity | ["High"]   |
