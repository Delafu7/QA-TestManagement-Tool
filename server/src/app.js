const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/logger.middleware');
const { identifyUser } = require('./middleware/auth.middleware');
const apiRateLimiter = require('./middleware/rateLimit.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const usuariosRoutes = require('./routes/usuarios.routes');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Antes que cualquier ruta de /api, incluidas las de usuarios sin autenticar (ver
// abajo): son justo las más expuestas a abuso por no requerir identidad previa.
app.use('/api', apiRateLimiter);

// El selector de usuario activo (08-decisiones.md §2) necesita poder listar y
// crear usuarios antes de que exista una identidad con la que autenticar el resto de rutas.
app.use('/api', usuariosRoutes);
app.use('/api', identifyUser, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
