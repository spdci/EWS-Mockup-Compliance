@data
Feature: Encrypted EWS messages

Every DCI message may be encrypted: header.is_msg_encrypted is true and message is an
EncryptedMessage (JWE: header, ciphertext, encrypted_key, tag, iv). The EWS data rules then
apply after decryption, which this suite cannot do.

  Scenario: An encrypted notification is a valid notify message
    Given an encrypted "notify" message
    Then the encrypted message should be valid

  Scenario Outline: An encrypted message without <field> is rejected
    Given an encrypted "notify" message
    When its encrypted field "<field>" is removed
    Then the encrypted message should be rejected because of "must have required property '<field>'"

    Examples:
      | field         |
      | ciphertext    |
      | encrypted_key |
      | tag           |
      | iv            |
