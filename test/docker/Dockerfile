FROM node:20-alpine

RUN apk --no-cache add curl

WORKDIR /app

COPY package.json ./
RUN npm install --loglevel=error && npm list @cucumber/cucumber

COPY ./ /app

ENTRYPOINT ["/app/docker/entrypoint.sh"]
