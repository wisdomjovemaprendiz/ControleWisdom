import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import { managementDashboard } from "../lib/management-dashboard";

test("painel calcula faltas e presença somente em chamadas finalizadas do período e unidade", () => {
  const store = schoolFixture();
  store.lessons[0].date = "2026-11-07";
  store.lessons.push(
    { ...store.lessons[0], id: "future", date: "2026-11-08" },
    { ...store.lessons[0], id: "draft", closed: false },
  );
  store.attendance.push(
    {
      ...store.attendance[0],
      id: "afuture",
      lesson_id: "future",
      status: "falta",
    },
    {
      ...store.attendance[0],
      id: "adraft",
      lesson_id: "draft",
      status: "falta",
    },
  );
  const data = managementDashboard(
    store,
    store.profiles[0],
    "u1",
    7,
    "2026-11-07",
  );
  assert.equal(data.absences.length, 1);
  assert.equal(data.marks.length, 7);
  assert.equal(data.frequency, 86);
  assert.equal(
    data.trend.reduce((n, r) => n + r.total, 0),
    data.marks.length,
  );
  assert.equal(data.absentStudents[0].student.id, "s3");
  assert.ok(data.students.every((s) => s.unit_id === "u1"));
});
test("cancelamentos sem data aparecem no cadastro sem inventar saídas no período", () => {
  const history = schoolFixture();
  Object.assign(history.students[0], {
    status: "cancelamento",
    archived_at: "2026-11-07T01:00:00Z",
    offboarding: { completed_at: "2026-11-07T01:00:00Z" },
  });
  Object.assign(history.students[1], { status: "cancelamento" });
  const store = {
    ...history,
    students: history.students.filter((s) => !s.archived_at),
  };
  const data = managementDashboard(
    store,
    store.profiles[0],
    "u1",
    7,
    "2026-11-06",
    history,
  );
  assert.equal(data.cancellations.length, 2);
  assert.equal(data.cancellationsInPeriod.length, 1);
  assert.ok(data.unknownDepartureDates >= 1);
  assert.ok(!data.active.some((s) => s.id === "s1"));
});
test("destaques exigem evidência suficiente e o professor só vê o próprio contexto", () => {
  const store = schoolFixture();
  store.lessons[0].date = "2026-11-07";
  assert.equal(
    managementDashboard(store, store.profiles[0], "u1", 7, "2026-11-07").leaders
      .length,
    0,
  );
  for (let i = 1; i <= 4; i++) {
    const id = `extra${i}`;
    store.lessons.push({ ...store.lessons[0], id, date: `2026-11-0${i}` });
    store.attendance.push({
      ...store.attendance[0],
      id: `mark${i}`,
      lesson_id: id,
      status: "presente",
    });
  }
  const data = managementDashboard(
    store,
    store.profiles[1],
    "all",
    7,
    "2026-11-07",
  );
  assert.equal(data.leaders[0].student.id, "s1");
  assert.equal(data.leaders[0].lessons, 5);
  assert.ok(data.classes.every((c) => c.teacher_id === store.profiles[1].id));
  assert.ok(data.students.every((s) => s.unit_id === "u1"));
  assert.ok(data.opportunities.every((r) => r.course.unit_id === "u1"));
});
test("cadastros pendentes não contam como novas matrículas e turmas fechadas não recebem indicação comercial", () => {
  const store = schoolFixture();
  Object.assign(store.students[0], {
    registration_stage: "pre_enrollment",
    enrollment_date: "2026-11-07",
  });
  store.classes[0].enrollment_open = false;
  const data = managementDashboard(
    store,
    store.profiles[0],
    "u1",
    7,
    "2026-11-07",
  );
  assert.ok(data.pendingEnrollments.some((s) => s.id === "s1"));
  assert.ok(!data.newEnrollments.some((s) => s.id === "s1"));
  assert.ok(!data.opportunities.some((r) => r.course.id === "c1"));
});

test("ocorrências positivas não viram alerta recorrente e alunos desligados não geram intervenção ativa", () => {
  const store = schoolFixture();
  store.lessons[0].date = "2026-11-07";
  store.lessons[1].date = "2026-11-06";
  store.occurrences = [
    {
      id: "pos1",
      lesson_id: "l1",
      student_id: "s1",
      unit_id: "u1",
      codes: ["collaboration"],
      notes: "Boa colaboração",
      author_id: "p2",
      author_name: "Ana",
    },
    {
      id: "pos2",
      lesson_id: "l2",
      student_id: "s1",
      unit_id: "u1",
      codes: ["collaboration"],
      notes: "Apoio aos colegas",
      author_id: "p2",
      author_name: "Ana",
    },
  ];
  const intervention = store.pedagogy.find((p) => p.student_id === "s3")!;
  intervention.follow_up = "2026-11-07";
  store.students.find((s) => s.id === "s3")!.status = "conclusao";
  const data = managementDashboard(
    store,
    store.profiles[0],
    "u1",
    7,
    "2026-11-07",
  );
  assert.equal(data.recurringOccurrences.length, 0);
  assert.ok(!data.interventions.some((r) => r.record.student_id === "s3"));
});
