// Porcentaje de `n` sobre `total`, protegido contra división por cero (usado en
// todas las barras de avance: Dashboard, FasesTesting).
export function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}
