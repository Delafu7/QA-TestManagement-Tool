const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logFilePath = process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/server.ndjson');
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

const destination = pino.destination({ dest: logFilePath, sync: false });

const logger = pino(
  {
    base: { service: 'qa-tool-server' },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    messageKey: 'mensaje',
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  destination
);

module.exports = logger;
