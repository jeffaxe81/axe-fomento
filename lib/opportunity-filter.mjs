/** Filtros puros para oportunidades; não consulta dados externos. */
export function filterOpportunities(opportunities, { query = '', area = '' } = {}) {
  if (!Array.isArray(opportunities)) throw new TypeError('Lista de oportunidades inválida');
  const term = String(query).trim().toLocaleLowerCase('pt-BR');
  const selectedArea = String(area).trim().toLocaleLowerCase('pt-BR');
  return opportunities.filter((item) => {
    if (term && ![item.title, item.provider].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term))) return false;
    if (selectedArea && !(Array.isArray(item.areas) && item.areas.some((value) => String(value).toLocaleLowerCase('pt-BR') === selectedArea))) return false;
    return true;
  });
}
