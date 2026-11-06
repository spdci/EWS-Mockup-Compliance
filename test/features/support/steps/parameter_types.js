import { defineParameterType } from '@cucumber/cucumber';

// Record types checked by the EWS data rules:
//  CapAlert       DO.EWS.02 CapAlert (with DO.EWS.03 Info, DO.EWS.04 Resource, DO.EWS.05 Area, DO.EWS.06 GeoCode)
//  Alert          DO.EWS.01 Alert, a GeoJSON Feature carrying a CapAlert
//  SdmxJson       API.EWS.05 aggregated member statistics, SDMX-JSON
//  DciStatistics  sdmx-dci-member-example aggregated member statistics, DCI JSON
defineParameterType({
  name: 'recordType',
  regexp: /CapAlert|Alert|SdmxJson|DciStatistics/,
  transformer: (s) => s,
});
