import test from "node:test";
import assert from "node:assert/strict";
import { demoStore } from "../lib/demo";
import {
  canAccess,
  absenceCount,
  frequency,
  attendanceMessage,
  evolutionMessage,
  validateStudent,
  whatsappUrl,
} from "../lib/domain";
test("professor e secretaria só acessam a própria unidade; coordenação acessa todas", () => {
  const store = demoStore();
  for (const profile of store.profiles) {
    assert.equal(
      canAccess(profile, "u1"),
      profile.role === "coordenacao" || profile.unit_id === "u1",
    );
    assert.equal(
      canAccess(profile, "u2"),
      profile.role === "coordenacao" || profile.unit_id === "u2",
    );
  }
});
test("faltas e frequência tratam atraso como presença e excluem justificativas", () => {
  const s = demoStore();
  assert.equal(absenceCount(s, "s3"), 3);
  assert.equal(frequency(s, "s3"), 0);
  assert.equal(frequency(s, "s5"), 100);
  assert.equal(frequency(s, "s16"), null);
  s.attendance.push({
    id: "x",
    unit_id: "u1",
    lesson_id: "l2",
    student_id: "s5",
    status: "justificado",
  });
  assert.equal(frequency(s, "s5"), 100);
});
test("resumo inclui conteúdo, professor e situações da chamada correta", () => {
  const s = demoStore(),
    message = attendanceMessage(s, s.lessons[0]);
  assert.match(message, /Planilhas/);
  assert.match(message, /Ana Oliveira/);
  assert.doesNotMatch(message, /Lucas Ferreira/);
  assert.match(message, /Pedro Henrique — Atrasado/);
  assert.match(message, /Maria Eduarda — Presente/);
  assert.doesNotMatch(message, /Maria Eduarda Lima/);
  assert.match(message, /\*WISDOM CURSOS\*/);
  assert.doesNotMatch(message, /Valentina Ribeiro/);
});
test("evolução individual não mistura registros de outros alunos", () => {
  const s = demoStore(),
    message = evolutionMessage(s, s.students[0]);
  assert.match(message, /Resolve fórmulas/);
  assert.doesNotMatch(message, /As faltas estão/);
});
test("matrícula expressa exige aluno, turma e contato do responsável", () => {
  assert.ok(validateStudent({}));
  assert.ok(validateStudent({ name: "Ana", class_id: "c1" }));
  assert.equal(
    validateStudent({
      name: "Ana",
      class_id: "c1",
      guardian_phone: "5511999999999",
    }),
    null,
  );
});
test("WhatsApp higieniza telefone e codifica o texto revisado", () => {
  assert.equal(
    whatsappUrl("+55 (11) 99999-9999", "Olá & pais"),
    "https://wa.me/5511999999999?text=Ol%C3%A1%20%26%20pais",
  );
});
