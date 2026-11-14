import test from "node:test";
import assert from "node:assert/strict";
import { schoolFixture } from "./fixtures/school";
import { studentReport } from "../lib/student-report";
import {
  availableStudentReportBlocks,
  selectStudentReportBlocks,
} from "../lib/student-report-selection";

test("seleção remove indicadores e blocos inteiros sem alterar o relatório original", () => {
  const store = schoolFixture();
  const report = studentReport(store, store.students[0], "internal");
  const snapshot = JSON.stringify(report);
  const filtered = selectStudentReportBlocks(report, [
    "identification",
    "pedagogy",
  ]);
  assert.equal(filtered.metrics.length, 0);
  assert.ok(
    filtered.sections.some(
      (section) => section.title === "Identificação e contatos",
    ),
  );
  assert.ok(
    filtered.sections.some(
      (section) =>
        section.title.includes("Aprendizagem") || section.title.includes(" · "),
    ),
  );
  assert.ok(
    !filtered.sections.some(
      (section) => section.title === "Contatos e encaminhamentos da equipe",
    ),
  );
  assert.equal(JSON.stringify(report), snapshot);
  assert.equal(filtered.name, report.name);
  assert.equal(filtered.filename, report.filename);
});
test("seleção familiar não introduz blocos internos e permite remover todos os indicadores", () => {
  const store = schoolFixture();
  const report = studentReport(store, store.students[0], "family");
  const available = availableStudentReportBlocks(report).map(([id]) => id);
  assert.ok(!available.includes("contacts"));
  assert.ok(!available.includes("administration"));
  const selected = selectStudentReportBlocks(report, [
    "contacts",
    "administration",
  ]);
  assert.deepEqual(selected.sections, []);
  assert.deepEqual(selected.metrics, []);
  const all = selectStudentReportBlocks(report, available);
  assert.deepEqual(all.sections, report.sections);
  assert.deepEqual(all.metrics, report.metrics);
});
