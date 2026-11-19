import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import { courseReviewState } from "../lib/course-alerts";
import { followUps } from "../lib/operations";
import { today } from "../lib/domain";
test("análise registra excedente daquele momento; novas horas e nova etapa do prazo voltam a alertar", () => {
  const store = schoolFixture(),
    s = store.students[0],
    offering = store.offerings.find((o) => o.id === s.offering_id)!;
  offering.total_hours = 128;
  s.opening_hours = 178;
  s.course_start_date = "2026-01-01";
  s.last_installment_date = "2026-12-01";
  store.attendance = [];
  let r = courseReviewState(store, s, "2026-11-19");
  assert.equal(r.active, true);
  assert.equal(r.messages.length, 2);
  const p = r.progress;
  store.contacts.push({
    id: "review",
    unit_id: s.unit_id,
    student_id: s.id,
    author_id: "p2",
    date: "2026-11-19",
    reason: "Análise",
    outcome: "Reposição autorizada",
    next_contact: "",
    course_review: {
      offering_id: p.offeringId,
      contracted_hours: p.totalHours,
      completed_hours: p.completedHours,
      deadline: p.lastInstallment,
      deadline_state: p.deadlineState,
      start_date: p.startDate,
    },
  });
  assert.equal(courseReviewState(store, s, "2026-11-19").active, false);
  s.opening_hours = 180;
  assert.ok(
    courseReviewState(store, s, "2026-11-20").messages.some((message) =>
      message.includes("52 h"),
    ),
  );
  s.opening_hours = 178;
  assert.ok(
    courseReviewState(store, s, "2026-12-01").messages.some((message) =>
      message.includes("termina hoje"),
    ),
  );
  assert.ok(
    courseReviewState(store, s, "2026-12-02").messages.some((message) =>
      message.includes("encerrado"),
    ),
  );
  s.status = "conclusao";
  assert.equal(courseReviewState(store, s, "2026-12-02").active, false);
});
test("carga exata gera análise de conclusão e alertas da central respeitam o perfil", () => {
  const store = schoolFixture(),
    s = store.students[0],
    offering = store.offerings.find((o) => o.id === s.offering_id)!;
  offering.total_hours = 128;
  s.opening_hours = 128;
  store.attendance = [];
  assert.ok(
    courseReviewState(store, s).messages.some((message) =>
      message.includes("avaliar conclusão"),
    ),
  );
  assert.ok(
    followUps(store, store.profiles[0]).some(
      (task) => task.kind === "course" && task.student.id === s.id,
    ),
  );
  const seller = { ...store.profiles[0], role: "comercial" as const };
  assert.ok(!followUps(store, seller).some((task) => task.kind === "course"));
});
