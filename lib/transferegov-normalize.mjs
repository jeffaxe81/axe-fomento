/** Contrato conservador: extrai apenas identificador, título e órgão. */
export const SOURCE_URL = 'https://api-publica.transferegov.gestao.gov.br/parcerias/programa';
const object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const firstString = (row, keys, maximum) => {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const value = String(raw).trim();
    if (value && value.length <= maximum && !/[\u0000-\u001f]/.test(value)) return value;
  }
  return null;
};
export function normalizeProgram(row) {
  if (!object(row)) return null;
  const externalId = firstString(row, ['id_programa','codigo_programa','cod_programa'], 100);
  const title = firstString(row, ['nome_programa','nm_programa','titulo_programa','descricao_programa'], 180);
  if (!externalId || !title) return null;
  const provider = firstString(row, ['nome_orgao','nm_orgao','nome_ente_superior','nm_ente_superior'], 180) ?? 'Órgão não informado';
  return { externalId, title, provider, sourceUrl: SOURCE_URL };
}
export function extractPrograms(payload, maximum = 25) {
  const array = Array.isArray(payload) ? payload
    : object(payload) ? [payload.data, payload.items, payload.results, payload.content].find(Array.isArray)
    : null;
  if (!array) throw new Error('Formato de resposta não reconhecido; nenhuma informação importada.');
  if (array.length > 2000) throw new Error('Resposta excede o volume autorizado.');
  const seen = new Set();
  const valid = [];
  for (const record of array) {
    const parsed = normalizeProgram(record);
    if (!parsed || seen.has(parsed.externalId)) continue;
    seen.add(parsed.externalId);
    valid.push(parsed);
    if (valid.length >= maximum) break;
  }
  if (array.length && !valid.length) throw new Error('Campos da fonte incompatíveis; importação abortada.');
  return valid;
}
