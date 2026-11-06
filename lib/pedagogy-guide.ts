import type { SupportPlan } from "./domain";
import {
  CATALOGUE_VERSION,
  observationOptions,
  strategyOptions,
  pedagogyDraft,
  outcomeLabels,
} from "./pedagogy";

export const guideContexts = [
  "Atividade individual",
  "Atividade em grupo",
  "Exercício prático",
  "Apresentação oral",
  "Leitura e produção escrita",
];
export const guideGoals = [
  "Realizar a tarefa com menos apoio",
  "Concluir mais etapas da atividade",
  "Aplicar a estratégia em uma nova tarefa",
];
export const guideEvidence: Record<string, string[]> = {
  not_assessed: [
    "Ainda não houve oportunidade de realizar uma tarefa comparável.",
    "O aluno esteve ausente no período de acompanhamento.",
  ],
  progress: [
    "Realizou a tarefa com menos lembretes que no registro anterior.",
    "Concluiu mais etapas, ainda com apoio do professor.",
    "Utilizou a estratégia em parte da atividade.",
  ],
  achieved: [
    "Concluiu a tarefa equivalente com autonomia.",
    "Aplicou a estratégia sem lembretes em uma nova atividade.",
  ],
  unchanged: [
    "Manteve a necessidade de apoio em uma tarefa equivalente.",
    "Ainda não utilizou a estratégia nas oportunidades observadas.",
  ],
  review: [
    "A estratégia utilizada não favoreceu a realização da tarefa observada.",
    "As condições da atividade mudaram e o apoio precisa ser ajustado.",
  ],
};
export function guidedPedagogyPlan(input: {
  scores: Record<string, number>;
  strategyIds: string[];
  context: string;
  level: number;
  goal: string;
  outcome: string;
  evidence: string;
}): SupportPlan {
  const observations = observationOptions.filter(
    (o) => (input.scores[o.id] || 0) > 0,
  );
  const strategies = strategyOptions.filter(
    (s) =>
      input.strategyIds.includes(s.id) &&
      observations.some((o) => o.strategyIds.includes(s.id)),
  );
  return {
    mode: "assisted",
    observation_scores: Object.fromEntries(
      observations.map((o) => [o.id, input.scores[o.id]]),
    ),
    strategy_ids: strategies.map((s) => s.id),
    context: input.context,
    baseline: `Autonomia observada: ${["", "apoio contínuo", "apoio frequente", "apoio em algumas etapas", "lembretes pontuais", "execução independente"][input.level] || "não informada"}.`,
    goal: input.goal,
    criteria: strategies.map((s) => s.measure).join(" "),
    outcome: outcomeLabels[input.outcome] ? input.outcome : "",
    evidence: (guideEvidence[input.outcome] || []).includes(input.evidence)
      ? input.evidence
      : "",
    sources: [...new Set(strategies.flatMap((s) => s.sources))],
    catalogue_version: CATALOGUE_VERSION,
  };
}
export function guidedPedagogyDraft(
  input: Parameters<typeof guidedPedagogyPlan>[0],
) {
  const plan = guidedPedagogyPlan(input);
  return { plan, ...pedagogyDraft(plan) };
}
export function guideFollowUp(reference: string, days: number) {
  if (!days) return "";
  const date = new Date(reference + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
