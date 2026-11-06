@endpoint=ews/collections/alerts/items
Feature: Create and replace alerts (API.EWS.04)

API.EWS.04 Create-replace: POST /collections/alerts/items creates an alert, PUT
/collections/alerts/items/{alertId} replaces one. The body is a DO.EWS.01 Alert: a GeoJSON
Feature whose geometry is the spatial extent of the hazard and whose properties hold the full
CapAlert. An alert that breaks the standard must be refused (OGC exception, HTTP 400).

  # ---------------------------------------------------------------------------
  # Create
  # ---------------------------------------------------------------------------
  @smoke @method=POST
  Scenario: The published Alert example is created
    Given the "create alert" endpoint
    And the "spec example" Alert as the request body
    When the request is sent
    Then the HTTP status should be 201
    And the response should have a JSON content type
    And the response should be a valid "alert"
    And the response should be the alert that was sent

  @functional @method=POST
  Scenario Outline: The <alert> Alert is created
    Given the "create alert" endpoint
    And the "<alert>" Alert as the request body
    When the request is sent
    Then the HTTP status should be 201
    And the response should be a valid "alert"
    And the response should be the alert that was sent

    Examples:
      | alert      |
      | full       |
      | earthquake |
      | heatwave   |
      | drought    |
      | exercise   |
      | private    |
      | minimal    |

  @functional @method=POST
  Scenario: An alert with no polygon is created with a null geometry
    Given the "create alert" endpoint
    And a request body carrying the "heatwave" CapAlert as an Alert without geometry
    When the request is sent
    Then the HTTP status should be 201
    And the response should be a valid "alert"

  @negative @method=POST
  Scenario Outline: An invalid alert is not created: <case>
    Given the "create alert" endpoint
    And the "full" Alert as the request body
    And the request field "<field>" becomes '<value>'
    When the request is sent
    Then the response should be an OGC exception with HTTP status 400

    Examples: Feature
      | case                      | field                     | value                               |
      | not a Feature             | type                      | "FeatureCollection"                 |
      | missing geometry          | geometry                  | <removed>                           |
      | missing properties        | properties                | <removed>                           |
      | unknown geometry type     | geometry.type             | "Circle"                            |
      | coordinates not numbers   | geometry.coordinates      | [[[["35.45","33.85"]]]]             |
      | ring of 3 positions       | geometry.coordinates      | [[[[35.45,33.85],[35.55,33.85],[35.45,33.85]]]] |

    Examples: CapAlert in the properties
      | case                      | field                                    | value        |
      | missing identifier        | properties.identifier                    | <removed>    |
      | missing sender            | properties.sender                        | <removed>    |
      | status outside CD.EWS.03  | properties.status                        | "Real"       |
      | missing threshold_status  | properties.threshold_status              | <removed>    |
      | severity outside CD.EWS.02 | properties.info.0.severity              | "High"       |
      | missing event             | properties.info.0.event                  | <removed>    |
      | resource without mimeType | properties.info.0.resource.0.mimeType    | <removed>    |
      | resource with a negative size | properties.info.0.resource.0.size    | -1           |

  # ---------------------------------------------------------------------------
  # Replace
  # ---------------------------------------------------------------------------
  @smoke @method=PUT
  Scenario: An alert is replaced
    Given the "replace alert" endpoint
    And the "full" Alert as the request body
    When the request is sent
    Then the HTTP status should be 200
    And the response should be a valid "alert"
    And the response should be the alert that was sent

  @functional @method=PUT
  Scenario: A slow-onset alert is replaced by its update (same identifier, newer assessment_date)
    Given the "replace alert" endpoint
    And the "drought" Alert as the request body
    When the request is sent
    Then the HTTP status should be 200
    And the response should be a valid "alert"

  @negative @method=PUT
  Scenario: An invalid replacement is refused
    Given the "replace alert" endpoint
    And the "full" Alert as the request body
    And the request field "properties.msg_type" becomes '"Replace"'
    When the request is sent
    Then the response should be an OGC exception with HTTP status 400

  @negative @method=PUT @mock
  Scenario: An alert that is not in the collection cannot be replaced
    Given the "replace alert" endpoint
    And the "full" Alert as the request body
    And the alert "unknown"
    When the request is sent
    Then the response should be an OGC exception with HTTP status 404
