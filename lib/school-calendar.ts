import type { Store, Student } from "./domain";
import { scheduleDays, validDate, addDays } from "./course-progress";
export interface CalendarEvent {
  id: string;
  unit_id: string | null;
  class_id: string | null;
  title: string;
  kind: "holiday" | "recess" | "no_class";
  start_date: string;
  end_date: string;
  enabled: boolean;
  source_key?: string | null;
  source_url?: string | null;
  created_at?: string;
  updated_at?: string;
}
export const calendarKinds = {
  holiday: "Feriado",
  recess: "Recesso",
  no_class: "Sem aula",
} as const;
export const nationalHolidays2027 = [
  ["2027-01-01", "Confraternização Universal"],
  ["2027-04-21", "Tiradentes"],
  ["2027-05-01", "Dia Mundial do Trabalho"],
  ["2027-09-07", "Independência do Brasil"],
  ["2027-10-12", "Nossa Senhora Aparecida"],
  ["2027-11-02", "Finados"],
  ["2027-11-15", "Proclamação da República"],
  ["2027-11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
  ["2027-12-25", "Natal"],
] as const;
export const suggestedDates2027 = [
  {
    start: "2027-02-08",
    end: "2027-02-09",
    title: "Carnaval",
    kind: "no_class" as const,
  },
  {
    start: "2027-02-10",
    end: "2027-02-10",
    title: "Quarta-feira de Cinzas",
    kind: "no_class" as const,
  },
  {
    start: "2027-03-26",
    end: "2027-03-26",
    title: "Sexta-feira Santa",
    kind: "holiday" as const,
  },
  {
    start: "2027-05-27",
    end: "2027-05-27",
    title: "Corpus Christi",
    kind: "holiday" as const,
  },
];
export function studentWeekdays(store: Store, student: Student) {
  const group = store.classes.find((c) => c.id === student.class_id);
  const explicit =
    student.enrollment_mode === "individual"
      ? student.individual_days || []
      : group?.lesson_days || [];
  const fallback =
    student.enrollment_mode === "individual"
      ? []
      : scheduleDays((group?.schedule || "").replace(/_/g, " "));
  return [
    ...new Set(
      explicit.length
        ? explicit
        : fallback.length
          ? fallback
          : student.enrollment_mode === "individual"
            ? []
            : scheduleDays((group?.name || "").replace(/_/g, " ")),
    ),
  ]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}
export function eventsForDay(
  events: CalendarEvent[],
  date: string,
  unitId: string,
  classId: string | null,
) {
  return events.filter(
    (event) =>
      event.enabled &&
      (!event.unit_id || event.unit_id === unitId) &&
      (!event.class_id || event.class_id === classId) &&
      event.start_date <= date &&
      event.end_date >= date,
  );
}
export function monthRange(from: string, to: string) {
  const validMonth = (value: string) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 2100;
  if (!validMonth(from) || !validMonth(to) || from > to)
    throw new Error("Confira o mês inicial e o mês final.");
  const first = Number(from.slice(0, 4)) * 12 + Number(from.slice(5)) - 1,
    last = Number(to.slice(0, 4)) * 12 + Number(to.slice(5)) - 1;
  if (last - first >= 24) throw new Error("Selecione até 24 meses por ficha.");
  return Array.from(
    { length: last - first + 1 },
    (_, i) =>
      `${Math.floor((first + i) / 12)}-${String(((first + i) % 12) + 1).padStart(2, "0")}`,
  );
}
export interface SignatureDay {
  date: string;
  month: string;
  closures: CalendarEvent[];
}
export interface SignatureMonth {
  month: string;
  label: string;
  days: SignatureDay[];
}
export function signatureMonths(
  store: Store,
  student: Student,
  from: string,
  to: string,
  excludedDates: readonly string[] = [],
): SignatureMonth[] {
  const excluded = new Set(excludedDates);
  const months = monthRange(from, to),
    days = studentWeekdays(store, student);
  if (!days.length)
    throw new Error(
      "Defina os dias de aula da turma ou da matrícula individual antes de emitir a ficha.",
    );
  return months.map((month) => {
    const year = Number(month.slice(0, 4)),
      monthIndex = Number(month.slice(5)) - 1,
      last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const dates = Array.from(
      { length: last },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ).filter(
      (date) =>
        !excluded.has(date) &&
        days.includes(new Date(date + "T12:00:00Z").getUTCDay()),
    );
    return {
      month,
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(month + "-01T12:00:00Z")),
      days: dates.map((date) => ({
        date,
        month,
        closures: eventsForDay(
          store.calendar_events,
          date,
          student.unit_id,
          student.class_id,
        ),
      })),
    };
  });
}
export type SignatureRow =
  | { kind: "month"; label: string; month: string }
  | { kind: "day"; day: SignatureDay };
export function paginateSignatureMonths(
  months: SignatureMonth[],
  maxHeight: number | ((pageIndex: number) => number),
  height: (row: SignatureRow) => number,
) {
  const pages: SignatureRow[][] = [];
  let current: SignatureRow[] = [],
    used = 0;
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };
  const capacity = () =>
    typeof maxHeight === "number" ? maxHeight : maxHeight(pages.length);
  for (const month of months) {
    const band: SignatureRow = {
      kind: "month",
      label: month.label,
      month: month.month,
    };
    const first = month.days[0];
    if (
      first &&
      used + height(band) + height({ kind: "day", day: first }) > capacity()
    )
      flush();
    current.push(band);
    used += height(band);
    for (const day of month.days) {
      const row: SignatureRow = { kind: "day", day };
      if (used + height(row) > capacity()) {
        flush();
        const continuation: SignatureRow = {
          ...band,
          label: month.label + " (continuação)",
        };
        current.push(continuation);
        used = height(continuation);
      }
      if (used + height(row) > capacity())
        throw new Error(
          "Há muitos motivos sobrepostos em uma data. Resuma os títulos no calendário.",
        );
      current.push(row);
      used += height(row);
    }
  }
  flush();
  return pages;
}
export function calendarEventError(event: CalendarEvent) {
  if (!event.title.trim() || event.title.trim().length > 160)
    return "Informe um motivo de até 160 caracteres.";
  if (
    !validDate(event.start_date) ||
    !validDate(event.end_date) ||
    event.end_date < event.start_date
  )
    return "Confira as datas de início e fim.";
  if (event.end_date > addDays(event.start_date, 731))
    return "Cada período pode ter até dois anos. Divida intervalos maiores.";
  if (event.class_id && !event.unit_id) return "Selecione a unidade da turma.";
  return "";
}

export function scheduleTimeLabel(schedule: string) {
  const values = [
    ...new Set(
      schedule
        .replace(/_/g, " ")
        .match(/\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)/gi) || [],
    ),
  ];
  return values.length === 2 ? values.join(" às ") : values.join(" / ");
}
