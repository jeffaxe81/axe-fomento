/** Deterministic preliminary screening. Does not replace edital/legal verification. */
export function evaluateMatch(municipality, opportunity, now = new Date()) {
  const region = String(municipality.uf || '').toUpperCase();
  const eligible = opportunity.eligible_ufs || [];
  if (eligible.length && !eligible.includes(region)) {
    return { score: 0, band: 'Incompatível', reasons: ['UF não contemplada nesta oportunidade'], eligible: false };
  }
  if (opportunity.deadline && new Date(`${opportunity.deadline}T23:59:59Z`).getTime() < new Date(now).getTime()) {
    return { score: 0, band: 'Encerrada', reasons: ['Prazo de inscrição encerrado'], eligible: false };
  }
  let score = 30;
  const reasons = [];
  const interests = (municipality.priority_areas || []).map(x => String(x).toLowerCase());
  const areas = (opportunity.areas || []).map(x => String(x).toLowerCase());
  const intersections = interests.filter(x => areas.includes(x));
  if (intersections.length) {
    score += Math.min(45, intersections.length * 25);
    reasons.push(`Aderência às prioridades: ${intersections.join(', ')}`);
  } else {
    reasons.push('Sem correspondência explícita com as prioridades cadastradas');
  }
  if (!eligible.length || eligible.includes(region)) {
    score += 15;
    reasons.push(eligible.length ? `UF ${region} contemplada` : 'Abrangência nacional declarada');
  }
  if (opportunity.min_population != null && municipality.population != null && municipality.population < opportunity.min_population) {
    return { score: 0, band: 'Incompatível', reasons: ['População abaixo do limite mínimo'], eligible: false };
  }
  if (opportunity.max_population != null && municipality.population != null && municipality.population > opportunity.max_population) {
    return { score: 0, band: 'Incompatível', reasons: ['População acima do limite máximo'], eligible: false };
  }
  if (opportunity.max_population != null || opportunity.min_population != null) {
    if (municipality.population == null) {
      reasons.push('População não cadastrada; verificar elegibilidade no edital');
      score = Math.min(score, 55);
    } else {
      score += 10;
      reasons.push('Faixa populacional atendida');
    }
  }
  score = Math.min(100, score);
  return { score, band: score >= 75 ? 'Alta aderência' : score >= 50 ? 'Aderência moderada' : 'Baixa aderência', reasons, eligible: true };
}
