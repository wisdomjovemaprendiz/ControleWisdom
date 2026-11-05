import test from "node:test";
import assert from "node:assert/strict";
import { read, utils } from "xlsx";
import { schoolFixture } from "./fixtures/school";
import {
  buildCustomReport,
  type CustomReportOptions,
} from "../lib/custom-reports";
import { createReportExcel } from "../lib/report-excel";
import { classColor, occupancyInfo } from "../lib/class-appearance";
const options: CustomReportOptions = {
  unit: "all",
  classId: "all",
  from: "",
  to: "2026-12-31",
  status: "all",
  includeArchived: false,
  filterEnrollmentDate: false,
};
test("relatório inclui somente campos marcados e respeita a unidade do perfil", () => {
  const store = schoolFixture(),
    profile = store.profiles.find((p) => p.role === "secretaria")!;
  const report = buildCustomReport(
    store,
    profile,
    ["phone", "guardian"],
    options,
  );
  assert.deepEqual(report.headers, ["Telefone do aluno", "Responsável"]);
  assert.equal(
    report.count,
    store.students.filter((s) => s.unit_id === profile.unit_id).length,
  );
  assert.ok(report.rows.every((row) => row.length === 2));
  assert.throws(() => buildCustomReport(store, profile, [], options), /Marque/);
  const outside = buildCustomReport(store, profile, ["name"], {
    ...options,
    unit: store.units.find((u) => u.id !== profile.unit_id)!.id,
  });
  assert.equal(outside.count, 0);
});
test("filtros de turma, matrícula, situação e arquivamento usam o mesmo conjunto exportado", () => {
  const store = schoolFixture(),
    profile = store.profiles[0],
    s = store.students[0];
  s.enrollment_date = "2026-11-03";
  s.archived_at = "2026-11-04T12:00:00Z";
  let report = buildCustomReport(store, profile, ["name"], {
    ...options,
    from: "2026-11-03",
    to: "2026-11-03",
    filterEnrollmentDate: true,
  });
  assert.ok(!report.rows.flat().includes(s.name));
  report = buildCustomReport(store, profile, ["name"], {
    ...options,
    classId: s.class_id!,
    includeArchived: true,
    from: "2026-11-03",
    to: "2026-11-03",
    filterEnrollmentDate: true,
  });
  assert.ok(report.rows.flat().includes(s.name));
  Object.assign(s, { class_id: null, enrollment_mode: "individual" });
  assert.ok(
    buildCustomReport(store, profile, ["class"], {
      ...options,
      classId: "individual",
      includeArchived: true,
    }).rows.every((row) => row[0] === "Aula individual"),
  );
});
for (const format of ["xls", "xlsx"] as const)
  test(`Excel ${format} preserva colunas, telefones, números e texto literal`, async () => {
    const rows = [
      ["=1+1", "0011999999999", 0],
      ["Nome | com: símbolos", "+5511999999999", 12],
    ];
    const bytes = await createReportExcel(
      ["Nome", "Telefone", "Faltas"],
      rows,
      format,
    );
    assert.deepEqual(
      [...bytes.slice(0, format === "xls" ? 4 : 2)],
      format === "xls" ? [0xd0, 0xcf, 0x11, 0xe0] : [0x50, 0x4b],
    );
    const workbook = read(bytes, { type: "array" }),
      sheet = workbook.Sheets.Alunos;
    assert.deepEqual(utils.sheet_to_json(sheet, { header: 1, raw: true }), [
      ["Nome", "Telefone", "Faltas"],
      ...rows,
    ]);
    assert.equal(sheet.A2.f, undefined);
    assert.equal(sheet.A2.t, "s");
  });
test("Excel antigo sinaliza limite sem truncar alunos", async () => {
  await assert.rejects(
    createReportExcel(["Nome"], Array(65536).fill(["Aluno"]), "xls"),
    /65.535/,
  );
});
test("cores de identidade são fixas e a barra diferencia as faixas de ocupação", () => {
  assert.equal(classColor({ id: "turma", color: "#123456" }), "#123456");
  assert.equal(classColor({ id: "turma" }), classColor({ id: "turma" }));
  assert.deepEqual(
    [
      occupancyInfo(0, 20).tone,
      occupancyInfo(8, 20).tone,
      occupancyInfo(14, 20).tone,
      occupancyInfo(18, 20).tone,
    ],
    ["low", "moderate", "balanced", "near-full"],
  );
  assert.equal(occupancyInfo(20, 20).label, "Lotada");
  assert.equal(occupancyInfo(21, 20).available, 0);
});
