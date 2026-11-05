import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import {
  individualMinutes,
  canTeachIndividual,
  studentPlacement,
} from "../lib/individual";
import { operationalStore } from "../lib/records";
import {
  frequencyReportLines,
  attendanceMessage,
  frequency,
} from "../lib/domain";
import { followUps } from "../lib/operations";
test("individual mantém relatórios, alertas e horas sem criar turma artificial", () => {
  const store = schoolFixture(),
    s = store.students[0],
    prof = store.profiles.find(
      (p) => p.role === "professor" && p.unit_id === s.unit_id,
    )!;
  Object.assign(s, {
    class_id: null,
    enrollment_mode: "individual",
    individual_teacher_id: prof.id,
    name: "Aluno Particular",
  });
  store.attendance = store.attendance.filter((a) => a.student_id !== s.id);
  const l = {
    id: "individual-1",
    unit_id: s.unit_id,
    class_id: null,
    student_id: s.id,
    teacher_id: prof.id,
    teacher: prof.name,
    date: "2026-01-01",
    topic: "Organização",
    closed: true,
    duration_minutes: 60,
  };
  store.lessons.push(l);
  store.attendance.push({
    id: "mark-1",
    unit_id: s.unit_id,
    lesson_id: l.id,
    student_id: s.id,
    status: "falta",
  });
  assert.equal(
    operationalStore(store).lessons.some((x) => x.id === l.id),
    true,
  );
  assert.ok(
    frequencyReportLines(store, [l], s.unit_id, "individual").some(
      (line) =>
        line.includes("Aluno Particular | Aula individual") &&
        line.includes("Faltas: 1"),
    ),
  );
  assert.match(attendanceMessage(store, l), /Aula individual/);
  assert.match(attendanceMessage(store, l), /AUSENTES \(1\)/);
  assert.equal(frequency(store, s.id), 0);
  assert.equal(individualMinutes(store, s.id), 0);
  const secretary = store.profiles.find((p) => p.role === "secretaria")!;
  assert.ok(
    followUps(store, secretary).some(
      (x) => x.student.id === s.id && x.kind === "absence",
    ),
  );
  assert.ok(
    !followUps(store, secretary)
      .filter((x) => x.student.id === s.id && x.kind === "registration")
      .some((x) => x.detail.includes("turma")),
  );
  store.attendance.find((a) => a.id === "mark-1")!.status = "presente";
  assert.equal(individualMinutes(store, s.id), 60);
  assert.equal(canTeachIndividual(prof, s), true);
  assert.equal(
    canTeachIndividual({ ...prof, id: "outro-professor" }, s),
    false,
  );
  assert.equal(studentPlacement(store, s), "Aula individual");
});
