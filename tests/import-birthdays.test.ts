import test from "node:test";
import assert from "node:assert/strict";
import writeXlsxFile from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import { demoStore } from "../lib/demo";
import {
  previewStudents,
  parseBirthDate,
  importedStudent,
  type ImportCell,
} from "../lib/student-import";
import { birthdaysThisWeek } from "../lib/birthdays";
test("importação por nome e turma cria cadastro incompleto sem telefone fictício", () => {
  const s = demoStore();
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
  const s = demoStore();
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
  const s = demoStore();
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
  const s = demoStore();
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
  const s = demoStore();
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
  const s = demoStore();
  const student = { ...s.students[0], birth_date: "2008-02-29" };
  assert.equal(birthdaysThisWeek([student], "2026-02-28").length, 0);
  assert.equal(birthdaysThisWeek([student], "2028-02-29")[0].isToday, true);
});
