@method=POST @endpoint=ews/on-unsubscribe
Feature: Receive the unsubscribe result (POST /on-unsubscribe)

Exposed by the SP system. After an unsubscribe request the EWS sends the status of every
subscription code here.

  Background:
    Given the "on-unsubscribe" endpoint

  @smoke
  Scenario: A confirmed unsubscription is acknowledged
    Given an on-unsubscribe callback confirming the unsubscription
    Then the request should be a valid "on-unsubscribe" message
    When the request is sent
    Then the HTTP status should be 200
    And the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario Outline: A rejected unsubscription (<code>) is acknowledged
    Given an on-unsubscribe callback rejected with reason code "<code>"
    Then the request should be a valid "on-unsubscribe" message
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

    Examples:
      | code                            |
      | rjct.subscription_code.invalid  |
      | rjct.event.already_unsubscribed |

  @negative
  Scenario Outline: An invalid unsubscribe result is rejected: <case>
    Given an on-unsubscribe callback confirming the unsubscription
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the request should be rejected according to the DCI error model

    Examples:
      | case                     | field                                  | value        |
      | wrong action             | header.action                          | "notify"     |
      | missing status           | message.status                         | <removed>    |
      | unknown reason code      | message.status_reason_code             | "rjct.other" |
      | unknown code status      | message.subscription_status.0.status   | "cancelled"  |
