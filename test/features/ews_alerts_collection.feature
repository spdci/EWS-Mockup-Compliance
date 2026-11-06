@method=GET @endpoint=ews/collections/alerts
Feature: Fetch alerts (API.EWS.03, OGC API Features)

API.EWS.03 Fetch Alert exposes the EWS alerts as an OGC API Features collection:
GET /collections/alerts, GET /collections/alerts/items, filtered on CAP properties
(?event=Flood, ?severity=Extreme, ?urgency=Immediate, ...), and one alert by identifier.
Every alert returned is a DO.EWS.01 Alert (GeoJSON Feature) carrying a valid CapAlert.

  # ---------------------------------------------------------------------------
  # The collection
  # ---------------------------------------------------------------------------
  @smoke
  Scenario: The alerts collection is described
    Given the "alerts collection" endpoint
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be received within 15000 ms
    And the response should be a valid "collection"
    And the collection should link to its items

  # ---------------------------------------------------------------------------
  # Items
  # ---------------------------------------------------------------------------
  @smoke
  Scenario: The alerts are returned as a FeatureCollection of valid alerts
    Given the "alert items" endpoint
    When the request is sent
    Then the HTTP status should be 200
    And the response should have the content type "application/geo+json"
    And the response should be a valid "feature-collection"
    And at least 1 alert should be returned
    And numberReturned should match the features returned
    And every alert in the collection should be a different alert

  @functional
  Scenario Outline: Alerts filtered by <property> = <value> all match the filter
    Given the "alert items" endpoint
    And the alerts are filtered by "<property>" = "<value>"
    When the request is sent
    Then the response should be a valid "feature-collection"
    And every returned alert should have "<property>" = "<value>"
    And numberReturned should match the features returned

    Examples: Filters of API.EWS.03
      | property | value     |
      | event    | Flood     |
      | severity | Extreme   |
      | urgency  | Immediate |

    Examples: Other CAP properties
      | property         | value                |
      | certainty        | Observed             |
      | category         | Met                  |
      | category         | MET                  |
      | status           | Actual               |
      | status           | Exercise             |
      | msg_type         | Update               |
      | scope            | Public               |
      | threshold_status | TRIGGER              |
      | event_code       | DR                   |

  @functional @mock
  Scenario Outline: The mock collection holds alerts for <property> = <value>
    Given the "alert items" endpoint
    And the alerts are filtered by "<property>" = "<value>"
    When the request is sent
    Then the response should be a valid "feature-collection"
    And at least <count> alerts should be returned

    Examples:
      | property  | value       | count |
      | severity  | Extreme     | 2     |
      | category  | Met         | 3     |
      | event     | Flash Flood | 1     |
      | status    | Exercise    | 1     |

  @functional
  Scenario: A filter value nobody matches returns an empty FeatureCollection
    Given the "alert items" endpoint
    And the alerts are filtered by "urgency" = "Unknown"
    When the request is sent
    Then the response should be a valid "feature-collection"
    And no alert should be returned

  @functional
  Scenario: limit caps the number of alerts returned
    Given the "alert items" endpoint
    And at most 2 alerts are asked for
    When the request is sent
    Then the response should be a valid "feature-collection"
    And at most 2 alerts should be returned
    And numberReturned should match the features returned

  @negative
  Scenario Outline: An invalid filter is rejected: <property> = <value>
    Given the "alert items" endpoint
    And the query parameter "<property>" is "<value>"
    When the request is sent
    Then the response should be an OGC exception with HTTP status 400

    Examples:
      | property         | value        |
      | severity         | Catastrophic |
      | severity         | extreme      |
      | urgency          | Now          |
      | certainty        | Sure         |
      | category         | Weather      |
      | status           | Real         |
      | threshold_status | RED          |
      | limit            | 0            |
      | limit            | many         |

  # ---------------------------------------------------------------------------
  # One alert
  # ---------------------------------------------------------------------------
  @smoke
  Scenario: One alert is returned by its identifier
    Given the "alert item" endpoint
    And the alert "existing"
    When the request is sent
    Then the HTTP status should be 200
    And the response should have a JSON content type
    And the response should be a valid "alert"

  @functional @mock
  Scenario Outline: The <alert> alert is returned by its identifier
    Given the "alert item" endpoint
    And the alert "<alert>"
    When the request is sent
    Then the response should be a valid "alert"
    And the returned alert should be "<alert>"

    Examples:
      | alert        |
      | spec example |
      | full         |
      | earthquake   |
      | heatwave     |

  @negative
  Scenario: An unknown alert is not found
    Given the "alert item" endpoint
    And the alert "unknown"
    When the request is sent
    Then the response should be an OGC exception with HTTP status 404
