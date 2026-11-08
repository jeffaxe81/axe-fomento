import { PROJECT_STATUSES } from './project-status.mjs';
/** Recebe exclusivamente os projetos já autorizados pelo backend para o município. */
export function summarizeProjects(projects) {
  if (!Array.isArray(projects)) throw new TypeError('Lista de projetos inválida');
  const byStatus = Object.fromEntries(PROJECT_STATUSES.map(status => [status, 0]));
  for (const project of projects) {
    if (!PROJECT_STATUSES.includes(project?.status)) throw new RangeError('Status de projeto desconhecido');
    byStatus[project.status] += 1;
  }
  return { total: projects.length, byStatus };
}
