import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import {
  classSalesRows,
  groupInvitation,
  validGroupLink,
  canEditStudent,
  needsAbsenceOutreach,
} from "../lib/sales";
import { followUps } from "../lib/operations";
import { pendingPedagogy } from "../lib/pedagogy";
const seller = {
  id: "sales",
  name: "Comercial",
  role: "comercial" as const,
  unit_id: "u1",
  active: true,
  must_change_password: false,
};
test("oportunidades comerciais respeitam unidade, prioridade e reserva de vagas", () => {
  const s = schoolFixture();
  s.classes[0].enrollment_priority = 2;
  s.classes[1].enrollment_priority = 1;
  s.classes[1].enrollment_open = false;
  const rows = classSalesRows(s, seller);
  assert.ok(rows.every((r) => r.course.unit_id === "u1"));
  assert.equal(rows[0].course.id, s.classes[1].id);
  assert.equal(rows[0].open, false);
  for (const r of rows)
    assert.equal(
      r.vacancies,
      Math.max(
        0,
        r.course.capacity -
          s.students.filter(
            (st) => st.class_id === r.course.id && st.status === "ativo",
          ).length,
      ),
    );
});
test("convites possuem mensagens diferentes e links de grupo seguros", () => {
  const s = schoolFixture(),
    c = {
      ...s.classes[0],
      whatsapp: "https://chat.whatsapp.com/ValidInvite123456",
    };
  assert.equal(validGroupLink(c.whatsapp), true);
  assert.equal(validGroupLink("javascript:alert(1)"), false);
  assert.equal(
    validGroupLink("https://evil.test/chat.whatsapp.com/abc"),
    false,
  );
  assert.equal(
    validGroupLink("https://chat.whatsapp.com.evil.test/abcdefghi"),
    false,
  );
  assert.match(
    groupInvitation(s.students[0], c, "student"),
    /interagir com seus colegas/,
  );
  assert.match(
    groupInvitation(s.students[0], c, "guardian"),
    /frequência e a evolução/,
  );
});
test("pré-matrícula gera alerta para secretaria e comercial não acessa pendências pedagógicas", () => {
  const s = schoolFixture(),
    student = {
      ...s.students[0],
      created_by: seller.id,
      registration_stage: "pre_enrollment" as const,
    };
  s.students[0] = student;
  assert.equal(canEditStudent(seller, student), true);
  assert.equal(
    canEditStudent(seller, { ...student, registration_stage: "complete" }),
    false,
  );
  assert.equal(
    canEditStudent(seller, { ...student, created_by: "other" }),
    false,
  );
  assert.ok(
    followUps(
      s,
      s.profiles.find((p) => p.role === "secretaria")!,
    ).some((t) => t.kind === "enrollment" && t.student.id === student.id),
  );
  assert.equal(pendingPedagogy(s, seller).length, 0);
  assert.ok(
    !followUps(s, seller).some(
      (t) => t.kind === "pedagogy" || t.kind === "registration",
    ),
  );
  assert.equal(canEditStudent(seller, { ...student, unit_id: "u2" }), false);
});
test("uma única falta não gera alerta para comercial nem secretaria", () => {
  const s = schoolFixture(),
    st = s.students[0];
  s.attendance = [];
  s.lessons = [{ ...s.lessons[0], id: "latest", date: "2026-11-05" }];
  s.attendance.push({
    id: "mark",
    lesson_id: "latest",
    unit_id: st.unit_id,
    student_id: st.id,
    status: "falta",
  });
  assert.equal(needsAbsenceOutreach(s, st), false);
  assert.ok(
    !followUps(s, seller).some(
      (t) => t.kind === "absence" && t.student.id === st.id,
    ),
  );
});
