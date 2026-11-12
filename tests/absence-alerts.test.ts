import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import { absenceAlert } from "../lib/absence-alerts";
import type { AttendanceStatus } from "../lib/domain";

function scenario(
  statuses: (AttendanceStatus | undefined)[],
  dates?: string[],
) {
  const store = schoolFixture(),
    student = store.students[0];
  const base = store.lessons[0];
  store.lessons = statuses.map((_, index) => ({
    ...base,
    id: `lesson-${index}`,
    date: dates?.[index] || `2026-11-${String(index + 1).padStart(2, "0")}`,
    closed: true,
  }));
  store.attendance = statuses.flatMap((status, index) =>
    status
      ? [
          {
            id: `mark-${index}`,
            unit_id: student.unit_id,
            lesson_id: `lesson-${index}`,
            student_id: student.id,
            status,
          },
        ]
      : [],
  );
  return { store, student };
}

test("alerta exige duas faltas consecutivas atuais ou mais de três faltas no mês", () => {
  for (const [statuses, expected] of [
    [["falta"], false],
    [["falta", "falta"], true],
    [["falta", "presente", "falta"], false],
    [["falta", "presente", "falta", "presente", "falta"], false],
    [
      [
        "falta",
        "presente",
        "falta",
        "presente",
        "falta",
        "presente",
        "falta",
        "presente",
      ],
      true,
    ],
    [["falta", "falta", "presente"], false],
    [["falta", "atrasado", "falta"], false],
    [["falta", "justificado", "falta"], false],
    [["falta", undefined, "falta"], false],
  ] as [(AttendanceStatus | undefined)[], boolean][]) {
    const { store, student } = scenario(statuses);
    assert.equal(
      absenceAlert(store, student, "2026-11-30").active,
      expected,
      JSON.stringify(statuses),
    );
  }
});

test("contagem mensal não soma meses diferentes; sequência pode atravessar o mês", () => {
  const { store, student } = scenario(
    ["falta", "presente", "falta", "presente", "falta", "presente", "falta"],
    [
      "2026-10-01",
      "2026-10-05",
      "2026-10-10",
      "2026-10-15",
      "2026-11-01",
      "2026-11-05",
      "2026-11-10",
    ],
  );
  const alert = absenceAlert(store, student, "2026-11-30");
  assert.equal(alert.monthly, 2);
  assert.equal(alert.active, false);
  const cross = scenario(["falta", "falta"], ["2026-10-31", "2026-11-01"]);
  assert.equal(
    absenceAlert(cross.store, cross.student, "2026-11-02").active,
    true,
  );
});

test("futuro, aulas abertas e registros arquivados não compõem o alerta", () => {
  for (const kind of ["future", "open", "lesson-archived", "mark-archived"]) {
    const { store, student } = scenario(["falta", "falta"]);
    if (kind === "future") store.lessons[1].date = "2026-12-01";
    if (kind === "open") store.lessons[1].closed = false;
    if (kind === "lesson-archived")
      store.lessons[1].archived_at = "2026-11-02T12:00:00Z";
    if (kind === "mark-archived")
      store.attendance[1].archived_at = "2026-11-02T12:00:00Z";
    assert.equal(
      absenceAlert(store, student, "2026-11-30").active,
      false,
      kind,
    );
  }
  const { store, student } = scenario(["falta", "falta"]);
  student.status = "cancelamento";
  assert.equal(absenceAlert(store, student, "2026-11-30").active, false);
  student.status = "ativo";
  student.archived_at = "2026-11-02T12:00:00Z";
  assert.equal(absenceAlert(store, student, "2026-11-30").active, false);
});

test("aula individual considera somente a agenda do próprio aluno e não duplica marcações", () => {
  const { store, student } = scenario(["falta", "falta"]);
  student.enrollment_mode = "individual";
  student.class_id = null;
  store.lessons.forEach((lesson) => {
    lesson.class_id = null;
    lesson.student_id = student.id;
  });
  store.lessons.push({
    ...store.lessons[1],
    id: "other",
    student_id: "s2",
    date: "2026-11-03",
  });
  store.attendance.push({ ...store.attendance[1], id: "duplicate" });
  const alert = absenceAlert(store, student, "2026-11-30");
  assert.equal(alert.consecutive, 2);
  assert.equal(alert.monthly, 2);
  assert.equal(alert.active, true);
});
