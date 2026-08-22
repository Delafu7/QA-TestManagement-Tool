const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Contrato de 03-api-contract.md: query params `page` (default 1) y `pageSize`
// (default 20, máx 100). Cualquier valor ausente o no numérico cae al default en
// vez de devolver 400: no vale la pena rechazar la petición por esto.
const parsePagination = ({ page, pageSize } = {}) => {
  let p = parseInt(page, 10);
  let ps = parseInt(pageSize, 10);
  if (!Number.isInteger(p) || p < 1) p = 1;
  if (!Number.isInteger(ps) || ps < 1) ps = DEFAULT_PAGE_SIZE;
  if (ps > MAX_PAGE_SIZE) ps = MAX_PAGE_SIZE;
  return { page: p, pageSize: ps, offset: (p - 1) * ps };
};

module.exports = { parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
