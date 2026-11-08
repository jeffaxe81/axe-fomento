// Deterministic, advisory-only scoring. No legal or financial eligibility decisions.
export function validateRubric(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0 || criteria.length > 30) throw new Error("Rubrica inválida");
  const ids = new Set();
  let total = 0;
  const normalized = criteria.map((item) => {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,50}$/.test(item.id) || ids.has(item.id)) throw new Error("Critério inválido ou duplicado");
    if (typeof item.label !== "string" || item.label.trim().length < 3 || item.label.length > 160) throw new Error("Descrição inválida");
    if (!Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100) throw new Error("Peso inválido");
    ids.add(item.id);
    total += item.weight;
    return Object.freeze({ id: item.id, label: item.label.trim(), weight: item.weight });
  });
  if (total !== 100) throw new Error("Pesos devem somar 100");
  return Object.freeze(normalized);
}

export function scoreReadiness(criteria, assessments) {
  const rubric = validateRubric(criteria);
  if (!Array.isArray(assessments)) throw new Error("Avaliações inválidas");
  const known = new Set(rubric.map((c) => c.id));
  const values = new Map();
  for (const item of assessments) {
    if (!item || !known.has(item.id) || values.has(item.id)) throw new Error("Avaliação duplicada ou desconhecida");
    if (item.score !== null && (!Number.isInteger(item.score) || item.score < 0 || item.score > 100)) throw new Error("Nota inválida");
    if (item.score !== null && (typeof item.evidence !== "string" || item.evidence.trim().length < 5 || item.evidence.length > 2000)) throw new Error("Evidência obrigatória");
    values.set(item.id, { score: item.score, evidence: item.score === null ? null : item.evidence.trim() });
  }
  const breakdown = rubric.map((c) => {
    const a = values.get(c.id);
    return { ...c, score: a?.score ?? null, evidence: a?.evidence ?? null, weightedPoints: a?.score === null || !a ? null : (a.score * c.weight) / 100 };
  });
  const evaluatedWeight = breakdown.reduce((sum, c) => sum + (c.score === null ? 0 : c.weight), 0);
  const knownPoints = breakdown.reduce((sum, c) => sum + (c.weightedPoints ?? 0), 0);
  return {
    // Conservative: missing evidence contributes zero; never normalize away unknowns.
    score: Math.round(knownPoints * 100) / 100,
    maximumPossibleScore: Math.round((knownPoints + 100 - evaluatedWeight) * 100) / 100,
    evaluatedWeight,
    complete: evaluatedWeight === 100,
    breakdown
  };
}
