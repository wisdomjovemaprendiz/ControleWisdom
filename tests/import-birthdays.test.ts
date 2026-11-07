import test from "node:test";
import assert from "node:assert/strict";
import writeXlsxFile from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import { schoolFixture } from "./fixtures/school";
import {
  previewStudents,
  parseBirthDate,
  importedStudent,
  type ImportCell,
} from "../lib/student-import";
import { birthdaysThisWeek } from "../lib/birthdays";
test("importação por nome e turma cria cadastro incompleto sem telefone fictício", () => {
  const s = schoolFixture();
  const rows = previewStudents(
    [
      ["Nome", "Turma"],
      ["Nicolas Teste", "Informática • Turma 01"],
    ],
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
  );
  assert.equal(rows[0].status, "ready");
  const student = importedStudent(rows[0], s.profiles[0]);
  assert.equal(student.guardian_phone, "");
  assert.equal(student.birth_date, "");
  assert.equal(student.class_id, "c1");
  assert.equal(student.unit_id, "u1");
});
test("importação sinaliza repetidos, turma externa e data inválida sem salvar", () => {
  const s = schoolFixture();
  const rows = previewStudents(
    [
      ["Nome", "Turma", "Nascimento"],
      ["Gabriel Almeida", "Informática • Turma 01", ""],
      ["Novo Teste", "Informática • Turma 01", "31/02/2009"],
      ["Outro Teste", "Informática • Turma 04", ""],
      ["Novo Válido", "Informática • Turma 01", "14/05/2009"],
      ["Novo Válido", "Informática • Turma 01", ""],
    ],
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
  );
  assert.deepEqual(
    rows.map((r) => r.status),
    ["duplicate", "error", "error", "ready", "duplicate"],
  );
});
test("importação considera as vagas do lote e rejeita unidade sem acesso", () => {
  const s = schoolFixture();
  s.classes[0].capacity = 8;
  const data: ImportCell[][] = [
    ["Nome", "Turma"],
    ["Aluno Novo A", "c1"],
    ["Aluno Novo B", "c1"],
  ];
  const result = previewStudents(
    data,
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
  );
  assert.deepEqual(
    result.map((r) => r.status),
    ["ready", "error"],
  );
  assert.throws(
    () => previewStudents(data, s.classes, s.students, s.profiles[1], "u2"),
    /Sem acesso/,
  );
});
test("planilha .xlsx real preserva datas e cabeçalhos na leitura", async () => {
  const file = await writeXlsxFile([
    ["Nome", "Turma", "Data de nascimento"],
    [
      "Luísa Excel",
      "Informática • Turma 01",
      { value: new Date("2009-05-14T00:00:00Z"), format: "dd/mm/yyyy" },
    ],
  ]).toBuffer();
  const sheet = await readSheet(file);
  const s = schoolFixture();
  const data = sheet.map((row) =>
    row.map((value) =>
      value instanceof Date ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : null,
    ),
  );
  const rows = previewStudents(
    data,
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
  );
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[0].birthDate, "2009-05-14");
});
test("datas inválidas e futuras não viram aniversário; serial Excel é aceito", () => {
  assert.equal(parseBirthDate("14/05/2009"), "2009-05-14");
  assert.equal(parseBirthDate(39947), "2009-05-14");
  assert.throws(() => parseBirthDate("31/02/2009"));
  assert.throws(() => parseBirthDate("2099-01-01"));
});
test("aniversários respeitam semana segunda-domingo e virada do ano", () => {
  const s = schoolFixture();
  const students = [
    { ...s.students[0], birth_date: "2009-12-31" },
    { ...s.students[1], birth_date: "2009-01-01" },
    { ...s.students[2], birth_date: "2009-01-04" },
    { ...s.students[3], birth_date: "2009-01-05" },
    { ...s.students[4], birth_date: "2009-12-31", status: "abandono" as const },
  ];
  const rows = birthdaysThisWeek(students, "2026-01-01");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].date, "2025-12-31");
  assert.equal(rows[1].isToday, true);
  assert.equal(rows[2].date, "2026-01-04");
});
test("29 de fevereiro não é convertido automaticamente em outra data", () => {
  const s = schoolFixture();
  const student = { ...s.students[0], birth_date: "2008-02-29" };
  assert.equal(birthdaysThisWeek([student], "2026-02-28").length, 0);
  assert.equal(birthdaysThisWeek([student], "2028-02-29")[0].isToday, true);
});

