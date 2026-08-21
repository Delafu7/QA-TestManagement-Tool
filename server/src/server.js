const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info({ tipo: 'evento_negocio', evento: 'server_started', puerto: PORT });
  console.log(`qa-tool-server escuchando en el puerto ${PORT}`);
});
