import test from "node:test";
import assert from "node:assert/strict";
import { demoStore } from "../lib/demo";
import { followUps, classLessons } from "../lib/operations";
import { today } from "../lib/domain";
test("fila de trabalho nunca inclui alunos de outra unidade para professor ou secretaria", () => {
  const data = demoStore();
  for (const profile of data.profiles.filter((p) => p.role !== "coordenacao")) {
    const tasks = followUps(data, profile);
    assert.ok(tasks.every((t) => t.student.unit_id === profile.unit_id));
  }
});
test("coordenação filtra todos os tipos de pendência pela unidade escolhida", () => {
  const data = demoStore(),
    profile = data.profiles[0];
  const tasks = followUps(data, profile, "u2");
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((t) => t.student.unit_id === "u2"));
  assert.equal(
    tasks.some((t) => t.student.id === "s3"),
    false,
  );
});
test("fila combina faltas e cadastro sem incluir matrícula arquivada", () => {
  const data = demoStore();
  const tasks = followUps(data, data.profiles[0]);
  assert.ok(tasks.some((t) => t.student.id === "s3" && t.kind === "absence"));
  assert.ok(tasks.some((t) => t.kind === "registration"));
  assert.ok(tasks.every((t) => t.student.status === "ativo"));
});
test("retorno vencido tem prioridade e retorno futuro não entra na fila", () => {
  const data = demoStore();
  data.contacts.push(
    {
      id: "contact1",
      unit_id: "u1",
      student_id: "s1",
      author_id: "p3",
      date: "2026-01-01",
      reason: "Falta",
      outcome: "Combinar retorno",
      next_contact: "2026-01-02",
    },
    {
      id: "contact2",
      unit_id: "u1",
      student_id: "s2",
      author_id: "p3",
      date: today(),
      reason: "Falta",
      outcome: "Aguardar",
      next_contact: "2099-01-01",
    },
  );
  const tasks = followUps(data, data.profiles[0]);
  assert.equal(tasks[0].id, "contact-contact1");
  assert.equal(
    tasks.some((t) => t.id === "contact-contact2"),
    false,
  );
});
test("diário retorna somente aulas da turma em ordem de data", () => {
  const data = demoStore();
  const lessons = classLessons(data, "c1");
  assert.equal(lessons.length, 3);
  assert.ok(lessons.every((l) => l.class_id === "c1"));
  assert.ok(lessons[0].date >= lessons[1].date);
  assert.deepEqual(classLessons(data, "c4"), []);
});

test("retornos na mesma data mantêm o prazo mais próximo sem ordenar UUID como horário", () => {
  const data = demoStore();
  data.contacts.push(
    {
      id: "a",
      unit_id: "u1",
      student_id: "s1",
      author_id: "p3",
      date: today(),
      reason: "Retorno",
      outcome: "Ligar hoje",
      next_contact: today(),
    },
    {
      id: "z",
      unit_id: "u1",
      student_id: "s1",
      author_id: "p3",
      date: today(),
      reason: "Outro contato",
      outcome: "Rever depois",
      next_contact: "2099-01-01",
    },
  );
  assert.ok(
    followUps(data, data.profiles[0]).some((t) => t.id === "contact-a"),
  );
});
