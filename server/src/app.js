const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/logger.middleware');
const apiRateLimiter = require('./middleware/rateLimit.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', apiRateLimiter);
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
