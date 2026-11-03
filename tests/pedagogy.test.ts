import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import {
  suggestPedagogy,
  pedagogyDraft,
  pendingPedagogy,
  strategyOptions,
  observationOptions,
  pedagogySources,
  CATALOGUE_VERSION,
} from "../lib/pedagogy";
import type { SupportPlan } from "../lib/domain";
import {
  frequencyReportLines,
  attendanceMessage,
  shortStudentName,
} from "../lib/domain";
import { photoCropGeometry } from "../lib/photos";
const emptyPlan: SupportPlan = {
  mode: "assisted",
  observation_scores: {},
  strategy_ids: [],
  context: "",
  baseline: "",
  goal: "",
  criteria: "",
  outcome: "",
  evidence: "",
  sources: [],
  catalogue_version: CATALOGUE_VERSION,
};
test("catálogo relaciona observações verificáveis e intervenções com fontes rastreáveis", () => {
  const sources = new Set(pedagogySources.map((s) => s.id));
  for (const option of observationOptions) {
    assert.ok(
      option.related.every((id) => observationOptions.some((o) => o.id === id)),
    );
    assert.ok(
      option.strategyIds.every((id) =>
        strategyOptions.some((s) => s.id === id),
      ),
    );
  }
  for (const strategy of strategyOptions) {
    assert.ok(strategy.sources.length);
    assert.ok(strategy.sources.every((id) => sources.has(id as never)));
    assert.ok(strategy.measure && strategy.rationale && strategy.steps);
  }
  const result = suggestPedagogy({ attention_start: 3, steps_lost: 2 });
  assert.equal(result.strategies[0].id, "chunk_steps");
  assert.ok(result.observations.some((o) => o.id === "task_planning"));
  assert.equal(suggestPedagogy({}).strategies.length, 0);
  assert.ok(
    suggestPedagogy({}, "Muito distraído, não mantém foco").observations.some(
      (o) => o.id === "attention_start",
    ),
  );
});
test("rascunho só usa observações e resultados informados sem inventar melhora", () => {
  const original = structuredClone(emptyPlan);
  const draft = pedagogyDraft({
    ...original,
    observation_scores: { reading_instructions: 2 },
    strategy_ids: ["read_restate"],
    baseline: "Pede ajuda em três de quatro enunciados.",
    goal: "Reformular o enunciado com apoio reduzido.",
  });
  assert.match(draft.notes, /Frequente/);
  assert.match(draft.notes, /três de quatro/);
  assert.ok(!/melhorou|superou|atingiu/.test(draft.notes));
  assert.ok(draft.sources.includes("wwc"));
  const follow = pedagogyDraft({
    ...emptyPlan,
    outcome: "unchanged",
    evidence: "Continuou pedindo o mesmo número de apoios.",
  });
  assert.match(follow.notes, /Sem mudança observável/);
  assert.match(follow.notes, /mesmo número/);
  assert.deepEqual(original, emptyPlan);
});
test("agenda mantém todas as intervenções pendentes e conclui apenas o registro vinculado", () => {
  const store = schoolFixture(),
    base = store.pedagogy[0];
  store.pedagogy = [
    { ...base, id: "plan1", follow_up: "2026-11-03" },
    { ...base, id: "plan2", follow_up: "2026-11-02" },
    { ...base, id: "plan3", follow_up: "2026-11-05" },
  ];
  const actor = store.profiles[0];
  let pending = pendingPedagogy(store, actor, "all", "2026-11-03");
  assert.deepEqual(
    pending.map((i) => i.state),
    ["overdue", "today", "upcoming"],
  );
  store.pedagogy.push({
    ...base,
    id: "outcome1",
    parent_record_id: "plan1",
    kind: "Evolução",
    follow_up: "",
  });
  pending = pendingPedagogy(store, actor, "all", "2026-11-03");
  assert.ok(!pending.some((i) => i.record.id === "plan1"));
  assert.ok(pending.some((i) => i.record.id === "plan2"));
  store.pedagogy.at(-1)!.archived_at = "2026-11-03T12:00:00Z";
  assert.ok(
    pendingPedagogy(store, actor, "all", "2026-11-03").some(
      (i) => i.record.id === "plan1",
    ),
  );
  const teacher = { ...store.profiles[1], unit_id: "outside" };
  assert.equal(pendingPedagogy(store, teacher, "all", "2026-11-03").length, 0);
});
test("enquadramento permite zoom menor, maior e reposicionamento sem mudar a proporção", () => {
  const normal = photoCropGeometry(1000, 2000, 512, { zoom: 1, x: 0, y: 0 });
  assert.equal(normal.width, 512);
  assert.equal(normal.height, 1024);
  const small = photoCropGeometry(1000, 2000, 512, { zoom: 0.5, x: 0, y: 0 });
  assert.equal(small.width, 256);
  assert.equal(small.height, 512);
  const zoomed = photoCropGeometry(1000, 2000, 512, {
    zoom: 2,
    x: 0.2,
    y: 0.3,
  });
  assert.equal(zoomed.width, 1024);
  assert.ok(
    zoomed.x > photoCropGeometry(1000, 2000, 512, { zoom: 2, x: 0, y: 0 }).x,
  );
});

test("relatórios incluem ausentes, justificadas e alunos sem presença no período", () => {
  const store = schoolFixture(),
    lesson = store.lessons[0];
  const message = attendanceMessage(store, lesson);
  const marks = store.attendance.filter((a) => a.lesson_id === lesson.id);
  for (const mark of marks) {
    const student = store.students.find((s) => s.id === mark.student_id)!;
    assert.ok(message.includes(shortStudentName(student.name)));
  }
  assert.match(message, /AUSENTES/);
  assert.match(message, /FALTAS JUSTIFICADAS/);
  const rows = frequencyReportLines(store, store.lessons, "all");
  for (const student of store.students)
    assert.ok(rows.some((row) => row.startsWith(student.name + " |")));
  const filtered = frequencyReportLines(
    store,
    store.lessons.filter((l) => l.class_id === "c1"),
    "u1",
    "c1",
  );
  assert.ok(filtered.every((row) => !row.includes("Unidade Vila")));
  assert.ok(filtered.some((row) => row.includes("Faltas: 3")));
});

test("horário e justificativa opcionais aparecem nos resumos sem inventar dados", () => {
  const store = schoolFixture(),
    lesson = store.lessons[0],
    rows = store.attendance.filter((a) => a.lesson_id === lesson.id);
  rows[0].status = "atrasado";
  rows[0].arrival_time = "14:25";
  rows[1].status = "justificado";
  rows[1].justification = "Consulta médica";
  let message = attendanceMessage(store, lesson);
  assert.match(message, /Chegada: 14:25/);
  assert.match(message, /Motivo: Consulta médica/);
  rows[0].arrival_time = "";
  rows[1].justification = "";
  message = attendanceMessage(store, lesson);
  assert.doesNotMatch(message, /Chegada:/);
  assert.doesNotMatch(message, /Motivo:/);
});
