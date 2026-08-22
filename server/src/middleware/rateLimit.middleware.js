const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 300;

// En docker-compose, `client` (nginx) hace de proxy inverso hacia `server`
// (08-decisiones.md §13): sin esto, req.ip sería siempre la IP interna del
// contenedor `client` y el límite se compartiría entre todo el equipo en vez
// de aplicarse por usuario real. nginx.conf ya fija X-Real-IP.
// ipKeyGenerator normaliza IPv6 a un bloque /56 (si no, cualquiera con un
// rango IPv6 podría esquivar el límite pidiendo desde una IP distinta por petición).
const keyGenerator = (req) => ipKeyGenerator(req.header('X-Real-IP') || req.ip);

const apiRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiadas peticiones; inténtelo de nuevo en unos segundos',
        details: {},
      },
    });
  },
});

module.exports = apiRateLimiter;
