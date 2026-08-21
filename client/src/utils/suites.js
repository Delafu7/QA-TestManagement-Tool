export function flattenSuites(tree, prefix = '') {
  const out = [];
  for (const suite of tree) {
    const nombre = prefix ? `${prefix} > ${suite.nombre}` : suite.nombre;
    out.push({ id: suite.id, nombre });
    if (suite.hijas?.length) out.push(...flattenSuites(suite.hijas, nombre));
  }
  return out;
}
