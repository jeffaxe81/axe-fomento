import test from "node:test";
import assert from "node:assert/strict";
import { validateRubric, scoreReadiness } from "../lib/readiness-rubric.mjs";

const rubric = [{ id: "technical", label: "Maturidade técnica", weight: 60 }, { id: "financial", label: "Maturidade financeira", weight: 40 }];

test("rubrica exige pesos 100, ids únicos e inteiros", () => {
  assert.equal(validateRubric(rubric).length, 2);
  assert.throws(() => validateRubric([{ ...rubric[0], weight: 99 }]));
  assert.throws(() => validateRubric([rubric[0], { ...rubric[1], id: "technical" }]));
  assert.throws(() => validateRubric([{ ...rubric[0], weight: 60.5 }, rubric[1]]));
});
test("nota é determinística, ponderada e auditável", () => {
  const input = [{ id: "financial", score: 50, evidence: "Documento financeiro v1" }, { id: "technical", score: 80, evidence: "Parecer técnico v2" }];
  const a = scoreReadiness(rubric, input);
  assert.deepEqual(a, scoreReadiness(rubric, [...input].reverse()));
  assert.equal(a.score, 68);
  assert.equal(a.maximumPossibleScore, 68);
  assert.equal(a.complete, true);
});
test("evidência ausente não é presumida como atendida", () => {
  const result = scoreReadiness(rubric, [{ id: "technical", score: 80, evidence: "Parecer técnico v2" }]);
  assert.equal(result.score, 48);
  assert.equal(result.maximumPossibleScore, 88);
  assert.equal(result.evaluatedWeight, 60);
  assert.equal(result.complete, false);
  assert.equal(result.breakdown[1].score, null);
});
test("rejeita notas inválidas, critérios desconhecidos e duplicações", () => {
  assert.throws(() => scoreReadiness(rubric, [{ id: "technical", score: 101, evidence: "Parecer" }]));
  assert.throws(() => scoreReadiness(rubric, [{ id: "technical", score: 20, evidence: "" }]));
  assert.throws(() => scoreReadiness(rubric, [{ id: "other", score: 20, evidence: "Documento" }]));
  assert.throws(() => scoreReadiness(rubric, [{ id: "technical", score: null }, { id: "technical", score: null }]));
});