test("lista colada aceita nomes do Word e turma comum sem cabeçalho", async () => {
  const { parsePastedStudents, detectImportColumns } =
    await import("../lib/student-import");
  const s = schoolFixture();
  const data = parsePastedStudents("1. Aluna  Nova\n• Aluno Novo\nAluno Novo");
  const config = detectImportColumns(data, s.classes);
  assert.equal(config.hasHeader, false);
  assert.deepEqual(config.columns, ["name"]);
  const rows = previewStudents(
    data,
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
    { ...config, classId: "c1" },
  );
  assert.deepEqual(
    rows.map((r) => r.status),
    ["ready", "ready", "duplicate"],
  );
  assert.equal(rows[0].name, "Aluna Nova");
});
test("colunas sem título reconhecem telefone e nascimento em ordens diferentes", async () => {
  const { parsePastedStudents, detectImportColumns } =
    await import("../lib/student-import");
  const s = schoolFixture();
  for (const text of [
    "Aluna Teste\t(71) 99999-1234\t14/05/2009",
    "14/05/2009\tAluna Teste\t71999991234",
    "Aluna Teste 14/05/2009 (71) 99999-1234",
    "Aluna Teste (71) 99999-1234 14/05/2009",
  ]) {
    const data = parsePastedStudents(text),
      config = detectImportColumns(data, s.classes);
    const rows = previewStudents(
      data,
      s.classes,
      s.students,
      s.profiles[0],
      "u1",
      { ...config, classId: "c1" },
    );
    assert.equal(rows[0].status, "ready", text);
    assert.equal(rows[0].name, "Aluna Teste");
    assert.equal(rows[0].phone, "71999991234");
    assert.equal(rows[0].birthDate, "2009-05-14");
    assert.equal(importedStudent(rows[0], s.profiles[0]).phone, "71999991234");
  }
});
test("cabeçalhos reconhecem contatos separados e a turma escolhida prevalece", async () => {
  const { parsePastedStudents, detectImportColumns } =
    await import("../lib/student-import");
  const s = schoolFixture();
  const data = parsePastedStudents(
    'Nome;Turma;Telefone;Responsável;Telefone do responsável;Nascimento\n"Ana; Maria";c2;71999991234;Paula Souza;71999994321;5/3/2009',
  );
  const config = detectImportColumns(data, s.classes);
  assert.equal(config.hasHeader, true);
  const rows = previewStudents(
    data,
    s.classes,
    s.students,
    s.profiles[0],
    "u1",
    { ...config, classId: "c1" },
  );
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[0].classId, "c1");
  assert.equal(rows[0].guardian, "Paula Souza");
  assert.equal(rows[0].guardianPhone, "71999994321");
  assert.equal(rows[0].birthDate, "2009-03-05");
  assert.equal(rows[0].name, "Ana; Maria");
});
test("limites e revisão impedem campos duplicados, datas erradas e turma de outra unidade", async () => {
  const { parsePastedStudents, detectImportColumns } =
    await import("../lib/student-import");
  const s = schoolFixture(),
    data = parsePastedStudents("Aluno Novo\t31/02/2009\t71999991234");
  const config = detectImportColumns(data, s.classes);
  assert.equal(
    previewStudents(data, s.classes, s.students, s.profiles[0], "u1", {
      ...config,
      classId: "c1",
    })[0].status,
    "error",
  );
  assert.equal(
    previewStudents(data, s.classes, s.students, s.profiles[0], "u1", {
      ...config,
      classId: "c4",
    })[0].status,
    "error",
  );
  assert.throws(
    () =>
      previewStudents(data, s.classes, s.students, s.profiles[0], "u1", {
        columns: ["name", "phone", "phone"],
        hasHeader: false,
        classId: "c1",
      }),
    /apenas uma coluna/,
  );
  const many = Array.from({ length: 501 }, (_, i) => ["Aluno " + i]);
  assert.throws(
    () =>
      previewStudents(many, s.classes, s.students, s.profiles[0], "u1", {
        columns: ["name"],
        hasHeader: false,
        classId: "c1",
      }),
    /500 alunos/,
  );
  assert.throws(
    () => parsePastedStudents('Nome;Telefone\n"Nome aberto;71999991234'),
    /aspas/,
  );
});
