import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import {
  courseProgress,
  scheduleDays,
  nthClassDate,
} from "../lib/course-progress";
import type { AttendanceStatus, Store } from "../lib/domain";
function setup() {
  const store = schoolFixture(),
    s = store.students[0],
    c = store.classes.find((c) => c.id === s.class_id)!,
    o = store.offerings.find((o) => o.unit_id === s.unit_id)!;
  Object.assign(o, { total_hours: 200 });
  Object.assign(c, {
    offering_id: o.id,
    lesson_duration_minutes: 120,
    lesson_days: [2, 4],
  });
  Object.assign(s, {
    offering_id: o.id,
    course_start_date: "2026-11-03",
    last_installment_date: "2027-05-01",
  });
  store.attendance = [];
  store.lessons = [];
  return { store, s, c, o };
}
function call(
  store: Store,
  s: Store["students"][number],
  id: string,
  date: string,
  status: AttendanceStatus,
  minutes = 120,
  course = s.offering_id,
) {
  store.lessons.push({
    id,
    unit_id: s.unit_id,
    class_id: s.class_id,
    student_id: null,
    date,
    teacher_id: "p2",
    teacher: "Prof",
    topic: "Conteúdo",
    closed: true,
    duration_minutes: minutes,
  });
  store.attendance.push({
    id: "a" + id,
    unit_id: s.unit_id,
    lesson_id: id,
    student_id: s.id,
    status,
    course_offering_id: course,
  });
}
test("200 horas e aulas de duas horas: cada presença soma 1%, sem contar a falta", () => {
  const { store, s } = setup();
  call(store, s, "l1", "2026-11-03", "presente");
  let p = courseProgress(store, s, "2026-11-03");
  assert.equal(p.completedHours, 2);
  assert.equal(p.remainingHours, 198);
  assert.equal(p.percent, 1);
  call(store, s, "l2", "2026-11-05", "falta");
  p = courseProgress(store, s, "2026-11-05");
  assert.equal(p.completedHours, 2);
  assert.equal(p.percent, 1);
  assert.ok(
    p.estimatedEnd! >
      courseProgress(
        {
          ...store,
          attendance: store.attendance.filter((a) => a.lesson_id !== "l2"),
          lessons: store.lessons.filter((l) => l.id !== "l2"),
        },
        s,
        "2026-11-03",
      ).estimatedEnd!,
  );
});
test("atraso soma aula, justificativa não soma, correção e duplicata não duplicam horas", () => {
  const { store, s } = setup();
  call(store, s, "l1", "2026-11-03", "atrasado");
  call(store, s, "l2", "2026-11-05", "justificado");
  store.attendance.push({ ...store.attendance[0], id: "duplicata" });
  assert.equal(courseProgress(store, s, "2026-11-05").completedHours, 2);
  store.attendance[0].status = "presente";
  assert.equal(courseProgress(store, s, "2026-11-05").completedHours, 2);
});
test("previsão ajusta assiduidade sem contar dias sem chamada como faltas", () => {
  const { store, s } = setup();
  for (const [i, date] of [
    "2026-11-03",
    "2026-11-05",
    "2026-11-10",
    "2026-11-12",
  ].entries())
    call(store, s, "l" + i, date, i === 1 ? "falta" : "presente");
  const p = courseProgress(store, s, "2026-11-12");
  assert.equal(p.observedRate, 0.75);
  assert.equal(p.usesAttendance, true);
  assert.equal(p.recordedCalls, 4);
  const perfect = structuredClone(store);
  perfect.attendance.forEach((a) => (a.status = "presente"));
  assert.ok(
    p.estimatedEnd! > courseProgress(perfect, s, "2026-11-12").estimatedEnd!,
  );
});
test("datas de início, horas anteriores e exclusões delimitam o progresso", () => {
  const { store, s } = setup();
  s.opening_hours = 20;
  call(store, s, "old", "2026-11-01", "presente");
  call(store, s, "valid", "2026-11-03", "presente");
  call(store, s, "future", "2026-11-10", "presente");
  call(store, s, "archived", "2026-11-05", "presente");
  store.lessons.find((l) => l.id === "archived")!.archived_at =
    "2026-11-05T12:00:00Z";
  assert.equal(courseProgress(store, s, "2026-11-05").completedHours, 22);
});
test("a carga da chamada é histórica e a troca de curso separa os créditos", () => {
  const { store, s, c, o } = setup();
  call(store, s, "old", "2026-11-03", "presente", 120);
  c.lesson_duration_minutes = 180;
  assert.equal(courseProgress(store, s, "2026-11-03").completedHours, 2);
  const other = store.offerings.find(
    (x) => x.id !== o.id && x.unit_id === s.unit_id,
  )!;
  other.total_hours = 100;
  s.offering_id = other.id;
  assert.equal(courseProgress(store, s, "2026-11-03").completedHours, 0);
});
test("boleto orienta a previsão sem agenda e não gera progresso sozinho", () => {
  const { store, s, c } = setup();
  c.lesson_days = [];
  c.schedule = "A combinar";
  s.course_start_date = "2026-11-01";
  s.last_installment_date = "2027-01-01";
  const p = courseProgress(store, s, "2026-11-01");
  assert.equal(p.estimatedEnd, "2027-01-01");
  assert.equal(p.estimateBasis, "billing");
  assert.equal(p.completedHours, 0);
  assert.equal(p.percent, 0);
  s.last_installment_date = "2026-10-01";
  assert.equal(courseProgress(store, s, "2026-11-01").estimatedEnd, null);
});
test("100% não altera matrícula e falta de dados não inventa previsão", () => {
  const { store, s, o, c } = setup();
  o.total_hours = 2;
  call(store, s, "l", "2026-11-03", "presente");
  const p = courseProgress(store, s, "2026-11-03");
  assert.equal(p.percent, 100);
  assert.equal(p.completed, true);
  assert.equal(p.estimatedEnd, null);
  assert.equal(s.status, "ativo");
  o.total_hours = null;
  c.lesson_duration_minutes = null;
  const unknown = courseProgress(store, s, "2026-11-03");
  assert.equal(unknown.percent, null);
  assert.equal(unknown.estimatedEnd, null);
});
test("dias estruturados e horários escritos funcionam sem depender do fuso do navegador", () => {
  assert.deepEqual(scheduleDays("Terça e Quinta às 14h"), [2, 4]);
  assert.deepEqual(scheduleDays("Seg e Qua • 14h às 16h"), [1, 3]);
  assert.deepEqual(scheduleDays("Seg a Sex"), [1, 2, 3, 4, 5]);
  assert.equal(nthClassDate("2026-11-03", 4, [2, 4]), "2026-11-12");
});
test("arredondamento da exibição não cria aula extra nem antecipa 100%", () => {
  const { store, s, o, c } = setup();
  o.total_hours = 1;
  c.lesson_duration_minutes = 5;
  call(store, s, "l", "2026-11-03", "presente", 5);
  let p = courseProgress(store, s, "2026-11-03");
  assert.equal(p.remainingLessons, 11);
  store.lessons = [];
  store.attendance = [];
  o.total_hours = 1000;
  s.opening_hours = 999.75;
  p = courseProgress(store, s, "2026-11-03");
  assert.equal(p.percent, 99.9);
  assert.equal(p.completed, false);
  assert.equal(p.remainingHours, 0.25);
});
