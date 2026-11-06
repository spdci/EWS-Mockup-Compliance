FROM node:20-alpine

# Mockoon CLI >= 9 is required (valid_json_schema rules, response callbacks)
RUN npm install -g @mockoon/cli@9.2.0

WORKDIR /mocks

# EWS side on 3003, SP side on 3004
COPY mockoon-ews.json mockoon-sp.json entrypoint.sh ./

# Do not run as root
RUN adduser --shell /bin/sh --disabled-password --gecos "" mockoon \
 && chown -R mockoon /mocks \
 && chmod +x /mocks/entrypoint.sh

USER mockoon

EXPOSE 3003 3004

ENTRYPOINT ["/mocks/entrypoint.sh"]
