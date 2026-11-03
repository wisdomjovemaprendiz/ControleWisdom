import test from "node:test";
import assert from "node:assert/strict";
import { operationalStore } from "../lib/records";
import { schoolFixture } from "./fixtures/school";
test("arquivamento da unidade oculta a operação sem apagar registros de origem", () => {
  const source = schoolFixture();
  const original = structuredClone(source);
  source.units[0].archived_at = "2026-11-03T10:00:00Z";
  const visible = operationalStore(source);
  assert.ok(!visible.units.some((u) => u.id === source.units[0].id));
  assert.ok(!visible.students.some((s) => s.unit_id === source.units[0].id));
  assert.ok(!visible.lessons.some((l) => l.unit_id === source.units[0].id));
  assert.equal(source.students.length, original.students.length);
  source.units[0].archived_at = null;
  assert.deepEqual(operationalStore(source).students, original.students);
});
test("arquivamento individual oculta contatos e presenças dependentes até restauração", () => {
  const source = schoolFixture();
  const student = source.students.find((s) =>
    source.attendance.some((a) => a.student_id === s.id),
  )!;
  student.archived_at = "2026-11-03T10:00:00Z";
  const visible = operationalStore(source);
  assert.ok(!visible.students.some((s) => s.id === student.id));
  assert.ok(!visible.attendance.some((a) => a.student_id === student.id));
  assert.ok(!visible.contacts.some((c) => c.student_id === student.id));
  assert.ok(source.attendance.some((a) => a.student_id === student.id));
});
