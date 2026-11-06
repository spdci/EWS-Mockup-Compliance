#!/bin/sh
exec mockoon-cli start \
  --hostname 0.0.0.0 0.0.0.0 \
  --data mockoon-ews.json mockoon-sp.json \
  --disable-log-to-file
