FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV PORT=4000
ENV SQLITE_DB_PATH=/data/qa-tool.sqlite
ENV LOG_FILE_PATH=/var/log/qa-tool/server.ndjson

EXPOSE 4000

CMD ["node", "src/server.js"]
