const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let server;
let responseQueue = [];
let receivedRequests = [];
let notionClient;

const defaultResponse = () => ({ status: 200, body: { id: `page-${Math.random().toString(36).slice(2)}` } });

test.before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        receivedRequests.push({ path: req.url, body: raw ? JSON.parse(raw) : {} });
        const { status, body } = responseQueue.shift() || defaultResponse();
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      } catch (err) {
        // Nunca dejar la petición sin responder: un fallo aquí dejaría el fetch()
        // del cliente colgado para siempre en vez de fallar el test con claridad.
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `error en el servidor fake de test: ${err.message}` }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.NOTION_API_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  notionClient = require('../src/integrations/notion.client');
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.beforeEach(() => {
  responseQueue = [];
  receivedRequests = [];
});

const ejecucion = (overrides = {}) => ({
  casoTitulo: 'Login con credenciales válidas',
  suiteNombre: 'Auth > Login',
  prioridad: 'alta',
  estado: 'passed',
  ejecutor: 'Ana Gómez',
  fechaEjecucion: '2026-08-20T10:15:00Z',
  duracionSegundos: 42,
  comentario: '',
  defectos: [],
  ...overrides,
});

test('envía una página por ejecución y devuelve los notionPageIds', async () => {
  const resultado = await notionClient.enviarEjecuciones({
    notionDatabaseId: 'db-1',
    notionToken: 'secret_x',
    cicloNombre: 'Sprint 14',
    ejecuciones: [ejecucion(), ejecucion({ casoTitulo: 'Login KO', estado: 'failed' })],
  });
  assert.equal(resultado.enviados, 2);
  assert.equal(resultado.fallidos, 0);
  assert.equal(resultado.notionPageIds.length, 2);
  assert.equal(receivedRequests.length, 2);
});

test('las propiedades enviadas a Notion mapean los campos de la ejecución', async () => {
  await notionClient.enviarEjecuciones({
    notionDatabaseId: 'db-1',
    notionToken: 'secret_x',
    cicloNombre: 'Sprint 14',
    ejecuciones: [ejecucion({ comentario: 'Se queda en blanco', defectos: [{ id: 'def-1' }] })],
  });
  const props = receivedRequests[0].body.properties;
  assert.equal(props.Nombre.title[0].text.content, 'Login con credenciales válidas');
  assert.equal(props.Estado.select.name, 'passed');
  assert.equal(props.Comentario.rich_text[0].text.content, 'Se queda en blanco');
  assert.equal(props.Defecto.rich_text[0].text.content, 'def-1');
});

test('reintenta una vez tras un 429 y cuenta el envío como exitoso', async () => {
  responseQueue = [
    { status: 429, body: { message: 'rate limited' } },
    { status: 200, body: { id: 'page-tras-retry' } },
  ];
  const resultado = await notionClient.enviarEjecuciones({
    notionDatabaseId: 'db-1',
    notionToken: 'secret_x',
    cicloNombre: 'Sprint 14',
    ejecuciones: [ejecucion()],
  });
  assert.equal(resultado.enviados, 1);
  assert.deepEqual(resultado.notionPageIds, ['page-tras-retry']);
  assert.equal(receivedRequests.length, 2);
});

test('un fallo no sistémico (400) en una ejecución se cuenta como fallido y no interrumpe el resto', async () => {
  responseQueue = [{ status: 400, body: { message: 'Prioridad no reconocida' } }];
  const resultado = await notionClient.enviarEjecuciones({
    notionDatabaseId: 'db-1',
    notionToken: 'secret_x',
    cicloNombre: 'Sprint 14',
    ejecuciones: [ejecucion(), ejecucion({ casoTitulo: 'Segunda ejecución' })],
  });
  assert.equal(resultado.fallidos, 1);
  assert.equal(resultado.enviados, 1);
  assert.equal(receivedRequests.length, 2); // sigue con la segunda tras el fallo de la primera
});

test('un error sistémico (401) interrumpe el lote completo en vez de contarse como fallido', async () => {
  responseQueue = [{ status: 401, body: { message: 'token inválido' } }];
  await assert.rejects(
    () =>
      notionClient.enviarEjecuciones({
        notionDatabaseId: 'db-1',
        notionToken: 'secret_invalido',
        cicloNombre: 'Sprint 14',
        ejecuciones: [ejecucion(), ejecucion({ casoTitulo: 'No debería intentarse' })],
      }),
    /token inválido/
  );
  assert.equal(receivedRequests.length, 1); // no sigue con la segunda ejecución
});
