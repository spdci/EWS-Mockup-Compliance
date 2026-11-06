@method=POST @endpoint=ews/unsubscribe
Feature: Cancel alert subscriptions (API.EWS.01, POST /unsubscribe)

API.EWS.01 publishes /subscribe and /unsubscribe. The SP system cancels subscriptions by the
subscription codes the EWS returned; the EWS acknowledges and delivers the result to the
on-unsubscribe callback.

  Background:
    Given the "unsubscribe" endpoint

  @smoke
  Scenario: An unsubscribe request is acknowledged
    Given an unsubscribe request for the subscription codes "SUB-EWS-0001"
    Then the request should be a valid "unsubscribe" message
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be received within 15000 ms
    And the response should be a valid acknowledgement with ack_status "ACK"

  @functional
  Scenario: Several subscriptions are cancelled at once
    Given an unsubscribe request for the subscription codes "SUB-EWS-0001, SUB-EWS-0002, SUB-EWS-0003"
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"

  @callback
  Scenario: The unsubscribe result is delivered to the on-unsubscribe callback
    Given an unsubscribe request for the subscription codes "SUB-EWS-0001, SUB-EWS-0002"
    And the callback listener is used as sender_uri
    When the request is sent
    Then the response should be a valid acknowledgement with ack_status "ACK"
    And an "on-unsubscribe" callback should be received
    And the callback should be a valid "on-unsubscribe" message
    And every subscription code should be reported as unsubscribed

  @negative
  Scenario Outline: An invalid unsubscribe request is rejected: <case>
    Given a valid request
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the request should be rejected according to the DCI error model

    Examples:
      | case                      | field                      | value         |
      | missing header            | header                     | <removed>     |
      | wrong action              | header.action              | "subscribe"   |
      | missing transaction_id    | message.transaction_id     | <removed>     |
      | missing timestamp         | message.timestamp          | <removed>     |
      | invalid timestamp         | message.timestamp          | "yesterday"   |
      | missing subscription code | message.subscription_codes | <removed>     |
      | empty subscription codes  | message.subscription_codes | []            |
      | empty subscription code   | message.subscription_codes | [""]          |
