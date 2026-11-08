import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { schoolFixture } from "./fixtures/school";
import {
  signatureMonths,
  studentWeekdays,
  monthRange,
  paginateSignatureMonths,
  nationalHolidays2027,
  eventsForDay,
  calendarEventError,
  type CalendarEvent,
} from "../lib/school-calendar";
import { createSignatureSheetPdf } from "../lib/signature-sheet-pdf";
function setup() {
  const store = schoolFixture(),
    student = store.students[0];
  store.classes[0].lesson_days = [2, 4];
  return { store, student };
}
test("ficha usa somente dias da turma, mantém feriado e marca recessos por unidade e turma", () => {
  const { store, student } = setup();
  store.calendar_events.push(
    {
      id: "break",
      unit_id: "u1",
      class_id: "c1",
      title: "Recesso de setembro",
      kind: "recess",
      start_date: "2027-09-09",
      end_date: "2027-09-14",
      enabled: true,
    },
    {
      id: "other",
      unit_id: "u2",
      class_id: null,
      title: "Outra unidade",
      kind: "no_class",
      start_date: "2027-09-01",
      end_date: "2027-09-30",
      enabled: true,
    },
  );
  const month = signatureMonths(store, student, "2027-09", "2027-09")[0];
  assert.equal(month.days.length, 9);
  assert.ok(
    month.days.every((day) =>
      [2, 4].includes(new Date(day.date + "T12:00:00Z").getUTCDay()),
    ),
  );
  assert.equal(
    month.days.find((d) => d.date === "2027-09-07")!.closures[0].title,
    "Independência do Brasil",
  );
  assert.equal(
    month.days.find((d) => d.date === "2027-09-09")!.closures[0].title,
    "Recesso de setembro",
  );
  assert.equal(
    month.days.find((d) => d.date === "2027-09-16")!.closures.length,
    0,
  );
  assert.equal(
    eventsForDay(store.calendar_events, "2027-09-09", "u1", "c2").length,
    0,
  );
  store.calendar_events.find((e) => e.id === "break")!.enabled = false;
  assert.equal(
    signatureMonths(store, student, "2027-09", "2027-09")[0].days.find(
      (d) => d.date === "2027-09-09",
    )!.closures.length,
    0,
  );
});
test("dias antigos por texto e aulas individuais usam agenda correta, inclusive ano bissexto", () => {
  const { store, student } = setup();
  store.classes[0].lesson_days = [];
  store.classes[0].schedule = "Terças e Quintas às 14h";
  assert.deepEqual(studentWeekdays(store, student), [2, 4]);
  student.enrollment_mode = "individual";
  student.class_id = null;
  student.individual_days = [4, 2, 4];
  assert.deepEqual(studentWeekdays(store, student), [2, 4]);
  assert.ok(
    signatureMonths(store, student, "2028-02", "2028-02")[0].days.some(
      (d) => d.date === "2028-02-29",
    ),
  );
  student.individual_days = [];
  assert.throws(
    () => signatureMonths(store, student, "2027-01", "2027-12"),
    /dias de aula/,
  );
  assert.equal(monthRange("2027-01", "2027-12").length, 12);
  assert.equal(monthRange("2027-11", "2028-02").length, 4);
  assert.throws(() => monthRange("2027-12", "2027-01"));
  assert.throws(() => monthRange("2027-01", "2030-01"), /24 meses/);
  assert.equal(nationalHolidays2027.length, 9);
  assert.ok(nationalHolidays2027.some(([date]) => date === "2027-11-20"));
});
test("paginação conserva todas as datas e não deixa mês sem linha no fim da página", () => {
  const { store, student } = setup();
  const months = signatureMonths(store, student, "2027-01", "2027-12");
  const pages = paginateSignatureMonths(months, 180, (row) =>
    row.kind === "month" ? 7 : 13,
  );
  assert.ok(pages.length > 1);
  assert.ok(
    pages.every(
      (page) => page[0].kind === "month" && page.at(-1)!.kind === "day",
    ),
  );
  assert.equal(
    pages.flat().filter((row) => row.kind === "day").length,
    months.flatMap((m) => m.days).length,
  );
  const event: CalendarEvent = {
    id: "x",
    unit_id: "u1",
    class_id: null,
    title: "",
    kind: "recess",
    start_date: "2027-07-20",
    end_date: "2027-07-01",
    enabled: true,
  };
  assert.ok(calendarEventError(event));
});
test("PDF da ficha contém logo, fonte institucional e várias páginas sem perder o calendário anual", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    new Response(
      readFileSync(new URL("../public" + String(input), import.meta.url)),
    );
  try {
    const { store, student } = setup();
    student.guardian = "Responsável da Ficha";
    const doc = await createSignatureSheetPdf({
      store,
      student,
      from: "2027-01",
      to: "2027-12",
    });
    assert.ok(doc.getNumberOfPages() > 1);
    assert.match(doc.output(), /\/Subtype \/Image/);
    assert.match(doc.output(), /\/FontFile2/);
    assert.match(doc.output(), /\/Type \/Page\b/);
  } finally {
    globalThis.fetch = original;
  }
});
