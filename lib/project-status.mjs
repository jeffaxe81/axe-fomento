/** Regras de transição de projetos. A autorização por tenant é aplicada na API. */
export const PROJECT_STATUSES = Object.freeze(['rascunho', 'preparacao', 'submetido', 'aprovado', 'recusado']);
const transitions = Object.freeze({
  rascunho: ['preparacao'],
  preparacao: ['rascunho', 'submetido'],
  submetido: ['aprovado', 'recusado'],
  aprovado: [],
  recusado: []
});
export function canTransitionProject(from, to) {
  return Object.hasOwn(transitions, from) && transitions[from].includes(to);
}
export function transitionProjectStatus(from, to) {
  if (!PROJECT_STATUSES.includes(from) || !PROJECT_STATUSES.includes(to)) throw new RangeError('Status de projeto desconhecido');
  if (!canTransitionProject(from, to)) throw new RangeError(`Transição de projeto não permitida: ${from} -> ${to}`);
  return to;
}
