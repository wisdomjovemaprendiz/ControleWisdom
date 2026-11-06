import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guidedPedagogyDraft,
  guideFollowUp,
  guideEvidence,
} from "../lib/pedagogy-guide";

test("guia produz registro completo com fontes e apenas estratégias relacionadas", () => {
  const result = guidedPedagogyDraft({
    scores: { attention_start: 2, nonsense: 3 },
    strategyIds: ["chunk_steps", "emotion_routine"],
    context: "Atividade individual",
    level: 3,
    goal: "Realizar a tarefa com menos apoio",
    outcome: "",
    evidence: "",
  });
  assert.deepEqual(result.plan.observation_scores, { attention_start: 2 });
  assert.deepEqual(result.plan.strategy_ids, ["chunk_steps"]);
  assert.match(result.notes, /Frequente \(2\/3\)/);
  assert.match(result.notes, /apoio em algumas etapas/);
  assert.match(result.skill, /Atenção/);
  assert.match(result.intervention, /etapas observáveis/);
  assert.ok(result.plan.criteria);
  assert.deepEqual(result.plan.sources, ["cast"]);
  assert.equal(result.plan.evidence, "");
});
test("evolução usa somente evidência escolhida para o resultado indicado", () => {
  const input = {
    scores: { attention_start: 1 },
    strategyIds: ["start_check"],
    context: "Atividade individual",
    level: 4,
    goal: "Realizar a tarefa com menos apoio",
    outcome: "progress",
    evidence: guideEvidence.progress[0],
  };
  assert.match(guidedPedagogyDraft(input).notes, /menos lembretes/);
  assert.equal(
    guidedPedagogyDraft({ ...input, evidence: guideEvidence.achieved[0] }).plan
      .evidence,
    "",
  );
  assert.equal(guideFollowUp("2026-12-28", 7), "2027-01-04");
  assert.equal(guideFollowUp("2026-12-28", 0), "");
});
