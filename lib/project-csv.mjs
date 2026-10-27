/** Exporta exclusivamente os projetos já autorizados para o usuário pelo backend. */
const COLUMNS = ['id', 'title', 'status', 'created_at'];
function escapeCsv(value) {
  let text = String(value ?? '');
  // Mitiga execução de fórmulas ao abrir o CSV em planilhas.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function projectsToCsv(projects) {
  if (!Array.isArray(projects)) throw new TypeError('Lista de projetos inválida');
  const rows = projects.map(project => COLUMNS.map(key => escapeCsv(project?.[key])).join(','));
  return '\uFEFF' + [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
