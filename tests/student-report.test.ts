import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { schoolFixture } from "./fixtures/school";
import { studentReport } from "../lib/student-report";
import { createStudentReportPdf } from "../lib/student-report-pdf";

function setup() {
  const store = schoolFixture(),
    student = store.students[0];
  store.lessons[0].date = "2026-11-14";
  student.course_start_date = "2026-10-01";
  student.last_installment_date = "2027-07-10";
  student.address = "Endereço interno";
  store.contacts.push({
    id: "contact-private",
    unit_id: student.unit_id,
    student_id: student.id,
    author_id: "p3",
    date: "2026-11-13",
    reason: "Tratativa administrativa",
    outcome: "Anotação privada da secretaria",
    next_contact: "2026-11-20",
  });
  store.occurrences.push(
    {
      id: "personal",
      lesson_id: "l1",
      unit_id: student.unit_id,
      student_id: student.id,
      codes: ["phone"],
      notes: "Detalhe interno da ocorrência",
      author_id: "p2",
      author_name: "Docente",
    },
    {
      id: "class",
      lesson_id: "l1",
      unit_id: student.unit_id,
      student_id: null,
      codes: ["talk"],
      notes: "Contexto coletivo interno",
      author_id: "p2",
      author_name: "Docente",
    },
  );
  return { store, student };
}
test("ficha interna reúne dados acadêmicos, contatos, ocorrências e encaminhamentos", () => {
  const { store, student } = setup();
  const report = studentReport(store, student, "internal", "2026-11-14");
  const text = JSON.stringify(report);
  for (const expected of [
    "Endereço interno",
    "Anotação privada da secretaria",
    "Detalhe interno da ocorrência",
    "Contexto coletivo interno",
    "10/07/2027",
    "Histórico de aulas e presença",
    "Resolve fórmulas com autonomia",
  ]) {
    assert.ok(text.includes(expected), expected);
  }
  assert.match(
    report.filename,
    /Gabriel-Almeida-ficha-interna-2026-11-14\.pdf/,
  );
  assert.equal(
    report.metrics.find((metric) => metric.label === "Faltas registradas")
      ?.value,
    "0",
  );
});
test("ficha familiar mantém evolução e intervenção sem dados administrativos privados", () => {
  const { store, student } = setup();
  const report = studentReport(store, student, "family", "2026-11-14");
  const text = JSON.stringify(report);
  for (const hidden of [
    "Endereço interno",
    "Anotação privada da secretaria",
    "Tratativa administrativa",
    "Detalhe interno da ocorrência",
    "Contexto coletivo interno",
    "10/07/2027",
    "Contatos e encaminhamentos",
    "Nível registrado",
  ])
    assert.ok(!text.includes(hidden), hidden);
  for (const expected of [
    "Patrícia Almeida",
    "Resolve fórmulas com autonomia",
    "Uso excessivo do celular",
    "Como a família pode acompanhar",
  ])
    assert.ok(text.includes(expected), expected);
  assert.match(
    report.filename,
    /Gabriel-Almeida-acompanhamento-familia-2026-11-14\.pdf/,
  );
});
test("relatório não mistura alunos, não inventa evolução e ignora chamadas abertas e futuras", () => {
  const { store, student } = setup();
  store.pedagogy = store.pedagogy.filter(
    (record) => record.student_id !== student.id,
  );
  store.lessons.push(
    { ...store.lessons[0], id: "future", date: "2026-12-01" },
    { ...store.lessons[0], id: "open", closed: false },
  );
  for (const lesson_id of ["future", "open"])
    store.attendance.push({
      ...store.attendance[0],
      id: lesson_id,
      lesson_id,
      status: "falta",
    });
  store.attendance.push({ ...store.attendance[0], id: "duplicate" });
  const report = studentReport(store, student, "family", "2026-11-14");
  assert.equal(
    report.metrics.find((metric) => metric.label === "Faltas registradas")
      ?.value,
    "0",
  );
  assert.ok(
    JSON.stringify(report).includes("Ainda não há observações individuais"),
  );
  assert.ok(!JSON.stringify(report).includes("Lucas Ferreira"));
  const summary = report.sections.find(
    (section) => section.title === "Resumo de frequência",
  )!;
  assert.deepEqual(summary.rows[0], ["Aulas com chamada registrada", "1"]);
});
test("PDF paginado contém marca e fonte incorporada sem perder o histórico longo", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new Response(
      readFileSync(new URL("../public" + String(input), import.meta.url)),
    );
  try {
    const { store, student } = setup();
    const report = studentReport(store, student, "internal", "2026-11-14");
    report.sections.push({
      title: "Histórico extenso",
      headers: ["Data", "Observação"],
      rows: Array.from({ length: 100 }, (_, i) => [
        "14/11/2026",
        `Observação ${i} · evolução do aluno com evidências registradas.`,
      ]),
    });
    const doc = await createStudentReportPdf(report, "Equipe de teste");
    assert.ok(doc.getNumberOfPages() > 2);
    const finalTable = (
      doc as typeof doc & { lastAutoTable: import("jspdf-autotable").Table }
    ).lastAutoTable;
    assert.equal(finalTable.body.length, 100);
    assert.ok(
      JSON.stringify(finalTable.body.at(-1)!.raw).includes("Observação 99"),
    );
    assert.match(doc.output(), /\/FontFile2/);
    assert.match(doc.output(), /\/Subtype \/Image/);
  } finally {
    globalThis.fetch = original;
  }
});
