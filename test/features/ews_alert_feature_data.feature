@data
Feature: EWS alert feature data rules (DO.EWS.01 Alert, GeoJSON / OGC API Features)

DO.EWS.01: the alert "shall be represented as a GeoJSON Feature object" (OGC API Features,
featureGeoJSON.yaml): type "Feature", a geometry (the spatial extent of the hazard, or null)
and properties holding the CapAlert. The attribute table makes properties the CapAlert
itself; the published example nests it under properties.capAlert. Both are accepted.

GeoJSON positions are [longitude, latitude]; CAP polygons are "latitude,longitude". Getting
the order wrong moves the alert to another place on earth, so every CAP polygon of the alert
must appear in the geometry as [lon, lat] positions (whatever the winding).

  @smoke
  Scenario Outline: Reference alert feature "<record>" is valid EWS data
    Given the "<record>" Alert record
    Then the record should be valid

    Examples:
      | record       |
      | spec example |
      | full         |
      | drought      |
      | earthquake   |
      | heatwave     |
      | exercise     |
      | private      |
      | minimal      |

  Scenario: An empty feature is rejected
    Given an empty Alert record
    Then the record should be rejected because of:
      | must have required property 'type'       |
      | must have required property 'geometry'   |
      | must have required property 'properties' |

  Scenario Outline: <case> is rejected
    Given the "full" Alert record
    When its "<attribute>" attribute is set to '<value>'
    Then the record should be rejected because of "<error>"

    Examples: Feature
      | case                          | attribute            | value                       | error                                     |
      | a FeatureCollection           | type                 | "FeatureCollection"         | /type must be equal to constant           |
      | an unknown geometry type      | geometry.type        | "Circle"                    | /geometry/type must be equal to one of the allowed values |
      | a geometry without coordinates | geometry            | {"type":"Polygon"}          | must have required property 'coordinates' |
      | a Point with one number       | geometry             | {"type":"Point","coordinates":[36.1]} | /geometry/coordinates must NOT have fewer than 2 items |
      | properties that are no CapAlert | properties         | {"name":"Flood"}            | must have required property 'identifier'  |
      | an id that is not the identifier | id                | "ANOTHER-ID"                | is not the identifier of the alert it carries |

    Examples: Geometry
      | case                          | attribute            | value                                                                         | error                                  |
      | longitude out of range        | geometry.coordinates | [[[[236.80,-1.30],[236.80,-1.20],[236.95,-1.20],[236.95,-1.30],[236.80,-1.30]]]] | longitude 236.8 is outside -180..180 |
      | latitude out of range         | geometry             | {"type":"Point","coordinates":[36.1,-95]}                                      | latitude -95 is outside -90..90        |
      | an open ring                  | geometry.coordinates | [[[[36.80,-1.30],[36.80,-1.20],[36.95,-1.20],[36.95,-1.30]]]]                  | ring 1 is not closed                   |
      | the CAP polygon in lat,lon order | geometry.coordinates | [[[[-1.30,36.80],[-1.20,36.80],[-1.20,36.95],[-1.30,36.95],[-1.30,36.80]]]] | in lat,lon order: GeoJSON positions are [lon, lat] |
      | a geometry that is not the CAP area | geometry.coordinates | [[[[10,10],[11,10],[11,11],[10,11],[10,10]]]]                          | does not contain the CAP polygon       |

  Scenario: The published example nests the CapAlert under properties.capAlert
    Given the "spec example" Alert record
    When its "properties.capAlert.status" attribute is set to '"Real"'
    Then the record should be rejected because of "/properties/capAlert/status must be equal to one of the allowed values"

  Scenario: The CapAlert data rules apply inside the feature
    Given the "full" Alert record
    When its "properties.scope" attribute is set to '"Private"'
    And its "properties.addresses" attribute is removed
    Then the record should be rejected because of "must have required property 'addresses'"

  Scenario: The geometry may wind the other way round from the CAP polygon (RFC 7946)
    Given the "spec example" Alert record
    Then the record should be valid

  Scenario: An alert with no polygon may have a null geometry
    Given the "heatwave" Alert record
    When its "geometry" attribute is set to 'null'
    Then the record should be valid

  Scenario: An integer feature id is allowed when there is no identifier to compare
    Given the "full" Alert record
    When its "id" attribute is removed
    Then the record should be valid
