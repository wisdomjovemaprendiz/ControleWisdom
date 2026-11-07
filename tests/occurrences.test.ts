import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import {
  studentOccurrences,
  naturalName,
  studentChatUrl,
} from "../lib/occurrences";
import { attendanceMessage, evolutionMessage } from "../lib/domain";
import { occupancyInfo } from "../lib/class-appearance";
test("ocorrências individuais e contexto coletivo seguem o histórico sem vazar ao grupo", () => {
  const store = schoolFixture();
  store.occurrences = [
    {
      id: "o1",
      unit_id: "u1",
      lesson_id: "l1",
      student_id: null,
      codes: ["talk"],
      notes: "Retomar combinados",
      author_id: "p2",
      author_name: "Ana",
    },
    {
      id: "o2",
      unit_id: "u1",
      lesson_id: "l1",
      student_id: "s1",
      codes: ["phone"],
      notes: "Orientação privada",
      author_id: "p2",
      author_name: "Ana",
    },
    {
      id: "o3",
      unit_id: "u1",
      lesson_id: "l1",
      student_id: "s2",
      codes: ["task"],
      notes: "Outro aluno",
      author_id: "p2",
      author_name: "Ana",
    },
  ];
  assert.equal(studentOccurrences(store, "s1").length, 2);
  assert.equal(studentOccurrences(store, "s3").length, 0); // Absent: collective context is not assigned.
  store.students[0].class_id = "c2";
  assert.equal(studentOccurrences(store, "s1").length, 2);
  assert.match(
    evolutionMessage(store, store.students[0]),
    /Orientação privada/,
  );
  assert.doesNotMatch(
    evolutionMessage(store, store.students[0]),
    /Outro aluno/,
  );
  assert.doesNotMatch(
    attendanceMessage(store, store.lessons[0]),
    /Orientação privada|Retomar combinados|Uso excessivo/,
  );
});
test("ordenação natural, WhatsApp brasileiro e ocupação verde quando lotada", () => {
  assert.deepEqual(["Turma 10", "Turma 2", "Turma 1"].sort(naturalName), [
    "Turma 1",
    "Turma 2",
    "Turma 10",
  ]);
  assert.equal(
    studentChatUrl("(71) 99999-1234"),
    "https://web.whatsapp.com/send?phone=5571999991234",
  );
  assert.equal(
    studentChatUrl("+55 71 99999-1234"),
    "https://web.whatsapp.com/send?phone=5571999991234",
  );
  assert.equal(occupancyInfo(20, 20).color, "#218361");
  assert.equal(occupancyInfo(0, 20).color, "#C43B43");
});
